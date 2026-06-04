from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer
from .models import OTPVerification
from .auth_views import send_confirmation_email


class RegisterAPIView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # If OTP verification is required for this flow, verify before creating user
        email = serializer.validated_data.get('email')
        if not OTPVerification.objects.filter(email=email, is_verified=True).exists():
            return Response({'error': 'Email not verified'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                user = serializer.save()

            # Send confirmation and return tokens
            send_confirmation_email(user.email, user.get_full_name() or user.email)
            refresh = RefreshToken.for_user(user)
            # Attach role-specific profile info (face registration attached only for student role)
            profile = {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'avatar': None, 'face_registered': False}
            face_reg_obj = None
            try:
                from .models import Student, OJTInstructor, HTE
                role_row = user.role_profile if hasattr(user, 'role_profile') else None
                role = role_row.role if role_row else None
                if role == 'student':
                    s = Student.objects.filter(user=user).first()
                    if s:
                        profile['age'] = s.age
                        profile['address'] = s.address
                elif role == 'instructor':
                    ins = OJTInstructor.objects.filter(user=user).first()
                    if ins:
                        profile['course'] = ins.course
                        profile['department'] = ins.department
                        profile['qr_code_url'] = ins.qr_code_image.url if ins.qr_code_image else None
                elif role == 'hte':
                    h = HTE.objects.filter(user=user).first()
                    if h:
                        profile['company_name'] = h.company_name
                        profile['company_address'] = h.company_address
                # face registration object
                try:
                    from .models import FaceRegistration
                    fr = FaceRegistration.objects.filter(user=user).first()
                    if fr and role == 'student':
                        try:
                            img_url = request.build_absolute_uri(fr.image.url) if fr.image else None
                        except Exception:
                            img_url = None
                        face_reg_obj = {'image_url': img_url, 'has_encoding': bool(fr.face_encoding)}
                except Exception:
                    face_reg_obj = None
            except Exception:
                pass

            if face_reg_obj:
                profile['face_registration'] = face_reg_obj
                profile['avatar'] = face_reg_obj.get('image_url')
                profile['face_registered'] = bool(face_reg_obj.get('has_encoding'))

            return Response({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)} ,
                             'user': profile}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

