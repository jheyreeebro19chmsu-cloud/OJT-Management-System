#!/usr/bin/env bash
set -euo pipefail

# Render startup script: ensure face-photos bucket exists before starting the app.
# Usage (Render): set the "Start Command" to: sh backend/scripts/render_startup.sh

if [ -z "${SUPABASE_URL-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY-}" ]; then
  echo "Warning: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set. Skipping bucket creation."
else
  echo "Creating Supabase bucket 'face-photos' (if not exists)..."
  python backend/scripts/create_supabase_bucket.py || echo "Bucket creation script failed (continuing)."
fi

# Start the web server. Replace the following with your actual start command if different.
if [ -n "${PORT-}" ]; then
  echo "Starting gunicorn on port $PORT"
  exec gunicorn ojt_backend.wsgi:application --bind 0.0.0.0:${PORT}
else
  echo "PORT not set; starting Django development server on 0.0.0.0:8000"
  exec python manage.py runserver 0.0.0.0:8000
fi
