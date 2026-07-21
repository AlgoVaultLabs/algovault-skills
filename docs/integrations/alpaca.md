# AlgoVault × Alpaca — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-alpaca)
> *Snapshot taken 2026-04-26 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with Alpaca's crypto [MCP Server](https://github.com/alpacahq/alpaca-mcp-server) execution kit and your agent has both the analytics brain and a crypto venue. Lead the setup with `uvx alpaca-mcp-server` and scope the toolsets crypto-only via `ALPACA_TOOLSETS=trading,crypto-data`. As the [Alpaca launch blog](https://alpaca.markets/blog/introducing-official-mcp-server-enabling-multi-market-trading-with-ai-interfaces/) notes: "As your workflow grows, you can connect the MCP Server alongside other MCP servers through an MCP-compatible client like VS Code, Cursor, or Claude Code. This allows traders to combine multiple toolsets inside one interface."

> **Provenance:** Alpaca crypto MCP Server, V2 launched 2026-04-09. [`alpaca-mcp-server@2.0.2`](https://pypi.org/project/alpaca-mcp-server/) (PyPI; MIT). Run zero-install via `uvx alpaca-mcp-server` (requires `uv`). Crypto kit scoped with `ALPACA_TOOLSETS=trading,crypto-data`; `ALPACA_PAPER_TRADE` defaults to `true`. Demo execution runs against the Alpaca paper venue (`paper-api.alpaca.markets/v2/orders`). Verified 2026-06-04.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for `get_trade_call` on ETH at two timeframes (`15m` and `1h`).
2. Confirms multi-timeframe consensus — both timeframes return the same `signal` direction.
3. Hands the consensus signal to the Alpaca crypto kit, which places a tiny notional `BTC/USD` order against the paper venue (`POST paper-api.alpaca.markets/v2/orders`) when the agent's policy fires.

The whole loop runs against the Alpaca paper venue — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check) and **`uv`** (for `uvx`).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Alpaca paper account** (free at <https://app.alpaca.markets/paper/dashboard/overview>; no deposit). Generate `ALPACA_API_KEY` + `ALPACA_SECRET_KEY` — paper keys are scoped to paper balance only.
4. **Both MCP servers wired** into your client. AlgoVault uses the `mcp-remote` form with a track-token header; the Alpaca crypto kit runs via `uvx` with crypto-only toolsets:
   ```json
   {
     "mcpServers": {
       "algovault": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "https://api.algovault.com/mcp",
                  "--header", "X-AlgoVault-Track-Token:int-alpaca"]
       },
       "alpaca": { "command": "uvx", "args": ["alpaca-mcp-server"],
         "env": { "ALPACA_API_KEY": "<k>", "ALPACA_SECRET_KEY": "<s>", "ALPACA_PAPER_TRADE": "true", "ALPACA_TOOLSETS": "trading,crypto-data" } }
     }
   }
   ```

## Demo: Multi-timeframe consensus → Alpaca paper crypto order (≤80 lines)

```javascript
// examples/alpaca/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const ASSET = 'ETH';
const TIMEFRAMES = ['15m', '1h'];

console.log('=== DEMO MODE ===');

// 1. Multi-timeframe AlgoVault read on ETH
const verdicts = [];
for (const tf of TIMEFRAMES) {
  verdicts.push(await getAlgoVaultVerdict({ coin: ASSET, timeframe: tf }));
}

// 2. Consensus check
const directions = new Set(verdicts.map((v) => v.signal));
const consensus = directions.size === 1 && !directions.has('HOLD');

// 3. Keyless = paper order path skipped; with keys, POST a notional BTC/USD order
//    to paper-api.alpaca.markets (hard guard refuses any non-paper host).

console.log('=== NO REAL ORDERS PLACED ===');
```

Run it:

```bash
node examples/alpaca/demo.mjs
```

Expected output (last 3 lines, keyless):

```
[verdicts | 15m=... 1h=... | consensus=... direction=...]
[alpaca | SKIPPED — set ALPACA_API_KEY/SECRET (free paper account) to run the paper order path]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch AlgoVault verdicts on multiple timeframes.** The shared helper opens an MCP session against `https://api.algovault.com/mcp` and calls `get_trade_call` for `ETH` on `15m` and `1h` (both free-tier supported). The agent receives two independent reads from the same composite-verdict pipeline — different windows of price action, same model.

2. **Apply the agent's consensus policy.** When both timeframes return the same `signal` direction (and that direction is not `HOLD`), the agent's pre-configured policy fires its execution branch. Disagreement between timeframes — or any `HOLD` — skips execution entirely. The threshold of "all timeframes agree" is the agent's choice; you might use 2-of-3 or weighted voting in production.

3. **Place a paper crypto order via the Alpaca kit.** When keys are absent, the script prints the `[alpaca | SKIPPED …]` line and exits cleanly — no network call. When keys are present, it POSTs a tiny notional `BTC/USD` market order to `paper-api.alpaca.markets/v2/orders` (headers `APCA-API-KEY-ID` / `APCA-API-SECRET-KEY`) and prints the order id plus the `"paper"` confirmation. A hard guard refuses any host other than `paper-api.alpaca.markets`. The `=== NO REAL ORDERS PLACED ===` banner closes every run regardless of which branch fired.

## 3 Recipes

### Recipe 1 — Multi-timeframe consensus → Alpaca paper crypto order

This is the recipe `examples/alpaca/demo.mjs` implements. The agent calls AlgoVault `get_trade_call` for `ETH` on `15m` and `1h`. The agent's pre-configured policy fires its execution branch only when **all queried timeframes agree** on the same direction (`BUY` or `SELL`; `HOLD` always blocks). On execution, a small notional `BTC/USD` market order goes to the Alpaca paper venue via `place_crypto_order` (qty or notional; GTC/IOC; market/limit/stop-limit; $200k/order cap). The threshold of "all agree" is the agent's choice — you might run 2-of-3 weighted voting in production.

### Recipe 2 — Notional DCA gated on market regime

The agent calls AlgoVault `get_market_regime` (or reads `regime` off the `get_trade_call` payload) for the asset of interest. The agent's pre-configured policy fires its execution branch when the returned regime clears a configured floor. On execution, a fixed-notional `BTC/USD` market order goes to the Alpaca paper venue via `place_crypto_order` (notional mode — a steady dollar amount each cycle). The notional size and cadence come from the agent's policy config; AlgoVault returns the regime classification.

### Recipe 3 — Orderbook-depth check before sizing

The agent calls AlgoVault `get_trade_call` for the asset, then reads top-of-book depth via the Alpaca kit's `get_crypto_latest_orderbook` for the same pair (e.g. `BTC/USD`). The agent's pre-configured policy sizes the order against available depth — thinner book, smaller clip — before placing via `place_crypto_order`. **Sizing logic is the agent's policy; AlgoVault returns the read.** The orderbook depth is a venue read; the size decision belongs to the agent.

## ⚠️ Production setup (real-money)

The demo above runs on the Alpaca paper venue only. Real-money setup requires:

- KYC completion on Alpaca.
- Production API keys with **only** the permissions your agent needs (no withdrawals, IP-allowlisted).
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.

See `examples/alpaca/README.md` for the full real-money checklist + the Alpaca crypto MCP install via `uvx alpaca-mcp-server` (set `ALPACA_PAPER_TRADE=false` for live runs; live fees apply — taker 25bps / maker 15bps at T1). **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-alpaca)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-06-04 · Alpaca crypto MCP `alpaca-mcp-server@2.0.2` (PyPI, MIT)*
