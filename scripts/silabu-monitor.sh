#!/bin/bash
# silabu-monitor.sh — Post-release watchdog for SILABU DIGI
# Runs every 30min. Reports only when NEW errors detected.
# Silent when everything is healthy.

STATE_FILE="/tmp/silabu-monitor-last-check"
LOG_FILE="/root/.pm2/logs/silabu-api-error-0.log"

# Get last check timestamp (or 0 if first run)
LAST_CHECK=0
if [ -f "$STATE_FILE" ]; then
    LAST_CHECK=$(cat "$STATE_FILE")
fi
NOW=$(date +%s)
echo "$NOW" > "$STATE_FILE"

# 1. Check API health
HEALTH=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3010/api/health 2>/dev/null)
if [ "$HEALTH" != "200" ]; then
    echo "🔴 CRITICAL: API health check failed (HTTP $HEALTH)"
    echo "Time: $(date -u '+%Y-%m-%d %H:%M UTC')"
    echo "Action: Check PM2 status, consider pm2 restart silabu-api"
    exit 0
fi

# 2. Check PM2 process status
PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    p=d[0]
    print(f\"status={p['pm2_env']['status']} restarts={p['pm2_env']['restart_time']} mem={p['monit']['memory']} cpu={p['monit']['cpu']}\")
except: print('PARSE_ERROR')
" 2>/dev/null)

RESTARTS=$(echo "$PM2_STATUS" | grep -oP 'restarts=\K[0-9]+')
if [ "${RESTARTS:-0}" -gt 12 ]; then
    echo "🔴 WARNING: PM2 restart count high ($RESTARTS)"
    echo "Status: $PM2_STATUS"
    echo "Time: $(date -u '+%Y-%m-%d %H:%M UTC')"
fi

# 3. Check for NEW errors in PM2 error log since last check
if [ -f "$LOG_FILE" ]; then
    NEW_ERRORS=$(awk -v since="$LAST_CHECK" '
    /^\d{4}-\d{2}-\d{2}T/ {
        split($1, a, "T"); split(a[1], d, "-"); split(a[2], t, ":");
        ts = mktime(d[1]" "d[2]" "d[3]" "t[1]" "t[2]" "substr(t[3],1,2));
        if (ts > since) found=1
    }
    found { print }
    ' "$LOG_FILE" 2>/dev/null)
    
    if [ -n "$NEW_ERRORS" ]; then
        ERROR_COUNT=$(echo "$NEW_ERRORS" | grep -c "Error\|ERROR\|error" 2>/dev/null || echo 0)
        if [ "$ERROR_COUNT" -gt 0 ]; then
            echo "🟡 PM2 Error Log — $ERROR_COUNT new error(s) since last check"
            echo "Time: $(date -u '+%Y-%m-%d %H:%M UTC')"
            echo ""
            echo "$NEW_ERRORS" | tail -20
        fi
    fi
fi

# 4. Quick endpoint spot-check (dashboard, neraca)
for ENDPOINT in "/api/accounting/dashboard-summary" "/api/accounting/neraca?tahun=2026"; do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:3010$ENDPOINT" 2>/dev/null)
    if [ "$CODE" != "200" ] && [ "$CODE" != "401" ]; then
        echo "🟡 Endpoint issue: $ENDPOINT → HTTP $CODE"
    fi
done

# Silent exit if everything is healthy
exit 0
