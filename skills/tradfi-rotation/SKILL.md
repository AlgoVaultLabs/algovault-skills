---
name: tradfi-rotation
description: "TradFi Rotation — Compare regime and direction across TradFi perpetuals. Rotate into the asset with the strongest trend. uses AlgoVault MCP (get_market_regime → get_trade_signal). Difficulty: Advanced."
---

# TradFi Rotation

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_market_regime → get_trade_signal from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Advanced  ·  **Pattern:** cross-asset comparison

## Example prompt

> Get the market regime and trade call for TSLA, GOLD, and SP500 on the 4h timeframe. Which one has the strongest trend with the highest confidence trade call? Recommend the best one to trade.

## Tool-call sequence

1. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: tradfi-rotation`.
2. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: tradfi-rotation`.

Each call sends `X-AlgoVault-Skill-Slug: tradfi-rotation` so the invocation rolls up
on the per-Skill counter inside the AlgoVault internal dashboard
(`/dashboard` on `api.algovault.com` — admin-only). Per-Skill funnel data is
treated as competitive intel; only aggregate track-record numbers are public
at <https://algovault.com/track-record>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=tradfi-rotation**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
