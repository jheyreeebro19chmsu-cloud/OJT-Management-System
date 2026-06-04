import os
import sys
import pathlib
# Ensure backend package is on sys.path so DJANGO settings can be imported
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ojt_backend.settings')
import django
django.setup()
from django.core.files.base import ContentFile
from django.contrib.auth.models import User
from security.models import FaceRegistration
from PIL import Image
import io

EMAIL = 'jheyreeebro19.chmsu@gmail.com'

u = User.objects.filter(email__iexact=EMAIL).first()
if not u:
    print('user not found')
    raise SystemExit(1)
fr = FaceRegistration.objects.filter(user=u).first()
if not fr:
    print('face registration not found, creating')
    fr = FaceRegistration.objects.create(user=u, employee_id=f'emp_{u.id}')

# create image
img = Image.new('RGB', (400, 400), (120, 150, 200))
buf = io.BytesIO()
img.save(buf, format='JPEG')
buf.seek(0)
content = ContentFile(buf.read())
filename = f'avatar_user_{u.id}.jpg'
fr.image.save(filename, content, save=True)
fr.face_registered = True
fr.save()
print('ok', fr.id, fr.image.name)
