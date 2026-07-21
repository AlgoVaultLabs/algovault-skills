# `examples/bingx/` — BingX VST (demo trading) demo

Runnable equivalent of the Demo in [`docs/integrations/bingx.md`](../../docs/integrations/bingx.md).

## What it does

1. Probes BingX's **VST demo host** for the symbol's tradability (keyless).
2. Fetches an AlgoVault composite verdict for BTC 1h via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
3. Applies the agent's policy: `call === 'BUY' && confidence > 70`.
4. Validates a small `MARKET` order via `POST /openApi/swap/v2/trade/order/test` (HMAC-signed if keys are present; otherwise it exits cleanly after the probe).

BingX publishes **no official client SDK**, so this uses plain `fetch` + `node:crypto` — zero third-party dependencies.

**Hard guards (every run):**

- `BINGX_TESTNET=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source.
- `SAMPLE_QTY <= MAX_QTY = 0.001` BTC — capped at module load.
- The base URL is asserted to contain `-vst.`; the demo refuses to run against `open-api.bingx.com`.
- Order validation goes to `/trade/order/test`. **No real orders are ever placed by this script.**

## Gotchas the demo surfaces for you

- Symbols on the VST host are **normal** (`BTC-USDT`), *not* `-VST`-suffixed. Posting `BTC-VST` to the live host — a widely-copied mistake — is wrong.
- The VST universe is a strict **subset** of live (855 vs 910 contracts at time of writing), so the demo confirms the symbol is listed on the demo host before building anything.
- Sign the **raw** sorted parameter string; do not URL-encode before signing.
- API keys are **read-only by default** — trade permission must be enabled explicitly.

## Run

### Minimum (zero keys)

```bash
BINGX_TESTNET=true node examples/bingx/demo.mjs
```

### Full (with the HMAC-signed dry-run)

```bash
BINGX_TESTNET=true \
  BINGX_API_KEY=<key> \
  BINGX_API_SECRET=<secret> \
  node examples/bingx/demo.mjs
```

Top up demo funds from code with `POST /openApi/swap/v2/trade/getVst`.

## Real-money checklist (before you ever point this at mainnet)

- [ ] KYC complete and the service is available in your jurisdiction.
- [ ] Production API credentials scoped to **only** what the agent needs — no withdrawal permission, IP-allowlisted.
- [ ] Per-order size cap enforced in code, not just in config.
- [ ] Daily loss limit + a kill switch you can trigger without a deploy.
- [ ] Independent position monitoring (a separate watchdog, not the trading agent itself).
- [ ] The demo's hard guards replaced with deliberate, reviewed production guards.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## See also

- Tutorial: [`docs/integrations/bingx.md`](../../docs/integrations/bingx.md)
- Shared MCP helper: [`examples/_shared/algovault-helper.mjs`](../_shared/algovault-helper.mjs)
- Live track record: <https://algovault.com/track-record>
