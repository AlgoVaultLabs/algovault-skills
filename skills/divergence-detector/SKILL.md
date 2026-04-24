---
name: Divergence Detector
description: Compare trade call direction vs market regime. When they disagree, flag it as a high-risk divergence. — uses AlgoVault MCP (get_market_regime → get_trade_signal). Difficulty: Advanced.
---

# Divergence Detector

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_market_regime → get_trade_signal from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Advanced  ·  **Pattern:** signal-regime divergence

## Example prompt

> For BTC and ETH: get the market regime on 4h and a trade call on 15m. If the trade call says BUY but the regime is TRENDING_DOWN (or vice versa), flag it as a divergence with a risk warning.

## Tool-call sequence

1. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: divergence-detector`.
2. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: divergence-detector`.

Each call sends `X-AlgoVault-Skill-Slug: divergence-detector` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=divergence-detector**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
