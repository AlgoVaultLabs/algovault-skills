# Manual submission — Binance Skills Hub PR

## Surface

`github.com/binance/binance-skills-hub` — Binance's official open-skills marketplace. **Submission model is PR-to-add-skill** (per Binance's CONTRIBUTION block in the README).

## Why semi-automated

Generating a real PR programmatically requires fork + branch + write SKILL.md + commit + push + open PR — substantive enough that an automated submission risks looking spammy or failing review. This file is the **template** consumed by `scripts/generate_skill_submission.mjs --exchange BINANCE`, which emits a ready-to-paste `SKILL.md` + `PR_BODY.md` + `PR_TITLE.txt` + `SUMMARY.md` with all `<PLACEHOLDER>` tokens substituted from live `/api/performance-public` + `/api/merkle-batches` + `/health`. The architect does the final fork+commit+PR review in ~5 min.

## Placeholder tokens

All `<UPPERCASE_TOKEN>` strings below get substituted at generator-run time. Do not hardcode values back into this template — the CI canary `tests/unit/submit-template-consistency.test.mjs` will fail the build.

| Token | Source | Example |
|---|---|---|
| `<PFE_WR>` | `/api/performance-public` `.overall.pfeWinRate × 100`, 1 decimal | `90.1` |
| `<TOTAL_CALLS>` | `/api/performance-public` `.overall.totalCalls`, floor to 1k + `+` | `78,000+` |
| `<BATCH_COUNT>` | `/api/merkle-batches` `.batches.length` | `28` |
| `<VERSION>` | `/health` `.version` | `1.10.7` |
| `<EXCHANGE_UPPER>` | CLI arg | `BINANCE` |
| `<EXCHANGE_LOWER>` | CLI arg lowercased | `binance` |
| `<EXCHANGE_TITLE>` | CLI arg title-cased | `Binance` |
| `<TUTORIAL_URL>` | `https://algovault.com/docs/integrations/<EXCHANGE_LOWER>` | |
| `<DEMO_URL>` | `https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/<EXCHANGE_LOWER>/demo.mjs` | |
| `<PROVENANCE_DATE>` | ISO date when generator ran | `2026-05-08` |

## Step-by-step submission

### 1. Fork the repo

```bash
gh repo fork binance/binance-skills-hub --clone=true --remote=true
cd binance-skills-hub
git checkout -b feature/algovault-skill
```

### 2. Create the skill folder + SKILL.md

```bash
mkdir -p skills/algovault
```

`skills/algovault/SKILL.md` (generator output, paste verbatim):

<!-- SKILL_MD_START -->
```markdown
---
title: AlgoVault MCP — Composite Verdict for Crypto Perps
description: |
  AlgoVault MCP returns a single composite verdict (signal, confidence,
  regime, factors) per call, fusing RSI(14), EMA(9/21), funding rate, OI
  momentum, and volume into one weighted score. Cross-venue intelligence
  across 5 exchanges. Every signal Merkle-anchored on-chain at
  https://algovault.com/track-record. Pair with <EXCHANGE_TITLE> Skills Hub for
  AlgoVault analytics + <EXCHANGE_TITLE> execution. Tutorial:
  <TUTORIAL_URL>
metadata:
  version: 0.1.0  <!-- LITERAL: skill plugin's own version, not MCP server semver -->
  author: AlgoVaultLabs
license: MIT
---

# AlgoVault MCP — Composite Verdict for Crypto Perps

Use AlgoVault MCP whenever you need a single composite trading verdict instead of running 26 raw indicator calculations.

## When to invoke

Pre-trade analytics. The agent reads the verdict (`signal`, `confidence`, `regime`, `factors`) and applies its own pre-configured policy to decide whether to execute via <EXCHANGE_TITLE> Skills Hub.

## How to invoke

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed:

```
get_trade_call(coin="BTC", timeframe="1h", exchange="<EXCHANGE_UPPER>")
```

Returns:

```json
{
  "signal": "BUY|SELL|HOLD",
  "confidence": 0-100,
  "regime": "TRENDING_UP|TRENDING_DOWN|RANGING|VOLATILE",
  "factors": { "rsi": "...", "ema": "...", "funding": "...", "oi_momentum": "...", "volume": "..." },
  "_algovault": { "tool": "get_trade_call", "version": "<VERSION>" }
}
```

## Track record (live)

<PFE_WR>% PFE Win Rate · <TOTAL_CALLS> calls · <BATCH_COUNT> on-chain Merkle batches anchored to Base L2.
Verify at https://algovault.com/track-record

## Tutorial

End-to-end <EXCHANGE_TITLE> Spot Testnet pairing: <TUTORIAL_URL>
```
<!-- SKILL_MD_END -->

### 3. Commit + push

```bash
git add skills/algovault/SKILL.md
git commit -m "feat(skills): add AlgoVault MCP composite-verdict skill"
git push origin feature/algovault-skill
```

### 4. Open PR

PR title (generator output: `PR_TITLE.txt`):

<!-- PR_TITLE_START -->
[Skill] AlgoVault MCP — Composite Verdict for Crypto Perps
<!-- PR_TITLE_END -->

PR body (generator output: `PR_BODY.md`):

<!-- PR_BODY_START -->
**<PFE_WR>% PFE Win Rate across <TOTAL_CALLS> Merkle-verified signals on Base L2.**

Adds AlgoVault MCP as an analytics skill in the <EXCHANGE_TITLE> Skills Hub marketplace.

Tutorial: <TUTORIAL_URL>
Demo: <DEMO_URL>
Track record (live, on-chain Merkle-verified): https://algovault.com/track-record · <BATCH_COUNT> batches anchored

AlgoVault returns a composite trading verdict (signal/confidence/regime/factors) per MCP call. Pair with <EXCHANGE_TITLE> Skills Hub: AlgoVault provides the analytics; <EXCHANGE_TITLE> executes. Demo runs against <EXCHANGE_TITLE> Spot Testnet only with hard guards (`<EXCHANGE_UPPER>_TESTNET=true` env var, `MAINNET_BLOCKED=true` const, 0.001 ETH order cap).

MIT licensed. Built by AlgoVault Labs.
<!-- PR_BODY_END -->

```bash
gh pr create \
  --repo binance/binance-skills-hub \
  --title "$(cat /tmp/skill-<EXCHANGE_LOWER>-*/PR_TITLE.txt)" \
  --body-file /tmp/skill-<EXCHANGE_LOWER>-*/PR_BODY.md
```

### 5. Record the PR URL

After opening, record the PR URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the <EXCHANGE_LOWER> row + flip status from `MANUAL_PENDING` to `PR_OPEN`.

## Provenance

Template last verified live <PROVENANCE_DATE> against `/api/performance-public` + `/api/merkle-batches` + `/health`. The generator script (`scripts/generate_skill_submission.mjs`) re-fetches at every run; values above are illustrative only — real submissions use whatever the API returns at run time.
