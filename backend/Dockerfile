# ── MedInsight backend ──────────────────────────────────────────────────────
# Simple development image.  Production hardening (non-root user, gunicorn,
# multi-stage build) will be added in a later step.

FROM python:3.12-slim

# Keeps Python from generating .pyc files and enables unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system-level build dependencies for psycopg2 (not needed for the
# *-binary wheel, but kept here in case we switch to the source package later)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY . .

EXPOSE 8000

# Run Django's development server.
# In production this will be replaced with gunicorn.
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
