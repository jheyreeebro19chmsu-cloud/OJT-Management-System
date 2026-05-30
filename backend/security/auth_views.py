"""Authentication and registration views for OJT system."""
import json
import qrcode
import io
from django.conf import settings
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.files.base import ContentFile
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    UserRole, Student, OJTInstructor, HTE, OTPVerification
)
import requests

def send_verification_email(email: str, otp_code: str, full_name: str = "User") -> bool:
    """Send OTP verification email."""
    try:
        subject = "OJT System - Email Verification"
        message = f"Hello {full_name},\n\nYour OTP verification code is: {otp_code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nOJT Management System"
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_confirmation_email(email: str, full_name: str = "User") -> bool:
    """Send registration confirmation email."""
    try:
        subject = "OJT System - Registration Successful"
        message = f"Hello {full_name},\n\nYour registration has been successful!\n\nBest regards,\nOJT Management System"
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

@csrf_exempt
@require_http_methods(["POST"])
def request_otp(request: HttpRequest) -> JsonResponse:
    """Request OTP for verification."""
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        full_name = data.get('full_name', 'User')
        if not email:
            return JsonResponse({'error': 'Email is required'}, status=400)
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        otp = OTPVerification.create_otp(email)
        if send_verification_email(email, otp.otp_code, full_name):
            return JsonResponse({'success': True, 'message': 'OTP sent to email', 'expires_in_minutes': 10})
        return JsonResponse({'error': 'Failed to send OTP email'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def verify_otp(request: HttpRequest) -> JsonResponse:
    """Verify OTP code."""
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        otp_code = data.get('otp_code', '').strip()
        if not email or not otp_code:
            return JsonResponse({'error': 'Email and OTP code required'}, status=400)
        otp = OTPVerification.objects.filter(email=email).order_by('-created_at').first()
        if not otp or not otp.is_valid() or otp.otp_code != otp_code:
            return JsonResponse({'error': 'Invalid or expired OTP'}, status=400)
        otp.is_verified = True
        otp.save()
        return JsonResponse({'success': True, 'message': 'OTP verified successfully'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def register_student(request: HttpRequest) -> JsonResponse:
    """Register a new student."""
    try:
        data = json.loads(request.body)
        email, password = data.get('email', '').strip(), data.get('password', '').strip()
        first_name, last_name = data.get('first_name', '').strip(), data.get('last_name', '').strip()
        if not all([email, password, first_name, last_name]):
            return JsonResponse({'error': 'Required fields missing'}, status=400)
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        if not OTPVerification.objects.filter(email=email, is_verified=True).exists():
            return JsonResponse({'error': 'Email not verified'}, status=400)
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password, first_name=first_name, last_name=last_name)
            UserRole.objects.create(user=user, role='student', is_verified=True)
            Student.objects.create(user=user, age=data.get('age'), address=data.get('address', '').strip())
        send_confirmation_email(email, f"{first_name} {last_name}")
        refresh = RefreshToken.for_user(user)
        return JsonResponse({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': 'student'}}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def register_instructor(request: HttpRequest) -> JsonResponse:
    """Register a new OJT instructor."""
    try:
        data = json.loads(request.body)
        email, password = data.get('email', '').strip(), data.get('password', '').strip()
        first_name, last_name = data.get('first_name', '').strip(), data.get('last_name', '').strip()
        if not all([email, password, first_name, last_name]):
            return JsonResponse({'error': 'Required fields missing'}, status=400)
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        if not OTPVerification.objects.filter(email=email, is_verified=True).exists():
            return JsonResponse({'error': 'Email not verified'}, status=400)
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password, first_name=first_name, last_name=last_name)
            UserRole.objects.create(user=user, role='instructor', is_verified=True)
            instructor = OJTInstructor.objects.create(user=user, course=data.get('course', ''), department=data.get('department', ''), institution=data.get('institution', ''))
            qr_data = f"instructor_{instructor.id}_{instructor.user.email}"
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            img_io = io.BytesIO()
            qr.make_image().save(img_io, format='PNG')
            img_io.seek(0)
            instructor.qr_code = qr_data
            instructor.qr_code_image.save(f'qr_{instructor.id}.png', ContentFile(img_io.read()), save=True)
        send_confirmation_email(email, f"{first_name} {last_name}")
        refresh = RefreshToken.for_user(user)
        return JsonResponse({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': 'instructor'}, 'qr_code_url': instructor.qr_code_image.url}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def register_hte(request: HttpRequest) -> JsonResponse:
    """Register a new HTE."""
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip()
        if not email or User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Invalid or duplicate email'}, status=400)
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=User.objects.make_random_password(), first_name=data.get('first_name', ''), last_name=data.get('last_name', ''))
            UserRole.objects.create(user=user, role='hte', is_verified=True)
            HTE.objects.create(user=user, company_name=data.get('company_name', ''), company_address=data.get('company_address', ''), contact_person=data.get('contact_person', ''), contact_phone=data.get('contact_phone', ''))
        refresh = RefreshToken.for_user(user)
        return JsonResponse({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': 'hte'}}, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def login(request: HttpRequest) -> JsonResponse:
    """Login user."""
    try:
        data = json.loads(request.body)
        email, password = data.get('email', '').strip(), data.get('password', '').strip()
        user = User.objects.filter(email=email).first()
        if not user or not user.check_password(password):
            return JsonResponse({'error': 'Invalid credentials'}, status=401)
        role_obj = UserRole.objects.filter(user=user).first()
        role = role_obj.role if role_obj else 'student'
        refresh = RefreshToken.for_user(user)
        profile_data = {}
        if role == 'student':
            p = Student.objects.filter(user=user).first()
            if p: profile_data = {'age': p.age}
        elif role == 'instructor':
            p = OJTInstructor.objects.filter(user=user).first()
            if p: profile_data = {'course': p.course, 'qr_code_url': p.qr_code_image.url if p.qr_code_image else None}
        elif role == 'hte':
            p = HTE.objects.filter(user=user).first()
            if p: profile_data = {'company_name': p.company_name}
        return JsonResponse({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': role, **profile_data}})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def supabase_exchange(request: HttpRequest) -> JsonResponse:
    """Exchange a Supabase access token for a Django JWT access/refresh pair.

    Expects JSON body: {"access_token": "..."}
    This endpoint calls the Supabase `/auth/v1/user` endpoint with the provided
    access token to validate and fetch the user's email. If email found, it will
    get-or-create a Django User and return Refresh/Access tokens.
    """
    try:
        data = json.loads(request.body or b"{}")
        sup_token = data.get('access_token') or data.get('accessToken')
        if not sup_token:
            return JsonResponse({'error': 'access_token required'}, status=400)

        # Determine Supabase URL from settings or env
        supabase_url = getattr(settings, 'SUPABASE_URL', None) or getattr(settings, 'VITE_SUPABASE_URL', None) or None
        if not supabase_url:
            return JsonResponse({'error': 'Supabase URL not configured on server'}, status=500)

        userinfo_url = supabase_url.rstrip('/') + '/auth/v1/user'
        req = urllib.request.Request(userinfo_url, headers={'Authorization': f'Bearer {sup_token}'})
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = resp.read()
            info = json.loads(body.decode('utf-8'))

        email = info.get('email')
        if not email:
            return JsonResponse({'error': 'Could not determine email from Supabase token'}, status=400)

        # Ensure user exists in Django
        user, created = User.objects.get_or_create(username=email, defaults={'email': email, 'first_name': info.get('user_metadata', {}).get('first_name', ''), 'last_name': info.get('user_metadata', {}).get('last_name', '')})

        # Create default role/student profile if missing
        from .models import UserRole, Student, OJTInstructor, HTE
        role_row = UserRole.objects.filter(user=user).first()
        role = role_row.role if role_row else 'student'

        # If no role row, create a student record by default for sync
        if not role_row:
            UserRole.objects.create(user=user, role='student', is_verified=True)
            if not Student.objects.filter(user=user).exists():
                Student.objects.create(user=user)

        refresh = RefreshToken.for_user(user)
        profile_data = {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': role}
        return JsonResponse({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': profile_data})
    except urllib.error.HTTPError as he:
        try:
            body = he.read().decode('utf-8')
        except Exception:
            body = str(he)
        return JsonResponse({'error': 'supabase_token_invalid', 'detail': body}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reset_password(request: HttpRequest) -> JsonResponse:
    """Reset a user's password in Django and Supabase (if configured).

    Expects JSON: {"email": "...", "new_password": "..."}
    """
    try:
        data = json.loads(request.body or b"{}")
        email = data.get('email', '').strip()
        new_password = data.get('new_password', '').strip()
        if not email or not new_password:
            return JsonResponse({'error': 'email and new_password required'}, status=400)

        user = User.objects.filter(email=email).first()
        if not user:
            return JsonResponse({'error': 'User not found'}, status=404)

        # Update Django password
        user.set_password(new_password)
        user.save()

        # Optionally update Supabase via service role key
        supabase_url = getattr(settings, 'SUPABASE_URL', None) or getattr(settings, 'VITE_SUPABASE_URL', None) or None
        supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('VITE_SUPABASE_SERVICE_ROLE_KEY')
        sup_response = None
        if supabase_url and supabase_key:
            try:
                # Find Supabase user by email
                users_url = supabase_url.rstrip('/') + '/auth/v1/admin/users'
                headers = {'Authorization': f'Bearer {supabase_key}', 'apikey': supabase_key, 'Content-Type': 'application/json'}
                params = {'email': email}
                r = requests.get(users_url, headers=headers, params=params, timeout=6)
                if r.status_code == 200:
                    users = r.json()
                    # Supabase returns a list; pick first match
                    if isinstance(users, list) and users:
                        sup_user = users[0]
                        sup_id = sup_user.get('id')
                        if sup_id:
                            patch_url = f"{users_url}/{sup_id}"
                            pr = requests.patch(patch_url, headers=headers, json={'password': new_password}, timeout=6)
                            sup_response = {'status': pr.status_code, 'body': pr.text}
                else:
                    sup_response = {'status': r.status_code, 'body': r.text}
            except Exception as e:
                sup_response = {'error': str(e)}

        return JsonResponse({'success': True, 'supabase': sup_response})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
