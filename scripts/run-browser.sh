#!/usr/bin/env bash
# Browser verification: boot full stack (DB + API + Web), then drive the UI
# with agent-browser: login → discover → project tabs → radar → admin → settings.
set -e
cd /home/z/my-project/my-fullstack-agent-app

cleanup() {
  echo "[browser] stopping..."
  kill $WEB_PID $API_PID $DB_PID 2>/dev/null || true
  agent-browser close 2>/dev/null || true
  sleep 1
}
trap cleanup EXIT

for port in 4000 3000; do
  pids=$(ss -ltnp 2>/dev/null | rg ":$port " | rg -o 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
done
sleep 1

echo "[browser] database..."
node scripts/dev-db.mjs > /tmp/db.log 2>&1 &
DB_PID=$!
sleep 8

echo "[browser] api..."
cd apps/api
NODE_ENV=development node dist/main.js > /tmp/api.log 2>&1 &
API_PID=$!
cd ../..
for i in $(seq 1 30); do curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1 && break; sleep 1; done
curl -sf http://localhost:4000/api/v1/health > /dev/null && echo "API ready"

echo "[browser] seed..."
node scripts/seed.mjs --force 2>&1 | tail -1

echo "[browser] web (next start)..."
cd apps/web
node_modules/.bin/next start -p 3000 > /tmp/web.log 2>&1 &
WEB_PID=$!
cd ../..
for i in $(seq 1 30); do curl -sf http://localhost:3000/login > /dev/null 2>&1 && break; sleep 1; done
curl -sf -o /dev/null http://localhost:3000/login && echo "Web ready"

echo "=== STEP 1: login page renders ==="
agent-browser open http://localhost:3000/login
agent-browser wait --text "TalentShowcase"
agent-browser snapshot -i -c

echo "=== STEP 2: login as alice ==="
agent-browser find label "Email" fill "alice@company.com"
agent-browser find label "Password" fill "password123"
agent-browser find text "Sign in" click
agent-browser wait --text "Discover"
echo "URL now: $(agent-browser get url)"
agent-browser snapshot -i -c | head -40

echo "=== STEP 3: open first project detail ==="
agent-browser find text "Customer Feedback Analytics Dashboard" click
agent-browser wait --text "Overview"
sleep 1
agent-browser snapshot -i -c | head -50

echo "=== STEP 4: AI reports tab ==="
agent-browser find text "AI Reports" click
sleep 1
agent-browser snapshot -i -c | head -30

echo "=== STEP 5: files tab + preview ==="
agent-browser find text "Files " click
sleep 1
agent-browser find text "README.md" click
sleep 1
agent-browser snapshot -i -c | head -40

echo "=== STEP 6: reviews tab ==="
agent-browser find text "Reviews " click
sleep 1
agent-browser snapshot -i -c | head -40

echo "=== STEP 7: skill radar page ==="
agent-browser find text "Skill Radar" click
agent-browser wait --text "Your Radar"
sleep 1
agent-browser snapshot -i -c | head -40

echo "=== STEP 8: settings + MFA ==="
agent-browser find text "Settings" click
agent-browser wait --text "Two-Factor Authentication"
agent-browser find text "Set up MFA" click
sleep 2
agent-browser screenshot /tmp/ui-mfa-setup.png
agent-browser snapshot -i -c | head -30

echo "=== STEP 9: logout, login as HR, admin dashboard ==="
agent-browser find text "Sign out" click
agent-browser wait --text "Sign in"
agent-browser find label "Email" fill "bob@company.com"
agent-browser find label "Password" fill "password123"
agent-browser find text "Sign in" click
agent-browser wait --text "Admin"
agent-browser open http://localhost:3000/admin
agent-browser wait --text "Audit Log"
sleep 1
agent-browser screenshot /tmp/ui-admin.png
agent-browser snapshot -i -c | head -50

echo "=== STEP 10: screenshots of key screens ==="
agent-browser open http://localhost:3000/discover
agent-browser wait --text "Discover"
agent-browser screenshot /tmp/ui-discover.png
agent-browser open http://localhost:3000/radar
agent-browser wait --text "Your Radar" || true
sleep 1
agent-browser screenshot /tmp/ui-radar.png

echo "[browser] done"
