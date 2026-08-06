# AlgoVault × BingX — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-bingx)
> *Live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with BingX's VST demo-trading environment and your agent has both the analytics brain and the execution venue.

> **Provenance:** BingX publishes **no official client SDK** — its GitHub org ([`BingX-API`](https://github.com/BingX-API)) contains documentation repos and an AI-skills bundle, not a client library, and no BingX-published package exists on npm. The demo below therefore uses plain `fetch` + Node's built-in `crypto`, with zero third-party dependencies. Demo execution runs against BingX's **VST (Virtual Simulated Trading)** host `https://open-api-vst.bingx.com`, documented in BingX's own org repo as *"Production Simulated (Testnet) … use `prod-vst` for paper trading / testing without real funds"*, with `BINGX_TESTNET=true` + `MAINNET_BLOCKED=true` wrapper guards. Verified 2026-07-21.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for a composite verdict on a chosen asset + timeframe.
2. Reads the verdict's `call`, `confidence`, `regime`, and `reasoning` fields.
3. Hands the verdict to BingX's VST demo environment, which validates a small order via the dedicated dry-run endpoint when the agent's pre-configured policy fires.

The whole loop runs against BingX's VST demo host — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **BingX account** (free signup at <https://bingx.com>). API key + secret from the [API management console](https://bingx.com/en/accounts/api). Keys are **read-only by default** — enable trade permission explicitly, and IP-allowlist them.
4. **No SDK to install.** The demo runs read-only out of the box with no keys at all; supplying keys unlocks the authenticated dry-run step.

## Demo: Confidence-filtered entry validator on BTC (≤80 lines)

```javascript
// examples/bingx/demo.mjs (excerpt — see file for full source)
import crypto from 'node:crypto';
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const BINGX_VST_BASE = 'https://open-api-vst.bingx.com';

if (process.env.BINGX_TESTNET !== 'true') {
  throw new Error('BINGX_TESTNET=true required — demo refuses to run against mainnet.');
}

const verdict = await getAlgoVaultVerdict({ coin: 'BTC', timeframe: '1h' });

if (verdict.call === 'BUY' && verdict.confidence > 70) {
  // Dry-run: validates signature + params, places nothing.
  await signedPost('/openApi/swap/v2/trade/order/test', {
    symbol: 'BTC-USDT', side: 'BUY', positionSide: 'LONG',
    type: 'MARKET', quantity: 0.001,
  });
}
```

Run it:

```bash
BINGX_TESTNET=true node examples/bingx/demo.mjs
```

Expected output (last 3 lines):

```
[bingx vst | contracts HTTP 200 | BTC-USDT tradable on the demo host]
[policy | fires=false (call===BUY && confidence>70)]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch the AlgoVault verdict.** The helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_call` with `{coin, timeframe}`, and returns the parsed `call` / `confidence` / `regime` / `reasoning` payload. Free tier covers 100 calls/month — plenty for development.

2. **Apply the agent's policy.** When the verdict satisfies a pre-configured policy (e.g. *the agent's policy fires when `confidence > 70` AND `call === 'BUY'`*), the script proceeds to the execution branch. The policy lives entirely in your code — AlgoVault returns the analytics; the agent decides.

3. **Hand the order to BingX.** The signed request goes to `POST /openApi/swap/v2/trade/order/test`, which validates the signature and parameters without placing a trade. The script aborts immediately if `BINGX_TESTNET` is not set — a hard guard against accidentally running against mainnet.

## 3 Recipes

### Recipe 1 — Regime-gated entries

Call `get_market_regime` before acting. When the regime is `RANGING`, a trend-following agent can skip the entry rather than paying the spread on a chop signal. The regime arrives in the same composite response — no second provider, no extra call.

### Recipe 2 — Validate before you place

BingX exposes `POST /openApi/swap/v2/trade/order/test` alongside the real `POST /openApi/swap/v2/trade/order`. Route every order through the test endpoint first and only submit on a clean response. It is the cheapest possible guard against a malformed signature or a bad `positionSide`, and it costs nothing.

### Recipe 3 — Top up demo funds from code

The VST balance is adjustable via the API itself: `POST /openApi/swap/v2/trade/getVst` takes `adjustType` (`0` increase / `1` decrease) and `amount`, rate-limited to 5/s per UID. A long-running backtest harness can therefore reset its own demo balance between runs without touching the web console.

## ⚠️ Production setup (real-money)

The demo above runs on the VST demo host only. Real-money setup requires:

- KYC completion on BingX.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted). Keys are read-only until you explicitly grant trade permission.
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.
- Awareness of the order rate limit — 10/s per UID and 3/s per IP on the place-order endpoint.

See `examples/bingx/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-bingx-footer)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-07-21 · BingX publishes no official client SDK; demo uses plain fetch + node:crypto*
