# Django Backend (Face Recognition + Geofencing)

This backend exposes secure endpoints for geofence validation and facial verification.

## Setup
1. Create a virtual environment.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Create migrations for the security app (first time only):
   `python manage.py makemigrations security`
4. Run migrations:
   `python manage.py migrate`
5. Start the server:
   `python manage.py runserver`

## Frontend Integration
Set this in the frontend `.env` file:
`VITE_DJANGO_API_URL=http://127.0.0.1:8000/api`

## Endpoints
- `POST /api/geofence/check/`
- `POST /api/face/register/`
- `POST /api/face/verify/`
- `POST /api/attendance/photo/`
- `GET /api/health/`

Images are stored under `backend/media/` while in development. Configure a proper
media storage solution before production use.

Note: `face-recognition` requires native dependencies (dlib). Install them if the
package fails to build on your machine.

## API key for mobile prototype

The mobile prototype can send a shared API key with requests. Set the key on the server
via environment variable `DJANGO_SECURITY_API_KEY`. Example (PowerShell):

```powershell
$env:DJANGO_SECURITY_API_KEY = 'supersecret123'
# or add to backend/.env: DJANGO_SECURITY_API_KEY=supersecret123
```

Then set the same key in the Expo app (either in `mobile/expo-app/src/config.json` for quick testing,
or pass as an environment variable when running Expo — see `mobile/expo-app/app.config.js`).

The mobile registration endpoint (`POST /api/mobile/register/`) will reject requests with an invalid or
missing key when `DJANGO_SECURITY_API_KEY` is set.
