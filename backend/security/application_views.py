import json
from django.conf import settings
from django.core.mail import send_mail
from django.http import JsonResponse, HttpRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .api_auth import require_jwt
from .models import (
    Student, OJTInstructor, HTE, StudentOJTApplication, TimeRecord, HTEAccessRequest
)

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
        
        send_application_status_email(
            application.student.user.email,
            application.student.user.get_full_name(),
            'approved',
            application.company_name
        )
        
        return JsonResponse({'success': True, 'message': 'Application approved successfully'})
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
        
        send_application_status_email(
            application.student.user.email,
            application.student.user.get_full_name(),
            'rejected',
            application.company_name
        )
        
        return JsonResponse({'success': True, 'message': 'Application rejected successfully'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_applications(request: HttpRequest) -> JsonResponse:
    """Return OJT applications associated with an HTE user."""
    try:
        user = getattr(request, 'user', None)
        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        applications = StudentOJTApplication.objects.filter(hte=hte).order_by('-created_at')
        data = [
            {
                'id': a.id,
                'student_name': a.student.user.get_full_name(),
                'student_email': a.student.user.email,
                'status': a.status,
                'required_hours': a.required_hours,
                'rendered_hours': a.rendered_hours,
                'remaining_hours': a.remaining_hours, # Accessing as property now
                'start_date': a.start_date.isoformat(),
                'end_date': a.end_date.isoformat(),
                'company_name': a.company_name,
            }
            for a in applications
        ]

        return JsonResponse({'success': True, 'applications': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_access_requests(request: HttpRequest) -> JsonResponse:
    """Return HTE access requests for the HTE user."""
    try:
        user = getattr(request, 'user', None)
        hte = HTE.objects.filter(user=user).first()
        if not hte:
            return JsonResponse({'error': 'HTE profile not found'}, status=404)

        requests = HTEAccessRequest.objects.filter(hte=hte).order_by('-requested_at')
        data = [
            {
                'id': r.id,
                'application_id': r.application.id,
                'student_name': r.application.student.user.get_full_name(),
                'status': r.status,
                'requested_at': r.requested_at.isoformat(),
                'approved_at': r.approved_at.isoformat() if r.approved_at else None,
                'rejection_reason': r.rejection_reason,
            }
            for r in requests
        ]

        return JsonResponse({'success': True, 'access_requests': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["GET"])
@require_jwt(required_role='hte')
def get_hte_dashboard(request: HttpRequest) -> JsonResponse:
    """Return aggregate dashboard metrics for the authenticated HTE."""
    try:
        user = getattr(request, 'user', None)
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
        total_remaining_hours = sum(a.remaining_hours for a in applications) # Accessing as property now

        unique_students = applications.values_list('student__user__id', flat=True).distinct().count()

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
        
        application.hte = hte
        application.save()
        
        access_request = HTEAccessRequest.objects.create(
            hte=hte,
            application=application,
            status='pending'
        )
        
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
        
        return JsonResponse({'success': True, 'message': 'HTE access approved successfully'})
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
        
        return JsonResponse({'success': True, 'message': 'HTE access rejected successfully'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
