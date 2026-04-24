---
name: hourly-digest-bot
description: "Hourly Digest Bot — Build an automated digest: scan all tier-1 and tier-2 assets every hour, summarize trade calls and market regime into a brief report. uses AlgoVault MCP (get_trade_signal → get_market_regime). Difficulty: Advanced."
---

# Hourly Digest Bot

> AlgoVault provides the thesis; your agent decides execution.

## Purpose

This Skill is a single-prompt wrapper around get_trade_signal → get_market_regime from the
[AlgoVault MCP server](https://api.algovault.com/mcp). It returns a
**composite verdict / interpretation** — never a buy/sell recommendation.
Your agent decides whether and how to act on the thesis.

**Difficulty:** Advanced  ·  **Pattern:** periodic digest, notification-ready

## Example prompt

> Scan BTC, ETH, SOL, AVAX, LINK, DOGE, XRP, ADA for trade calls on 1h. Also get the market regime for BTC and ETH on 4h. Summarize as a brief market digest: how many BUYs vs SELLs, overall regime, and top 3 highest-confidence calls.

## Tool-call sequence

1. **`get_trade_signal`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: hourly-digest-bot`.
2. **`get_market_regime`** — invoke with appropriate parameters; pass header `X-AlgoVault-Skill-Slug: hourly-digest-bot`.

Each call sends `X-AlgoVault-Skill-Slug: hourly-digest-bot` so the invocation rolls up
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

Live PFE Win Rate + cumulative call count: **https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=hourly-digest-bot**

## Positioning

AlgoVault sells signal **interpretation**, not signals or advice. We provide
the thesis; your agent decides execution. Track record is verifiable on-chain
via the Merkle root in every response.

_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._
