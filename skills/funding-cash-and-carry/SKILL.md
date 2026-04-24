---
name: funding-cash-and-carry
description: "Funding Cash-and-Carry — Find a funding arb spread, then get a trade call on the long side. If the trade call agrees with the long direction, you have double conviction. uses AlgoVault MCP (scan_funding_arb → get_trade_signal). Difficulty: Advanced."
---

# Funding Cash-and-Carry

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around scan_funding_arb → get_trade_signal from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Advanced  ·  **Pattern:** arb + directional alignment

## Example prompt

> Scan funding arb with minimum 10 bps spread. For the top opportunity, get a trade call for the asset on 15m. If the trade call agrees with the long side of the arb, flag it as a high-conviction cash-and-carry setup.

## Tool-call sequence

1. **`scan_funding_arb`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: funding-cash-and-carry`.
2. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: funding-cash-and-carry`.

Each call sends `X-AlgoVault-Skill-Slug: funding-cash-and-carry` so the invocation rolls up
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

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=funding-cash-and-carry**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
