# `examples/kucoin/` — KuCoin Futures order VALIDATOR

Runnable equivalent of the Demo in [`docs/integrations/kucoin.md`](../../docs/integrations/kucoin.md).

## ⚠️ There is no KuCoin sandbox

KuCoin **retired its sandbox on 2023-07-10** and has not restored it. Every historical sandbox host (`api-sandbox-futures.kucoin.com`, `api-sandbox.kucoin.com`, `openapi-sandbox.kucoin.com`) returns **NXDOMAIN**, and the current official SDK contains zero sandbox references.

This demo therefore uses `POST /api/v1/orders/test`, which **validates an order payload and returns without placing a trade**:

- ✅ Confirms credentials, signature construction, and parameters are correct.
- ❌ Does **not** fill, does **not** simulate a matching engine, gives **no** simulated balances or PnL.

It is not a testnet, and this demo does not describe it as one. For venues with a genuine order-placing testnet, see the [BingX](../bingx/), [Aster](../aster/), and [Binance](../binance/) examples.

**Access note:** KuCoin closed all US accounts effective 2025-01-23 and restricts access from US IP addresses.

## What it does

1. Public connectivity probe against the futures host (keyless).
2. Fetches an AlgoVault composite verdict for BTC 1h via [`getAlgoVaultVerdict`](../_shared/algovault-helper.mjs).
3. Applies the agent's policy: `call === 'BUY' && confidence > 70`.
4. Validates a small `market` order via `POST /api/v1/orders/test`.

**Hard guards (every run):**

- `KUCOIN_DRY_RUN=true` env var required — the demo throws immediately otherwise.
- `MAINNET_BLOCKED = true` constant in source.
- `SAMPLE_SIZE <= MAX_SIZE = 1` contract — capped at module load.
- `ORDER_PATH` is asserted to end in `/test`.
- The live endpoint `/api/v1/orders` **appears nowhere in the file**, so no code path can place an order.

## Gotchas the demo surfaces for you

- From key version 2 the **passphrase is not sent in plaintext** — it is `base64(HMAC-SHA256(passphrase, apiSecret))`. The demo sends `KC-API-KEY-VERSION: 3`.
- Futures is `api-futures.kucoin.com`, **not** the spot host `api.kucoin.com`.
- **Every legacy per-language KuCoin SDK is archived**, and several archived repos have *more* stars than the live [`kucoin-universal-sdk`](https://github.com/Kucoin/kucoin-universal-sdk) (npm + PyPI 1.3.1). Sort by activity, not popularity.

## Run

### Minimum (zero keys)

```bash
KUCOIN_DRY_RUN=true node examples/kucoin/demo.mjs
```

### Full (with the signed validation step)

```bash
KUCOIN_DRY_RUN=true \
  KUCOIN_API_KEY=<key> \
  KUCOIN_API_SECRET=<secret> \
  KUCOIN_API_PASSPHRASE=<passphrase> \
  node examples/kucoin/demo.mjs
```

## Real-money checklist (before you ever point this at mainnet)

- [ ] KYC complete and the service is available in your jurisdiction.
- [ ] Production API credentials scoped to **only** what the agent needs — no withdrawal permission, IP-allowlisted.
- [ ] Per-order size cap enforced in code, not just in config.
- [ ] Daily loss limit + a kill switch you can trigger without a deploy.
- [ ] Independent position monitoring (a separate watchdog, not the trading agent itself).
- [ ] The demo's hard guards replaced with deliberate, reviewed production guards.

**AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## See also

- Tutorial: [`docs/integrations/kucoin.md`](../../docs/integrations/kucoin.md)
- Shared MCP helper: [`examples/_shared/algovault-helper.mjs`](../_shared/algovault-helper.mjs)
- Live track record: <https://algovault.com/track-record>
