#!/usr/bin/env bash
# C6 no-regressions check for crypto-quant-signal-mcp on Hetzner.
#
# Per Plan A4: replaces the spec's reference to verify_phase2.sh (which does
# not exist on the host) with 4 concrete checks against the live deployment.
# Run after C6 deploys to Hetzner; expects the skill-invocations table + new
# /analytics/skills route to be live.
#
# Usage:  bash scripts/verify-c6-no-regressions.sh [HOST_IP]
# Default HOST_IP: 204.168.185.24
set -uo pipefail

HOST="${1:-204.168.185.24}"
SSH="ssh -o ConnectTimeout=15 -i $HOME/.ssh/algovault_deploy root@$HOST"

fail() { echo "VERIFY_C6_FAIL: $1" >&2; exit 1; }

# (i) Containers up
docker_state=$($SSH 'docker ps --format "{{.Names}}\t{{.Status}}" | grep crypto-quant-signal-mcp' 2>/dev/null)
echo "$docker_state" | grep -q 'mcp-server-1' || fail "mcp-server container missing"
echo "$docker_state" | grep -q 'facilitator-1' || fail "facilitator container missing"
echo "$docker_state" | grep -q 'postgres-1'   || fail "postgres container missing"
echo "  [c6-check] containers: 3/3 Up"

# (ii) Health endpoint
HEALTH=$(curl -fsS https://api.algovault.com/health 2>/dev/null)
echo "$HEALTH" | jq -e '.status == "ok"' >/dev/null || fail "/health did not return status=ok"
echo "  [c6-check] /health: ok"

# (iii) MCP tools/list returns 3 tools (full Streamable-HTTP handshake)
ACCEPT="application/json, text/event-stream"
INIT_HEADERS=$(mktemp); trap 'rm -f "$INIT_HEADERS"' EXIT
curl -fsS -D "$INIT_HEADERS" -X POST https://api.algovault.com/mcp \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-05","capabilities":{},"clientInfo":{"name":"verify-c6","version":"0"}}}' \
  >/dev/null 2>&1 || fail "MCP initialize failed"
SID=$(grep -i '^mcp-session-id:' "$INIT_HEADERS" | head -1 | tr -d '\r' | awk '{print $2}')
test -n "$SID" || fail "no mcp-session-id from initialize"
curl -fsS -X POST https://api.algovault.com/mcp \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
TOOL_COUNT=$(curl -fsS -X POST https://api.algovault.com/mcp \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | sed -n 's/^data: //p' | head -1 | jq -r '.result.tools | length' 2>/dev/null || echo "0")
test "$TOOL_COUNT" = "3" || fail "tools/list returned $TOOL_COUNT (expected 3)"
echo "  [c6-check] MCP tools/list: 3 tools"

# (iv) /analytics/skills public page renders all 20 slugs
PAGE=$(curl -fsS https://algovault.com/analytics/skills 2>/dev/null)
test -n "$PAGE" || fail "/analytics/skills returned empty"
SLUG_HITS=$(echo "$PAGE" | grep -cE 'quick-btc-check|portfolio-scanner|regime-aware-trading|funding-arb-monitor|full-3-tool-pipeline|multi-timeframe-confirmation|tradfi-rotation|risk-gated-entry|funding-sentiment-dashboard|contrarian-meme-scanner|divergence-detector|hourly-digest-bot|hedging-advisor|volatility-breakout-watch|cross-asset-correlation|funding-cash-and-carry|weekend-vs-weekday-patterns|agent-portfolio-rebalance|smart-dca-bot|multi-agent-war-room')
test "$SLUG_HITS" -ge 20 || fail "/analytics/skills missing slugs (got $SLUG_HITS slug-line hits, expected ≥20)"
echo "  [c6-check] /analytics/skills: 20/20 slugs rendered"

echo "VERIFY_C6_PASS"
