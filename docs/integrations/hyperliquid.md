# AlgoVault × Hyperliquid — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-hyperliquid)
> *Live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Hyperliquid's on-chain perps API and your agent has both the analytics brain and the execution venue.

> **Provenance:** OFFICIAL [`hyperliquid-python-sdk`](https://github.com/hyperliquid-dex/hyperliquid-python-sdk) (`hyperliquid-dex` org · PyPI `hyperliquid-python-sdk` **0.24.0**, published 2026-06-04 · 1,758⭐ · MIT). There is **no official JavaScript/npm SDK** — the [official API docs](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) list TypeScript SDKs as *"written by members of the community"*. The Rust SDK, despite living in the `hyperliquid-dex` org, is likewise described by those docs as community-authored. Demo execution targets the [Hyperliquid testnet](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) (`https://api.hyperliquid-testnet.xyz`) with `HYPERLIQUID_TESTNET=true` + `MAINNET_BLOCKED=true` wrapper guards. Verified 2026-07-21.

## ⚠️ Read this before you start — eligibility and faucet preconditions

Two constraints are specific to Hyperliquid, and both are worth knowing **before** you write any code:

1. **Jurisdiction.** Hyperliquid's [Terms of Use](https://app.hyperliquid.xyz/terms) (§1.6, last updated 2026-06-15) define "Restricted Persons" to include persons or entities resident, located, incorporated, or registered in **the United States of America or Ontario, Canada**, plus sanctioned territories — and state that Restricted Persons "are strictly prohibited from accessing or using the Interface." §1.9 further requires that you not use "any technology or method to disguise your location or otherwise evade any access restriction." Determine your own eligibility before proceeding; this tutorial does not offer a workaround.
2. **The testnet faucet is not open-access.** Per the [testnet faucet docs](https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/testnet-faucet), eligibility requires that you "have previously deposited on mainnet using the same address." A brand-new throwaway wallet **cannot** fund itself on testnet.

Because of (2), the demo below is deliberately **keyless and order-free**: it fetches the AlgoVault verdict, reads live testnet metadata, and *prints the exact order payload it would sign* — without signing or submitting anything. That path runs for everyone. Submitting the order is documented in Recipe 3 for readers who are eligible and already funded.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for a composite verdict on a chosen asset + timeframe.
2. Reads the verdict's `signal`, `confidence`, `regime`, and `factors` fields.
3. Builds the exact Hyperliquid order action the verdict implies and prints it for inspection, running against Hyperliquid's **testnet** endpoint.

The whole loop runs against Hyperliquid's testnet API — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Nothing else for the demo.** It is keyless — no account, no funds, no API wallet.
4. **For actual order submission only** (Recipe 3), the official Python SDK:
   ```bash
   pip install hyperliquid-python-sdk
   ```
   Plus an eligible, mainnet-funded address and an approved API wallet — see the preconditions above.

## Demo: Verdict-to-order-payload preview on ETH (≤80 lines)

```javascript
// examples/hyperliquid/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const HL_TESTNET_BASE = 'https://api.hyperliquid-testnet.xyz';

if (process.env.HYPERLIQUID_TESTNET !== 'true') {
  throw new Error('HYPERLIQUID_TESTNET=true required — demo refuses to run against mainnet.');
}

// 1. Composite verdict from AlgoVault
const verdict = await getAlgoVaultVerdict({ coin: 'ETH', timeframe: '1h' });

// 2. The agent's own policy decides — AlgoVault only supplies analytics
if (verdict.signal === 'BUY' && verdict.confidence > 70) {
  // 3. Resolve the asset index from live testnet metadata, then build the action
  const action = {
    type: 'order',
    orders: [{ a: assetIndex, b: true, p: limitPx, s: '0.01', r: false,
               t: { limit: { tif: 'Ioc' } } }],
    grouping: 'na',
  };
  console.log(JSON.stringify(action, null, 2)); // printed, NOT signed or sent
}
```

Run it:

```bash
HYPERLIQUID_TESTNET=true node examples/hyperliquid/demo.mjs
```

Expected output (last 3 lines):

```
[hyperliquid] asset ETH resolved to index 4 (testnet meta)
[hyperliquid] would submit: POST https://api.hyperliquid-testnet.xyz/exchange
[hyperliquid] payload printed above — NOT signed, NOT sent. Demo complete.
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch the AlgoVault verdict.** The helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_call` with `{coin, timeframe}`, and returns the parsed `signal` / `confidence` / `regime` / `factors` payload. Free tier covers up to 20 calls/day per IP — plenty for development.

2. **Apply the agent's policy.** When the verdict satisfies a pre-configured policy (e.g. *the agent's policy fires when `confidence > 70` AND `signal === 'BUY'`*), the script proceeds to the payload-building branch. The policy lives entirely in your code — AlgoVault returns the analytics; the agent decides.

3. **Build the Hyperliquid action.** The script `POST`s to the testnet `/info` endpoint to resolve the asset's index (Hyperliquid identifies assets by integer index, not ticker), assembles the `order` action, and prints it. The script aborts immediately if `HYPERLIQUID_TESTNET` is not set — a hard guard against accidentally pointing at mainnet.

## 3 Recipes

### Recipe 1 — Regime-gated entries on BTC

Call `get_market_regime` for BTC before acting on any verdict. When the regime is `RANGING`, an agent configured for trend-following can skip the entry entirely rather than paying the spread on a chop signal. The regime field is part of the same composite response — no second provider, no extra call.

### Recipe 2 — Confidence-tiered order sizing

Rather than a fixed size, map `confidence` onto a size ladder your risk policy defines (for example: below 60 → no order; 60–80 → base size; above 80 → base × 1.5, still under your per-order cap). Hyperliquid's order payload takes size as a string in the `s` field, so the mapping happens in your code before the action is built.

### Recipe 3 — Actual submission via the official Python SDK

Order submission requires an EIP-712 signature, and Hyperliquid uses **two distinct signing schemes**: L1 actions (orders, cancels) sign a "phantom agent" under domain `Exchange` with a hardcoded `chainId: 1337`, while user-signed actions (transfers, `approveAgent`) use domain `HyperliquidSignTransaction`. The official Python SDK implements both correctly:

```python
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants
exchange = Exchange(wallet, constants.TESTNET_API_URL, account_address=MASTER_ADDRESS)
```

Two things that bite here. First, `account_address` must be the **master** wallet even when the signing key is an API wallet — the SDK README is explicit about this. Second, the SDK's `market_open()` / `market_close()` helpers submit an **IOC limit order priced off a 5% default slippage**, not a true market order; describe them accordingly in any code you ship.

## ⚠️ Production setup (real-money)

The demo above runs on testnet only. Real-money setup requires:

- Confirming your own eligibility under Hyperliquid's Terms of Use.
- An approved API wallet with **only** the permissions your agent needs; never reuse a deregistered API-wallet address, since its nonce state may be pruned.
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.
- Awareness of the address-based rate limit — an address accrues roughly 1 request per 1 USDC of cumulative volume after an initial buffer, and throttles to 1 request / 10 s when exhausted.

See `examples/hyperliquid/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-hyperliquid-footer)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-07-21 · `hyperliquid-python-sdk` 0.24.0 OFFICIAL (`github.com/hyperliquid-dex/hyperliquid-python-sdk`); no official npm SDK exists*
