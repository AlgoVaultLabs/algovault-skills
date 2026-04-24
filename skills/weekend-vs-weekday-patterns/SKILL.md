---
name: Weekend vs Weekday Patterns
description: Schedule trade calls every 4 hours, log results over time. Compare weekend vs weekday regime patterns to find exploitable edges. — uses AlgoVault MCP (get_trade_signal → get_market_regime). Difficulty: Research.
---

# Weekend vs Weekday Patterns

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_trade_signal → get_market_regime from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Research  ·  **Pattern:** data collection, research

## Example prompt

> Every 4 hours, get a trade call for BTC on 4h and log the regime, direction, and confidence. After a week, compare weekend vs weekday patterns. Are weekends more RANGING? Do SELL calls cluster on Sundays?

## Tool-call sequence

1. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: weekend-vs-weekday-patterns`.
2. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: weekend-vs-weekday-patterns`.

Each call sends `X-AlgoVault-Skill-Slug: weekend-vs-weekday-patterns` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=weekend-vs-weekday-patterns**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
