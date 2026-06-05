# AlgoVault × Kraken — Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ Merkle-verified on-chain batches.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-kraken)
> *Snapshot taken 2026-04-26 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2. Pair it with the [Kraken CLI](https://github.com/krakenfx/kraken-cli) and its `kraken mcp` execution surface, and your agent has both the analytics brain and the execution venue.

> **Provenance:** Kraken CLI, launched 2026-03-11. A single Rust binary, MIT-licensed, exposing 151 commands. The `kraken mcp` subcommand serves those commands over stdio MCP. Repo: [`github.com/krakenfx/kraken-cli`](https://github.com/krakenfx/kraken-cli). Demo execution runs against the Kraken paper engine (`kraken paper`), which needs no API keys and no account. Verified 2026-06-04.

## TL;DR (3-line hook)

- One API call → composite verdict (signal, confidence, regime, factors). Not 26 raw indicators.
- Cross-venue intelligence across 5 exchanges. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim.

## What you'll build (90s read)

A runnable Node.js agent that:

1. Calls AlgoVault MCP for `get_trade_signal` on BTC at two timeframes (`15m` and `1h`).
2. Confirms multi-timeframe consensus — both timeframes return the same `signal` direction.
3. Hands the consensus signal to the Kraken paper engine, which simulates a small `kraken paper buy BTCUSD` order when the agent's pre-configured policy fires.

The whole loop runs against the Kraken paper engine — **zero real-money risk in any code path**.

## Prerequisites (4 items)

1. **Node.js ≥ 22** (`node --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Kraken CLI** installed (one binary; macOS + Linux; Windows via WSL; no brew formula):
   ```bash
   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/krakenfx/kraken-cli/releases/latest/download/kraken-cli-installer.sh | sh
   ```
4. **Both MCP servers wired** into your client. AlgoVault uses the `mcp-remote` form with a track-token header; Kraken runs as a local stdio server:
   ```json
   {
     "mcpServers": {
       "algovault": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "https://api.algovault.com/mcp",
                  "--header", "X-AlgoVault-Track-Token:int-kraken"]
       },
       "kraken": { "command": "kraken", "args": ["mcp", "-s", "all"] }
     }
   }
   ```

## Demo: Multi-timeframe consensus → Kraken paper entry (≤80 lines)

```javascript
// examples/kraken/demo.mjs (excerpt — see file for full source)
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';
import { execFileSync } from 'node:child_process';

const TIMEFRAMES = ['15m', '1h'];

console.log('=== DEMO MODE ===');

// 1. Multi-timeframe AlgoVault read on BTC
const verdicts = [];
for (const tf of TIMEFRAMES) {
  verdicts.push(await getAlgoVaultVerdict({ coin: 'BTC', timeframe: tf }));
}

// 2. Consensus check
const directions = new Set(verdicts.map((v) => v.signal));
const consensus = directions.size === 1 && !directions.has('HOLD');

// 3. If the kraken binary is present → paper engine (zero keys).
//    If absent → keyless public REST ticker fallback.

console.log('=== NO REAL ORDERS PLACED ===');
```

Run it:

```bash
node examples/kraken/demo.mjs
```

Expected output (kraken binary absent — keyless REST fallback):

```
[verdicts | 15m=... 1h=... | consensus=... direction=...]
[kraken-cli not installed — install one-liner: curl --proto '=https' --tlsv1.2 -LsSf https://github.com/krakenfx/kraken-cli/releases/latest/download/kraken-cli-installer.sh | sh]
[kraken ticker (REST) | XBTUSD last=... | keyless]
=== NO REAL ORDERS PLACED ===
```

## Walkthrough (line-by-line — neutral narration)

The script does three things in order:

1. **Fetch AlgoVault verdicts on multiple timeframes.** The shared helper opens an MCP session against `https://api.algovault.com/mcp` and calls `get_trade_signal` for `BTC` on `15m` and `1h` (both free-tier supported). The agent receives two independent reads from the same composite-verdict pipeline — different windows of price action, same model.

2. **Apply the agent's consensus policy.** When both timeframes return the same `signal` direction (and that direction is not `HOLD`), the agent's pre-configured policy fires its execution branch. Disagreement between timeframes — or any `HOLD` — skips execution. The threshold of "all timeframes agree" is the agent's choice; you might use 2-of-3 or weighted voting in production.

3. **Route to Kraken.** The script runs `command -v kraken`. If the binary is present, it drives the paper engine: `kraken paper init --balance 10000 -o json`, then `kraken paper buy BTCUSD 0.01 -o json` on consensus, then `kraken paper status -o json`. The paper engine uses live public ticker prices, a 0.26% simulated taker fee, and returns `"mode":"paper"` in its JSON — no keys, no account. If the binary is absent, the script prints the install one-liner, then reads the keyless public ticker via `GET https://api.kraken.com/0/public/Ticker?pair=XBTUSD`. The `=== NO REAL ORDERS PLACED ===` banner closes every run.

## 3 Recipes

### Recipe 1 — Multi-timeframe consensus → Kraken paper entry

This is the recipe `examples/kraken/demo.mjs` implements. The agent calls AlgoVault `get_trade_signal` for `BTC` on `15m` and `1h` (extend to `5m` once on Starter+ for a 3-timeframe consensus). The agent's pre-configured policy fires its execution branch only when **all queried timeframes agree** on the same direction (`BUY` or `SELL`; `HOLD` always blocks). On execution, a small simulated order goes to the Kraken paper engine via `kraken paper buy BTCUSD 0.01 -o json`. The paper engine needs zero keys and zero account. The threshold of "all agree" is the agent's choice — you might run 2-of-3 weighted voting in production.

### Recipe 2 — Regime-gated futures-paper hedge

The agent calls AlgoVault `get_market_regime` (or reads `regime` off the `get_trade_signal` payload) for the asset of interest. The agent's pre-configured policy fires its hedge branch when the returned regime is `VOLATILE` and confidence clears a configured floor. On execution, the agent opens an offsetting position on the Kraken **futures** paper engine (`kraken futures paper`), which supports 8 order types for stop and take-profit placement. The hedge size and order type come from the agent's risk-policy config; AlgoVault returns the regime classification.

### Recipe 3 — Ticker-vs-verdict divergence alert

The agent reads the live ticker through a Kraken MCP tool — tool names follow the `kraken_<command>` form, so `kraken ticker` becomes `kraken_ticker`. It compares the ticker's recent move against the AlgoVault `get_trade_signal` direction for the same asset. When price has moved one way but the composite verdict points the other way (and confidence is high), the agent's policy raises a divergence alert for review. No order fires — this recipe watches and reports. AlgoVault returns the verdict; the agent owns the alert threshold.

## ⚠️ Production setup (real-money)

The demo above runs on the Kraken paper engine only. Real-money setup requires:

- KYC completion on Kraken.
- Production API keys with **only** the permissions your agent needs (no withdrawals). Generate them at kraken.com under **Settings → API**; set `KRAKEN_API_KEY` and `KRAKEN_API_SECRET` (or use `~/.config/kraken/config.toml`).
- The paper-to-live transition exactly as Kraken documents it: swap `kraken paper buy` for `kraken order buy`, run every live order with `--validate` first (a server-side dry run), and arm `kraken order cancel-after 60` as a dead-man's switch.
- Least-privilege MCP scope: `kraken mcp -s all` guards dangerous calls behind `acknowledged=true`; reserve `--allow-dangerous` for fully autonomous runs you have audited. See the repo README CAUTION note and the `AGENTS.md` least-privilege guidance.
- Risk controls: per-order size cap, daily loss limit, kill switch.
- Position monitoring: a separate agent or watchdog that tracks open positions independently.

See `examples/kraken/README.md` for the full real-money checklist. **AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.**

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 5 exchanges — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-04-26 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">89.4%</span> PFE Win Rate · <span data-tr-field="signal_count">56,375</span>+ calls · <span data-tr-field="batch_count">16</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-kraken)

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial © AlgoVault Labs · MIT licensed · Provenance verified 2026-06-04 · Kraken CLI (MIT, single Rust binary, 151 commands) · repo `krakenfx/kraken-cli`*
