#!/bin/sh
set -e

# Move to app directory
cd /app || exit 1

# Create media bucket if using S3/MinIO
if [ "${USE_MINIO:-0}" = "1" ] || [ "${USE_MINIO:-0}" = "true" ]; then
	echo "Creating media bucket if missing..."
	python manage.py create_media_bucket || echo "create_media_bucket failed"
fi

# Pre-warm InsightFace model
echo "Initializing InsightFace model..."
python - <<'PYEOF'
try:
    from insightface_service import get_face_analysis_app
    app = get_face_analysis_app()
    if app:
        print("InsightFace model initialized successfully.")
except Exception as e:
    print(f"InsightFace notice (lazy load on first request): {e}")
PYEOF

# Run migrations (no input) then exec the provided command
python manage.py migrate --noinput || echo "Migrations notice"

exec "$@"
