# Manual submission — Binance Skills Hub PR

## Surface

`github.com/binance/binance-skills-hub` — Binance's official open-skills marketplace. **Submission model is PR-to-add-skill** (per Binance's CONTRIBUTION block in the README). Install pattern is `npx skills add <repo-url>` (Node ≥ 22), not a classic npm MCP server.

> **Status (2026-07-11):** PR [#254](https://github.com/binance/binance-skills-hub/pull/254) is **already OPEN** (branch `AlgoVaultFi:feature/algovault-skill`), created 2026-05-08, unengaged (0 reviews). This template is the refreshed source for **updating that PR in place** — do NOT open a second PR (duplicate = spam). See `docs/SUBMIT_BINANCE_SKILLS_HUB.md` for the full runbook.

## Why semi-automated

Generating a real PR programmatically requires fork + branch + write SKILL.md + commit + push + open PR — substantive enough that an automated submission risks looking spammy or failing review. This file is the **template** consumed by `scripts/generate_skill_submission.mjs --exchange BINANCE`, which emits a ready-to-paste `SKILL.md` + `PR_BODY.md` + `PR_TITLE.txt` + `SUMMARY.md` with all `<PLACEHOLDER>` tokens substituted from live `/api/performance-public` + `/api/merkle-batches` + `/health`. The architect does the final commit + PR review.

## Live-verified conventions (probed 2026-07-11)

Mirror an existing **merged** skill, not the README template (the README's `title:` field is stale — every merged skill uses `name:`):

- Frontmatter: `name:` (slug), `description:`, `metadata.version`, `metadata.author`. **No `license:` key** — measured 2026-08-26 across the merged tree, ZERO merged hub skills carry one in frontmatter, despite CONTRIBUTING.md requiring it. The tree is the schema; neither doc is. State the licence in body prose. (`skills/binance/binance/SKILL.md`, `skills/binance-web3/trading-signal/SKILL.md`.)
- Path: `skills/<namespace>/<skill>/SKILL.md` — two levels. AlgoVault → `skills/algovault/signal-intelligence/SKILL.md`.
- CONTRIBUTING **Trading Rules**: no promoting any asset, nothing presented as guaranteed/safe, **no wallet addresses**. Content neutral + factual + educational.
- Canonical tool name is `get_trade_call` (the server marks the old alias `[ALIAS]`; the CI canary forbids the legacy name in this template).

## Placeholder tokens

All `<UPPERCASE_TOKEN>` strings below get substituted at generator-run time. Do not hardcode values back into this template — the CI canary `tests/unit/submit-template-consistency.test.mjs` will fail the build.

| Token | Source | Example |
|---|---|---|
| `<PFE_WR>` | `/api/performance-public` `.overall.pfeWinRate × 100`, 1 decimal | `91.7` |
| `<TOTAL_CALLS>` | `/api/performance-public` `.overall.totalCalls`, floor to 1k + `+` | `349,000+` |
| `<BATCH_COUNT>` | `/api/merkle-batches` `.batches.length` | `92` |
| `<VERSION>` | `/health` `.version` | `1.23.0` |
| `<EXCHANGE_UPPER>` | CLI arg | `BINANCE` |
| `<EXCHANGE_LOWER>` | CLI arg lowercased | `binance` |
| `<EXCHANGE_TITLE>` | CLI arg title-cased | `Binance` |
| `<TUTORIAL_URL>` | `https://algovault.com/docs/integrations/<EXCHANGE_LOWER>` | |
| `<DEMO_URL>` | `https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/<EXCHANGE_LOWER>/demo.mjs` | |
| `<PROVENANCE_DATE>` | ISO date when generator ran | `2026-07-11` |

## Step-by-step submission (refresh the OPEN PR #254)

### 1. Fork already exists

`AlgoVaultFi/binance-skills-hub` is already a fork of `binance/binance-skills-hub`; branch `feature/algovault-skill` is PR #254's head. Clone + check it out:

```bash
gh repo clone AlgoVaultFi/binance-skills-hub
cd binance-skills-hub
git checkout feature/algovault-skill
git pull origin feature/algovault-skill
```

### 2. Replace the skill with the convention-correct nested path

```bash
git rm skills/algovault/SKILL.md 2>/dev/null || true      # remove the stale flat file
mkdir -p skills/algovault/signal-intelligence
```

`skills/algovault/signal-intelligence/SKILL.md` (generator output, paste verbatim):

<!-- SKILL_MD_START -->
```markdown
---
name: signal-intelligence
description: |
  AlgoVault MCP returns one composite trade verdict per call — call
  (BUY/SELL/HOLD), confidence, market regime, and the cross-venue funding /
  open-interest / trend factors behind it — so an agent reads one JSON verdict
  instead of computing raw indicators itself. Cross-venue intelligence across
  the major crypto perpetual-futures venues; every signal Merkle-anchored on
  Base L2 (verify at https://algovault.com/track-record). Use it as the
  analytics brain layer for a trading agent, then pair with <EXCHANGE_TITLE>
  Skills Hub for execution. Read-only — never places an order. Tutorial:
  <TUTORIAL_URL>
metadata:
  version: 1.1.0  <!-- LITERAL: skill artifact version, not the MCP server semver -->
  author: AlgoVaultFi
---

# AlgoVault Signal Intelligence — Composite Verdict for Crypto Perps

> The Brain Layer for AI Trading Agents. AlgoVault returns the analytics verdict; your agent and its risk policy decide execution. It is **additive to <EXCHANGE_TITLE> execution, not a competitor** — read-only, never submits an order.

Call this whenever an agent needs a single, backtested trading verdict for a crypto perpetual-futures asset instead of computing dozens of raw indicators itself. One MCP call returns direction, confidence, market regime, and the cross-venue factors behind it.

## Pairing with Binance Agent OS

Binance Agent OS gives an agent execution on Binance: OAuth at connect time, no API keys on the
machine, and trading confined to an isolated Agentic sub-account. It has no withdrawal scope.

What it does not have is a second venue. A cross-venue funding spread needs two, and a composite
verdict needs more. That is the layer this skill supplies — the decision layer for an agent that
is already executing through Binance Agent OS.

Add both servers to one MCP client:

```bash
claude mcp add binance-mcp-server --transport http https://agent.binance.com/mcp/agentic

claude mcp add --transport http --scope project algovault \
  https://api.algovault.com/mcp?src=binance_agent_os
```

Then name the tool you want. With two servers connected an exchange-shaped prompt is ambiguous,
and this skill exposes no exchange-operation tools, so nothing about that phrasing points at the
verdict:

> "Use AlgoVault's `get_trade_call` for BTC 15m on Binance. Show me signal, confidence and
> regime. If signal is BUY and confidence is above 70, place a $100 market buy on Binance spot —
> confirm with me before sending."

Full walkthrough: https://algovault.com/integrations/binance-agent-os

## When to call

- **Pre-trade analytics gate** — read the verdict, apply your own policy, then (optionally) execute via <EXCHANGE_TITLE> Skills Hub.
- **Regime check** before switching strategy (trend vs range vs volatile).
- **Cross-venue funding-spread awareness** before routing a carry / arb leg.

AlgoVault is read-only signal *interpretation* — it never submits orders and never recommends buying or selling any specific asset.

## Tools

Live at MCP endpoint `https://api.algovault.com/mcp` (streamable HTTP, stateless). Add the server to your agent, then call the tools below. Send header `X-AlgoVault-Skill-Slug: signal-intelligence` on each call for attribution.

### `get_trade_call` — composite verdict for one perp

Params: `coin` (required, e.g. `BTC`), `timeframe` (`1m`…`1d`, default `15m`), `exchange` (`BINANCE` default, plus `BYBIT` `OKX` `BITGET` `HL` and more), `includeReasoning` (default `true`).

```
get_trade_call(coin="BTC", timeframe="1h", exchange="<EXCHANGE_UPPER>")
```

Returns (abridged — real fields):

```json
{
  "call": "BUY",
  "confidence": 72,
  "regime": "TRENDING_UP",
  "price": 64250.5,
  "indicators": {
    "funding_rate": 0.0001,
    "funding_state": "neutral",
    "oi_change_pct": 2.4,
    "trend_persistence": "strong",
    "volume_24h": 1200000000
  },
  "reasoning": "trend + funding aligned long",
  "_receipts": {
    "verdict": "BUY",
    "conviction_pct": 72,
    "track_record": { "pfe_win_rate": 0.91, "n": 12000, "as_of": "..." },
    "verification_uri": "https://algovault.com/track-record",
    "disclaimer": "Informational only; not investment advice."
  }
}
```

`call` is the verdict (`BUY`/`SELL`/`HOLD`); `_receipts` carries the live, on-chain-verified PFE win rate and a verification link with every response.

### `get_market_regime` — regime classifier for one perp

Params: `coin` (required), `timeframe` (`1h`|`4h`|`1d`, default `4h`), `exchange` (default `HL`). Returns the regime (`TRENDING_UP`/`TRENDING_DOWN`/`RANGING`/`VOLATILE`) + confidence + a strategy hint, blending trend/range strength with cross-venue funding sentiment.

### `scan_funding_arb` — ranked cross-venue funding spreads

Params: `minSpreadBps` (default `5`), `limit` (default `10`). Returns a ranked list of funding-rate arbitrage opportunities across major perp venues (long one venue / short another) as a `BUY`/`SELL`/`HOLD` verdict per pair — the cross-venue view no single-exchange API exposes.

Also available: `scan_trade_calls` (whole-market top-by-open-interest scan) and `search_knowledge` / `chat_knowledge` (look up integration patterns before wiring in).

## Testnet-safe example (<EXCHANGE_TITLE> Spot Testnet — zero real-money risk)

Confidence-filtered swing entry. Analytics come from AlgoVault; execution is left to the agent's policy and runs against **testnet only**, hard-guarded so it can never reach mainnet (full source: <DEMO_URL>):

```javascript
// BINANCE_TESTNET=true node demo.mjs
const MAINNET_BLOCKED = true;
const TESTNET = 'https://testnet.binance.vision/api';
if (process.env.BINANCE_TESTNET !== 'true') {
  throw new Error('BINANCE_TESTNET=true required — refuses to run against mainnet.');
}
// 1. AlgoVault verdict (read-only analytics via MCP get_trade_call)
const v = await getTradeCall({ coin: 'ETH', timeframe: '1h' });
// 2. Agent policy lives in YOUR code
const fires = v.call === 'BUY' && v.confidence > 70;
// 3. If policy fires + testnet keys set, VALIDATE (never submit) a small order
if (fires && process.env.BINANCE_TESTNET_API_KEY) {
  // HMAC-signed POST /api/v3/order/test — validates only, returns {} on success
  // order size capped at 0.001 ETH
}
console.log('=== NO REAL ORDERS PLACED ===');
```

The script aborts unless `BINANCE_TESTNET=true`; `/api/v3/order/test` validates without submitting; the requested size is capped.

## Track record & links (live)

<PFE_WR>% PFE Win Rate across <TOTAL_CALLS> calls, each Merkle-anchored on Base L2 (<BATCH_COUNT> batches). PFE Win Rate = peak-favorable-excursion directional accuracy, evaluated against public exchange prices. Current figures and the free tier are live at:

- Track record: https://algovault.com/track-record
- Docs: https://algovault.com/docs.html
- Pricing / free tier: https://algovault.com/#pricing

## Disclaimer

Informational only. AlgoVault outputs are read-only signal interpretation — not investment, financial, or trading advice, and not a recommendation to buy, sell, or hold any asset. No outcome is guaranteed; past performance does not predict future results. You are solely responsible for your own trading decisions. This is consistent with the Binance Skills Hub disclaimer.

Built by AlgoVault Labs — https://algovault.com · MIT licensed.
```
<!-- SKILL_MD_END -->

### 3. Commit + push (updates PR #254 in place)

```bash
git add skills/algovault/signal-intelligence/SKILL.md
git rm --cached skills/algovault/SKILL.md 2>/dev/null || true
git commit -m "feat(skills): refresh AlgoVault signal-intelligence skill (name: schema, nested path, live shape)"
git push origin feature/algovault-skill
```

### 4. PR already open — refresh title/body if needed

PR title (generator output: `PR_TITLE.txt`):

<!-- PR_TITLE_START -->
[Skill] AlgoVault Signal Intelligence — cross-venue composite verdict for crypto perps
<!-- PR_TITLE_END -->

PR body (generator output: `PR_BODY.md`):

<!-- PR_BODY_START -->
**<PFE_WR>% PFE Win Rate across <TOTAL_CALLS> Merkle-verified signals on Base L2.**

Adds AlgoVault MCP as an analytics skill in the <EXCHANGE_TITLE> Skills Hub marketplace: one MCP call returns a composite trade verdict (`call`, `confidence`, `regime`, cross-venue funding/OI/trend factors). It is **additive to <EXCHANGE_TITLE> execution, not a competitor** — AlgoVault is the cross-venue analytics brain layer; <EXCHANGE_TITLE> executes. Read-only, places no orders.

- Cross-venue intelligence across the major perpetual-futures venues — not derivable from any single-venue API.
- Every signal Merkle-anchored on Base L2 (<BATCH_COUNT> batches). Verify before you trust: https://algovault.com/track-record
- Docs: https://algovault.com/docs.html
- Demo runs against <EXCHANGE_TITLE> Spot Testnet only, hard-guarded (`<EXCHANGE_UPPER>_TESTNET=true` required, `MAINNET_BLOCKED=true`, `/api/v3/order/test` validate-only, size cap): <DEMO_URL>

MIT licensed. Built by AlgoVault Labs.
<!-- PR_BODY_END -->

```bash
gh pr edit 254 --repo binance/binance-skills-hub \
  --title "$(cat <output-dir>/PR_TITLE.txt)" \
  --body-file <output-dir>/PR_BODY.md
```

### 5. Record the PR URL

PR #254 URL is already recorded in `status.md`. On any state change, update the community-submission tracker + this file's status line.

## Provenance

Template last verified live <PROVENANCE_DATE> against `/api/performance-public` + `/api/merkle-batches` + `/health`. The generator (`scripts/generate_skill_submission.mjs`) re-fetches at every run; the `<PLACEHOLDER>` examples above are illustrative only — real submissions use whatever the API returns at run time.
