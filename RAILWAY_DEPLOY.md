# Railway deployment (monorepo)

This repo contains:

- `backend/` → Django REST API (recommended to deploy on Railway)
- `/` → Vite/React frontend (often deployed on Vercel/Netlify; can also be deployed on Railway)

## Deploy the Django backend on Railway

1. Push this repo to GitHub (Railway deploys from your GitHub repo).
2. In Railway: **New Project** → **Deploy from GitHub Repo** → select this repo.
3. Create/select a service for the backend, then in that service:
   - **Settings → Root Directory**: set to `backend`
   - Railway should auto-detect and build using `backend/Dockerfile`.
4. (Optional) Add a PostgreSQL database:
   - **Add → Database → PostgreSQL**
   - In your backend service Variables, add a reference variable:
     - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
5. Add backend service environment variables (Variables tab):
   - `DJANGO_SECRET_KEY=...` (generate a long random string)
   - `DJANGO_DEBUG=0`
   - `DJANGO_USE_HTTPS=1`
   - `DJANGO_ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}`
   - `DJANGO_CORS_ORIGINS=https://YOUR-FRONTEND-DOMAIN` (comma-separated if multiple)
6. Deploy, then verify:
   - `https://<your-backend>.up.railway.app/api/health/`

## Point the frontend to Railway

Wherever you deploy the frontend, set:

- `VITE_DJANGO_API_URL=https://<your-backend>.up.railway.app/api`

Then rebuild/redeploy the frontend (Vite env vars are build-time).

## Notes

- `backend/media/` is local filesystem storage and **won't be durable** on most PaaS deployments.
  For production, move media to object storage (S3/R2/Supabase Storage, etc.).
