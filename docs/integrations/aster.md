# AlgoVault × Aster — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-aster)
> *Live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Aster's on-chain perps API and your agent has both the analytics brain and the execution venue.

> **Provenance:** OFFICIAL API documentation at [`asterdex/api-docs`](https://github.com/asterdex/api-docs) (the canonical source; rendered at [asterdex.github.io/aster-api-website](https://asterdex.github.io/aster-api-website/)). Aster publishes **no package on npm or PyPI** — its official Python connector is git-install only (its README's `pip install aster-connector-python` returns a PyPI 404, verified 2026-07-21). Demo execution targets the [Aster futures testnet](https://asterdex.github.io/aster-api-website/) (`https://fapi.asterdex-testnet.com`) on BNB Chain Testnet, with `ASTER_TESTNET=true` + `MAINNET_BLOCKED=true` wrapper guards. Note the canonical domain is **asterdex.com** — `aster.exchange` does not resolve. Verified 2026-07-21.

## ⚠️ V1 API keys are closed — new integrations must use V3

Aster's api-docs README states that **from 2026-03-25, V1 new API Key creation is no longer supported** (existing keys keep working). If you are starting today you cannot obtain the simple HMAC-style V1 credentials, so this tutorial targets **V3**, which authenticates with an **EIP-712 wallet signature** rather than an API key/secret pair. Note that Aster's own official Python connector is V1-only and last saw a commit in March 2025 — it is not a viable starting point for a new integration.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for a composite verdict on a chosen asset + timeframe.
2. Reads the verdict's `call`, `confidence`, `regime`, and `reasoning` fields.
3. Builds the exact Aster V3 order request the verdict implies and prints it, running against Aster's testnet.

The whole loop runs against Aster's futures testnet — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Nothing else for the demo.** It is keyless — the testnet's public endpoints need no credentials.
4. **For actual order submission only**, a testnet wallet plus an API wallet ("AGENT") minted at <https://www.asterdex-testnet.com/en/api-wallet> (switch to the `Pro API` tab), funded from the [testnet faucet](https://www.asterdex-testnet.com/en/faucet) — 1,000 test USDT + 1,000 test ASTER, once per day. If you want Aster's official Python connector, install it from git, never from PyPI:
   ```bash
   pip install git+https://github.com/asterdex/aster-connector-python.git
   ```

## Demo: Verdict-to-order-request preview on BTC (≤80 lines)

```javascript
// examples/aster/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const ASTER_TESTNET_BASE = 'https://fapi.asterdex-testnet.com';

if (process.env.ASTER_TESTNET !== 'true') {
  throw new Error('ASTER_TESTNET=true required — demo refuses to run against mainnet.');
}

const verdict = await getAlgoVaultVerdict({ coin: 'BTC', timeframe: '1h' });

if (verdict.call === 'BUY' && verdict.confidence > 70) {
  const request = {
    endpoint: 'POST /fapi/v3/order',
    params: { symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: '0.001',
              user: '<master wallet>', signer: '<API wallet>', nonce: '<micros>' },
  };
  console.log(JSON.stringify(request, null, 2)); // printed, NOT signed or sent
}
```

Run it:

```bash
ASTER_TESTNET=true node examples/aster/demo.mjs
```

Expected output (last 3 lines):

```
[aster testnet | ping HTTP 200 | BTCUSDT tradable | serverTime drift 41ms]
[aster] would submit: POST https://fapi.asterdex-testnet.com/fapi/v3/order
[aster] request printed above — NOT signed, NOT sent. Demo complete.
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch the AlgoVault verdict.** The helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_call` with `{coin, timeframe}`, and returns the parsed `call` / `confidence` / `regime` / `reasoning` payload. Free tier covers up to 20 calls/day per IP — plenty for development.

2. **Apply the agent's policy.** When the verdict satisfies a pre-configured policy (e.g. *the agent's policy fires when `confidence > 70` AND `call === 'BUY'`*), the script proceeds to the request-building branch. The policy lives entirely in your code — AlgoVault returns the analytics; the agent decides.

3. **Build the Aster V3 request.** The script checks testnet reachability and clock drift, confirms the symbol is listed, assembles the V3 order parameters, and prints them. The script aborts immediately if `ASTER_TESTNET` is not set — a hard guard against accidentally pointing at mainnet.

## 3 Recipes

### Recipe 1 — Regime-gated entries

Call `get_market_regime` before acting. When the regime is `RANGING`, a trend-following agent can skip the entry rather than paying the spread on a chop signal. The regime arrives in the same composite response.

### Recipe 2 — Reuse a Binance-shaped client, carefully

Aster's REST surface is Binance-USD-M-Futures-*shaped*: the same `/fapi/v1/` path family, the `X-MBX-APIKEY` header on the V1 rail, and Binance's error-code taxonomy (`-1102`, `-2014`). Aster does **not** formally advertise Binance compatibility, so treat the resemblance as a convenience for porting request-building code, not a compatibility guarantee — and note that V3's auth model is entirely different (wallet signature, no API secret).

### Recipe 3 — Sign a V3 order correctly

V3 signs an EIP-712 payload with the API wallet's key. Three details cause most failures: the `nonce` is in **microseconds** (not milliseconds) and must be within ±10s of server time; the EIP-712 `chainId` is **714 on testnet** and 1666 on mainnet, so a copy-pasted mainnet signer silently fails against testnet; and agent *registration* uses `signatureChainId` (`56`/`101`) rather than the fixed `714`. Aster's own testnet doc calls this last one out explicitly.

## ⚠️ Production setup (real-money)

The demo above runs on testnet only. Real-money setup requires:

- An API wallet ("AGENT") on mainnet with only the permissions your agent needs.
- The mainnet EIP-712 `chainId` (1666) and the mainnet base host `https://fapi.asterdex.com`.
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.
- Awareness that rate limits are **per-IP, not per-key** (2,400 weight/min, 1,200 orders/min, 300 orders/s).

See `examples/aster/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-aster-footer)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-07-21 · Aster publishes no npm/PyPI package; official Python connector is git-install only*
