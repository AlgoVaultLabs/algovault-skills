---
name: Hedging Advisor
description: You hold a long ETH position. Check regime and trade call — if both turn bearish, look for a funding arb to hedge via the cheaper venue. — uses AlgoVault MCP (get_market_regime → get_trade_signal → scan_funding_arb). Difficulty: Advanced.
---

# Hedging Advisor

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_market_regime → get_trade_signal → scan_funding_arb from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Advanced  ·  **Pattern:** defensive hedging

## Example prompt

> I'm currently long ETH. Get the market regime on 4h and a trade call on 1h. If both are bearish, scan funding arb for ETH and tell me which venue has the cheapest short to hedge my position.

## Tool-call sequence

1. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: hedging-advisor`.
2. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: hedging-advisor`.
3. **`scan_funding_arb`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: hedging-advisor`.

Each call sends `X-AlgoVault-Skill-Slug: hedging-advisor` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=hedging-advisor**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
