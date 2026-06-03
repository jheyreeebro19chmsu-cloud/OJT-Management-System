from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/pending-requests/", consumers.PendingRequestsConsumer.as_asgi()),
    re_path(r"ws/pending-requests/(?P<instructor_id>[^/]+)/$", consumers.PendingRequestsConsumer.as_asgi()),
]
