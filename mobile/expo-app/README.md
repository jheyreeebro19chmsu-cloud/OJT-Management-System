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

Using environment variables (recommended for dev builds)
- Instead of editing `src/config.json`, you can inject values at runtime via environment variables using `app.config.js`. This avoids committing secrets into source files.

Examples:

Unix / macOS:
```bash
BACKEND=http://192.168.1.42:8000 API_KEY=supersecret123 expo start
```

Windows PowerShell:
```powershell
$env:BACKEND='http://192.168.1.42:8000'
$env:API_KEY='supersecret123'
expo start
```

When using this flow the app reads `BACKEND` and `API_KEY` from `Constants.expoConfig.extra` (provided by `app.config.js`). `src/config.json` remains as a fallback.

