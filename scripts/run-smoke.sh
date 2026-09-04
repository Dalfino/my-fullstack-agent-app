#!/usr/bin/env bash
# Boot DB + seed + API, then run the smoke tests — all within one session.
set -e
cd /home/z/my-project/my-fullstack-agent-app

cleanup() {
  echo "[run] stopping processes..."
  kill $API_PID $DB_PID 2>/dev/null || true
  sleep 1
}
trap cleanup EXIT

# Kill any strays from previous runs holding our ports
for port in 4000; do
  pids=$(ss -ltnp 2>/dev/null | rg ":$port " | rg -o 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
done
sleep 1

echo "[run] starting database..."
node scripts/dev-db.mjs > /tmp/db.log 2>&1 &
DB_PID=$!
sleep 8

echo "[run] starting API (creates/updates schema via synchronize)..."
cd apps/api
NODE_ENV=development node dist/main.js > /tmp/api.log 2>&1 &
API_PID=$!
cd ../..

# Wait for API readiness (schema is now in place)
for i in $(seq 1 30); do
  if curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; then
    echo "[run] API ready after ${i}s"
    break
  fi
  sleep 1
done
if ! curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; then
  echo "[run] API FAILED to start:"; tail -30 /tmp/api.log
  kill $DB_PID 2>/dev/null || true
  exit 1
fi

echo "[run] seeding..."
node scripts/seed.mjs --force 2>&1 | tail -3

echo "[run] running smoke tests..."
node scripts/smoke-test.mjs
SMOKE_EXIT=$?

echo "[run] stopping processes..."
kill $API_PID $DB_PID 2>/dev/null || true
sleep 1
exit $SMOKE_EXIT
