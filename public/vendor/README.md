This folder holds vendor JS assets that should be served from the same origin to avoid browser Tracking Prevention.

Use the downloader script in `scripts/download-face-api.js` to fetch `face-api.js` from the CDN and place it here:

Node.js required. Run from repository root:

```bash
node scripts/download-face-api.js
```

After the file is downloaded, commit `public/vendor/face-api.js` to the repo and redeploy the frontend so the app loads the local copy.
