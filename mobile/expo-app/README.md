Expo mobile prototype for OJT registration

Setup

1. Install dependencies (run inside `mobile/expo-app`):

```bash
npm install
expo install expo-location expo-camera
```

2. Run the app:

```bash
npm start
# then open in Expo Go or simulator
```

Notes
- Requests location and camera permission on user action.
- Captures location, reverse-geocodes to an address, captures photo, and submits multipart form to your backend.

Configure backend URL
- Edit `mobile/expo-app/src/config.json` and set the `BACKEND` value to your dev machine IP and port, for example:

```json
{
	"BACKEND": "http://192.168.1.42:8000"
}
```

Run both services from VS Code
- Terminal 1 (backend):

```powershell
cd backend
& ".\.venv\Scripts\Activate.ps1"
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

- Terminal 2 (mobile):

```bash
cd mobile/expo-app
npm install
expo start
```

Testing notes
- Use the `Tunnel` option in Expo if your phone cannot reach the dev IP.
- Replace `BACKEND` with an ngrok HTTPS URL when using Tunnel or testing from other networks.

