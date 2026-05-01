#!/bin/bash
# DISTRIBUTION-CLOSEOUT-W1 R4: send Telegram reminder for one day's exchange submission.
# Usage: send.sh <day-num> <exchange-name> <target-url>
# 2026-05-01 fix: dropped parse_mode=Markdown — Telegram's Markdown parser
# rejects underscores inside URLs (e.g. agent_hub) as unmatched italic markers
# with HTTP 400. Plain text avoids all parse-mode pitfalls. We also tee the
# curl output so future failures aren't swallowed by atd's silent stdout.
set -euo pipefail
DAY=${1:?day-num required}
EX=${2:?exchange required}
URL=${3:?target-url required}
. /opt/crypto-quant-signal-mcp/.env
MSG="📣 DISTRIBUTION-CLOSEOUT-W1 Day $DAY reminder

Today's exchange: $EX
Target URL: $URL

Open docs/DISTRIBUTION_SCHEDULE.md in algovault-skills repo, copy the Day $DAY pre-rendered body, paste into the GitHub UI, then paste the resulting URL back to Code.

Live numbers re-fetch:
curl -fsS https://algovault.com/api/performance-public | jq '{pfe: .overall.pfeWinRate, calls: .overall.totalCalls}'
"
LOG=/var/log/algovault-distribution-reminders.log
mkdir -p $(dirname $LOG)
RESPONSE=$(curl -sS -w '\nHTTP %{http_code}\n' -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=$MSG" 2>&1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] day=$DAY ex=$EX url=$URL" >> $LOG
echo "  response: $RESPONSE" >> $LOG
# Echo to stdout AND require HTTP 200 (so atd-fired runs fail loudly if Telegram errors)
echo "$RESPONSE" | grep -q 'HTTP 200' && echo "sent day-$DAY reminder for $EX" || (echo "FAILED day-$DAY reminder for $EX: $RESPONSE"; exit 1)
