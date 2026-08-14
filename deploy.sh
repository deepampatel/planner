#!/usr/bin/env bash
# Deploy plann.fast to production.
# Builds locally (the droplet is too small to build on), ships via rsync,
# restarts systemd services. Migrations auto-apply on backend startup.
set -euo pipefail

SERVER="root@165.232.185.171"
REMOTE_DIR="/opt/planfast"
ROOT="$(cd "$(dirname "$0")" && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# A running `pnpm dev` shares .next with the production build and corrupts it
if lsof -iTCP:3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "ERROR: something is listening on :3000 (pnpm dev?). Stop it first." >&2
  exit 1
fi

echo "==> Backing up production database"
ssh "$SERVER" "mkdir -p $REMOTE_DIR/backups && cp $REMOTE_DIR/data/planfast.db $REMOTE_DIR/backups/planfast-\$(date +%Y%m%d-%H%M%S).db"

echo "==> Building backend (linux/amd64)"
cd "$ROOT/backend"
mkdir -p "$STAGE/backend"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o "$STAGE/backend/server" ./cmd/server
cp -R "$ROOT/backend/migrations" "$STAGE/backend/migrations"

echo "==> Building frontend (standalone)"
cd "$ROOT/frontend"
corepack pnpm build
mkdir -p "$STAGE/frontend/.next/static"
cp -R .next/standalone/. "$STAGE/frontend/"
cp -R .next/static/. "$STAGE/frontend/.next/static/"
cp -R public "$STAGE/frontend/public"

echo "==> Syncing to $SERVER"
rsync -az --delete --exclude 'data' "$STAGE/backend" "$STAGE/frontend" "$SERVER:$REMOTE_DIR/"

echo "==> Restarting services"
# The frontend needs APP_URL so Next.js emits absolute https://plann.fast
# URLs in og:image metadata (idempotent; EnvironmentFile is not usable here
# because planfast.env's PORT=8080 would override the frontend's PORT=3000)
ssh "$SERVER" "grep -q 'APP_URL' /etc/systemd/system/planfast-frontend.service || { sed -i '/Environment=NODE_ENV=production/a Environment=APP_URL=https://plann.fast' /etc/systemd/system/planfast-frontend.service && systemctl daemon-reload; }"
ssh "$SERVER" "chown -R planfast:planfast $REMOTE_DIR/backend $REMOTE_DIR/frontend && chmod +x $REMOTE_DIR/backend/server && systemctl restart planfast-backend planfast-frontend"

echo "==> Health check"
sleep 3
ssh "$SERVER" "systemctl is-active planfast-backend planfast-frontend && curl -sf http://localhost:8080/health && curl -sfo /dev/null http://localhost:3000"
curl -sfo /dev/null --max-time 20 https://plann.fast && echo "https://plann.fast is up ✓"
