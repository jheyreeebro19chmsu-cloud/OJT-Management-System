import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ojt_backend.settings")

django_app = get_wsgi_application()


# CORS middleware wrapper — adds CORS headers to ALL responses.
# This is a last-resort unblock for frontend-to-backend calls.
class ForceAllCORSMiddleware:
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        def cors_start_response(status, response_headers, exc_info=None):
            # Add CORS headers to every response
            cors_headers = [
                ("Access-Control-Allow-Origin", "*"),
                ("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS"),
                ("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept"),
                ("Access-Control-Allow-Credentials", "true"),
            ]
            response_headers = list(response_headers) + cors_headers
            return start_response(status, response_headers, exc_info)

        return self.app(environ, cors_start_response)


application = ForceAllCORSMiddleware(django_app)
