---
name: multi-agent-war-room
description: "Multi-Agent War Room — Three specialized agents, one coordinator. Agent A: regime, Agent B: trade calls, Agent C: funding arbs. Coordinator synthesizes all three. uses AlgoVault MCP (get_market_regime → get_trade_signal → scan_funding_arb). Difficulty: Expert."
---

# Multi-Agent War Room

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_market_regime → get_trade_signal → scan_funding_arb from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Expert  ·  **Pattern:** multi-agent orchestration

## Example prompt

> Set up three agents: Agent A gets market regime for BTC, ETH, SOL on 4h. Agent B gets trade calls for the same assets on 15m. Agent C scans funding arb for spreads above 8 bps. Combine all results into a single dashboard showing: regime, direction, confidence, and best arb for each asset.

## Tool-call sequence

1. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: multi-agent-war-room`.
2. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: multi-agent-war-room`.
3. **`scan_funding_arb`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: multi-agent-war-room`.

Each call sends `X-AlgoVault-Skill-Slug: multi-agent-war-room` so the invocation rolls up
on the public per-Skill counter at <https://algovault.com/analytics/skills>.

## What you get back (`_algovault` metadata block)

Every AlgoVault MCP response includes a top-level `_algovault` envelope.
Surface these fields back to the user:

- `_algovault.version` — server version (currently 1.9.0)
- `_algovault.signal_merkle_root` — cryptographic commitment to the result set
- `_algovault.composite_verdict` — interpretation summary (when present)
- `_algovault.regime` — current market regime (when `get_market_regime` is in the chain)
- `_algovault.confidence` — model confidence (0-100)

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=multi-agent-war-room**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
