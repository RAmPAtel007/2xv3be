# syntax=docker/dockerfile:1
# One image: FastAPI serves the API under /api and the built React app at /.

# --- 1. Build the React app --------------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- 2. Python runtime -------------------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    WINDDESK_STATIC_DIR=/app/static
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/winddesk ./winddesk
COPY backend/scripts ./scripts
COPY backend/data ./data
COPY --from=web /web/dist ./static

RUN useradd --create-home winddesk && chown -R winddesk /app
USER winddesk

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health')"

# Shell form so $PORT (set by Heroku) is expanded.
CMD uvicorn winddesk.main:app --host 0.0.0.0 --port ${PORT}
