import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ojt_backend.settings")

django_app = get_wsgi_application()


# CORS middleware wrapper — adds CORS headers only if not already provided by django-cors-headers.
class ForceAllCORSMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        def cors_start_response(status, response_headers, exc_info=None):
            # Prevent duplicate Access-Control-Allow-Origin headers
            header_keys = [h[0].lower() for h in response_headers]
            if "access-control-allow-origin" not in header_keys:
                origin = environ.get("HTTP_ORIGIN", "*")
                cors_headers = [
                    ("Access-Control-Allow-Origin", origin if origin else "*"),
                    ("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"),
                    ("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, x-ojt-api-key, x-api-key"),
                    ("Access-Control-Allow-Credentials", "true"),
                ]
                response_headers = list(response_headers) + cors_headers
            return start_response(status, response_headers, exc_info)

        return self.app(environ, cors_start_response)


application = ForceAllCORSMiddleware(django_app)
