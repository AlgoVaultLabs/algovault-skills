# AlgoVault × Gemini — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-gemini)
> *Snapshot taken 2026-04-26 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Gemini's self-hosted [Agentic Trading MCP](https://github.com/gemini/developer-platform) and your agent has both the analytics brain and the execution venue.

> **Provenance:** Gemini Agentic Trading MCP, launched 2026-04-27. Self-hosted Node MCP under [`github.com/gemini/developer-platform`](https://github.com/gemini/developer-platform) → `packages/mcp-server` (**Apache-2.0**). Demo execution runs against [Gemini sandbox](https://exchange.sandbox.gemini.com) (`https://api.sandbox.gemini.com`), gated by the `GEMINI_API_BASE_URL` env var containing `sandbox`. Verified 2026-06-04.

## TL;DR (3-line hook — MOAT-led)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 5 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for `get_trade_signal` on ETH at two timeframes (`15m` and `1h`).
2. Confirms multi-timeframe consensus — both timeframes return the same `signal` direction.
3. Hands the consensus signal to a Gemini sandbox order via `gemini_new_order` when the agent's policy fires.

The whole loop runs against Gemini sandbox — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault MCP wired** — use the `mcp-remote` JSON form below. Keep the track-token header on every tier:
   ```json
   {
     "mcpServers": {
       "algovault": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "https://api.algovault.com/mcp",
                  "--header", "X-AlgoVault-Track-Token:int-gemini"]
       },
       "gemini": { "command": "node", "args": ["<repo_root>/packages/mcp-server/dist/index.js"],
         "env": { "GEMINI_API_KEY": "<k>", "GEMINI_API_SECRET": "<s>", "GEMINI_API_BASE_URL": "https://api.sandbox.gemini.com/v1" } }
     }
   }
   ```
3. **Gemini sandbox account** (free signup at <https://exchange.sandbox.gemini.com>; auto-credited test funds). Create a key at <https://exchange.gemini.com/settings/api> with the **Trading** scope.
4. **Gemini Agentic Trading MCP** built from source (recommended for the recipes; the demo runs without it via the public market-data surface):
   ```bash
   git clone https://github.com/gemini/developer-platform
   cd developer-platform/packages/mcp-server && npm install && npm run build
   ```

## Demo: Multi-timeframe consensus → Gemini sandbox order (≤80 lines)

```javascript
// examples/gemini/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

export const MAINNET_BLOCKED = true;
const base = process.env.GEMINI_API_BASE_URL || '';
const TIMEFRAMES = ['15m', '1h'];

if (!base.includes('sandbox')) {
  throw new Error('GEMINI_API_BASE_URL must contain "sandbox" — demo refuses to run against mainnet.');
}

console.log('=== DEMO MODE ===');
console.log(`[GEMINI_API_BASE_URL=${base} | mainnet_blocked=true]`);

// 1. Multi-timeframe AlgoVault read on ETH
const verdicts = [];
for (const tf of TIMEFRAMES) {
  verdicts.push(await getAlgoVaultVerdict({ coin: 'ETH', timeframe: tf }));
}

// 2. Consensus check
const directions = new Set(verdicts.map((v) => v.signal));
const consensus = directions.size === 1 && !directions.has('HOLD');

// 3. Keyless Gemini sandbox public probe to prove the sandbox path
await fetch(`${base}/pubticker/btcusd`);

console.log('=== NO REAL ORDERS PLACED ===');
```

Run it:

```bash
GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1 node examples/gemini/demo.mjs
```

Expected output (last 4 lines):

```
[verdicts | 15m=... 1h=... | consensus=... direction=...]
[gemini sandbox | pubticker HTTP 200 | host=api.sandbox.gemini.com last=...]
[order | SKIPPED — see README for gemini_new_order via MCP with sandbox keys]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch AlgoVault verdicts on multiple timeframes.** The shared helper opens an MCP session against `https://api.algovault.com/mcp` and calls `get_trade_signal` for `ETH` on `15m` and `1h` (both free-tier supported). The agent receives two independent reads from the same composite-verdict pipeline — different windows of price action, same model.

2. **Apply the agent's consensus policy.** When both timeframes return the same `signal` direction (and that direction is not `HOLD`), the agent's pre-configured policy fires its execution branch. Disagreement between timeframes — or any `HOLD` — skips execution entirely. The threshold of "all timeframes agree" is the agent's choice; you might use 2-of-3 or weighted voting in production.

3. **Probe Gemini sandbox to prove the sandbox path.** The script calls `GET /v1/pubticker/btcusd` against `api.sandbox.gemini.com` — a public market-data tool that needs no keys. With keys, the full path is `gemini_new_order` via the Gemini MCP. The `=== NO REAL ORDERS PLACED ===` banner closes every run. The script aborts immediately unless `GEMINI_API_BASE_URL` contains `sandbox` — a hard guard against running on mainnet.

## 3 Recipes

### Recipe 1 — Multi-timeframe consensus → Gemini sandbox order

This is the recipe `examples/gemini/demo.mjs` implements. The agent calls AlgoVault `get_trade_signal` for `ETH` on `15m` and `1h` (extend to `5m` once on Starter+ for a 3-timeframe consensus). The agent's pre-configured policy fires its execution branch only when **all queried timeframes agree** on the same direction (`BUY` or `SELL`; `HOLD` always blocks). On execution, a small `LIMIT` order goes to Gemini sandbox via `gemini_new_order`. The threshold of "all agree" is the agent's choice — you might run 2-of-3 weighted voting in production.

### Recipe 2 — Regime-gated staking of idle balance

The agent calls AlgoVault `get_market_regime` (or reads `regime` off the `get_trade_signal` payload) for the asset of interest. It then reads idle holdings via `gemini_get_balances`. The agent's pre-configured policy fires its execution branch when the returned regime is calm (for example `RANGING`) and confidence exceeds a configured floor. On execution, the agent stakes a slice of the idle balance via `gemini_stake`. **AlgoVault returns the regime read only — staking is the agent's policy.**

### Recipe 3 — Funding-aware perp watch

The agent calls AlgoVault `scan_funding_arb` for a cross-venue funding read on the asset of interest. It also reads the venue side via `gemini_get_funding_amounts`. The agent's pre-configured policy fires its execution branch when the two reads agree that funding favors one side past a configured floor. On execution, a Gemini sandbox perp order goes via `gemini_new_order`. **AlgoVault returns the cross-venue analytics; the agent + its risk policy decide execution.**

## ⚠️ Production setup (real-money)

The demo above runs on Gemini sandbox only. Real-money setup requires:

- KYC completion on Gemini.
- Production API keys scoped to **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Subaccounts to give each agent isolated balances, rate limits, and blast radius.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.

See `examples/gemini/README.md` for the full real-money checklist + the Gemini MCP build from source (point `GEMINI_API_BASE_URL` at the mainnet host for production runs). **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault? (closing — MOAT recap)

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 5 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-gemini)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-06-04 · Gemini Agentic Trading MCP (Apache-2.0) · repo `gemini/developer-platform`*
