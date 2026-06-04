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
            # Include face registration info if any
            avatar_url = None
            face_registered = False
            try:
                from .models import FaceRegistration
                fr = FaceRegistration.objects.filter(user=user).first()
                if fr:
                    try:
                        avatar_url = request.build_absolute_uri(fr.image.url) if fr.image else None
                    except Exception:
                        avatar_url = None
                    face_registered = bool(fr.face_encoding) or bool(getattr(fr, 'face_registered', False))
            except Exception:
                pass

            return Response({'success': True, 'tokens': {'refresh': str(refresh), 'access': str(refresh.access_token)},
                             'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'avatar': avatar_url, 'face_registered': face_registered}}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

