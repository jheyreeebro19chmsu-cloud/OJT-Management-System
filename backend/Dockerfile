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
CMD ["sh", "-c", "python manage.py migrate && python manage.py check && python -m gunicorn ojt_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --log-level debug"]