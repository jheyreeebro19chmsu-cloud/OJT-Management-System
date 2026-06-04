import os
import sys
import pathlib
import json

# Ensure backend on path
sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ojt_backend.settings')

import django
django.setup()

import requests
from django.contrib.auth.models import User
from django.db import transaction

SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_TOKEN = os.environ.get('SUPABASE_TOKEN')

if not SUPABASE_URL or not SUPABASE_TOKEN:
    print(json.dumps({'error': 'SUPABASE_URL and SUPABASE_TOKEN env vars required'}))
    raise SystemExit(1)

userinfo_url = SUPABASE_URL.rstrip('/') + '/auth/v1/user'
headers = {'Authorization': f'Bearer {SUPABASE_TOKEN}', 'apikey': SUPABASE_TOKEN}

try:
    r = requests.get(userinfo_url, headers=headers, timeout=10)
    if r.status_code != 200:
        print(json.dumps({'error': 'supabase request failed', 'status_code': r.status_code, 'body': r.text}))
        raise SystemExit(1)
    info = r.json()
except Exception as e:
    print(json.dumps({'error': 'failed to call supabase', 'detail': str(e)}))
    raise SystemExit(1)

email = info.get('email')
if not email:
    print(json.dumps({'error': 'email not found in supabase response', 'response': info}))
    raise SystemExit(1)

# Create or update Django user
from security.models import UserRole, Student, OJTInstructor, HTE

with transaction.atomic():
    user, created = User.objects.get_or_create(username=email, defaults={'email': email, 'first_name': info.get('user_metadata', {}).get('first_name', ''), 'last_name': info.get('user_metadata', {}).get('last_name', '')})
    role_row = UserRole.objects.filter(user=user).first()
    role = role_row.role if role_row else 'student'
    if not role_row:
        UserRole.objects.create(user=user, role='student', is_verified=True)
        if not Student.objects.filter(user=user).exists():
            Student.objects.create(user=user)

print(json.dumps({'success': True, 'created': created, 'user': {'id': user.id, 'email': user.email, 'name': user.get_full_name(), 'role': role}}))
