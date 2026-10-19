FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system runtime dependencies for OpenCV and InsightFace
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and wheel
RUN python -m pip install --upgrade pip setuptools wheel

# Install Python requirements
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

# Pre-download buffalo_s model during build time (eliminates runtime memory spikes)
RUN python -c "from insightface.app import FaceAnalysis; FaceAnalysis(name='buffalo_s', allowed_modules=['detection', 'recognition'])" || true

# Copy application code
COPY . /app/

# Entrypoint that runs migrations before starting the process
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["sh", "-c", "python manage.py collectstatic --noinput && python -m gunicorn ojt_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --timeout 120 --log-level info"]
