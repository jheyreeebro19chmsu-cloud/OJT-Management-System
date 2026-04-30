import face_recognition
import numpy as np
from celery import shared_task
from .models import FaceRegistration, AttendancePhoto
import json

@shared_task
def process_face_registration_task(registration_id):
    """
    Background task to compute face encoding for a new registration.
    """
    try:
        registration = FaceRegistration.objects.get(id=registration_id)
        if not registration.image:
            return "No image found"
            
        img = face_recognition.load_image_file(registration.image.path)
        encodings = face_recognition.face_encodings(img)
        
        if encodings:
            registration.face_encoding = list(encodings[0])
            registration.save()
            return f"Encoding saved for {registration.employee_id}"
        return "No face detected in image"
    except Exception as e:
        return f"Error: {str(e)}"

@shared_task
def verify_attendance_face_task(photo_id, tolerance=0.6):
    """
    Background task to verify an attendance photo against a registered face.
    Useful for batch processing or when avoiding slow HTTP responses.
    """
    try:
        photo = AttendancePhoto.objects.get(id=photo_id)
        registration = FaceRegistration.objects.filter(employee_id=photo.employee_id).first()
        
        if not registration or not registration.face_encoding:
            return "No registered face encoding found"
            
        # Load images
        known_encoding = np.array(registration.face_encoding)
        unknown_image = face_recognition.load_image_file(photo.image.path)
        unknown_encodings = face_recognition.face_encodings(unknown_image)
        
        if not unknown_encodings:
            photo.face_verified = False
            photo.save()
            return "No face detected in attendance photo"
            
        # Compare
        distance = face_recognition.face_distance([known_encoding], unknown_encodings[0])[0]
        matched = bool(distance <= tolerance)
        
        photo.face_verified = matched
        photo.save()
        
        return f"Verification result: {'Matched' if matched else 'Not Matched'} (dist: {distance:.4f})"
    except Exception as e:
        return f"Error: {str(e)}"
