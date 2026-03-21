#!/bin/sh
set -e

echo "Starting plan.fast..."

# Start Go backend in background (uses PORT env var = 8080)
cd /app/backend
./server &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 30); do
  if wget -qO- http://localhost:${PORT:-8080}/health > /dev/null 2>&1; then
    echo "Backend ready on :${PORT:-8080}"
    break
  fi
  sleep 0.5
done

# Start Next.js frontend on port 3000 (override PORT so it doesn't conflict)
cd /app/frontend
echo "Frontend starting on :3000"
exec env PORT=3000 node server.js
