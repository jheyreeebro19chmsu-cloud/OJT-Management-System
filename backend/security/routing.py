from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/face-process/(?P<employee_id>\w+)/$', consumers.FaceProcessConsumer.as_asgi()),
]
