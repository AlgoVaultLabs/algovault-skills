# AlgoVault × Bybit — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-bybit)
> *Snapshot taken 2026-04-26 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Bybit's [Official Trading MCP](https://github.com/bybit-exchange/trading-mcp) and your agent has both the analytics brain and the execution venue.

> **Provenance:** Official Bybit MCP, launched 2026-04-22. [`bybit-official-trading-server@2.0.9`](https://www.npmjs.com/package/bybit-official-trading-server) (npm; **note: spec referenced "v1.x" — the actual current major version is 2**) + [`github.com/bybit-exchange/trading-mcp`](https://github.com/bybit-exchange/trading-mcp) (default branch `main`). Demo execution runs against [Bybit Testnet](https://testnet.bybit.com) (`https://api-testnet.bybit.com/v5/*`) with the `BYBIT_TESTNET=true` env var (verbatim from README: `\| BYBIT_TESTNET \| No \| false \| Set to true to use the testnet \|`). Verified 2026-04-25.

## TL;DR (3-line hook — MOAT-led)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 5 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for `get_trade_signal` on ETH at two timeframes (`15m` and `1h`).
2. Confirms multi-timeframe consensus — both timeframes return the same `signal` direction.
3. Hands the consensus signal to Bybit Linear Perpetual testnet, which validates a small order (`POST /v5/order/create` against `api-testnet.bybit.com`) when the agent's pre-configured policy fires.

The whole loop runs against Bybit Testnet — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Bybit Testnet account** (free signup at <https://testnet.bybit.com>; separate from mainnet). Generate API key + secret in **API Management** — testnet keys are scoped to testnet balance only and cannot touch mainnet funds.
4. **Bybit Official Trading MCP** installed (recommended for the recipes; the demo runs without it via the public REST surface):
   ```bash
   npx -y bybit-official-trading-server@2.0.9
   ```

## Demo: Multi-timeframe consensus → Bybit perp entry (≤80 lines)

```javascript
// examples/bybit/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const BYBIT_TESTNET_BASE = 'https://api-testnet.bybit.com';
const TIMEFRAMES = ['15m', '1h'];

if (process.env.BYBIT_TESTNET !== 'true') {
  throw new Error('BYBIT_TESTNET=true required — demo refuses to run against mainnet.');
}

console.log('=== DEMO MODE ===');
console.log(`[BYBIT_TESTNET=true | base=${BYBIT_TESTNET_BASE}]`);

// 1. Multi-timeframe AlgoVault read on ETH
const verdicts = [];
for (const tf of TIMEFRAMES) {
  verdicts.push(await getAlgoVaultVerdict({ coin: 'ETH', timeframe: tf }));
}

// 2. Consensus check
const directions = new Set(verdicts.map((v) => v.signal));
const consensus = directions.size === 1 && !directions.has('HOLD');

// 3. Probe Bybit testnet instruments-info to prove BYBIT_TESTNET path

console.log('=== NO REAL ORDERS PLACED ===');
```

Run it:

```bash
BYBIT_TESTNET=true node examples/bybit/demo.mjs
```

Expected output (last 4 lines):

```
[verdicts | 15m=... 1h=... | consensus=... direction=...]
[bybit testnet | instruments-info HTTP 200 | host=api-testnet.bybit.com retCode=0]
[order | SKIPPED — see README for authenticated POST /v5/order/create with BYBIT_TESTNET_API_KEY/SECRET]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch AlgoVault verdicts on multiple timeframes.** The shared helper opens an MCP session against `https://api.algovault.com/mcp` and calls `get_trade_signal` for `ETH` on `15m` and `1h` (both free-tier supported). The agent receives two independent reads from the same composite-verdict pipeline — different windows of price action, same model.

2. **Apply the agent's consensus policy.** When both timeframes return the same `signal` direction (and that direction is not `HOLD`), the agent's pre-configured policy fires its execution branch. Disagreement between timeframes — or any `HOLD` — skips execution entirely. The threshold of "all timeframes agree" is the agent's choice; you might use 2-of-3 or weighted voting in production.

3. **Validate the order against Bybit testnet.** The script probes `GET /v5/market/instruments-info?category=linear&symbol=ETHUSDT` against `api-testnet.bybit.com` to prove demo-mode connectivity. With keys, the full path is `POST /v5/order/create` (Bybit returns `retCode: 0` on success). The `=== NO REAL ORDERS PLACED ===` banner closes every run regardless of which branch fired. The script aborts immediately if `BYBIT_TESTNET` is not `true` — a hard guard against accidentally running against mainnet.

## 3 Recipes

### Recipe 1 — Multi-timeframe consensus → Bybit perp entry

This is the recipe `examples/bybit/demo.mjs` implements. The agent calls AlgoVault `get_trade_signal` for `ETH` on `15m` and `1h` (extend to `5m` once on Starter+ for the original 3-timeframe consensus the spec describes). The agent's pre-configured policy fires its execution branch only when **all queried timeframes agree** on the same direction (`BUY` or `SELL`; `HOLD` always blocks). On execution, a small `LIMIT` order goes to Bybit Linear Perpetual testnet via `POST /v5/order/create`. The threshold of "all agree" is the agent's choice — you might run 2-of-3 weighted voting in production.

### Recipe 2 — Volatility breakout watch with conditional orders

The agent calls AlgoVault `get_market_regime` (or reads `regime` off the `get_trade_signal` payload) for the asset of interest. The agent's pre-configured policy fires its execution branch when the returned regime is `VOLATILE` and confidence exceeds a configured floor. On execution, a Bybit testnet **conditional order** (Bybit's specialty — combines a trigger price, a take-profit, and a stop-loss in one API call via `POST /v5/order/create` with `triggerPrice`, `takeProfit`, `stopLoss`) goes against the breakout direction. The TP/SL distances come from the agent's risk-policy config; AlgoVault returns the regime classification.

### Recipe 3 — Hedge-aware DCA on existing position

The agent already holds a long position. It calls AlgoVault `get_market_regime` and `get_trade_signal` for the same asset. When **both** indicators are bearish (regime ∈ `{TRENDING_DOWN, VOLATILE}` AND signal == `SELL` with high confidence), the agent's pre-configured hedge policy opens an offsetting short on Bybit testnet (notional-only — never leverage above the existing long). When indicators flip back to neutral or bullish, the agent's policy closes the hedge. **Multi-position state management is the agent's responsibility — AlgoVault returns the current read; the agent tracks position, cost basis, and hedge ratio.**

## ⚠️ Production setup (real-money)

The demo above runs on Bybit testnet only. Real-money setup requires:

- KYC completion on Bybit.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.

See `examples/bybit/README.md` for the full real-money checklist + the Bybit Official Trading MCP install via `npx -y bybit-official-trading-server@2.0.9` (omit `BYBIT_TESTNET=true` for production runs). **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault? (closing — MOAT recap)

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 5 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-bybit)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-04-25 · Bybit `bybit-official-trading-server@2.0.9` (npm) + `bybit-exchange/trading-mcp` (GitHub)*
