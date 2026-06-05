# `examples/gemini/` — Gemini Sandbox demo

Runnable equivalent of Recipe 1 in [`docs/integrations/gemini.md`](../../docs/integrations/gemini.md).

## What it does

1. Fetches AlgoVault composite verdicts for ETH on `15m` and `1h` via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Checks multi-timeframe consensus — both timeframes return the same non-`HOLD` direction.
3. Probes Gemini sandbox's public ticker endpoint (`https://api.sandbox.gemini.com/v1/pubticker/btcusd`) to prove sandbox connectivity. This public market-data tool needs no keys.

**Hard guards (every run):**

- `GEMINI_API_BASE_URL` must contain `sandbox` — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source — compile-time intent marker.
- All Gemini network calls go to `api.sandbox.gemini.com`, never the mainnet host.

## Setup

### Gemini sandbox API key creation walkthrough

1. Sign up at <https://exchange.sandbox.gemini.com> (separate from mainnet; auto-credited test funds).
2. Open **Settings** &rarr; **API** (`exchange.gemini.com/settings/api` for mainnet keys).
3. Click **Create A New API Key**.
4. Scope: enable **Trading**. Leave everything else unchecked.
5. Copy the **API Key** and **API Secret** — they're only shown once.
6. Sandbox accounts auto-credit test funds, so order-placement validation works out of the box.

### Minimum (zero keys — connectivity-only run)

```bash
GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1 node examples/gemini/demo.mjs
```

This hits public Gemini sandbox endpoints (`pubticker`) + the AlgoVault MCP free tier. No Gemini API keys required.

### Full (with keys — authenticated order placement available)

```bash
export GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1
export GEMINI_API_KEY=<key_from_sandbox_console>
export GEMINI_API_SECRET=<secret_from_sandbox_console>
# Add the Gemini MCP server (self-hosted Node, built from source):
claude mcp add gemini -s user \
  -e GEMINI_API_KEY=$GEMINI_API_KEY -e GEMINI_API_SECRET=$GEMINI_API_SECRET \
  -e GEMINI_API_BASE_URL=$GEMINI_API_BASE_URL \
  -- node <repo_root>/packages/mcp-server/dist/index.js
node examples/gemini/demo.mjs
```

The demo always SKIPS order placement. To place a sandbox order, call `gemini_new_order` through the Gemini MCP server with sandbox keys. The Gemini kit builds from source: `git clone https://github.com/gemini/developer-platform` &rarr; `cd developer-platform/packages/mcp-server && npm install && npm run build`. It exposes 50+ tools, including `gemini_get_ticker`, `gemini_get_candles`, `gemini_get_balances`, and `gemini_new_order`.

## Expected output (zero-key run)

```
=== DEMO MODE ===
[GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1 | mainnet_blocked=true]
[verdicts | 15m=BUY@72 1h=BUY@68 | consensus=true direction=BUY]
[gemini sandbox | pubticker HTTP 200 | host=api.sandbox.gemini.com last=68000.00]
[order | SKIPPED — see README for gemini_new_order via MCP with sandbox keys]
=== NO REAL ORDERS PLACED ===
```

The exact `signal`/`confidence`/`last` values change with live market data; the surrounding scaffolding is deterministic.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on Gemini.
- Mainnet API keys scoped to **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Per-order size cap (much smaller than your daily budget would suggest).
- Daily loss limit + kill switch wired into your agent loop.
- Independent position monitor (separate process / agent / cron) tracking open positions and PnL — never trust the trading agent to be the only source of position truth.
- Subaccounts to give each agent isolated balances, rate limits, and blast radius.
- A test-on-sandbox run with a known small order to verify the auth + signing pipeline matches the mainnet shape exactly.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Smoke test command (mirrors the C4 verification gate)

```bash
GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1 node examples/gemini/demo.mjs 2>&1 | tee /tmp/gemini.log
grep -q "=== DEMO MODE ===" /tmp/gemini.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/gemini.log
grep -q "api.sandbox.gemini.com" /tmp/gemini.log
```

All three greps should succeed (`echo $?` = 0).
