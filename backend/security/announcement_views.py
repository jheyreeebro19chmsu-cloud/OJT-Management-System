import json
import base64
from django.core.files.base import ContentFile
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    Student, OJTInstructor, Announcement, AnnouncementSubmission
)

@csrf_exempt
@require_http_methods(["POST"])
def post_announcement(request: HttpRequest) -> JsonResponse:
    """Post announcement by instructor."""
    try:
        if request.content_type and request.content_type.startswith('multipart'):
            user_id = request.POST.get('user_id')
            title = request.POST.get('title', '').strip()
            content = request.POST.get('content', '').strip()
            image_file = request.FILES.get('image')
        else:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            title = data.get('title', '').strip()
            content = data.get('content', '').strip()
            image_b64 = data.get('image_b64')

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

        if 'image_file' in locals() and image_file:
            announcement.image.save(image_file.name, image_file, save=True)
        elif 'image_b64' in locals() and image_b64:
            try:
                content_file = ContentFile(base64.b64decode(image_b64.split(',', 1)[1])) if ',' in image_b64 else ContentFile(base64.b64decode(image_b64))
                announcement.image.save(f'ann_{announcement.id}.jpg', content_file, save=True)
            except Exception:
                pass
        
        return JsonResponse({
            'success': True,
            'message': 'Announcement posted successfully',
            'announcement_id': announcement.id,
            'image_url': announcement.image.url if announcement.image else None
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
                'updated_at': a.updated_at.isoformat(),
                'image_url': request.build_absolute_uri(a.image.url) if a.image else None,
            }
            for a in announcements
        ]
        
        return JsonResponse({'success': True, 'announcements': data})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def submit_announcement_response(request: HttpRequest) -> JsonResponse:
    """Employee submits response (message + optional image) to an announcement."""
    try:
        if request.content_type and request.content_type.startswith('multipart'):
            announcement_id = request.POST.get('announcement_id')
            user_id = request.POST.get('user_id')
            message = request.POST.get('message', '').strip()
            image_file = request.FILES.get('image')
        else:
            data = json.loads(request.body)
            announcement_id = data.get('announcement_id')
            user_id = data.get('user_id')
            message = data.get('message', '').strip()
            image_b64 = data.get('image_b64')

        if not all([announcement_id, user_id]):
            return JsonResponse({'error': 'announcement_id and user_id are required'}, status=400)

        try:
            announcement = Announcement.objects.get(id=int(announcement_id))
            student = Student.objects.get(user_id=int(user_id))
        except (Announcement.DoesNotExist, Student.DoesNotExist):
            return JsonResponse({'error': 'Announcement or Student not found'}, status=404)

        submission = AnnouncementSubmission.objects.create(
            announcement=announcement,
            student=student,
            message=message
        )

        if 'image_file' in locals() and image_file:
            submission.image.save(image_file.name, image_file, save=True)
        elif 'image_b64' in locals() and image_b64:
            try:
                content = base64.b64decode(image_b64.split(',', 1)[1]) if ',' in image_b64 else base64.b64decode(image_b64)
                submission.image.save(f'sub_{submission.id}.jpg', ContentFile(content), save=True)
            except Exception:
                pass

        return JsonResponse({
            'success': True,
            'submission_id': submission.id,
            'submitted_at': submission.submitted_at.isoformat(),
            'image_url': submission.image.url if submission.image else None,
        }, status=201)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
