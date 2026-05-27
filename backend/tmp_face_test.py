import os
import django
import json
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ojt_backend.settings')
django.setup()

from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile
from security.models import FaceRegistration, OTPVerification
import io
from PIL import Image
import uuid
from django.conf import settings

print('Starting face test')

client = Client()

# Create neutral image
buf = io.BytesIO()
img = Image.new('RGB', (300,300), color=(128,128,128))
img.save(buf, format='JPEG')
buf.seek(0)
file_data = buf.read()
upload = SimpleUploadedFile('smoke.jpg', file_data, content_type='image/jpeg')

emp_id = f"debug-{uuid.uuid4().hex[:8]}"

expected_key = getattr(settings, 'SECURITY_API_KEY', '') or ''
extra_headers = {}
if expected_key:
    extra_headers['HTTP_X_OJT_API_KEY'] = expected_key

print('Posting to /api/face/register/ with employee_id', emp_id)
try:
    resp = client.post('/api/face/register/', data={'employee_id': emp_id, 'image': upload}, **extra_headers)
    print('Status:', resp.status_code)
    try:
        print('Body:', json.loads(resp.content.decode()))
    except Exception:
        print('Body raw:', resp.content.decode())
except Exception as e:
    import traceback
    print('Exception during register:', e)
    traceback.print_exc()

print('Querying DB for record')
reg = FaceRegistration.objects.filter(employee_id=emp_id).first()
print('DB record:', bool(reg))
if reg:
    print('has image:', bool(reg.image), 'has image_data:', bool(reg.image_data), 'face_encoding:', reg.face_encoding)

print('Posting to /api/face/verify/')
try:
    buf2 = io.BytesIO(file_data)
    upload2 = SimpleUploadedFile('smoke2.jpg', buf2.read(), content_type='image/jpeg')
    resp2 = client.post('/api/face/verify/', data={'employee_id': emp_id, 'captured_image': upload2}, **extra_headers)
    print('Status verify:', resp2.status_code)
    try:
        print('Body verify:', json.loads(resp2.content.decode()))
    except Exception:
        print('Body verify raw:', resp2.content.decode())
except Exception as e:
    import traceback
    print('Exception during verify:', e)
    traceback.print_exc()

print('Face test complete')
