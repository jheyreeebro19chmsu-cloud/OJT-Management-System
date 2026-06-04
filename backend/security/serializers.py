from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from .models import UserRole, Student, OJTInstructor, HTE


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(allow_blank=True, required=False)
    last_name = serializers.CharField(allow_blank=True, required=False)
    role = serializers.ChoiceField(choices=(('student', 'student'), ('instructor', 'instructor'), ('hte', 'hte')),
                                   default='student')

    # student fields
    age = serializers.IntegerField(required=False, allow_null=True)
    address = serializers.CharField(required=False, allow_blank=True)

    # instructor fields
    course = serializers.CharField(required=False, allow_blank=True)
    department = serializers.CharField(required=False, allow_blank=True)
    institution = serializers.CharField(required=False, allow_blank=True)

    # hte fields
    company_name = serializers.CharField(required=False, allow_blank=True)
    company_address = serializers.CharField(required=False, allow_blank=True)
    barangay = serializers.CharField(required=False, allow_blank=True)
    contact_person = serializers.CharField(required=False, allow_blank=True)
    contact_phone = serializers.CharField(required=False, allow_blank=True)
    # optional captured face image as base64 data URL
    captured_image = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Email already registered')
        return value

    def create(self, validated_data):
        role = validated_data.pop('role', 'student')
        password = validated_data.pop('password')
        email = validated_data.get('email')
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        captured_image = validated_data.pop('captured_image', None)

        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password,
                                            first_name=first_name, last_name=last_name)
            UserRole.objects.create(user=user, role=role, is_verified=True)

            if role == 'student':
                Student.objects.create(user=user, age=validated_data.get('age'), address=validated_data.get('address', ''))
            elif role == 'instructor':
                OJTInstructor.objects.create(user=user, course=validated_data.get('course', ''),
                                             department=validated_data.get('department', ''),
                                             institution=validated_data.get('institution', ''))
            elif role == 'hte':
                HTE.objects.create(user=user, company_name=validated_data.get('company_name', ''),
                                   company_address=validated_data.get('company_address', ''),
                                   barangay=validated_data.get('barangay', ''),
                                   contact_person=validated_data.get('contact_person', ''),
                                   contact_phone=validated_data.get('contact_phone', ''))

            # If a captured_image was provided and the role is student, try to create a FaceRegistration record
            if captured_image and role == 'student':
                try:
                    import base64, io
                    from django.core.files.base import ContentFile
                    from .models import FaceRegistration
                    from PIL import Image
                    import numpy as np
                    try:
                        import face_recognition
                    except Exception:
                        face_recognition = None

                    # Expect data URL like 'data:image/png;base64,...' or raw base64
                    raw = captured_image
                    if raw.startswith('data:'):
                        raw = raw.split(',', 1)[1]
                    image_bytes = base64.b64decode(raw)
                    # Save binary and image file
                    emp_id = f"emp_{user.id}"
                    fr = FaceRegistration.objects.create(user=user, employee_id=emp_id)
                    fr.image_data = image_bytes
                    fr.image_format = 'jpeg'
                    # Save image file using PIL to normalize
                    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
                    buf = io.BytesIO()
                    img.save(buf, format='JPEG')
                    buf.seek(0)
                    fr.image.save(f"{emp_id}.jpg", ContentFile(buf.read()), save=False)
                    # Try to compute face encoding
                    if face_recognition:
                        try:
                            arr = np.array(img)
                            encs = face_recognition.face_encodings(arr)
                            if encs:
                                fr.face_encoding = encs[0].tolist()
                        except Exception:
                            pass
                    fr.save()
                except Exception:
                    # Do not fail registration if face processing fails
                    pass

        return user

