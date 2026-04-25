# Manual submission — Binance Skills Hub PR

## Surface

`github.com/binance/binance-skills-hub` — Binance's official open-skills marketplace. **Submission model is PR-to-add-skill** (per Binance's CONTRIBUTION block in the README).

## Why manual

Generating a real PR programmatically requires fork + branch + write SKILL.md + commit + push + open PR — substantive enough that an automated submission risks looking spammy or failing review. This file is the prepared submission text + step-by-step PR flow for a 5-minute manual submission.

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

`skills/algovault/SKILL.md`:

```markdown
---
title: AlgoVault MCP — Composite Verdict for Crypto Perps
description: |
  AlgoVault MCP returns a single composite verdict (signal, confidence,
  regime, factors) per call, fusing RSI(14), EMA(9/21), funding rate, OI
  momentum, and volume into one weighted score. Cross-venue intelligence
  across 5 exchanges. Every signal Merkle-anchored on-chain at
  https://algovault.com/track-record. Pair with Binance Skills Hub for
  AlgoVault analytics + Binance execution. Tutorial:
  https://algovault.com/docs/integrations/binance
metadata:
  version: 0.1.0
  author: AlgoVaultLabs
license: MIT
---

# AlgoVault MCP — Composite Verdict for Crypto Perps

Use AlgoVault MCP whenever you need a single composite trading verdict instead of running 26 raw indicator calculations.

## When to invoke

Pre-trade analytics. The agent reads the verdict (`signal`, `confidence`, `regime`, `factors`) and applies its own pre-configured policy to decide whether to execute via Binance Skills Hub.

## How to invoke

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed:

```
get_trade_signal(coin="BTC", timeframe="1h", exchange="BINANCE")
```

Returns:

```json
{
  "signal": "BUY|SELL|HOLD",
  "confidence": 0-100,
  "regime": "TRENDING_UP|TRENDING_DOWN|RANGING|VOLATILE",
  "factors": { "rsi": "...", "ema": "...", "funding": "...", "oi_momentum": "...", "volume": "..." },
  "_algovault": { "tool": "get_trade_signal", "version": "1.9.0" }
}
```

## Track record (live)

89.5% PFE Win Rate · 54,629+ calls · 15+ on-chain Merkle batches anchored to Base L2.
Verify at https://algovault.com/track-record

## Tutorial

End-to-end Binance Spot Testnet pairing: https://algovault.com/docs/integrations/binance
```

### 3. Commit + push

```bash
git add skills/algovault/SKILL.md
git commit -m "feat(skills): add AlgoVault MCP composite-verdict skill"
git push origin feature/algovault-skill
```

### 4. Open PR

```bash
gh pr create \
  --repo binance/binance-skills-hub \
  --title "[Skill] AlgoVault MCP — Composite Verdict for Crypto Perps" \
  --body "Adds AlgoVault MCP as an analytics skill in the Binance Skills Hub marketplace.

Tutorial: https://algovault.com/docs/integrations/binance
Demo: https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/binance/demo.mjs
Track record (live, on-chain Merkle-verified): https://algovault.com/track-record

AlgoVault returns a composite trading verdict (signal/confidence/regime/factors) per MCP call. Pair with Binance Skills Hub: AlgoVault provides the analytics; Binance executes. Demo runs against Binance Spot Testnet only with hard guards (BINANCE_TESTNET=true env var, MAINNET_BLOCKED=true const, 0.001 ETH order cap).

MIT licensed. Built by AlgoVault Labs."
```

### 5. Record the PR URL

After opening, record the PR URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the binance row + flip status from `MANUAL_PENDING` to `PR_OPEN`.

## Provenance

This SKILL.md content + PR body uses the exact track-record numbers verified live 2026-04-25 against https://algovault.com/api/performance-public.
