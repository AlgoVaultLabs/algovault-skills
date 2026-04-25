# `examples/binance/` — Binance Spot Testnet demo

Runnable equivalent of Recipe 2 in [`docs/integrations/binance.md`](../../docs/integrations/binance.md).

## What it does

1. Fetches an AlgoVault composite verdict for ETH 1h via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Applies the agent's policy: `signal === 'BUY' && confidence > 70`.
3. Validates a small `LIMIT` order against Binance Spot Testnet via `POST /api/v3/order/test` (HMAC-signed if keys are present; otherwise the demo does a connectivity probe via `GET /api/v3/exchangeInfo` and exits cleanly).

**Hard guards (every run):**

- `BINANCE_TESTNET=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source — refuses to run if accidentally flipped.
- `SAMPLE_QTY <= MAX_QTY = 0.001` ETH — capped at module load.
- Order validation goes to `POST /api/v3/order/test` (Binance's "validate without submitting" endpoint). **No real orders are ever placed by this script.**

## Setup

### Minimum (zero keys — connectivity-only run)

```bash
BINANCE_TESTNET=true node examples/binance/demo.mjs
```

This hits public Binance testnet endpoints (`exchangeInfo`) + the AlgoVault MCP free tier. No Binance API keys required.

### Full (with HMAC-signed `order/test` validation)

1. Sign in at <https://testnet.binance.vision> with GitHub.
2. Click **Generate HMAC_SHA256 Key**, copy the API Key + Secret Key.
3. Export and run:

   ```bash
   export BINANCE_TESTNET=true
   export BINANCE_TESTNET_API_KEY=<api_key_from_testnet_console>
   export BINANCE_TESTNET_API_SECRET=<secret_key_from_testnet_console>
   node examples/binance/demo.mjs
   ```

## Expected output (zero-key run)

```
=== DEMO MODE ===
[BINANCE_TESTNET=true | base=https://testnet.binance.vision/api | mainnet_blocked=true]
[binance testnet | exchangeInfo HTTP 200 | symbol=ETHUSDT status=TRADING host=testnet.binance.vision]
[verdict | signal=BUY confidence=72 regime=TRENDING_UP tool=get_trade_signal]
[policy | fires=true (signal===BUY && confidence>70)]
[order/test | SKIPPED — no BINANCE_TESTNET_API_KEY/SECRET set; connectivity-only run]
=== NO REAL ORDERS PLACED ===
```

The exact `signal`/`confidence`/`regime` values change with live market data; the surrounding scaffolding is deterministic.

## Expected output (with keys; policy fires)

```
=== DEMO MODE ===
[BINANCE_TESTNET=true | base=https://testnet.binance.vision/api | mainnet_blocked=true]
[binance testnet | exchangeInfo HTTP 200 | symbol=ETHUSDT status=TRADING host=testnet.binance.vision]
[verdict | signal=BUY confidence=78 regime=TRENDING_UP tool=get_trade_signal]
[policy | fires=true (signal===BUY && confidence>70)]
[order/test | HTTP 200 | body={} | note: order/test validates but does NOT submit]
=== NO REAL ORDERS PLACED ===
```

`order/test` returning `{}` is success — Binance documents this as the empty-success body for a validated test order.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on Binance.
- Mainnet API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Per-order size cap (much smaller than this demo's 0.001 ETH).
- Daily loss limit + kill switch wired into your agent loop.
- Independent position monitor (separate process / agent / cron) that tracks open positions and PnL — never trust the trading agent to be the only source of position truth.
- A test-on-mainnet run with a known small order to verify the auth + signing pipeline matches the testnet shape exactly.
- Binance Skills Hub installed via `npx skills add https://github.com/binance/binance-skills-hub` — the official Binance-org marketplace is the canonical source for skills referenced in production agents.

**AlgoVault provides analytics. Your agent + your risk policy decide what (if anything) to execute.**

## Smoke test command (mirrors the C2 verification gate)

```bash
BINANCE_TESTNET=true node examples/binance/demo.mjs 2>&1 | tee /tmp/binance.log
grep -q "=== DEMO MODE ===" /tmp/binance.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/binance.log
grep -q "testnet.binance.vision" /tmp/binance.log
```

All three greps should succeed (`echo $?` = 0).
