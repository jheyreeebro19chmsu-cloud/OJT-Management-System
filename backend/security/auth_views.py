"""Authentication and registration views for OJT system."""
import json
import qrcode
import io
from datetime import timedelta
from typing import Any, Dict

from django.conf import settings
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.mail import send_mail
from django.core.files.base import ContentFile
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.tokens import RefreshToken
from .api_auth import require_jwt

from .models import (
    UserRole, Student, OJTInstructor, HTE, OTPVerification,
    StudentOJTApplication, TimeRecord, Announcement, Task,
    StudentTask, HTEAccessRequest
)


def send_verification_email(email: str, otp_code: str, full_name: str = "User") -> bool:
    """Send OTP verification email."""
    try:
        subject = "OJT System - Email Verification"
        message = f"""
Hello {full_name},

Your OTP verification code is: {otp_code}

This code will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
OJT Management System
        """
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_confirmation_email(email: str, full_name: str = "User") -> bool:
    """Send registration confirmation email."""
    try:
        subject = "OJT System - Registration Successful"
        message = f"""
Hello {full_name},

Your registration has been successful!

You can now login to the OJT Management System using your credentials.

Best regards,
OJT Management System
        """
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_application_status_email(email: str, student_name: str, status: str, company_name: str = "") -> bool:
    """Send application status update email."""
    try:
        subject = f"OJT Application {status.capitalize()}"
        message = f"""
Hello {student_name},

Your OJT application has been {status}.

{"Company: " + company_name if company_name else ""}

For more details, please log in to your dashboard.

Best regards,
OJT Management System
        """
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
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
        
        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        
        # Create OTP
        otp = OTPVerification.create_otp(email)
        
        # Send email
        email_sent = send_verification_email(email, otp.otp_code, full_name)
        
        if not email_sent:
            return JsonResponse({'error': 'Failed to send OTP email'}, status=500)
        
        return JsonResponse({
            'success': True,
            'message': 'OTP sent to email',
            'expires_in_minutes': 10
        })
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
        
        # Find OTP
        otp = OTPVerification.objects.filter(email=email).order_by('-created_at').first()
        
        if not otp:
            return JsonResponse({'error': 'No OTP found for this email'}, status=404)
        
        if not otp.is_valid():
            return JsonResponse({'error': 'OTP expired or already verified'}, status=400)
        
        if otp.otp_code != otp_code:
            return JsonResponse({'error': 'Invalid OTP code'}, status=400)
        
        otp.is_verified = True
        otp.save()
        
        return JsonResponse({
            'success': True,
            'message': 'OTP verified successfully'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def register_student(request: HttpRequest) -> JsonResponse:
    """Register a new student."""
    try:
        data = json.loads(request.body)
        
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        middle_initial = data.get('middle_initial', '').strip()
        age = data.get('age')
        address = data.get('address', '').strip()
        
        # Validate required fields
        if not all([email, password, first_name, last_name]):
            return JsonResponse({'error': 'Email, password, first and last name are required'}, status=400)
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        
        # Check if OTP was verified
        otp = OTPVerification.objects.filter(email=email, is_verified=True).order_by('-created_at').first()
        if not otp:
            return JsonResponse({'error': 'Email not verified. Please verify OTP first'}, status=400)
        
        # Create user
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create role
        UserRole.objects.create(
            user=user,
            role='student',
            is_verified=True
        )
        
        # Create student profile
        student = Student.objects.create(
            user=user,
            age=age,
            address=address
        )
        
        # Send confirmation email
        full_name = f"{first_name} {last_name}"
        send_confirmation_email(email, full_name)
        
        refresh = RefreshToken.for_user(user)
        
        return JsonResponse({
            'success': True,
            'message': 'Student registration successful',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'name': full_name,
                'role': 'student'
            }
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def register_instructor(request: HttpRequest) -> JsonResponse:
    """Register a new OJT instructor."""
    try:
        data = json.loads(request.body)
        
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        course = data.get('course', '').strip()
        department = data.get('department', '').strip()
        institution = data.get('institution', '').strip()
        
        # Validate required fields
        if not all([email, password, first_name, last_name]):
            return JsonResponse({'error': 'Email, password, first and last name are required'}, status=400)
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        
        # Check if OTP was verified
        otp = OTPVerification.objects.filter(email=email, is_verified=True).order_by('-created_at').first()
        if not otp:
            return JsonResponse({'error': 'Email not verified. Please verify OTP first'}, status=400)
        
        # Create user
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create role
        UserRole.objects.create(
            user=user,
            role='instructor',
            is_verified=True
        )
        
        # Create instructor profile
        instructor = OJTInstructor.objects.create(
            user=user,
            course=course,
            department=department,
            institution=institution
        )
        
        # Generate QR code
        qr_data = f"instructor_{instructor.id}_{instructor.user.email}"
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(qr_data)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        
        # Save QR code image
        img_io = io.BytesIO()
        qr_img.save(img_io, format='PNG')
        img_io.seek(0)
        instructor.qr_code = qr_data
        instructor.qr_code_image.save(f'qr_{instructor.id}.png', ContentFile(img_io.read()), save=True)
        
        # Send confirmation email
        full_name = f"{first_name} {last_name}"
        send_confirmation_email(email, full_name)
        
        refresh = RefreshToken.for_user(user)
        
        return JsonResponse({
            'success': True,
            'message': 'Instructor registration successful',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'name': full_name,
                'role': 'instructor'
            },
            'qr_code_url': instructor.qr_code_image.url if instructor.qr_code_image else None
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def register_hte(request: HttpRequest) -> JsonResponse:
    """Register a new HTE via Google OAuth."""
    try:
        data = json.loads(request.body)
        
        email = data.get('email', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        company_name = data.get('company_name', '').strip()
        company_address = data.get('company_address', '').strip()
        contact_person = data.get('contact_person', '').strip()
        contact_phone = data.get('contact_phone', '').strip()
        
        # Validate required fields
        if not all([email, company_name, company_address]):
            return JsonResponse({'error': 'Email, company name and address are required'}, status=400)
        
        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return JsonResponse({'error': 'Email already registered'}, status=400)
        
        # Create user (password not needed for Google OAuth, use random)
        password = User.objects.make_random_password()
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Create role
        UserRole.objects.create(
            user=user,
            role='hte',
            is_verified=True
        )
        
        # Create HTE profile
        hte = HTE.objects.create(
            user=user,
            company_name=company_name,
            company_address=company_address,
            contact_person=contact_person,
            contact_phone=contact_phone
        )
        
        refresh = RefreshToken.for_user(user)
        
        return JsonResponse({
            'success': True,
            'message': 'HTE registration successful',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'name': f"{first_name} {last_name}",
                'role': 'hte',
                'company': company_name
            }
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login(request: HttpRequest) -> JsonResponse:
    """Login user with email and password."""
    try:
        data = json.loads(request.body)
        
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        
        if not email or not password:
            return JsonResponse({'error': 'Email and password required'}, status=400)
        
        user = User.objects.filter(email=email).first()
        if not user or not user.check_password(password):
            return JsonResponse({'error': 'Invalid credentials'}, status=401)
        
        # Get user role
        user_role = UserRole.objects.filter(user=user).first()
        role = user_role.role if user_role else 'student'
        
        refresh = RefreshToken.for_user(user)
        
        # Get user profile based on role
        profile_data = {}
        if role == 'student':
            profile = Student.objects.filter(user=user).first()
            if profile:
                profile_data = {
                    'year_level': profile.year_level,
                    'section': profile.section,
                    'age': profile.age
                }
        elif role == 'instructor':
            profile = OJTInstructor.objects.filter(user=user).first()
            if profile:
                profile_data = {
                    'course': profile.course,
                    'department': profile.department,
                    'institution': profile.institution,
                    'qr_code_url': profile.qr_code_image.url if profile.qr_code_image else None
                }
        elif role == 'hte':
            profile = HTE.objects.filter(user=user).first()
            if profile:
                profile_data = {
                    'company_name': profile.company_name,
                    'company_address': profile.company_address
                }
        
        return JsonResponse({
            'success': True,
            'message': 'Login successful',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token)
            },
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.get_full_name(),
                'role': role,
                **profile_data
            }
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def submit_ojt_application(request: HttpRequest) -> JsonResponse:
    """Submit OJT application from student."""
    try:
        data = json.loads(request.body)
        
        user_id = data.get('user_id')
        instructor_id = data.get('instructor_id')
        company_name = data.get('company_name', '').strip()
        company_address = data.get('company_address', '').strip()
        gps_lat = data.get('gps_latitude')
        gps_lng = data.get('gps_longitude')
        geofence_radius = data.get('geofence_radius', 100)
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        required_hours = data.get('required_hours')
        
        if not all([user_id, instructor_id, company_name, company_address, gps_lat, gps_lng, start_date, end_date, required_hours]):
            return JsonResponse({'error': 'Missing required fields'}, status=400)
        
        try:
            student = Student.objects.get(user_id=user_id)
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except (Student.DoesNotExist, OJTInstructor.DoesNotExist):
            return JsonResponse({'error': 'Student or instructor not found'}, status=404)
        
        # Create application
        application = StudentOJTApplication.objects.create(
            student=student,
            instructor=instructor,
            company_name=company_name,
            company_address=company_address,
            gps_latitude=float(gps_lat),
            gps_longitude=float(gps_lng),
            geofence_radius=float(geofence_radius),
            start_date=start_date,
            end_date=end_date,
            required_hours=int(required_hours),
            status='pending'
        )
        
        # Send notification email
        send_mail(
            'New OJT Application Submitted',
            f"New OJT application from {student.user.get_full_name()} for {company_name}",
            settings.DEFAULT_FROM_EMAIL,
            [instructor.user.email],
            fail_silently=True
        )
        
        return JsonResponse({
            'success': True,
            'message': 'OJT application submitted successfully',
            'application_id': application.id
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def approve_ojt_application(request: HttpRequest) -> JsonResponse:
    """Approve OJT application."""
    try:
        data = json.loads(request.body)
        
        application_id = data.get('application_id')
        
        if not application_id:
            return JsonResponse({'error': 'Application ID required'}, status=400)
        
        try:
            application = StudentOJTApplication.objects.get(id=application_id)
        except StudentOJTApplication.DoesNotExist:
            return JsonResponse({'error': 'Application not found'}, status=404)
        
        application.status = 'approved'
        application.approved_at = timezone.now()
        application.save()
        
        # Send notification email
        send_application_status_email(
            application.student.user.email,
            application.student.user.get_full_name(),
            'approved',
            application.company_name
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Application approved successfully'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reject_ojt_application(request: HttpRequest) -> JsonResponse:
    """Reject OJT application."""
    try:
        data = json.loads(request.body)
        
        application_id = data.get('application_id')
        rejection_reason = data.get('rejection_reason', '')
        
        if not application_id:
            return JsonResponse({'error': 'Application ID required'}, status=400)
        
        try:
            application = StudentOJTApplication.objects.get(id=application_id)
        except StudentOJTApplication.DoesNotExist:
            return JsonResponse({'error': 'Application not found'}, status=404)
        
        application.status = 'rejected'
        application.rejection_reason = rejection_reason
        application.save()
        
        # Send notification email
        send_application_status_email(
            application.student.user.email,
            application.student.user.get_full_name(),
            'rejected',
            application.company_name
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Application rejected successfully'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def time_in(request: HttpRequest) -> JsonResponse:
    """Record time in for attendance."""
    try:
        data = json.loads(request.body)
        
        user_id = data.get('user_id')
        application_id = data.get('application_id')
        
        if not all([user_id, application_id]):
            return JsonResponse({'error': 'User ID and Application ID required'}, status=400)
        
        try:
            student = Student.objects.get(user_id=user_id)
            application = StudentOJTApplication.objects.get(id=application_id)
        except (Student.DoesNotExist, StudentOJTApplication.DoesNotExist):
            return JsonResponse({'error': 'Student or application not found'}, status=404)
        
        # Create time record
        time_record = TimeRecord.objects.create(
            student=student,
            application=application,
            time_in=timezone.now(),
            date=timezone.now().date()
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Time in recorded successfully',
            'time_in': time_record.time_in.isoformat()
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def time_out(request: HttpRequest) -> JsonResponse:
    """Record time out for attendance."""
    try:
        data = json.loads(request.body)
        
        user_id = data.get('user_id')
        application_id = data.get('application_id')
        
        if not all([user_id, application_id]):
            return JsonResponse({'error': 'User ID and Application ID required'}, status=400)
        
        try:
            student = Student.objects.get(user_id=user_id)
            application = StudentOJTApplication.objects.get(id=application_id)
        except (Student.DoesNotExist, StudentOJTApplication.DoesNotExist):
            return JsonResponse({'error': 'Student or application not found'}, status=404)
        
        # Get today's time record
        today = timezone.now().date()
        time_record = TimeRecord.objects.filter(
            student=student,
            application=application,
            date=today,
            time_out__isnull=True
        ).first()
        
        if not time_record:
            return JsonResponse({'error': 'No active time in found for today'}, status=404)
        
        time_record.time_out = timezone.now()
        time_record.calculate_hours()
        time_record.save()
        
        # Update application rendered hours
        application.rendered_hours += time_record.hours_rendered
        application.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Time out recorded successfully',
            'time_out': time_record.time_out.isoformat(),
            'hours_rendered': time_record.hours_rendered
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def post_announcement(request: HttpRequest) -> JsonResponse:
    """Post announcement by instructor."""
    try:
        data = json.loads(request.body)
        
        user_id = data.get('user_id')
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        
        if not all([user_id, title, content]):
            return JsonResponse({'error': 'User ID, title and content are required'}, status=400)
        
        try:
            instructor = OJTInstructor.objects.get(user_id=user_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)
        
        announcement = Announcement.objects.create(
            instructor=instructor,
            title=title,
            content=content
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Announcement posted successfully',
            'announcement_id': announcement.id
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
def get_announcements(request: HttpRequest) -> JsonResponse:
    """Get announcements for a course."""
    try:
        instructor_id = request.GET.get('instructor_id')
        
        if not instructor_id:
            return JsonResponse({'error': 'Instructor ID required'}, status=400)
        
        try:
            instructor = OJTInstructor.objects.get(id=instructor_id)
        except OJTInstructor.DoesNotExist:
            return JsonResponse({'error': 'Instructor not found'}, status=404)
        
        announcements = Announcement.objects.filter(instructor=instructor).order_by('-created_at')
        
        data = [
            {
                'id': a.id,
                'title': a.title,
                'content': a.content,
                'created_at': a.created_at.isoformat(),
                'updated_at': a.updated_at.isoformat()
            }
            for a in announcements
        ]
        
        return JsonResponse({
            'success': True,
            'announcements': data
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_applications(request: HttpRequest) -> JsonResponse:
    """Return OJT applications associated with an HTE user."""
    try:
        user = getattr(request, 'user', None)
        if not user:
            return JsonResponse({'error': 'authentication_required'}, status=401)

        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        applications = StudentOJTApplication.objects.filter(hte=hte).order_by('-created_at')
        data = []
        for a in applications:
            data.append({
                'id': a.id,
                'student_name': a.student.user.get_full_name(),
                'student_email': a.student.user.email,
                'status': a.status,
                'required_hours': a.required_hours,
                'rendered_hours': a.rendered_hours,
                'remaining_hours': a.remaining_hours(),
                'start_date': a.start_date.isoformat(),
                'end_date': a.end_date.isoformat(),
                'company_name': a.company_name,
            })

        return JsonResponse({'success': True, 'applications': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_time_records(request: HttpRequest) -> JsonResponse:
    """Return time records for applications associated with the HTE."""
    try:
        user = getattr(request, 'user', None)
        if not user:
            return JsonResponse({'error': 'authentication_required'}, status=401)

        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        applications = StudentOJTApplication.objects.filter(hte=hte)
        time_records = TimeRecord.objects.filter(application__in=applications).order_by('-date')

        data = []
        for t in time_records:
            data.append({
                'id': t.id,
                'student_name': t.student.user.get_full_name(),
                'application_id': t.application.id,
                'date': t.date.isoformat(),
                'time_in': t.time_in.isoformat() if t.time_in else None,
                'time_out': t.time_out.isoformat() if t.time_out else None,
                'hours_rendered': t.hours_rendered,
                'is_approved': t.is_approved,
                'notes': t.notes,
            })

        return JsonResponse({'success': True, 'time_records': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_access_requests(request: HttpRequest) -> JsonResponse:
    """Return HTE access requests for the HTE user."""
    try:
        user = getattr(request, 'user', None)
        if not user:
            return JsonResponse({'error': 'authentication_required'}, status=401)

        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        requests = HTEAccessRequest.objects.filter(hte=hte).order_by('-requested_at')
        data = []
        for r in requests:
            data.append({
                'id': r.id,
                'application_id': r.application.id,
                'student_name': r.application.student.user.get_full_name(),
                'status': r.status,
                'requested_at': r.requested_at.isoformat(),
                'approved_at': r.approved_at.isoformat() if r.approved_at else None,
                'rejection_reason': r.rejection_reason,
            })

        return JsonResponse({'success': True, 'access_requests': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_registrations(request: HttpRequest) -> JsonResponse:
    """Return face/employee registrations related to the HTE's applications."""
    try:
        user = getattr(request, 'user', None)
        if not user:
            return JsonResponse({'error': 'authentication_required'}, status=401)

        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        # Find registrations where employee_id appears in attendance for this HTE
        applications = StudentOJTApplication.objects.filter(hte=hte)
        attendance_photos = AttendancePhoto.objects.filter(application__in=applications)
        employee_ids = set([p.employee_id for p in attendance_photos if p.employee_id])

        registrations = FaceRegistration.objects.filter(employee_id__in=employee_ids)
        data = []
        for r in registrations:
            data.append({
                'id': r.id,
                'employee_id': r.employee_id,
                'image_url': request.build_absolute_uri(r.image.url) if r.image else None,
                'created_at': r.created_at.isoformat(),
            })

        return JsonResponse({'success': True, 'registrations': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_dashboard(request: HttpRequest) -> JsonResponse:
    """Return aggregate dashboard metrics for the authenticated HTE."""
    try:
        user = getattr(request, 'user', None)
        if not user:
            return JsonResponse({'error': 'authentication_required'}, status=401)

        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        applications = StudentOJTApplication.objects.filter(hte=hte)
        total_applications = applications.count()
        status_counts = {
            'pending': applications.filter(status='pending').count(),
            'approved': applications.filter(status='approved').count(),
            'rejected': applications.filter(status='rejected').count(),
            'completed': applications.filter(status='completed').count(),
            'cancelled': applications.filter(status='cancelled').count(),
        }

        total_required_hours = sum(a.required_hours for a in applications)
        total_rendered_hours = sum(a.rendered_hours for a in applications)
        total_remaining_hours = sum(a.remaining_hours() for a in applications)

        unique_students = applications.values_list('student__user__id', flat=True).distinct().count()

        # Recent time records (last 7 days)
        recent_time_records = TimeRecord.objects.filter(application__in=applications).order_by('-date')[:20]
        recent = [
            {
                'id': t.id,
                'student_name': t.student.user.get_full_name(),
                'date': t.date.isoformat(),
                'hours_rendered': t.hours_rendered,
                'is_approved': t.is_approved,
            }
            for t in recent_time_records
        ]

        return JsonResponse({
            'success': True,
            'metrics': {
                'total_applications': total_applications,
                'status_counts': status_counts,
                'total_required_hours': total_required_hours,
                'total_rendered_hours': total_rendered_hours,
                'total_remaining_hours': total_remaining_hours,
                'unique_students': unique_students,
            },
            'recent_time_records': recent,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def request_hte_access(request: HttpRequest) -> JsonResponse:
    """Request HTE access for student application."""
    try:
        data = json.loads(request.body)
        
        application_id = data.get('application_id')
        hte_id = data.get('hte_id')
        
        if not all([application_id, hte_id]):
            return JsonResponse({'error': 'Application ID and HTE ID required'}, status=400)
        
        try:
            application = StudentOJTApplication.objects.get(id=application_id)
            hte = HTE.objects.get(id=hte_id)
        except (StudentOJTApplication.DoesNotExist, HTE.DoesNotExist):
            return JsonResponse({'error': 'Application or HTE not found'}, status=404)
        
        # Update application HTE
        application.hte = hte
        application.save()
        
        # Create access request
        access_request = HTEAccessRequest.objects.create(
            hte=hte,
            application=application,
            status='pending'
        )
        
        # Send notification email
        send_mail(
            'New HTE Access Request',
            f"New access request from {application.student.user.get_full_name()} for {application.company_name}",
            settings.DEFAULT_FROM_EMAIL,
            [hte.user.email],
            fail_silently=True
        )
        
        return JsonResponse({
            'success': True,
            'message': 'HTE access request submitted successfully',
            'request_id': access_request.id
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def approve_hte_access(request: HttpRequest) -> JsonResponse:
    """Approve HTE access request."""
    try:
        data = json.loads(request.body)
        
        request_id = data.get('request_id')
        
        if not request_id:
            return JsonResponse({'error': 'Request ID required'}, status=400)
        
        try:
            access_request = HTEAccessRequest.objects.get(id=request_id)
        except HTEAccessRequest.DoesNotExist:
            return JsonResponse({'error': 'Access request not found'}, status=404)
        
        access_request.status = 'approved'
        access_request.approved_at = timezone.now()
        access_request.save()
        
        return JsonResponse({
            'success': True,
            'message': 'HTE access approved successfully'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def reject_hte_access(request: HttpRequest) -> JsonResponse:
    """Reject HTE access request."""
    try:
        data = json.loads(request.body)
        
        request_id = data.get('request_id')
        rejection_reason = data.get('rejection_reason', '')
        
        if not request_id:
            return JsonResponse({'error': 'Request ID required'}, status=400)
        
        try:
            access_request = HTEAccessRequest.objects.get(id=request_id)
        except HTEAccessRequest.DoesNotExist:
            return JsonResponse({'error': 'Access request not found'}, status=404)
        
        access_request.status = 'rejected'
        access_request.rejection_reason = rejection_reason
        access_request.save()
        
        return JsonResponse({
            'success': True,
            'message': 'HTE access rejected successfully'
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
