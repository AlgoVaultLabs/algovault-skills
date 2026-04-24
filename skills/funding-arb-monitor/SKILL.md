---
name: funding-arb-monitor
description: "Funding Arb Monitor — Scan for cross-venue funding rate arbitrage opportunities. Alert when the annualized spread exceeds your threshold. uses AlgoVault MCP (scan_funding_arb). Difficulty: Intermediate."
---

# Funding Arb Monitor

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around scan_funding_arb from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Intermediate  ·  **Pattern:** threshold-based alerting

## Example prompt

> Scan for funding arbitrage opportunities with a minimum spread of 10 basis points. Show me the top 5 ranked by annualized return.

## Tool-call sequence

1. **`scan_funding_arb`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: funding-arb-monitor`.

Each call sends `X-AlgoVault-Skill-Slug: funding-arb-monitor` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=funding-arb-monitor**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
