# ── Stage 1: Build Go backend ──────────────────────────────────
FROM golang:1.24-alpine AS builder-backend

WORKDIR /build
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# ── Stage 2: Build Next.js frontend ──────────────────────────
FROM node:22-alpine AS builder-frontend

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /build
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ .
RUN pnpm build

# ── Stage 3: Runtime ─────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache tini

WORKDIR /app

# Backend binary + migrations
COPY --from=builder-backend /server /app/backend/server
COPY backend/migrations /app/backend/migrations

# Frontend standalone build
COPY --from=builder-frontend /build/.next/standalone /app/frontend
COPY --from=builder-frontend /build/.next/static /app/frontend/.next/static
COPY --from=builder-frontend /build/public /app/frontend/public

# Entrypoint
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Data directory for SQLite
RUN mkdir -p /app/data

# Environment defaults
ENV PORT=8080
ENV DATABASE_URL=/app/data/planfast.db
ENV ALLOWED_ORIGINS=http://localhost:3000
ENV APP_URL=http://localhost:3000
ENV JWT_SECRET=change-me-in-production
ENV BACKEND_URL=http://localhost:8080
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/start.sh"]
