# `examples/kraken/` — Kraken CLI paper demo

Runnable equivalent of Recipe 1 in [`docs/integrations/kraken.md`](../../docs/integrations/kraken.md).

## What it does

1. Fetches AlgoVault composite verdicts for BTC on `15m` and `1h` via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
2. Checks multi-timeframe consensus — both timeframes return the same non-`HOLD` direction.
3. Runs `command -v kraken` to detect the Kraken CLI:
   - **Present** → drives the paper engine (`kraken paper init` → `kraken paper buy BTCUSD 0.01` on consensus → `kraken paper status`). The paper engine simulates fills against live public prices with a 0.26% taker fee. Zero keys, zero account.
   - **Absent** → prints the install one-liner, then reads the keyless public REST ticker (`https://api.kraken.com/0/public/Ticker?pair=XBTUSD`).

Every run closes with `=== NO REAL ORDERS PLACED ===`.

## Run

```bash
node examples/kraken/demo.mjs
```

No API keys required for either branch. The paper engine and the public REST ticker are both keyless.

## Expected output

### Kraken CLI installed (paper engine)

```
=== DEMO MODE ===
[verdicts | 15m=BUY@72 1h=BUY@68 | consensus=true direction=BUY]
[kraken paper | mode=paper | BUY BTCUSD 0.01 → filled]
=== NO REAL ORDERS PLACED ===
```

### Kraken CLI not installed (keyless REST ticker)

```
=== DEMO MODE ===
[verdicts | 15m=BUY@72 1h=BUY@68 | consensus=true direction=BUY]
[kraken-cli not installed — install one-liner: curl --proto '=https' --tlsv1.2 -LsSf https://github.com/krakenfx/kraken-cli/releases/latest/download/kraken-cli-installer.sh | sh]
[kraken ticker (REST) | XBTUSD last=68250.0 | keyless]
=== NO REAL ORDERS PLACED ===
```

The exact `signal`/`confidence`/price values change with live market data; the surrounding scaffolding is deterministic.

## Install the Kraken CLI

One binary; macOS + Linux; Windows via WSL; no brew formula:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/krakenfx/kraken-cli/releases/latest/download/kraken-cli-installer.sh | sh
```

Serve its 151 commands over stdio MCP with `kraken mcp` (default services `market,account,paper`). Use `kraken mcp -s all` to expose every service — dangerous calls then require `acknowledged=true`. Tool names follow the `kraken_<command>` form.

## Paper → live transition

The demo stays on the paper engine. To go live:

- Swap `kraken paper buy BTCUSD 0.01` for `kraken order buy`.
- Run every live order with `--validate` first — a server-side dry run that places nothing.
- Arm `kraken order cancel-after 60` as a dead-man's switch.

## Production (real money) — DO NOT RUN until you have all of these

- KYC completed on Kraken.
- Production API keys with **only** the permissions your agent needs (no withdrawals). Generate at kraken.com → **Settings → API**; set `KRAKEN_API_KEY` and `KRAKEN_API_SECRET` (or use `~/.config/kraken/config.toml`).
- Per-order size cap (much smaller than your daily budget would suggest).
- Daily loss limit + kill switch wired into your agent loop.
- `--validate` dry run on every order shape before the first real fill.
- `kraken order cancel-after 60` armed as a dead-man's switch.
- Least-privilege MCP scope: prefer `kraken mcp -s all` (dangerous calls need `acknowledged=true`) over `--allow-dangerous`. See the repo README CAUTION note and `AGENTS.md`.
- Independent position monitor (separate process / agent / cron) tracking open positions and PnL — never trust the trading agent to be the only source of position truth.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Smoke test command

```bash
node examples/kraken/demo.mjs 2>&1 | tee /tmp/kraken.log
grep -q "=== DEMO MODE ===" /tmp/kraken.log
grep -q "=== NO REAL ORDERS PLACED ===" /tmp/kraken.log
```

Both greps should succeed (`echo $?` = 0).
