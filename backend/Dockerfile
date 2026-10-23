# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install security updates and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged user (UID 10001)
RUN groupadd -g 10001 argus && \
    useradd -u 10001 -g argus -s /bin/false -m argus

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY backend /app/backend
COPY scripts /app/scripts
COPY decoy /app/decoy
COPY alembic.ini /app/alembic.ini

# Set working directory to app root
WORKDIR /app

# Ensure quarantine storage exists with restrictive permissions
RUN mkdir -p /var/lib/argus/quarantine /var/lib/argus/decoy_spool /var/lib/argus/mysql-spool /app/data && \
    chown -R argus:argus /app /var/lib/argus/quarantine /var/lib/argus/decoy_spool /var/lib/argus/mysql-spool /app/data && \
    chmod 700 /var/lib/argus/quarantine

# Run as unprivileged user
USER argus

ENV PYTHONPATH=/app/backend \
    QUARANTINE_STORAGE_DIR=/var/lib/argus/quarantine

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health/live || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
