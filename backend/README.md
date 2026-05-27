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

## Build prerequisites for face recognition

The `face-recognition` Python package depends on native libraries (notably `dlib`) and
requires system build tools to compile on the host machine. If you plan to install
`face-recognition` or `face_recognition_models` locally (or run the CI job), ensure the
following prerequisites are available:

- On Windows:
   - Install **Visual Studio Build Tools** (C++ toolchain) so `cl.exe` is available on PATH.
      Download from: https://visualstudio.microsoft.com/downloads/ (look for "Build Tools for Visual Studio").
   - Install **CMake** (https://cmake.org/) or add it to PATH. Newer Windows builds may also use the
      installer from kitware.

- On Ubuntu/Debian (CI uses these packages):
   - `build-essential`, `cmake`, `libopenblas-dev`, `liblapack-dev`, `libjpeg-dev`, and `pkg-config`.
      (The CI workflow installs these packages before pip.)

After the system prerequisites are installed, install Python packages:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install git+https://github.com/ageitgey/face_recognition_models
```

If you encounter build errors when installing `dlib`/`face-recognition`, the common cause is
missing C++ build tools or an unsupported compiler version. Installing the Visual Studio Build Tools
on Windows or the packages listed above on Linux usually resolves this.

## API key for mobile prototype

The mobile prototype can send a shared API key with requests. Set the key on the server
via environment variable `DJANGO_SECURITY_API_KEY`. Example (PowerShell):

```powershell
$env:DJANGO_SECURITY_API_KEY = 'supersecret123'
# or add to backend/.env: DJANGO_SECURITY_API_KEY=supersecret123
```

Then set the same key in your mobile client (for example, in its local config or runtime config).

The mobile registration endpoint (`POST /api/mobile/register/`) will reject requests with an invalid or
missing key when `DJANGO_SECURITY_API_KEY` is set.
