"""Light-weight middleware to log CORS preflight (OPTIONS) requests for debugging.

Add to `MIDDLEWARE` in settings to enable. Logs include request path, Origin,
Access-Control-Request-Method and Access-Control-Request-Headers.
"""
import logging
from typing import Callable

logger = logging.getLogger("preflight")


class PreflightLoggingMiddleware:
    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        try:
            if request.method == "OPTIONS":
                origin = request.META.get("HTTP_ORIGIN")
                acr_method = request.META.get("HTTP_ACCESS_CONTROL_REQUEST_METHOD")
                acr_headers = request.META.get("HTTP_ACCESS_CONTROL_REQUEST_HEADERS")
                logger.info(
                    "CORS preflight OPTIONS: path=%s origin=%s acr_method=%s acr_headers=%s",
                    request.path,
                    origin,
                    acr_method,
                    acr_headers,
                )
        except Exception:
            # Never fail the request because of logging
            logger.exception("Error while logging preflight request")

        return self.get_response(request)
