#!/usr/bin/env bash
# End-to-end test for the decoy split.
# Requires: docker compose stack running (docker compose up --build -d).
# Reads secrets from .env, never prints them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# --- Read secrets from .env (never echo) ---
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found at $ENV_FILE" >&2
    exit 1
fi

# Source .env for INTERNAL_INGESTION_TOKEN (used only in API calls, never printed)
set -a
source "$ENV_FILE"
set +a

DECOY_URL="http://localhost:8080"
BACKEND_URL="http://localhost:8000"

pass=0
fail=0

check() {
    local desc="$1"
    local cond="$2"
    if [ "$cond" = "true" ]; then
        echo "  PASS: $desc"
        pass=$((pass + 1))
    else
        echo "  FAIL: $desc"
        fail=$((fail + 1))
    fi
}

echo "=== E2E Decoy Split Test ==="
echo ""

# --- 1. Admin paths on :8080 must return 404 ---
echo "--- Checking admin paths on decoy port :8080 ---"
for path in \
    /api/v1/auth/login \
    /api/v1/events \
    /api/v1/evidence \
    /api/v1/export/events \
    /api/v1/audit-logs \
    /api/v1/overview/metrics \
    /api/v1/internal/ingest \
    /api/v1/internal/ingest-batch \
    /docs \
    /redoc \
    /openapi.json
do
    status=$(curl -s -o /dev/null -w '%{http_code}' "$DECOY_URL$path" 2>/dev/null || echo "000")
    check "GET $path on :8080 returns 404" "$([ "$status" = "404" ] && echo true || echo false)"
done

# --- 2. Decoy login on :8080 returns a response ---
echo ""
echo "--- Checking decoy login on :8080 ---"
login_resp=$(curl -s -w '\n%{http_code}' -X POST "$DECOY_URL/api/v1/decoy/auth/login" \
    -d "username=test_attacker&password=test_password" \
    -H "X-Argus-Test-Token: e2e" 2>/dev/null || echo "000")
login_status=$(echo "$login_resp" | tail -1)
check "POST /decoy/auth/login returns 401" "$([ "$login_status" = "401" ] && echo true || echo false)"

# --- 3. Event appears in backend (poll up to 15s) ---
echo ""
echo "--- Checking event appears in backend ---"
# Login to backend to get JWT (uses seeded admin)
admin_user="${ADMIN_USERNAME:-argus_admin}"
admin_pass="${ADMIN_PASSWORD:-ArgusAdmin2026!ChangeMe}"
login_body=$(curl -s -X POST "$BACKEND_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$admin_user\",\"password\":\"$admin_pass\"}" 2>/dev/null || echo "{}")
jwt=$(echo "$login_body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || echo "")

events_found="false"
if [ -n "$jwt" ]; then
    for i in $(seq 1 8); do  # 8 x 2s = 16s max
        events_resp=$(curl -s "$BACKEND_URL/api/v1/events?limit=1" \
            -H "Authorization: Bearer $jwt" 2>/dev/null || echo "{}")
        events_count=$(echo "$events_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('events',[])))" 2>/dev/null || echo "0")
        if [ "$events_count" -gt 0 ] 2>/dev/null; then
            events_found="true"
            break
        fi
        sleep 2
    done
fi
check "Event from decoy appears in backend API" "$events_found"

# --- 4. Stop backend, hit decoy, restart backend, event arrives ---
echo ""
echo "--- Checking spool + replay ---"
echo "  Stopping backend..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" stop argus-backend 2>/dev/null
sleep 2

# Hit decoy while backend is down
curl -s -o /dev/null -X POST "$DECOY_URL/api/v1/decoy/auth/login" \
    -d "username=spool_test&password=spooled_pass" \
    -H "X-Argus-Test-Token: e2e" 2>/dev/null || true
echo "  Sent decoy login while backend down"

echo "  Restarting backend..."
docker compose -f "$PROJECT_DIR/docker-compose.yml" start argus-backend 2>/dev/null
echo "  Polling for spooled event delivery (up to 40s)..."

# Poll every 2s for up to 40s for the spooled event to appear
spool_found="false"
for i in $(seq 1 20); do  # 20 x 2s = 40s max
    if [ -z "$jwt" ]; then
        break
    fi
    events_resp=$(curl -s "$BACKEND_URL/api/v1/events?limit=10" \
        -H "Authorization: Bearer $jwt" 2>/dev/null || echo "{}")
    has_spool=$(echo "$events_resp" | python3 -c "
import sys,json
d=json.load(sys.stdin)
events = d.get('events',[])
print('true' if any('spool_test' in str(e.get('metadata_payload',{}).get('injected_username','')) for e in events) else 'false')
" 2>/dev/null || echo "false")
    if [ "$has_spool" = "true" ]; then
        spool_found="true"
        break
    fi
    sleep 2
done
check "Spooled event delivered after backend restart" "$spool_found"

# --- Summary ---
echo ""
echo "=== Results: $pass passed, $fail failed ==="
exit $fail
