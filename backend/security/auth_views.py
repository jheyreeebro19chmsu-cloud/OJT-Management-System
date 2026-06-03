"""Authentication and registration views for OJT system."""
import json
import os
import urllib.request
import qrcode
import io
import logging
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
    UserRole, Student, OJTInstructor, HTE, OTPVerification, TraineeOTPRequest
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
            HTE.objects.create(
                user=user,
                company_name=data.get('company_name', ''),
                company_address=data.get('company_address', ''),
                barangay=data.get('barangay', '').strip(),
                contact_person=data.get('contact_person', ''),
                contact_phone=data.get('contact_phone', ''),
            )
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
        # Attempt to include avatar URL in profile data (prefer FaceRegistration.image)
        avatar_url = None
        try:
            from .models import FaceRegistration
            fr = FaceRegistration.objects.filter(user=user).first()
            if fr and fr.image:
                avatar_url = fr.image.url
        except Exception:
            avatar_url = None

        # Fallback: try to find avatar_url from TraineeOTPRequest (legacy) or related fields
        if not avatar_url:
            try:
                from .models import TraineeOTPRequest
                otp_req = TraineeOTPRequest.objects.filter(email=user.email).order_by('-requested_at').first()
                if otp_req and getattr(otp_req, 'avatar_url', None):
                    avatar_url = otp_req.avatar_url
            except Exception:
                pass

        if avatar_url:
            profile_data['avatar'] = avatar_url

        return JsonResponse({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)}, 'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': role, **profile_data}})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ======================= NEW OTP REGISTRATION ENDPOINTS =======================

def send_otp_to_instructor(instructor_email: str, trainee_email: str, otp_code: str, trainee_name: str, company_name: str) -> bool:
    """Send OTP notification to OJT Instructor."""
    try:
        subject = "OJT System - New Trainee Registration Request"
        message = f"""Hello Instructor,

A new trainee has requested to register in the OJT system.

Trainee Details:
- Name: {trainee_name}
- Email: {trainee_email}
- Company: {company_name}
- OTP Code: {otp_code}

Please review this request in your pending requests dashboard. Once approved, the trainee will receive this OTP code to proceed with facial recognition and complete registration.

Best regards,
OJT Management System"""
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [instructor_email], fail_silently=False)
        return True
    except Exception as e:
        print(f"Error sending instructor notification: {e}")
        return False


