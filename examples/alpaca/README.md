# `examples/alpaca/` — Alpaca paper crypto demo

Runnable equivalent of Recipe 1 in [`docs/integrations/alpaca.md`](../../docs/integrations/alpaca.md).

## What it does

1. Fetches AlgoVault composite verdicts for ETH on `15m` and `1h` via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Checks multi-timeframe consensus — both timeframes return the same non-`HOLD` direction.
3. Places a tiny notional `BTC/USD` market order on the Alpaca paper venue (`POST https://paper-api.alpaca.markets/v2/orders`) when keys are present. Keyless, this step is skipped and the demo exits cleanly.

**Hard guard (every run):**

- The order host must be `paper-api.alpaca.markets` — a constant check throws before any network call otherwise.
- The paper order path runs **only** when `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` are set. Keyless = skipped.

## Setup

### Alpaca paper API key creation walkthrough

1. Sign up at <https://app.alpaca.markets/paper/dashboard/overview> (free; no deposit).
2. On the paper dashboard, open the **API Keys** panel (right side) → **Generate New Key**.
3. Copy the **API Key ID** and **Secret Key** — the secret is shown once.
4. The keys are scoped to your paper balance only and cannot touch live funds.
5. (Optional) Scope the Alpaca MCP crypto-only with `ALPACA_TOOLSETS=trading,crypto-data`.

### Minimum (zero keys — verdict-only run)

```bash
node examples/alpaca/demo.mjs
```

This calls the AlgoVault MCP free tier and skips the paper order path. No Alpaca keys required.

### Full (with keys — paper order placement)

```bash
export ALPACA_API_KEY=<key_from_paper_dashboard>
export ALPACA_SECRET_KEY=<secret_from_paper_dashboard>
export ALPACA_PAPER_TRADE=true
node examples/alpaca/demo.mjs
```

With keys set, the demo POSTs a tiny notional `BTC/USD` market order to `paper-api.alpaca.markets/v2/orders` and prints the order id + `"paper"` confirmation. The Alpaca crypto MCP Server (`uvx alpaca-mcp-server`, default `ALPACA_PAPER_TRADE=true`) provides the canonical `place_crypto_order` tool — market/limit/stop-limit, GTC/IOC, qty or notional, $200k/order cap.

## Expected output (zero-key run)

```
=== DEMO MODE ===
[verdicts | 15m=BUY@72 1h=BUY@68 | consensus=true direction=BUY]
[alpaca | SKIPPED — set ALPACA_API_KEY/SECRET (free paper account) to run the paper order path]
=== NO REAL ORDERS PLACED ===
```

The exact `signal`/`confidence` values change with live market data; the surrounding scaffolding is deterministic.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on Alpaca.
- Live API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Per-order size cap (much smaller than your daily budget would suggest).
- Daily loss limit + kill switch wired into your agent loop.
- Independent position monitor (separate process / agent / cron) tracking open positions and PnL — never trust the trading agent to be the only source of position truth.
- A test run with a known small order to verify the auth pipeline matches the paper shape exactly.
- Alpaca crypto MCP installed via `uvx alpaca-mcp-server` (set `ALPACA_PAPER_TRADE=false` for live runs; live fees apply — taker 25bps / maker 15bps at T1).

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Smoke test command

```bash
node examples/alpaca/demo.mjs 2>&1 | tee /tmp/alpaca.log
grep -q "=== DEMO MODE ===" /tmp/alpaca.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/alpaca.log
grep -q "alpaca | SKIPPED" /tmp/alpaca.log
```

All three greps should succeed (`echo $?` = 0).
