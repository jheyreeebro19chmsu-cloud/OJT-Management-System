#!/bin/sh
set -e

# Move to app directory
cd /app || exit 1

# Create media bucket if using S3/MinIO
if [ "${USE_MINIO:-0}" = "1" ] || [ "${USE_MINIO,,}" = "true" ]; then
	echo "Creating media bucket if missing..."
	python manage.py create_media_bucket || echo "create_media_bucket failed"
fi

# Run migrations (no input) then exec the provided command
python manage.py migrate --noinput

exec "$@"
