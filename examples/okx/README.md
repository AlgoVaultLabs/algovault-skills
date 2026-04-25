# `examples/okx/` — OKX Demo Trading demo

Runnable equivalent of Recipe 1 in [`docs/integrations/okx.md`](../../docs/integrations/okx.md).

## What it does

1. Fetches AlgoVault composite verdicts for BTC + ETH on the **1h timeframe** via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs). (This demo uses 1h on BTC/ETH so it runs cleanly on the AlgoVault free tier; production grid-bot agents typically read regime on 4h, which requires Starter+ plan — see "Free-tier vs paid" below.)
2. Identifies any asset whose `regime === 'RANGING'` (a precondition for grid bots — they only profit in range-bound markets).
3. Probes OKX's simulated-trading public instrument endpoint with `x-simulated-trading: 1` (the REST equivalent of the OKX MCP `--demo` flag) to prove demo-mode connectivity. In a full authenticated run, the agent's grid-bot creator (`POST /api/v5/tradingBot/grid/order-algo`) would run for each RANGING candidate.

### Free-tier vs paid (AlgoVault)

| Tier | Coins | Timeframes | Calls/day per IP |
|---|---|---|---|
| Free | BTC, ETH | 15m, 1h | 20 |
| Starter ($9.99/mo) | All major perps | All TFs (1m → 1d) | 1,000 |
| Pro+ | Everything | Everything | Higher caps |

This demo deliberately picks BTC + ETH on 1h so the smoke test runs end-to-end without a paid key. To upgrade the demo to 4h SOL — change `ASSETS` to `['BTC','ETH','SOL']` and `TIMEFRAME` to `'4h'` at the top of `demo.mjs`. You'll need a Starter plan key set as `ALGOVAULT_API_KEY` in your shell.

**Hard guards (every run):**

- `OKX_DEMO=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source — refuses to run if accidentally flipped.
- All OKX network calls carry the `x-simulated-trading: 1` header.

## Setup

### Minimum (zero keys — connectivity-only run)

```bash
OKX_DEMO=true node examples/okx/demo.mjs
```

This hits public OKX instrument endpoints with the `x-simulated-trading: 1` header + the AlgoVault MCP free tier. No OKX API keys required.

### Full (with OKX Agent Trade Kit MCP — authenticated grid-bot creation)

1. Sign in at <https://www.okx.com> → click your profile icon → toggle **Demo Trading**.
2. Click **API** → **Create V5 API Key** in demo mode → record API key, secret, and passphrase. Demo keys are scoped to demo balance only.
3. Install the OKX Agent Trade Kit MCP for Claude Code (or your MCP client of choice):

   ```bash
   npx -y @okx_ai/okx-trade-cli@latest setup --client claude-code --profile demo
   ```

4. Run the MCP server in demo mode:

   ```bash
   npx -y @okx_ai/okx-trade-cli@latest --demo --modules market,spot,account
   ```

5. Connect your agent to the running MCP server (Claude Code picks it up automatically after `setup`); orchestrate the AlgoVault verdict + OKX execution.

## Expected output (zero-key run)

```
=== DEMO MODE ===
[OKX_DEMO=true | --demo equivalent header x-simulated-trading: 1 | mainnet_blocked=true]
[verdicts | BTC=TRENDING_UP ETH=RANGING SOL=VOLATILE | ranging_count=1]
[okx demo | spot/instruments HTTP 200 | code=0 instId=BTC-USDT state=live host=www.okx.com (x-simulated-trading: 1)]
[grid-bot | 1 RANGING candidate(s); agent's policy WOULD POST /tradingBot/grid/order-algo per asset (SKIPPED — see README for authenticated demo with API key+secret+passphrase)]
=== NO REAL ORDERS PLACED ===
```

The exact `regime` values change with live market data; the surrounding scaffolding is deterministic. Three AlgoVault calls are paced sequentially (not in parallel) to stay friendly to the free-tier rate limit and to avoid clustering bursts that the upstream HL throttle would 429 on.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on OKX.
- Mainnet API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Per-order size cap (much smaller than your daily budget would suggest).
- Daily loss limit + kill switch wired into your agent loop.
- Independent position monitor (separate process / agent / cron) tracking open positions and PnL — never trust the trading agent to be the only source of position truth.
- A test-on-mainnet run with a known small order to verify the auth + signing pipeline matches the demo shape exactly.
- OKX Agent Trade Kit installed in `--profile live` mode via `npx -y @okx_ai/okx-trade-cli@latest setup --client claude-code --profile live` for production agents.

**AlgoVault provides analytics. Your agent + your risk policy decide what (if anything) to execute.**

## Smoke test command (mirrors the C3 verification gate)

```bash
OKX_DEMO=true node examples/okx/demo.mjs 2>&1 | tee /tmp/okx.log
grep -q "=== DEMO MODE ===" /tmp/okx.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/okx.log
grep -q "x-simulated-trading: 1" /tmp/okx.log
```

All three greps should succeed (`echo $?` = 0).
