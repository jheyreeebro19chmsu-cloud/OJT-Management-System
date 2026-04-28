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
