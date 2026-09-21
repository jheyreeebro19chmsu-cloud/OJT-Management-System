#!/bin/sh
set -e

# Move to app directory
cd /app || exit 1

# Create media bucket if using S3/MinIO
if [ "${USE_MINIO:-0}" = "1" ] || [ "${USE_MINIO,,}" = "true" ]; then
	echo "Creating media bucket if missing..."
	python manage.py create_media_bucket || echo "create_media_bucket failed"
fi

# Pre-warm the DeepFace model so the FIRST real user request doesn't have to
# pay the one-time cost of downloading + loading model weights into memory.
echo "Pre-warming DeepFace model..."
python - <<'PYEOF'
try:
    from deepface import DeepFace
    DeepFace.build_model("VGG-Face")
    print("DeepFace model pre-warmed successfully.")
except Exception as e:
    print(f"DeepFace pre-warm failed (non-fatal, will lazy-load on first request): {e}")
PYEOF

# Run migrations (no input) then exec the provided command
python manage.py migrate --noinput

exec "$@"