@csrf_exempt
@require_http_methods(["POST"])
def request_trainee_otp_registration(request: HttpRequest) -> JsonResponse:
    """Request OTP registration for trainee or HTE. Sends OTP to instructor."""
    from .models import TraineeOTPRequest
    from django.utils import timezone
    
    try:
        data = json.loads(request.body)
        
        # Validate required fields
        required_fields = ['email', 'first_name', 'last_name', 'role', 'instructor_id']
        if not all(field in data for field in required_fields):
            return JsonResponse({'error': 'Missing required fields'}, status=400)
        
        email = data.get('email', '').strip()
        role = data.get('role', '').strip()
        instructor_id = data.get('instructor_id')
        
        # Check if email already registered
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        
        # Check if already has pending request
        if TraineeOTPRequest.objects.filter(email=email, status='pending').exists():
            return JsonResponse({'error': 'Registration request already pending'}, status=400)
        
        # Get instructor
        try:
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)
        
        # Validate GPS coordinates if provided
        gps_lat = data.get('gps_latitude')
        gps_lng = data.get('gps_longitude')
        logger = logging.getLogger(__name__)
        if gps_lat is not None:
            try:
                latv = float(gps_lat)
            except Exception:
                logger.warning('Invalid gps_latitude format for request: %s', gps_lat)
                return JsonResponse({'error': 'Invalid gps_latitude'}, status=400)
            if not (-90.0 <= latv <= 90.0):
                logger.warning('gps_latitude out of bounds: %s', latv)
                return JsonResponse({'error': 'gps_latitude out of bounds'}, status=400)
        if gps_lng is not None:
            try:
                lngv = float(gps_lng)
            except Exception:
                logger.warning('Invalid gps_longitude format for request: %s', gps_lng)
                return JsonResponse({'error': 'Invalid gps_longitude'}, status=400)
            if not (-180.0 <= lngv <= 180.0):
                logger.warning('gps_longitude out of bounds: %s', lngv)
                return JsonResponse({'error': 'gps_longitude out of bounds'}, status=400)

        # Generate OTP
        otp_code = OTPVerification.generate_otp()
        
        # Create TraineeOTPRequest
        request_data = {
            'role': role,
            'email': email,
            'first_name': data.get('first_name', '').strip(),
            'last_name': data.get('last_name', '').strip(),
            'full_name': f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            'age': data.get('age'),
            'address': data.get('address', '').strip(),
            'otp_code': otp_code,
            'otp_sent_at': timezone.now(),
            'instructor': instructor,
            'gps_latitude': data.get('gps_latitude'),
            'gps_longitude': data.get('gps_longitude'),
        }
        
        # Add role-specific fields
        if role == 'trainee':
            request_data.update({
                'school_name': data.get('school_name', '').strip(),
                'course': data.get('course', '').strip(),
                'year_level': data.get('year_level', '').strip(),
                'company_name': data.get('company_name', '').strip(),
                'company_address': data.get('company_address', '').strip(),
                'barangay': data.get('barangay', '').strip(),
            })
        elif role == 'hte':
            request_data.update({
                'company_name': data.get('company_name', '').strip(),
                'company_address': data.get('company_address', '').strip(),
                'barangay': data.get('barangay', '').strip(),
                'contact_person': data.get('contact_person', '').strip(),
                'contact_phone': data.get('contact_phone', '').strip(),
            })
        
        otp_request = TraineeOTPRequest.objects.create(**request_data)
        
        # Send OTP to instructor
        send_otp_to_instructor(
            instructor.user.email,
            email,
            otp_code,
            otp_request.full_name,
            otp_request.company_name
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Registration request sent to instructor. Waiting for approval.',
            'request_id': otp_request.id,
            'expires_in_minutes': 30
        }, status=201)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def get_pending_trainee_requests(request: HttpRequest) -> JsonResponse:
    """Get pending trainee registration requests for an instructor."""
    from .models import TraineeOTPRequest
    try:
        # Get instructor from query params or auth header
        instructor_id = request.GET.get('instructor_id')
        if not instructor_id:
            return JsonResponse({'error': 'instructor_id required'}, status=400)

        try:
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)

        # Load configured geofence zones
        from .utils import find_nearest_zone, safe_float
        zones = getattr(settings, 'DEFAULT_GEOFENCE_ZONES', []) or []
        active_zones = [z for z in zones if z.get('active', True)]

        # Get pending requests and attach nearest zone info when GPS provided
        pending_qs = TraineeOTPRequest.objects.filter(instructor=instructor, status='pending')
        results = []
        for p in pending_qs:
            item = {
                'id': p.id,
                'role': p.role,
                'email': p.email,
                'full_name': p.full_name,
                'company_name': p.company_name,
                'otp_code': p.otp_code,
                'requested_at': p.requested_at.isoformat() if p.requested_at else None,
                'course': p.course,
                'school_name': p.school_name,
                'gps_latitude': p.gps_latitude,
                'gps_longitude': p.gps_longitude,
                'company_address': p.company_address,
                'avatar_url': p.avatar.url if getattr(p, 'avatar', None) else None,
                'face_registered': bool(p.face_registered_at),
                'face_registered_at': p.face_registered_at.isoformat() if p.face_registered_at else None,
            }

            # If GPS present, compute nearest geofence zone and attach its metadata
            try:
                if p.gps_latitude is not None and p.gps_longitude is not None and active_zones:
                    lat_f = float(p.gps_latitude)
                    lng_f = float(p.gps_longitude)
                    nearest_zone, nearest_distance = find_nearest_zone(lat_f, lng_f, active_zones)
                    if nearest_zone:
                        zone_info = {
                            'name': nearest_zone.get('name'),
                            'lat': safe_float(nearest_zone.get('lat')),
                            'lng': safe_float(nearest_zone.get('lng')),
                            'radius': safe_float(nearest_zone.get('radius')),
                        }
                        item['zone'] = zone_info
                    else:
                        item['zone'] = None
                else:
                    item['zone'] = None
            except Exception:
                item['zone'] = None

            results.append(item)

        return JsonResponse({'success': True, 'requests': results})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def approve_trainee_registration(request: HttpRequest) -> JsonResponse:
    """Instructor approves trainee registration and sends OTP to trainee."""
    from .models import TraineeOTPRequest
    from django.utils import timezone
    
    try:
        data = json.loads(request.body)
        request_id = data.get('request_id')
        
        if not request_id:
            return JsonResponse({'error': 'request_id required'}, status=400)
        
        try:
            otp_request = TraineeOTPRequest.objects.get(id=request_id, status='pending')
        except TraineeOTPRequest.DoesNotExist:
            return JsonResponse({'error': 'Request not found or already processed'}, status=404)
        
        # Mark as approved
        otp_request.status = 'approved'
        otp_request.approved_at = timezone.now()
        otp_request.save()
        
        # Send OTP to trainee email
        subject = "OJT System - Registration OTP Code"
        message = f"""Hello {otp_request.full_name},

Your registration request has been approved!

Your OTP code is: {otp_request.otp_code}

Steps to complete registration:
1. Enter this OTP code in the mobile app
2. Complete facial recognition
3. Finish registration

This OTP will expire in 30 minutes.

Best regards,
OJT Management System"""
        
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [otp_request.email], fail_silently=False)
        
        return JsonResponse({
            'success': True,
            'message': 'Registration approved. OTP sent to trainee.',
            'otp_code': otp_request.otp_code
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reject_trainee_registration(request: HttpRequest) -> JsonResponse:
    """Instructor rejects trainee registration."""
    from .models import TraineeOTPRequest
    from django.utils import timezone
    
    try:
        data = json.loads(request.body)
        request_id = data.get('request_id')
        reason = data.get('reason', '').strip()
        
        if not request_id:
            return JsonResponse({'error': 'request_id required'}, status=400)
        
        try:
            otp_request = TraineeOTPRequest.objects.get(id=request_id, status='pending')
        except TraineeOTPRequest.DoesNotExist:
            return JsonResponse({'error': 'Request not found or already processed'}, status=404)
        
        # Mark as rejected
        otp_request.status = 'rejected'
        otp_request.rejection_reason = reason
        otp_request.save()
        
        # Send rejection email to trainee
        subject = "OJT System - Registration Request Rejected"
        message = f"""Hello {otp_request.full_name},

Unfortunately, your registration request has been rejected.

Reason: {reason or 'No reason provided'}

Please contact your instructor for more information.

Best regards,
OJT Management System"""
        
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [otp_request.email], fail_silently=False)
        
        return JsonResponse({'success': True, 'message': 'Registration rejected.'})
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def submit_face_recognition(request: HttpRequest) -> JsonResponse:
    """Submit face photo and recognition data."""
    from .models import TraineeOTPRequest
    from django.utils import timezone
    
    try:
        request_id = request.POST.get('request_id')
        otp_code = request.POST.get('otp_code', '').strip()
        face_data = request.POST.get('face_data', '')
        avatar = request.FILES.get('avatar')
        
        if not all([request_id, otp_code]):
            return JsonResponse({'error': 'Missing required fields'}, status=400)
        
        try:
            otp_request = TraineeOTPRequest.objects.get(id=request_id)
        except TraineeOTPRequest.DoesNotExist:
            return JsonResponse({'error': 'Request not found'}, status=404)
        
        # Verify OTP
        if otp_request.otp_code != otp_code:
            return JsonResponse({'error': 'Invalid OTP code'}, status=400)
        
        if otp_request.status != 'approved':
            return JsonResponse({'error': 'Request not approved'}, status=400)
        
        # Save face data and avatar
        if avatar:
            otp_request.avatar = avatar
        otp_request.face_data = face_data
        otp_request.face_registered_at = timezone.now()
        otp_request.save()

        # Try to synchronously generate a thumbnail and ensure avatar/thumbnail URLs are available
        avatar_url = None
        thumbnail_url = None
        try:
            from django.core.files.storage import default_storage
            from django.core.files.base import ContentFile
            try:
                # Avatar URL (prefer explicit field if set)
                if getattr(otp_request, 'avatar_url', None):
                    avatar_url = otp_request.avatar_url
                else:
                    try:
                        avatar_url = otp_request.avatar.url if otp_request.avatar else None
                    except Exception:
                        avatar_url = None

                # Generate thumbnail immediately if avatar present and thumbnail not already set
                thumb_key = getattr(otp_request, 'thumbnail_key', None)
                if not thumb_key and otp_request.avatar and getattr(otp_request.avatar, 'name', None):
                    try:
                        # Create thumbnail using Pillow
                        from PIL import Image
                        base_name = os.path.basename(otp_request.avatar.name)
                        base, _ = os.path.splitext(base_name)
                        thumb_name = f"avatars/thumbnails/{base}_thumb.jpg"

                        # Open avatar from storage
                        with default_storage.open(otp_request.avatar.name, 'rb') as f:
                            img = Image.open(f)
                            img = img.convert('RGB')
                            img.thumbnail((256, 256))
                            buf = io.BytesIO()
                            img.save(buf, format='JPEG', quality=85)
                            buf.seek(0)
                            # Save thumbnail to storage
                            if default_storage.exists(thumb_name):
                                default_storage.delete(thumb_name)
                            saved_key = default_storage.save(thumb_name, ContentFile(buf.read()))
                            otp_request.thumbnail_key = saved_key
                            otp_request.avatar_url = avatar_url or (default_storage.url(otp_request.avatar.name) if otp_request.avatar else '')
                            otp_request.save()
                            thumbnail_url = default_storage.url(saved_key)
                    except Exception:
                        # thumbnail generation failed; proceed without thumbnail
                        thumbnail_url = None
                else:
                    # If thumbnail_key already present, try to build URL
                    if thumb_key:
                        try:
                            thumbnail_url = default_storage.url(thumb_key)
                        except Exception:
                            thumbnail_url = None

                # Ensure avatar_url is filled from storage if still None
                if not avatar_url and otp_request.avatar and getattr(otp_request.avatar, 'name', None):
                    try:
                        avatar_url = default_storage.url(otp_request.avatar.name)
                        otp_request.avatar_url = avatar_url
                        otp_request.save()
                    except Exception:
                        avatar_url = None
            except Exception:
                avatar_url = getattr(otp_request, 'avatar_url', None) or None
                thumbnail_url = None
        except Exception:
            avatar_url = getattr(otp_request, 'avatar_url', None) or None
            thumbnail_url = None

        return JsonResponse({
            'success': True,
            'message': 'Face recognition data received. Ready for registration completion.',
            'request_id': otp_request.id,
            'avatar_url': avatar_url,
            'thumbnail_url': thumbnail_url,
            'face_registered': True,
        })
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def complete_trainee_registration(request: HttpRequest) -> JsonResponse:
    """Complete trainee registration after OTP approval and face recognition."""
    from .models import TraineeOTPRequest
    from django.utils import timezone
    
    try:
        data = json.loads(request.body)
        request_id = data.get('request_id')
        password = data.get('password', '').strip()
        
        if not all([request_id, password]):
            return JsonResponse({'error': 'Missing required fields'}, status=400)
        
        try:
            otp_request = TraineeOTPRequest.objects.get(id=request_id)
        except TraineeOTPRequest.DoesNotExist:
            return JsonResponse({'error': 'Request not found'}, status=404)
        
        # Verify status
        if otp_request.status != 'approved':
            return JsonResponse({'error': 'Request must be approved first'}, status=400)
        
        if not otp_request.face_registered_at:
            return JsonResponse({'error': 'Face recognition required'}, status=400)
        
        # Check email not already registered
        if User.objects.filter(email=otp_request.email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        
        # Create user account
        with transaction.atomic():
            user = User.objects.create_user(
                username=otp_request.email,
                email=otp_request.email,
                password=password,
                first_name=otp_request.first_name,
                last_name=otp_request.last_name
            )
            
            UserRole.objects.create(user=user, role=otp_request.role, is_verified=True)
            
            if otp_request.role == 'trainee':
                Student.objects.create(
                    user=user,
                    age=otp_request.age,
                    address=otp_request.address,
                    school=otp_request.school_name,
                    year_level=otp_request.year_level
                )
            elif otp_request.role == 'hte':
                HTE.objects.create(
                    user=user,
                    company_name=otp_request.company_name,
                    company_address=otp_request.company_address,
                    barangay=otp_request.barangay,
                    contact_person=otp_request.contact_person,
                    contact_phone=otp_request.contact_phone
                )
            
            # Mark OTP request as completed
            otp_request.status = 'completed'
            otp_request.completed_at = timezone.now()
            otp_request.save()

            # Promote avatar to FaceRegistration (if avatar present)
            try:
                from .models import FaceRegistration
                from django.core.files.storage import default_storage
                import os

                if getattr(otp_request, 'avatar', None) and getattr(otp_request.avatar, 'name', None):
                    avatar_path = otp_request.avatar.name
                    # Read avatar content from storage and save to FaceRegistration.image
                    try:
                        with default_storage.open(avatar_path, 'rb') as af:
                            content = ContentFile(af.read())
                            emp_id = f"emp_{user.id}"
                            fr, created = FaceRegistration.objects.get_or_create(user=user, defaults={'employee_id': emp_id})
                            # Save image using the same filename
                            fr.image.save(os.path.basename(avatar_path), content, save=True)
                            fr.face_registered = True
                            fr.save()
                            # Mark otp_request face_registered flag
                            TraineeOTPRequest.objects.filter(pk=otp_request.pk).update(face_registered=True)
                    except Exception as e:
                        logging.exception('Failed to copy avatar to FaceRegistration: %s', e)
            except Exception:
                # If FaceRegistration model not present or error occurs, continue without failing registration
                logging.exception('Error while promoting avatar to face registration')
        
        # Send confirmation email
        send_confirmation_email(otp_request.email, otp_request.full_name)
        
        # Return login credentials
        refresh = RefreshToken.for_user(user)
        # Determine avatar URL to return (prefer FaceRegistration.image if available)
        avatar_url = None
        try:
            from .models import FaceRegistration
            fr = FaceRegistration.objects.filter(user=user).first()
            if fr and fr.image:
                avatar_url = fr.image.url
        except Exception:
            pass
        if not avatar_url:
            try:
                avatar_url = otp_request.avatar_url or (otp_request.avatar.url if otp_request.avatar else None)
            except Exception:
                avatar_url = None

        return JsonResponse({
            'success': True,
            'message': 'Registration completed successfully!',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.get_full_name(),
                'role': otp_request.role,
                'avatar': avatar_url,
                'company': otp_request.company_name
            }
        }, status=201)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def get_instructor_by_email(request: HttpRequest) -> JsonResponse:
    """Get instructor details by email."""
    try:
        email = request.GET.get('email', '').strip()
        if not email:
            return JsonResponse({'error': 'email required'}, status=400)
        
        try:
            user = User.objects.get(email=email)
            instructor = OJTInstructor.objects.get(user=user)
            return JsonResponse({
                'success': True,
                'instructor': {
                    'id': instructor.id,
                    'email': user.email,
                    'name': user.get_full_name(),
                    'course': instructor.course,
                    'department': instructor.department,
                }
            })
        except (User.DoesNotExist, OJTInstructor.DoesNotExist):
            return JsonResponse({'error': 'Instructor not found'}, status=404)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def generate_instructor_otp(request: HttpRequest) -> JsonResponse:
    """Generate a one-time enrollment OTP for an instructor to share with trainees."""
    try:
        data = json.loads(request.body or b"{}")
        instructor_id = data.get('instructor_id')
        if not instructor_id:
            return JsonResponse({'error': 'instructor_id required'}, status=400)

        try:
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)

        # Use OTPVerification model to create a 6-digit code tied to instructor email
        otp = OTPVerification.create_otp(instructor.user.email)
        # Extend expiry for enrollment OTP (30 minutes)
        from django.utils import timezone
        otp.expires_at = timezone.now() + timezone.timedelta(minutes=30)
        otp.save()

        return JsonResponse({'success': True, 'otp_code': otp.otp_code, 'expires_in_minutes': 30})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def list_instructor_otps(request: HttpRequest) -> JsonResponse:
    """List recent OTPs generated for an instructor (by instructor_id query param)."""
    try:
        instructor_id = request.GET.get('instructor_id')
        if not instructor_id:
            return JsonResponse({'error': 'instructor_id required'}, status=400)
        try:
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)

        otps = OTPVerification.objects.filter(email=instructor.user.email).order_by('-created_at')[:20]
        data = [
            {
                'otp_code': o.otp_code,
                'created_at': o.created_at.isoformat(),
                'expires_at': o.expires_at.isoformat(),
                'is_verified': o.is_verified,
            }
            for o in otps
        ]
        return JsonResponse({'success': True, 'otps': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def revoke_instructor_otp(request: HttpRequest) -> JsonResponse:
    """Revoke (delete) an OTP by code for an instructor."""
    try:
        data = json.loads(request.body or b"{}")
        instructor_id = data.get('instructor_id')
        otp_code = data.get('otp_code')
        if not instructor_id or not otp_code:
            return JsonResponse({'error': 'instructor_id and otp_code required'}, status=400)
        try:
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)

        deleted, _ = OTPVerification.objects.filter(email=instructor.user.email, otp_code=otp_code).delete()
        if deleted:
            return JsonResponse({'success': True, 'message': 'OTP revoked'})
        return JsonResponse({'error': 'OTP not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def check_registration_status(request: HttpRequest) -> JsonResponse:
    """Check status of a registration request."""
    from .models import TraineeOTPRequest
    
    try:
        request_id = request.GET.get('request_id')
        if not request_id:
            return JsonResponse({'error': 'request_id required'}, status=400)
        
        try:
            otp_req = TraineeOTPRequest.objects.get(id=request_id)
            return JsonResponse({
                'success': True,
                'status': otp_req.status,
                'request': {
                    'id': otp_req.id,
                    'status': otp_req.status,
                    'email': otp_req.email,
                    'full_name': otp_req.full_name,
                    'approved_at': otp_req.approved_at.isoformat() if otp_req.approved_at else None,
                }
            })
        except TraineeOTPRequest.DoesNotExist:
            return JsonResponse({'error': 'Request not found'}, status=404)
    
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def supabase_exchange(request: HttpRequest) -> JsonResponse:
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


@csrf_exempt
@require_http_methods(["POST"])
def check_email(request: HttpRequest) -> JsonResponse:
    """Check whether an email address is already registered in Django users or role profiles."""
    try:
        data = json.loads(request.body or b"{}")
        email = data.get('email', '').strip()
        if not email:
            return JsonResponse({'error': 'email required'}, status=400)
        exists = User.objects.filter(email__iexact=email).exists()
        # Also check related profile tables for safety
        try:
            from .models import Student, OJTInstructor, HTE
            if not exists:
                # check if any profile references a user with this email
                exists = Student.objects.filter(user__email__iexact=email).exists() or OJTInstructor.objects.filter(user__email__iexact=email).exists() or HTE.objects.filter(user__email__iexact=email).exists()
        except Exception:
            pass
        return JsonResponse({'exists': bool(exists)})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
