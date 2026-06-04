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

        return user

