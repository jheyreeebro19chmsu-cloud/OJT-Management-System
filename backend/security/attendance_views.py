import json
from datetime import time as dtime, datetime, timedelta

from django.conf import settings
from django.http import JsonResponse, HttpRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .api_auth import require_jwt
from .models import (
    Student, OJTInstructor, HTE, StudentOJTApplication, TimeRecord,
    FaceRegistration, AttendancePhoto
)

@csrf_exempt
@require_http_methods(["POST"])
def verify_qr(request: HttpRequest) -> JsonResponse:
    """Verify a QR payload and return instructor info if valid."""
    try:
        data = json.loads(request.body)
        qr_data = data.get('qr_data', '').strip()
        if not qr_data:
            return JsonResponse({'error': 'qr_data is required'}, status=400)

        instructor = OJTInstructor.objects.filter(qr_code=qr_data).first()
        if not instructor:
            if qr_data.startswith('instructor_'):
                parts = qr_data.split('_')
                try:
                    iid = int(parts[1])
                    instructor = OJTInstructor.objects.filter(id=iid).first()
                except Exception:
                    instructor = None

        if not instructor:
            return JsonResponse({'error': 'Invalid QR code'}, status=404)

        return JsonResponse({
            'success': True,
            'instructor': {
                'id': instructor.id,
                'email': instructor.user.email,
                'name': instructor.user.get_full_name(),
                'qr_code_url': instructor.qr_code_image.url if instructor.qr_code_image else None
            }
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
        
        now = timezone.localtime(timezone.now())
        morning_in = getattr(settings, 'MORNING_IN', dtime(hour=8, minute=0))
        afternoon_in = getattr(settings, 'AFTERNOON_IN', dtime(hour=13, minute=0))
        tolerance_minutes = getattr(settings, 'ATTENDANCE_TOLERANCE_MINUTES', 30)

        def within(t: dtime, tol_min: int):
            low = (datetime.combine(now.date(), t) - timedelta(minutes=tol_min)).time()
            high = (datetime.combine(now.date(), t) + timedelta(minutes=tol_min)).time()
            return low <= now.time() <= high

        session = 'unspecified'
        if within(morning_in, tolerance_minutes):
            session = 'morning'
        elif within(afternoon_in, tolerance_minutes):
            session = 'afternoon'
        else:
            return JsonResponse({'error': 'Not within allowed time-in window'}, status=400)

        existing = TimeRecord.objects.filter(student=student, application=application, date=now.date(), session=session, time_out__isnull=True).first()
        if existing:
            return JsonResponse({'error': 'Active time-in already exists for this session'}, status=400)

        time_record = TimeRecord.objects.create(
            student=student,
            application=application,
            time_in=now,
            date=now.date(),
            session=session
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
        
        now = timezone.localtime(timezone.now())
        today = now.date()
        morning_out = getattr(settings, 'MORNING_OUT', dtime(hour=12, minute=0))
        afternoon_out = getattr(settings, 'AFTERNOON_OUT', dtime(hour=17, minute=0))
        tolerance_minutes = getattr(settings, 'ATTENDANCE_TOLERANCE_MINUTES', 30)

        def within(t: dtime, tol_min: int):
            low = (datetime.combine(now.date(), t) - timedelta(minutes=tol_min)).time()
            high = (datetime.combine(now.date(), t) + timedelta(minutes=tol_min)).time()
            return low <= now.time() <= high

        session = None
        if within(morning_out, tolerance_minutes):
            session = 'morning'
        elif within(afternoon_out, tolerance_minutes):
            session = 'afternoon'

        if session:
            time_record = TimeRecord.objects.filter(student=student, application=application, date=today, session=session, time_out__isnull=True).first()
        else:
            time_record = TimeRecord.objects.filter(student=student, application=application, date=today, time_out__isnull=True).first()
        
        if not time_record:
            return JsonResponse({'error': 'No active time in found for today'}, status=404)
        
        time_record.time_out = timezone.now()
        time_record.calculate_hours # Accessing as property now
        time_record.save()
        
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
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_time_records(request: HttpRequest) -> JsonResponse:
    """Return time records for applications associated with the HTE."""
    try:
        user = getattr(request, 'user', None)
        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        applications = StudentOJTApplication.objects.filter(hte=hte)
        time_records = TimeRecord.objects.filter(application__in=applications).order_by('-date')

        data = [
            {
                'id': t.id,
                'student_name': t.student.user.get_full_name(),
                'application_id': t.application.id,
                'date': t.date.isoformat(),
                'time_in': t.time_in.isoformat() if t.time_in else None,
                'time_out': t.time_out.isoformat() if t.time_out else None,
                'hours_rendered': t.hours_rendered,
                'is_approved': t.is_approved,
                'notes': t.notes,
            }
            for t in time_records
        ]

        return JsonResponse({'success': True, 'time_records': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_registrations(request: HttpRequest) -> JsonResponse:
    """Return face/employee registrations related to the HTE's applications."""
    try:
        user = getattr(request, 'user', None)
        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        applications = StudentOJTApplication.objects.filter(hte=hte)
        attendance_photos = AttendancePhoto.objects.filter(application__in=applications)
        employee_ids = set([p.employee_id for p in attendance_photos if p.employee_id])

        registrations = FaceRegistration.objects.filter(employee_id__in=employee_ids)
        data = [
            {
                'id': r.id,
                'employee_id': r.employee_id,
                'image_url': request.build_absolute_uri(r.image.url) if r.image else None,
                'created_at': r.created_at.isoformat(),
            }
            for r in registrations
        ]

        return JsonResponse({'success': True, 'registrations': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
