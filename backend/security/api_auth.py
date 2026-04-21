"""API key authentication for security JSON endpoints."""

from functools import wraps
from typing import Callable, Optional

from django.conf import settings
from django.http import HttpRequest, JsonResponse
from django.contrib.auth.models import User

try:
    from rest_framework_simplejwt.tokens import AccessToken
    from rest_framework_simplejwt.exceptions import TokenError
except Exception:
    AccessToken = None  # type: ignore
    TokenError = Exception


def _extract_api_key(request: HttpRequest) -> Optional[str]:
    auth = request.headers.get("Authorization") or ""
    if auth.startswith("Bearer "):
        return auth[7:].strip() or None
    return request.headers.get("X-OJT-API-Key") or request.headers.get("X-Api-Key")


def require_security_api_key(view_func: Callable) -> Callable:
    """
    When DJANGO_SECURITY_API_KEY is set, require a matching Bearer token or X-OJT-API-Key.
    When unset, the decorator is a no-op (local development).
    """

    @wraps(view_func)
    def _wrapped(request: HttpRequest, *args, **kwargs):
        expected = getattr(settings, "SECURITY_API_KEY", "") or ""
        if not expected:
            return view_func(request, *args, **kwargs)
        provided = _extract_api_key(request)
        if not provided or provided != expected:
            return JsonResponse(
                {
                    "error": "unauthorized",
                    "message": "Valid API key required (Authorization: Bearer <key> or X-OJT-API-Key).",
                },
                status=401,
            )
        return view_func(request, *args, **kwargs)

    return _wrapped


def require_jwt(required_role: Optional[str] = None) -> Callable:
    """Decorator to require a valid SimpleJWT access token and optional user role.

    When SimpleJWT is not available, this decorator is a no-op to preserve
    developer experience in minimal environments.
    """

    def decorator(view_func: Callable) -> Callable:

        @wraps(view_func)
        def _wrapped(request: HttpRequest, *args, **kwargs):
            if AccessToken is None:
                # SimpleJWT not installed; allow through (dev mode)
                return view_func(request, *args, **kwargs)

            auth = request.headers.get("Authorization") or ""
            if not auth.startswith("Bearer "):
                return JsonResponse({"error": "authorization_required"}, status=401)

            token = auth[7:].strip()
            if not token:
                return JsonResponse({"error": "authorization_required"}, status=401)

            try:
                access = AccessToken(token)
            except TokenError:
                return JsonResponse({"error": "invalid_token"}, status=401)

            user_id = access.get("user_id") or access.get("user")
            if not user_id:
                return JsonResponse({"error": "invalid_token_payload"}, status=401)

            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "user_not_found"}, status=401)

            if required_role:
                from .models import UserRole

                role = UserRole.objects.filter(user=user).first()
                if not role or role.role != required_role:
                    return JsonResponse({"error": "forbidden", "message": "Insufficient role"}, status=403)

            # attach user to request for downstream handlers
            request.user = user
            return view_func(request, *args, **kwargs)

        return _wrapped

    return decorator
