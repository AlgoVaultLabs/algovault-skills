---
name: Portfolio Scanner
description: Loop through the top 10 assets, get trade calls for each, and filter by high confidence. — uses AlgoVault MCP (get_trade_signal). Difficulty: Intermediate.
---

# Portfolio Scanner

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_trade_signal from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Intermediate  ·  **Pattern:** batch calling, confidence filtering

## Example prompt

> Get trade calls for BTC, ETH, SOL, DOGE, XRP, ADA, AVAX, LINK, DOT, and MATIC on the 15m timeframe. Only show me the ones with confidence above 70%.

## Tool-call sequence

1. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: portfolio-scanner`.

Each call sends `X-AlgoVault-Skill-Slug: portfolio-scanner` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=portfolio-scanner**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
