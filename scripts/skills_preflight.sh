#!/usr/bin/env bash
# Pre-build environment check.
# Print PREFLIGHT_GREEN on success; nonzero exit on any failure.
set -euo pipefail

fail() { echo "PREFLIGHT_FAIL: $1" >&2; exit 1; }

# 1. GitHub CLI authenticated against AlgoVaultLabs (or user with push rights)
gh auth status >/dev/null 2>&1 || fail "gh not authenticated (run: gh auth login)"

# 2. Empty repo accessible (auto-create if missing)
if ! gh repo view AlgoVaultLabs/algovault-skills >/dev/null 2>&1; then
  echo "[preflight] algovault-skills not found, creating..."
  gh repo create AlgoVaultLabs/algovault-skills --public \
    --description "20 Anthropic Skills over AlgoVault MCP" \
    --license MIT >/dev/null || fail "gh repo create"
fi

# 3. npm available (A6 — switched from pnpm; npm is universally present)
npm --version >/dev/null 2>&1 || fail "npm not on PATH"

# 4. Smithery CLI available via npx (no global install required)
npx -y @smithery/cli --version >/dev/null 2>&1 || fail "@smithery/cli unreachable via npx"

# 5. AlgoVault MCP reachable — full Streamable-HTTP MCP handshake (A1 replacement
#    for the non-existent .well-known/mcp-manifest endpoint).
#    Step a: POST initialize, capture the mcp-session-id header IF the server sends one.
#    Step b: Send notifications/initialized (required by spec).
#    Step c: POST tools/list, parse SSE-formatted result, assert the canonical tool.
MCP_URL="https://api.algovault.com/mcp"
ACCEPT="application/json, text/event-stream"
TMPDIR_PRE=$(mktemp -d); trap 'rm -rf "$TMPDIR_PRE"' EXIT

# (a) initialize — headers go to file, body to stdout.
# NOTE on the two shell hazards below, both hit while writing this change on the Mac
# (bash 3.2, `set -euo pipefail`): an empty array expanded as "${arr[@]}" is an UNBOUND
# VARIABLE error under `set -u` in bash 3.2, so both curl call sites use the
# ${arr[@]+"${arr[@]}"} form; and a bare `test ... && assign` is fatal under `set -e`
# when the test is false, which is the normal stateless case.
curl -fsS -D "$TMPDIR_PRE/init.headers" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-05","capabilities":{},"clientInfo":{"name":"algovault-skills-preflight","version":"0.1.0"}}}' \
  >/dev/null 2>&1 || fail "MCP initialize HTTP error"

# OPS-SKILLS-STATELESS-SESSION-SWEEP-W1: the remote transport runs STATELESS
# (OPS-MCP-SESSION-RESILIENCE-W1), so initialize returns NO mcp-session-id header and
# the handshake completes fine without one. Requiring it failed preflight outright.
# Optional now: forwarded when present (stateful / self-hosted stdio bridges), omitted
# when absent. Same contract as examples/_shared/algovault-helper.mjs and
# .github/workflows/marketplace-check.yml.
#
# The anchored `^mcp-session-id:` match matters: a live response DOES contain the
# string inside its CORS `access-control-allow-headers` list, so an unanchored grep
# reports a session id that was never issued.
SID=$(grep -i '^mcp-session-id:' "$TMPDIR_PRE/init.headers" | head -1 | tr -d '\r' | awk '{print $2}' || true)
# if/else, never `test -n "$SID" && SID_HDR=(...)`: this file runs under `set -e`, so a
# bare test that is FALSE in the ordinary case — no session id, i.e. every stateless
# response — exits the script with status 1 and prints nothing at all. Measured while
# writing this change: rc=1, no PREFLIGHT_FAIL line, no output on either stream.
if [ -n "$SID" ]; then
  SID_HDR=(-H "mcp-session-id: $SID")
else
  SID_HDR=()
fi

# (b) notifications/initialized — fire-and-forget per spec
curl -fsS -X POST "$MCP_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  ${SID_HDR[@]+"${SID_HDR[@]}"} \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  >/dev/null 2>&1 || true

# (c) tools/list — SSE response, parse `data: {...}` line
TOOLS_JSON=$(curl -fsS -X POST "$MCP_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  ${SID_HDR[@]+"${SID_HDR[@]}"} \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | sed -n 's/^data: //p' | head -1)
test -n "$TOOLS_JSON" || fail "MCP tools/list returned no data"

TOOL_COUNT=$(echo "$TOOLS_JSON" | jq -r '.result.tools | length' 2>/dev/null || echo "ERR")

# This asserted `= 3` and had been wrong since the suite grew past three tools —
# live tools/list returns 8 today. Swapping 3 for 8 would only re-arm the same
# failure on the next tool the product ships, and the count is not what preflight
# actually needs to know. What it needs is that the endpoint speaks MCP and exposes
# the canonical entry point, so assert THAT: a non-empty tool list containing
# get_trade_call. Neither leg rots when a tool is added, removed or flag-gated.
case "$TOOL_COUNT" in
  ''|*[!0-9]*) fail "MCP tools/list returned an unusable tool count ($TOOL_COUNT)" ;;
esac
test "$TOOL_COUNT" -ge 1 || fail "MCP tools/list returned an empty tool list"
echo "$TOOLS_JSON" | jq -e '.result.tools | map(.name) | index("get_trade_call")' >/dev/null 2>&1 \
  || fail "MCP tools/list ($TOOL_COUNT tools) does not expose get_trade_call"

# 6. ADMIN_KEY check deferred to C6 (A2 — key is rotated value per CLAUDE.md, not stored in any .env on disk)

echo "PREFLIGHT_GREEN"
