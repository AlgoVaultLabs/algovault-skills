# AlgoVault × KuCoin — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-kucoin)
> *Live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with KuCoin Futures and your agent has both the analytics brain and the execution venue.

> **Provenance:** OFFICIAL [`kucoin-universal-sdk`](https://github.com/Kucoin/kucoin-universal-sdk) — self-described as *"the official SDK from KuCoin"*, MIT, on **npm and PyPI at 1.3.1**, last pushed 2026-07-18. Note that **every legacy per-language KuCoin SDK is archived**, and several archived repos carry *more* GitHub stars than the live one — sort by activity, not popularity. Demo execution uses KuCoin's order-**validation** endpoint (`POST /api/v1/orders/test`) with `KUCOIN_DRY_RUN=true` + `MAINNET_BLOCKED=true` wrapper guards. Verified 2026-07-21.

## ⚠️ KuCoin has no sandbox — read this before you start

**KuCoin retired its sandbox on 2023-07-10** ([announcement](https://www.kucoin.com/announcement/kucoin-will-delist-the-sandbox-mode-0629)), promising to "present the Sandbox Environment in a new form later." As of 2026-07-21 that has not materialised: every historical sandbox host (`api-sandbox-futures.kucoin.com`, `api-sandbox.kucoin.com`, `openapi-sandbox.kucoin.com`) returns **NXDOMAIN**, and the current official SDK contains zero sandbox or testnet references.

This tutorial therefore does **not** claim a testnet. It is built on `POST /api/v1/orders/test`, which **validates an order payload — signature, symbol, sizing, permissions — and returns without placing a trade.** Be precise about what that does and does not give you:

- ✅ It confirms your credentials, signature construction, and parameters are correct.
- ❌ It does **not** fill, does **not** simulate a matching engine, and does **not** give you simulated balances or PnL.

If you need a venue with a genuine order-placing testnet, this repo's [BingX](./bingx.md), [Aster](./aster.md), and [Binance](./binance.md) tutorials cover ones that have one.

**Access note:** KuCoin closed all US accounts effective 2025-01-23 and restricts access from US IP addresses.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for a composite verdict on a chosen asset + timeframe.
2. Reads the verdict's `call`, `confidence`, `regime`, and `reasoning` fields.
3. Hands the verdict to KuCoin Futures' order-validation endpoint when the agent's pre-configured policy fires — proving the whole path works without placing a trade.

Every code path is validation-only — **no order is ever placed**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **KuCoin account** with a Futures API key (API key + secret + passphrase, from the API management console). The demo runs read-only out of the box; supplying credentials unlocks the validation step.
4. **Optional — the official SDK**, if you prefer it to raw `fetch`:
   ```bash
   npm install kucoin-universal-sdk
   ```

## Demo: Confidence-filtered order validator on XBTUSDTM (≤80 lines)

```javascript
// examples/kucoin/demo.mjs (excerpt — see file for full source)
import crypto from 'node:crypto';
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const KUCOIN_FUTURES_BASE = 'https://api-futures.kucoin.com';

if (process.env.KUCOIN_DRY_RUN !== 'true') {
  throw new Error('KUCOIN_DRY_RUN=true required — this demo is validation-only.');
}

const verdict = await getAlgoVaultVerdict({ coin: 'BTC', timeframe: '1h' });

if (verdict.call === 'BUY' && verdict.confidence > 70) {
  // /orders/test validates the payload. It does NOT fill.
  await signedPost('/api/v1/orders/test', {
    clientOid: crypto.randomUUID(), symbol: 'XBTUSDTM',
    side: 'buy', type: 'market', size: 1, leverage: 1,
  });
}
```

Run it:

```bash
KUCOIN_DRY_RUN=true node examples/kucoin/demo.mjs
```

Expected output (last 3 lines):

```
[kucoin futures | timestamp HTTP 200 | XBTUSDTM listed]
[policy | fires=false (call===BUY && confidence>70)]
=== NO ORDERS PLACED (validation endpoint only) ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch the AlgoVault verdict.** The helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_call` with `{coin, timeframe}`, and returns the parsed `call` / `confidence` / `regime` / `reasoning` payload. Free tier covers up to 20 calls/day per IP.

2. **Apply the agent's policy.** When the verdict satisfies a pre-configured policy (e.g. *the agent's policy fires when `confidence > 70` AND `call === 'BUY'`*), the script proceeds to the validation branch. The policy lives entirely in your code — AlgoVault returns the analytics; the agent decides.

3. **Validate against KuCoin.** The signed request goes to `POST /api/v1/orders/test` on the futures host. The script aborts immediately if `KUCOIN_DRY_RUN` is not set — and because the real `POST /api/v1/orders` endpoint appears nowhere in the file, there is no code path that can place an order.

## 3 Recipes

### Recipe 1 — Regime-gated entries

Call `get_market_regime` before acting. When the regime is `RANGING`, a trend-following agent can skip the entry rather than paying the spread on a chop signal.

### Recipe 2 — Get the KC-API headers right

KuCoin's auth is a five-header family: `KC-API-KEY`, `KC-API-SIGN`, `KC-API-TIMESTAMP`, `KC-API-PASSPHRASE`, and `KC-API-KEY-VERSION`. The detail that trips people up is that **from key version 2 onward the passphrase is not sent in plaintext** — it is itself `base64(HMAC-SHA256(passphrase, apiSecret))`. The current SDK sends `KC-API-KEY-VERSION: 3`. A v1-era snippet copied from an old blog post will fail authentication.

### Recipe 3 — Promote from validation to live, deliberately

Because `/orders/test` and `/orders` take an identical payload, promoting is a one-line change — which is exactly why it should be a deliberate, reviewed one. Keep the endpoint in a single constant, gate it behind an explicit environment flag, and pair the switch with a per-order size cap and a kill switch before it ever runs unattended.

## ⚠️ Production setup (real-money)

The demo above never places an order. Real-money setup requires:

- KYC completion on KuCoin, and confirming the service is available in your jurisdiction.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.
- The correct base host — futures is `api-futures.kucoin.com`, which is **not** the spot host `api.kucoin.com`.

See `examples/kucoin/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-kucoin-footer)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-07-21 · KuCoin sandbox retired 2023-07-10; this tutorial uses the order-validation endpoint, not a testnet*
