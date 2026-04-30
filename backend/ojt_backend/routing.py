from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
import security.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(
        security.routing.websocket_urlpatterns
    ),
})
