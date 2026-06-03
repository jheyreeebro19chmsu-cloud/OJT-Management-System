FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install system build dependencies required to compile dlib and its native deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential cmake python3-dev python3-venv \
       libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev \
       libboost-all-dev libjpeg-dev libpng-dev pkg-config git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and wheel
RUN python -m pip install --upgrade pip setuptools wheel

# Install dlib first (will compile) and the face libraries
RUN python -m pip install dlib==19.24.1
RUN python -m pip install face_recognition face_recognition_models

# Install Python requirements if present
COPY backend/requirements.txt backend/requirements.txt
RUN if [ -f backend/requirements.txt ]; then python -m pip install -r backend/requirements.txt; fi

# Copy application code
COPY backend/ /app/

# Entrypoint that runs migrations before starting the process
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
COPY . .
CMD ["sh", "-c", "python manage.py migrate && python manage.py check && python manage.py collectstatic --noinput && python -m gunicorn ojt_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --log-level debug"]
