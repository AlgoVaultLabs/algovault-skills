# AlgoVault × OKX — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-okx)
> *Snapshot taken 2026-04-26 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with OKX's [Agent Trade Kit](https://github.com/okx/agent-trade-kit) and your agent has both the analytics brain and the execution venue.

> **Provenance:** Official OKX [`@okx_ai/okx-trade-mcp@1.3.1`](https://www.npmjs.com/package/@okx_ai/okx-trade-mcp) (npm) + [`github.com/okx/agent-trade-kit`](https://github.com/okx/agent-trade-kit) (default branch `master`, description "OKX trading MCP server — connect AI agents to spot, swap, futures, options & grid bots via the Model Context Protocol"). Demo execution runs against OKX's simulated-trading environment via the `--demo` CLI flag (verbatim from `docs/cli-reference.md`: `--demo | Use simulated trading (demo) mode`). Verified 2026-04-25.

## TL;DR (3-line hook — MOAT-led)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 5 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for `get_market_regime` across BTC, ETH, and SOL on the 4h timeframe.
2. Identifies any asset whose regime is `RANGING` (a precondition for grid-bot strategies).
3. Hands the candidate set to the OKX Agent Trade Kit, which would create a small grid-bot order in **OKX demo mode** when the agent's pre-configured policy fires.

The whole loop runs against OKX's simulated-trading environment (the `--demo` flag's underlying behavior; equivalent REST surface via the `x-simulated-trading: 1` header). **Zero real-money risk in any code path.**

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **OKX demo trading account** — sign in at <https://www.okx.com> → toggle to **Demo Trading** (top-right account menu). Generate API key + secret + passphrase from the demo console (separate from mainnet keys).
4. **OKX Agent Trade Kit** installed (recommended for the recipes; the demo runs without it via the public REST surface):
   ```bash
   npx -y @okx_ai/okx-trade-cli@latest setup --client claude-code --profile demo
   ```
   Then:
   ```bash
   npx -y @okx_ai/okx-trade-cli@latest --demo --modules market,spot,account
   ```

## Demo: Multi-asset regime scan + grid-bot trigger (≤80 lines)

```javascript
// examples/okx/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const OKX_BASE = 'https://www.okx.com/api/v5';
const SIMULATED = { 'x-simulated-trading': '1' };  // OKX demo-trading header
const ASSETS = ['BTC', 'ETH', 'SOL'];

if (process.env.OKX_DEMO !== 'true') {
  throw new Error('OKX_DEMO=true required — demo refuses to run against mainnet.');
}

console.log('=== DEMO MODE ===');
console.log(`[OKX_DEMO=true | --demo equivalent header x-simulated-trading: 1]`);

// 1. AlgoVault regime read across BTC/ETH/SOL on 4h
const verdicts = await Promise.all(
  ASSETS.map((coin) => getAlgoVaultVerdict({ coin, timeframe: '4h' }))
);

// 2. Identify RANGING regimes (grid-bot precondition)
const rangingAssets = verdicts.filter((v) => v.regime === 'RANGING');

// 3. Probe OKX simulated-trading instrument (proves --demo path works)
//    Real grid-bot creation uses POST /api/v5/tradingBot/grid/order-algo

console.log('=== NO REAL ORDERS PLACED ===');
```

Run it:

```bash
OKX_DEMO=true node examples/okx/demo.mjs
```

Expected output (last 4 lines):

```
[verdicts | BTC=... ETH=... SOL=... ranging_count=...]
[okx demo | spot/instruments HTTP 200 | host=www.okx.com (x-simulated-trading: 1)]
[grid-bot | SKIPPED — see README for authenticated POST /tradingBot/grid/order-algo]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch AlgoVault regime reads in parallel.** The shared helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_signal` for `BTC` / `ETH` / `SOL` on the `4h` timeframe (each call returns `regime` alongside the signal/confidence), and returns the parsed payloads. Free tier covers 20 calls/day per IP — three regime reads per scan is ample for development.

2. **Apply the agent's policy.** The agent's grid-bot policy fires only when at least one asset in the scan returns a `RANGING` regime (grid bots only profit in range-bound markets — running them in `TRENDING_*` or `VOLATILE` regimes destroys capital). The policy lives in your code — AlgoVault returns the regime classifications; the agent decides.

3. **Probe the OKX simulated-trading surface.** The script issues a `GET /api/v5/public/instruments?instType=SPOT&instId=BTC-USDT` against `www.okx.com` with the `x-simulated-trading: 1` header (the REST equivalent of the OKX MCP CLI's `--demo` flag). On success OKX returns `code: "0"` and a full instrument-detail payload. The `=== NO REAL ORDERS PLACED ===` banner closes every run regardless of the policy outcome. The script aborts immediately if `OKX_DEMO` is not `true` — a hard guard against accidentally running against mainnet.

## 3 Recipes

### Recipe 1 — Multi-asset regime scan + grid-bot trigger

This is the recipe `examples/okx/demo.mjs` implements. The agent calls AlgoVault `get_market_regime` (or `get_trade_signal` which carries `regime` as a field) across `BTC`, `ETH`, and `SOL` on the `4h` timeframe. For any asset whose regime is `RANGING`, the agent's pre-configured policy hands the candidate to the OKX Agent Trade Kit's grid-bot creator (`POST /api/v5/tradingBot/grid/order-algo`) in OKX demo mode. The grid bounds, leverage, and grid count come from the agent's own configuration — AlgoVault returns the regime; the agent tunes the bot.

### Recipe 2 — Funding-arb pair on options

The agent calls AlgoVault `scan_funding_arb` to retrieve the top funding-spread opportunities. When the top spread exceeds 12 bps and OKX is one of the two indicated venues, the agent's pre-configured policy can route the long leg through OKX options (`POST /api/v5/trade/order` with `instType=OPTION`) in OKX demo mode and the short leg through the counterparty venue. **Multi-venue execution is out of scope for this single-exchange tutorial — readers are advised to extend the demo with their own cross-venue routing layer once the policy thresholds are dialled in.**

### Recipe 3 — Risk-gated entry with confidence floor

The agent calls AlgoVault `get_trade_signal` for the asset of interest. The agent's pre-configured policy fires only when the returned `confidence` exceeds 75% — a deliberately tight floor that filters out mid-conviction signals. On execution, a small spot order goes to OKX demo via `POST /api/v5/trade/order` with `instType=SPOT`. The threshold of 75% is the agent's choice, not AlgoVault's recommendation — you tune it to your strategy's risk appetite.

## ⚠️ Production setup (real-money)

The demo above runs in OKX demo trading only. Real-money setup requires:

- KYC completion on OKX.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.

See `examples/okx/README.md` for the full real-money checklist + the OKX Agent Trade Kit production install via `npx -y @okx_ai/okx-trade-cli@latest setup --client claude-code --profile live`. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault? (closing — MOAT recap)

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 5 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-okx)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-04-25 · OKX `@okx_ai/okx-trade-mcp@1.3.1` (npm) + `okx/agent-trade-kit` (GitHub)*
