# `examples/bybit/` — Bybit Testnet demo

Runnable equivalent of Recipe 1 in [`docs/integrations/bybit.md`](../../docs/integrations/bybit.md).

## What it does

1. Fetches AlgoVault composite verdicts for ETH on `15m` and `1h` via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Checks multi-timeframe consensus — both timeframes return the same non-`HOLD` direction.
3. Probes Bybit Linear Perpetual testnet's instruments-info endpoint (`https://api-testnet.bybit.com/v5/market/instruments-info`) to prove demo-mode connectivity. In a full authenticated run, the agent's order placer (`POST /v5/order/create` against the testnet base) would fire when consensus holds.

**Hard guards (every run):**

- `BYBIT_TESTNET=true` env var required — the demo throws immediately otherwise (matches the contract Bybit's own MCP uses).
- `MAINNET_BLOCKED = true` constant in source — refuses to run if accidentally flipped.
- All Bybit network calls go to `api-testnet.bybit.com`, never `api.bybit.com`.

## Setup

### Bybit Testnet API key creation walkthrough

1. Sign up at <https://testnet.bybit.com> (separate from mainnet — testnet keys cannot touch mainnet funds).
2. Hover the profile icon (top-right) → **API** → **Create New Key**.
3. Choose **System-generated** for the key type.
4. Permissions: enable **Read-Write** on **Contract** + **Spot**. Leave everything else unchecked.
5. **Skip IP whitelist** for the demo (recommend you add it back for production); set the key expiry to a short window (e.g. 30 days).
6. Copy the **API Key** and **API Secret** — they're only shown once.
7. (Optional but recommended) Fund the testnet account with the **Request Funds** button to enable order-placement validation.

### Minimum (zero keys — connectivity-only run)

```bash
BYBIT_TESTNET=true node examples/bybit/demo.mjs
```

This hits public Bybit testnet endpoints (`instruments-info`) + the AlgoVault MCP free tier. No Bybit API keys required.

### Full (with keys — authenticated order placement available)

```bash
export BYBIT_TESTNET=true
export BYBIT_TESTNET_API_KEY=<key_from_testnet_console>
export BYBIT_TESTNET_API_SECRET=<secret_from_testnet_console>
# Optionally install the official MCP server alongside the demo:
npx -y bybit-official-trading-server@2.0.9 &
node examples/bybit/demo.mjs
```

The demo currently SKIPS the authenticated order-placement step even when keys are provided — extend `examples/bybit/demo.mjs` to wire the HMAC-SHA256 signature pipeline (mirror the Binance HMAC pattern in `examples/binance/demo.mjs`) for real testnet orders. The Bybit Official MCP at `bybit-official-trading-server@2.0.9` provides the canonical signed-request stack via the `tools/order/create` MCP tool.

## Expected output (zero-key run)

```
=== DEMO MODE ===
[BYBIT_TESTNET=true | base=https://api-testnet.bybit.com | mainnet_blocked=true]
[verdicts | 15m=BUY@72 1h=BUY@68 | consensus=true direction=BUY]
[bybit testnet | instruments-info HTTP 200 | host=api-testnet.bybit.com retCode=0 symbol=ETHUSDT status=Trading]
[order | direction=BUY ETHUSDT consensus across 15m+1h; agent's policy WOULD POST /v5/order/create (SKIPPED — see README for authenticated demo with BYBIT_TESTNET_API_KEY/SECRET)]
=== NO REAL ORDERS PLACED ===
```

The exact `signal`/`confidence` values change with live market data; the surrounding scaffolding is deterministic.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on Bybit.
- Mainnet API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Per-order size cap (much smaller than your daily budget would suggest).
- Daily loss limit + kill switch wired into your agent loop.
- Independent position monitor (separate process / agent / cron) tracking open positions and PnL — never trust the trading agent to be the only source of position truth.
- A test-on-mainnet run with a known small order to verify the auth + signing pipeline matches the testnet shape exactly.
- Bybit Official Trading MCP installed via `npx -y bybit-official-trading-server@2.0.9` (omit `BYBIT_TESTNET=true` for production runs).

**AlgoVault provides analytics. Your agent + your risk policy decide what (if anything) to execute.**

## Smoke test command (mirrors the C4 verification gate)

```bash
BYBIT_TESTNET=true node examples/bybit/demo.mjs 2>&1 | tee /tmp/bybit.log
grep -q "=== DEMO MODE ===" /tmp/bybit.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/bybit.log
grep -q "api-testnet.bybit.com" /tmp/bybit.log
```

All three greps should succeed (`echo $?` = 0).
