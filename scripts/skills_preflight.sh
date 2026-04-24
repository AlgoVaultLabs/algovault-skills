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
#    Step a: POST initialize, capture mcp-session-id header.
#    Step b: Send notifications/initialized (required by spec).
#    Step c: POST tools/list, parse SSE-formatted result, count tools.
MCP_URL="https://api.algovault.com/mcp"
ACCEPT="application/json, text/event-stream"
TMPDIR_PRE=$(mktemp -d); trap 'rm -rf "$TMPDIR_PRE"' EXIT

# (a) initialize — headers go to file, body to stdout
curl -fsS -D "$TMPDIR_PRE/init.headers" -X POST "$MCP_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-05","capabilities":{},"clientInfo":{"name":"algovault-skills-preflight","version":"0.1.0"}}}' \
  >/dev/null 2>&1 || fail "MCP initialize HTTP error"

SID=$(grep -i '^mcp-session-id:' "$TMPDIR_PRE/init.headers" | head -1 | tr -d '\r' | awk '{print $2}')
test -n "$SID" || fail "MCP initialize did not return mcp-session-id header"

# (b) notifications/initialized — fire-and-forget per spec
curl -fsS -X POST "$MCP_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  >/dev/null 2>&1 || true

# (c) tools/list — SSE response, parse `data: {...}` line
TOOLS_JSON=$(curl -fsS -X POST "$MCP_URL" \
  -H "Content-Type: application/json" -H "Accept: $ACCEPT" \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | sed -n 's/^data: //p' | head -1)
test -n "$TOOLS_JSON" || fail "MCP tools/list returned no data"

TOOL_COUNT=$(echo "$TOOLS_JSON" | jq -r '.result.tools | length' 2>/dev/null || echo "ERR")
test "$TOOL_COUNT" = "3" || fail "MCP tools/list returned $TOOL_COUNT tools (expected 3)"

# 6. ADMIN_KEY check deferred to C6 (A2 — key is rotated value per CLAUDE.md, not stored in any .env on disk)

echo "PREFLIGHT_GREEN"
