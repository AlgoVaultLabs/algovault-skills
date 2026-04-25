# `examples/bitget/` — Bitget Agent Hub + GetClaw demo

Runnable equivalent of Recipe 1 in [`docs/integrations/bitget.md`](../../docs/integrations/bitget.md).

## What it does

1. Fetches an AlgoVault composite verdict for BTC at the 1h timeframe via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Renders the verdict as a natural-language instruction (e.g. *"BUY 0.0001 BTC because confidence is 78% and regime is TRENDING_UP"*) — or `HOLD` if the policy doesn't fire.
3. Probes Bitget's `mix/market/contracts` endpoint to confirm BTCUSDT is available + records the exchange's minimum trade unit (`minTradeNum: 0.0001`).
4. In a full authenticated run, the natural-language instruction would be passed to `bitget-mcp-server` (via Claude Code's MCP tool layer) for execution by GetClaw inside its dedicated demo account.

**Hard guards (every run — three independent layers):**

- `BITGET_DEMO=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source — refuses to run if accidentally flipped.
- `SAMPLE_QTY_BTC <= MAX_QTY_BTC = 0.0001` — capped at module load.

> **Note on demo enforcement:** `bitget-mcp-server@1.1.0` has **no env-var-level demo flag**. Bitget's demo gating is platform-side via a separate **GetClaw demo account** (you create the demo account on Bitget, fund it from the demo balance pool, and use *that* account's API keys). The wrapper guards above prevent _accidental mainnet execution by mistake_, but they do not prevent execution against a mainnet account if the operator manually sets `BITGET_DEMO=true` while supplying mainnet keys. **Always verify your `BITGET_API_KEY` was generated from a GetClaw demo account before any authenticated run.**

## Setup

### Bitget GetClaw demo account creation walkthrough

1. Sign up for a Bitget account at <https://www.bitget.com> (KYC may be required by region — check Bitget's regional disclosures).
2. Navigate to **Agent Hub** in the Bitget dashboard → enable **GetClaw**.
3. In the GetClaw setup flow, choose **Create Demo Account** (Bitget allocates a separate AI account with a demo balance distinct from your mainnet wallet).
4. Generate API keys for the GetClaw demo account: **API Management** → **Create API Key** → select the GetClaw demo account scope. Permissions: enable **Read** + **Trade**, leave **Withdraw** disabled. Record API key, secret, and passphrase.
5. Confirm the key is scoped to the demo account by checking the displayed account ID in the API key creation modal — **the operator is responsible for this verification; the wrapper cannot enforce it from outside.**

### Minimum (zero keys — connectivity-only run)

```bash
BITGET_DEMO=true node examples/bitget/demo.mjs
```

This hits the public Bitget contracts endpoint + the AlgoVault MCP free tier. No Bitget API keys required.

### Full (with GetClaw demo-account keys + Bitget MCP installed)

```bash
# 1. Install Bitget Agent Hub MCP for Claude Code
claude mcp add -s user \
  --env BITGET_API_KEY=<your_demo_api_key> \
  --env BITGET_SECRET_KEY=<your_demo_secret> \
  --env BITGET_PASSPHRASE=<your_demo_passphrase> \
  bitget -- npx -y bitget-mcp-server@1.1.0

# 2. Run the demo with the demo-mode wrapper guard
BITGET_DEMO=true node examples/bitget/demo.mjs
```

Then prompt Claude Code (or your MCP client) with the printed natural-language instruction; GetClaw executes via the MCP tool layer inside its demo account.

## Expected output (zero-key run)

```
=== DEMO MODE ===
[BITGET_DEMO=true | wrapper-enforced (MCP server has no built-in demo flag) | mainnet_blocked=true | qty<=0.0001 BTC]
[verdict | signal=BUY confidence=72 regime=TRENDING_UP tool=get_trade_signal]
[instruction | "BUY 0.0001 BTC because confidence is 72% and regime is TRENDING_UP"]
[bitget | contracts HTTP 200 | host=api.bitget.com BTCUSDT minTradeNum=0.0001 symbolType=perpetual]
[getclaw | natural-language instruction WOULD be passed to bitget-mcp-server for execution inside the GetClaw demo account (SKIPPED — see README for authenticated POST /v2/mix/order/place-order with BITGET_API_KEY/SECRET/PASSPHRASE)]
=== NO REAL ORDERS PLACED ===
```

The exact `signal`/`confidence`/`regime` values change with live market data; the surrounding scaffolding is deterministic.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on Bitget.
- Mainnet API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted) — distinct from your GetClaw demo account's keys.
- Per-order size cap (much smaller than your daily budget would suggest).
- Daily loss limit + kill switch wired into your agent loop.
- Independent position monitor (separate process / agent / cron) tracking open positions and PnL **inside the GetClaw production account specifically** (not the master Bitget account).
- A test-on-mainnet run with a known small order to verify the auth + signing pipeline matches the demo shape exactly.
- Bitget Agent Hub MCP installed via `claude mcp add ... -- npx -y bitget-mcp-server@1.1.0` (omit `BITGET_DEMO=true`; supply mainnet keys; **verify the keys are scoped to a production GetClaw account, not the master Bitget account**).

**AlgoVault provides analytics. Your agent + GetClaw + your risk policy decide what to execute inside the demo or production account you specifically authorise.**

## Smoke test command (mirrors the C5 verification gate)

```bash
BITGET_DEMO=true node examples/bitget/demo.mjs 2>&1 | tee /tmp/bitget.log
grep -q "=== DEMO MODE ===" /tmp/bitget.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/bitget.log
grep -q "api.bitget.com" /tmp/bitget.log
```

All three greps should succeed (`echo $?` = 0).
