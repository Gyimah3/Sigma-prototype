# ── Stage 1: Build Frontend ──────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/yarn.lock* frontend/package-lock.json* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

COPY frontend/ ./

RUN npm run build


# ── Stage 2: Backend + Serve ────────────────────────────────────
FROM python:3.13-slim AS runtime

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Install Python dependencies
COPY backend/pyproject.toml backend/uv.lock* ./backend/
WORKDIR /app/backend
RUN uv sync --no-dev

# Copy backend source
COPY backend/ ./

# Copy built frontend static files
COPY --from=frontend-build /app/frontend/out /app/frontend/out

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
