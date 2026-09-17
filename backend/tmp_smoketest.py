import os
import django
import json
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ojt_backend.settings')
django.setup()

from django.test import Client
from security.models import OTPVerification
from django.core.files.uploadedfile import SimpleUploadedFile
from security.models import FaceRegistration
import io
from PIL import Image
import base64
import uuid
from django.conf import settings

email = 'smoketest@example.com'
# Clean previous test OTPs
OTPVerification.objects.filter(email=email).delete()
# Create a verified OTP so registration won't reject
otp = OTPVerification.objects.create(
    email=email,
    otp_code='000000',
    expires_at=timezone.now() + timedelta(minutes=10),
    is_verified=True
)

client = Client()

reg_payload = {
    'email': email,
    'password': 'TestPass123!',
    'first_name': 'Smoke',
    'last_name': 'Tester',
}

resp = client.post('/api/auth/register-student/', data=json.dumps(reg_payload), content_type='application/json')
register_result = {'status_code': resp.status_code}
try:
    register_result['body'] = json.loads(resp.content.decode())
except Exception:
    register_result['body'] = resp.content.decode()

login_payload = {'email': email, 'password': 'TestPass123!'}
resp2 = client.post('/api/auth/login/', data=json.dumps(login_payload), content_type='application/json')
login_result = {'status_code': resp2.status_code}
try:
    login_result['body'] = json.loads(resp2.content.decode())
except Exception:
    login_result['body'] = resp2.content.decode()

output = {
    'register': register_result,
    'login': login_result,
}

# --- Face registration smoke test ---
emp_id = f"smoke-{uuid.uuid4().hex[:8]}"

# Create a neutral gray image (passes brightness check)
buf = io.BytesIO()
img = Image.new('RGB', (300, 300), color=(128, 128, 128))
img.save(buf, format='JPEG')
buf.seek(0)
file_data = buf.read()
upload = SimpleUploadedFile('smoke.jpg', file_data, content_type='image/jpeg')

# Add API key header if SECURITY_API_KEY is configured
expected_key = getattr(settings, 'SECURITY_API_KEY', '') or ''
extra_headers = {}
if expected_key:
    extra_headers['HTTP_X_OJT_API_KEY'] = expected_key

resp3 = client.post('/api/face/register/', data={'employee_id': emp_id, 'image': upload}, **extra_headers)
register_face_result = {'status_code': resp3.status_code}
try:
    register_face_result['body'] = json.loads(resp3.content.decode())
except Exception:
    register_face_result['body'] = resp3.content.decode()

# Refresh from DB
reg_obj = FaceRegistration.objects.filter(employee_id=emp_id).first()
db_record = None
if reg_obj:
    db_record = {
        'employee_id': reg_obj.employee_id,
        'has_image_file': bool(reg_obj.image),
        'has_image_data': bool(reg_obj.image_data),
        'image_format': getattr(reg_obj, 'image_format', None),
    }

# Attempt verify (may return 501 if face_recognition not installed)
buf2 = io.BytesIO(file_data)
upload2 = SimpleUploadedFile('smoke2.jpg', buf2.read(), content_type='image/jpeg')
resp4 = client.post('/api/face/verify/', data={'employee_id': emp_id, 'captured_image': upload2}, **extra_headers)
verify_result = {'status_code': resp4.status_code}
try:
    verify_result['body'] = json.loads(resp4.content.decode())
except Exception:
    verify_result['body'] = resp4.content.decode()

output.update({
    'register_face': register_face_result,
    'face_db_record': db_record,
    'verify_face': verify_result,
})

with open('tmp_smoketest_output.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2)

print('Smoke test complete; results written to tmp_smoketest_output.json')
