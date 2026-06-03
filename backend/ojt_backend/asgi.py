import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ojt_backend.settings")

# Use Channels' ProtocolTypeRouter when available; otherwise fall back to standard ASGI application
try:
	from channels.routing import ProtocolTypeRouter
	from channels.auth import AuthMiddlewareStack
	from django.urls import re_path
	import security.routing as security_routing

	django_asgi_app = get_asgi_application()

	application = ProtocolTypeRouter({
		"http": django_asgi_app,
		"websocket": AuthMiddlewareStack(
			security_routing.websocket_urlpatterns
		),
	})
except Exception:
	# Channels not installed or import error; use default ASGI app
	application = get_asgi_application()
