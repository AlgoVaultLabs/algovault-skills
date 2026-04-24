#!/usr/bin/env bash
# C6 no-regressions check for crypto-quant-signal-mcp on Hetzner.
#
# Per Plan A4: replaces the spec's reference to verify_phase2.sh (which does
# not exist on the host) with 4 concrete checks against the live deployment.
# Run after deploys to Hetzner; expects the skill-invocations table and the
# admin-gated /dashboard/api/skills-analytics endpoint to be live.
#
# (UPDATED 2026-04-24): The per-Skill page moved from public
# `algovault.com/analytics/skills` to admin-only `/dashboard` Skills section.
# Check (iv) now hits the admin JSON endpoint with the Bearer key (export
# ALGOVAULT_ADMIN_KEY before running, or check (iv) is skipped with a notice).
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

# (iv) Admin-gated /dashboard/api/skills-analytics returns all 20 slugs
# Public page (algovault.com/analytics/skills) was removed 2026-04-24 — moved
# internal because per-Skill funnel data is competitive intel.
if [ -z "${ALGOVAULT_ADMIN_KEY:-}" ]; then
  echo "  [c6-check] (iv) SKIP: ALGOVAULT_ADMIN_KEY not in env — admin endpoint check skipped"
else
  SLUGS=$(curl -fsS -H "Authorization: Bearer $ALGOVAULT_ADMIN_KEY" \
    https://api.algovault.com/dashboard/api/skills-analytics 2>/dev/null \
    | jq -r '.perSlug | length' 2>/dev/null || echo "0")
  test "$SLUGS" = "20" || fail "admin /dashboard/api/skills-analytics returned $SLUGS slugs (expected 20)"
  echo "  [c6-check] /dashboard/api/skills-analytics (admin): 20/20 slugs"
fi
# Also confirm the public URL is gone (404)
PUB_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://algovault.com/analytics/skills)
test "$PUB_CODE" = "404" || fail "public /analytics/skills should return 404 (got $PUB_CODE — was it not removed?)"
echo "  [c6-check] public /analytics/skills: 404 (correctly removed)"

echo "VERIFY_C6_PASS"
