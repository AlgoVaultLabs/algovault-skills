# AlgoVault × Bitget — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-bitget)
> *Snapshot taken 2026-04-26 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Bitget's [Agent Hub](https://github.com/BitgetLimited/agent_hub) (and its agent-native AI account, **GetClaw**) and your agent has both the analytics brain and an execution venue purpose-built for autonomous AI trading.

> **Provenance:** Official Bitget [`bitget-mcp-server@1.1.0`](https://www.npmjs.com/package/bitget-mcp-server) (npm; description "Official Bitget MCP Server", maintained by `secaudit@bitget.com`) + [`github.com/BitgetLimited/agent_hub`](https://github.com/BitgetLimited/agent_hub) (default branch `main`). Demo execution requires a separate **GetClaw demo account** — Bitget's per-account demo balance — because the Bitget MCP server has **no env-var-level demo flag**. This tutorial wraps the demo with `BITGET_DEMO=true` + `MAINNET_BLOCKED=true` constants + a hard `0.0001 BTC` order-size cap. Verified 2026-04-25.

## TL;DR (3-line hook — MOAT-led)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 5 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for `get_trade_signal` on `BTC` at the `1h` timeframe.
2. Reads the verdict's `signal` and `confidence` and renders them as a natural-language instruction (e.g. *"BUY 0.0001 BTC because confidence is 78% and the regime is TRENDING_UP"*).
3. Hands the instruction to Bitget's GetClaw agent — which, when run against a GetClaw demo account, executes the order autonomously inside its dedicated AI account.

The whole loop runs in **GetClaw demo mode** with our wrapper guards — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Bitget GetClaw demo account** — per Bitget's Agent Hub announcement, GetClaw runs inside a dedicated AI account with its own balance. Sign up for a Bitget account at <https://www.bitget.com>, then enable GetClaw + a demo balance via the **Agent Hub** dashboard. **The demo's hard guards refuse to run unless you've set `BITGET_DEMO=true` and confirmed the keys belong to a demo account, not your mainnet wallet.**
4. **Bitget Agent Hub MCP** installed (recommended for the recipes; the demo runs without it via the public REST surface):
   ```bash
   claude mcp add -s user \
     --env BITGET_API_KEY=<your_demo_api_key> \
     --env BITGET_SECRET_KEY=<your_demo_secret> \
     --env BITGET_PASSPHRASE=<your_demo_passphrase> \
     bitget -- npx -y bitget-mcp-server@1.1.0
   ```

## Demo: Natural-language verdict + GetClaw execution (≤80 lines)

```javascript
// examples/bitget/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const MAINNET_BLOCKED = true;
const MAX_QTY_BTC = 0.0001;
const BITGET_BASE = 'https://api.bitget.com/api/v2';

if (process.env.BITGET_DEMO !== 'true') {
  throw new Error('BITGET_DEMO=true required — demo refuses to run against mainnet.');
}

console.log('=== DEMO MODE ===');
console.log('[BITGET_DEMO=true | wrapper-enforced; MCP server has no built-in demo flag]');

// 1. AlgoVault verdict
const verdict = await getAlgoVaultVerdict({ coin: 'BTC', timeframe: '1h' });

// 2. Natural-language instruction render
const instruction = verdict.signal === 'BUY' && verdict.confidence > 70
  ? `BUY ${MAX_QTY_BTC} BTC because confidence is ${verdict.confidence}% and regime is ${verdict.regime}`
  : `HOLD — ${verdict.signal}@${verdict.confidence}% does not meet policy threshold`;

// 3. Probe Bitget contract specs to prove the BITGET_DEMO path

console.log('=== NO REAL ORDERS PLACED ===');
```

Run it:

```bash
BITGET_DEMO=true node examples/bitget/demo.mjs
```

Expected output (last 4 lines):

```
[verdict | signal=... confidence=... regime=...]
[instruction | "BUY 0.0001 BTC because ..."]
[bitget | contracts HTTP 200 | host=api.bitget.com BTCUSDT minTradeNum=0.0001]
[getclaw | SKIPPED — see README for authenticated POST /v2/mix/order/place-order with BITGET_API_KEY/SECRET/PASSPHRASE]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch the AlgoVault verdict.** The shared helper opens an MCP session against `https://api.algovault.com/mcp`, calls `get_trade_signal` for `BTC` on `1h`, and returns the parsed `signal` / `confidence` / `regime` / `factors` payload. Free tier covers the BTC + 1h combination.

2. **Render the natural-language instruction.** When the verdict satisfies the agent's pre-configured policy (`signal === 'BUY' AND confidence > 70`), the script generates a one-line natural-language instruction GetClaw can interpret directly. When the policy does not fire, the instruction is `HOLD` with the failing reason. This recipe is the canonical "AlgoVault as the analytics brain, GetClaw as the natural-language execution agent" pattern.

3. **Probe Bitget contract specs.** The script issues `GET /api/v2/mix/market/contracts?productType=USDT-FUTURES` to confirm Bitget's BTCUSDT perpetual is available + records the exchange's minimum trade unit (`minTradeNum: 0.0001`). The agent's pre-configured policy uses this minimum as the order size cap. The `=== NO REAL ORDERS PLACED ===` banner closes every run regardless of the policy outcome. The script aborts immediately if `BITGET_DEMO` is not set to `true`, if `MAINNET_BLOCKED` has been edited away from `true`, or if the requested order size exceeds the `MAX_QTY_BTC = 0.0001` cap — three independent guards against accidental mainnet execution.

## 3 Recipes

### Recipe 1 — Natural-language verdict + GetClaw execution

This is the recipe `examples/bitget/demo.mjs` implements. The agent calls AlgoVault `get_trade_signal` for `BTC` on `1h`, renders the verdict as a natural-language instruction, and hands the instruction to GetClaw running inside a dedicated demo account. GetClaw interprets the instruction, applies its own pre-configured risk policy (size cap, slippage tolerance), and either executes via `POST /v2/mix/order/place-order` or skips with a logged reason. **GetClaw's autonomy is bounded by the demo account's balance + your wrapper's `BITGET_DEMO=true` env contract — never by code-level checks alone.**

### Recipe 2 — Five Bitget AI Skills + AlgoVault composite verdict (complementary)

Bitget Agent Hub ships five analytical AI Skills out of the box: macro, technical, sentiment, intel, and news. Each Skill looks at one dimension of the market in isolation. AlgoVault's composite verdict is **complementary** — it fuses the underlying primitives (RSI, EMA, funding rate, OI momentum, volume, plus cross-venue regime) into a single direction-and-confidence call. The agent runs both: Bitget Skills give per-dimension narrative context the agent can show to the user; AlgoVault gives the cross-dimensional decision. Use them together — they answer different questions.

### Recipe 3 — Agent-native portfolio rebalance via GetClaw

The agent runs a daily regime scan via AlgoVault `get_market_regime` (or reads `regime` off `get_trade_signal`) across the assets in the GetClaw demo account's portfolio. For any asset whose regime has shifted (e.g. moved from `RANGING` to `TRENDING_DOWN`), the agent's pre-configured rebalance policy issues a natural-language rebalance instruction to GetClaw — **inside the demo account's walled garden**. GetClaw's account-isolation guarantees the rebalance can't touch any other Bitget account funds. **Multi-asset position state lives in the GetClaw demo account, not in agent memory — the agent reads, decides, and instructs; GetClaw owns and executes.**

## ⚠️ Production setup (real-money)

The demo above runs in a Bitget GetClaw demo account only. Real-money setup requires:

- KYC completion on Bitget.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted) — distinct from your demo account's keys.
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently. With GetClaw's account-isolation model, the watchdog reads from the GetClaw account specifically — not the master Bitget account.

See `examples/bitget/README.md` for the full real-money checklist + the Bitget Agent Hub install via `claude mcp add ... -- npx -y bitget-mcp-server@1.1.0`. **AlgoVault provides analytics; your agent (and GetClaw) decide what to execute inside the policy you set.**

## Why AlgoVault? (closing — MOAT recap)

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 5 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-bitget)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-04-25 · Bitget `bitget-mcp-server@1.1.0` (npm) + `BitgetLimited/agent_hub` (GitHub)*
