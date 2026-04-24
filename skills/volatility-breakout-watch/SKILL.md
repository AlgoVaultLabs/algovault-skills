---
name: Volatility Breakout Watch
description: Use regime detection as a screener: find assets in VOLATILE regime with high confidence — these are breakout candidates. Then get trade call for direction. — uses AlgoVault MCP (get_market_regime → get_trade_signal). Difficulty: Advanced.
---

# Volatility Breakout Watch

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_market_regime → get_trade_signal from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Advanced  ·  **Pattern:** regime as screener

## Example prompt

> Check the market regime for BTC, ETH, SOL, AVAX, LINK, and DOGE on 4h. For any in VOLATILE regime with confidence above 70%, get a trade call on 5m. Those are potential breakout trades.

## Tool-call sequence

1. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: volatility-breakout-watch`.
2. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: volatility-breakout-watch`.

Each call sends `X-AlgoVault-Skill-Slug: volatility-breakout-watch` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=volatility-breakout-watch**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
