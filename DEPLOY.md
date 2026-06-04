Deploy instructions — OJT Management System (frontend)

This file explains what to deploy for the frontend SPA after running a production build.

1) Build (locally)
- Install node deps (if not already):

  npm install

- Create the production build:

  npm run build

This produces a `dist/` folder in the project root.

2) Exact files to upload
- Upload the entire contents of the `dist/` directory, preserving the folder structure.
  - `dist/index.html`
  - `dist/assets/*` (all JS, CSS, images, fonts, maps, vendor chunks)

Do NOT upload only a subset — code-splitting produces many chunk files; missing ones cause runtime "Failed to fetch dynamically imported module" errors on clients (mobile/desktop).

3) Important configuration notes
- Vite `base` is set to `'./'` so assets are referenced relative to the page. Serve `index.html` from the path where users open the app (e.g., `/app/`).
- Ensure static asset routes (e.g., `/assets/*`) are served as static files and not rewritten to `index.html`.
- Set correct MIME types for JS/CSS (your host will normally do this).
- If you use a CDN, invalidate or purge the CDN cache after deploy so old index.html / chunk maps don't reference removed filenames.
- If you previously had a service worker, unregister it (or bump the service worker version). Cached files can cause the app to request non-existent chunk names.

4) Common hosting examples
- Static hosting (S3 + CloudFront): upload full `dist/` contents to the bucket root or the target path; set `index.html` as the default root object; purge CloudFront distribution.
- Nginx (self-hosted): copy `dist/` into a public folder and use this minimal config:

  location /app/ {
    root /var/www/your-site; # ensure /var/www/your-site/app/index.html exists
    try_files $uri $uri/ /app/index.html;
  }

- Vercel / Render: point the project to the repo (or upload `dist/`) — ensure the build step runs `npm run build` and the static publish directory is `dist`.

5) Troubleshooting
- 404 for a chunk (e.g. Dashboard-*.js): missing file on server or wrong base path. Re-upload full `dist/` and clear cache.
- Response is HTML when requesting a chunk: your server rewrite is returning `index.html` for `/assets/*`; fix static file route precedence.
- Incognito / Clear cache after deploy to bypass old service-worker or cached index.html.

6) If you want, I can:
- Produce a one-file nginx config tuned to your deploy path (e.g., `/app/`).
- Generate a short PowerShell/CLI script to copy `dist/` to S3 with correct content-types.


That's it — upload the full `dist/` folder and redeploy. If you paste one failing chunk URL (from mobile DevTools Network), I can interpret the server response and advise the exact fix.
