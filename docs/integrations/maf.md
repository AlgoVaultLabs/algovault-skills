# AlgoVault x Microsoft Agent Framework - Build Verifiable AI Trading Agents

> <!-- snapshot: 2026-07-21 - live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate &middot; <span data-tr-field="call_count">383,789</span>+ calls &middot; <span data-tr-field="merkle_batch_count">100</span>+ Merkle-verified on-chain batches &middot; <span data-tr-field="asset_count">738</span> assets.</strong>
> Don't trust - [verify the track record &rarr;](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-maf)
> *Snapshot taken 2026-05-18 - live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

Composite BUY/SELL/HOLD trade calls across major crypto perpetual-futures venues. Verified track record, Merkle-anchored on Base L2. Drop AlgoVault MCP into any [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) `ChatAgent` via the built-in `MCPStreamableHTTPTool` and your agent has both the analytics brain and a clean path to multi-agent orchestration across the Microsoft ecosystem.

> **Provenance:** OFFICIAL [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) (`github.com/microsoft/agent-framework` &middot; GA 1.0 April 2026 &middot; the Microsoft-anointed successor to AutoGen, which is now in maintenance mode). The MCP class used here, `agent_framework.MCPStreamableHTTPTool`, is documented at [Microsoft Learn](https://learn.microsoft.com/en-us/python/api/agent-framework-core/agent_framework.mcpstreamablehttptool?view=agent-framework-python-latest). Verified 2026-05-18.

## TL;DR (3-line hook)

- One API call &rarr; composite verdict (call, confidence, regime, indicators). Not 26 raw indicators.
- Cross-venue intelligence across 12 exchanges. Funding spreads, regime alignment, volatility - fused.
- Every signal Merkle-anchored on-chain. Verifiable accuracy, not a marketing claim. ERC-8004 agentId `44544`.

## What you'll build (90s read)

A runnable Python script that:

1. Opens an MCP session against `https://api.algovault.com/mcp` using `agent_framework.MCPStreamableHTTPTool`.
2. Calls `get_trade_call` for a chosen `coin` + `timeframe` directly via MAF's `call_tool(...)` - no LLM API key needed for the bare demo.
3. Prints the parsed `call` / `confidence` / `indicators` / `regime` payload.

The same `MCPStreamableHTTPTool` instance can be passed to a `ChatAgent` for the multi-turn case - see the [Optional follow-on](#optional-follow-on-multi-turn-chatagent) section below.

## Prerequisites (3 items)

1. **Python &ge; 3.10** (`python3 --version` to check).
2. **AlgoVault skills plugin** installed:
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Microsoft Agent Framework** installed:
   ```bash
   pip install agent-framework==1.4.0
   ```

The bare demo does NOT need an Azure OpenAI / OpenAI / Anthropic API key. The `ChatAgent` follow-on snippet does.

## Demo: one-shot composite trade call on BTC 4h (&le;80 lines)

```python
# examples/maf/demo.py (excerpt - see file for full source)
import asyncio
import json
import os
import sys
from agent_framework import MCPStreamableHTTPTool

ALGOVAULT_MCP_URL = os.environ.get(
    "ALGOVAULT_MCP_URL", "https://api.algovault.com/mcp"
)
REQUIRED_KEYS = ("call", "confidence", "indicators", "regime")


async def fetch_trade_call(coin: str, timeframe: str) -> dict:
    # load_prompts=False because AlgoVault MCP is a tools-only server
    # (no prompts/list method) - default MAF connect() would otherwise
    # raise "Method not found".
    tool = MCPStreamableHTTPTool(
        name="algovault",
        url=ALGOVAULT_MCP_URL,
        description="AlgoVault composite trade-call signals",
        load_prompts=False,
    )
    async with tool:
        contents = await tool.call_tool(
            "get_trade_call",
            coin=coin,
            timeframe=timeframe,
        )
    # contents is list[Content]; first text Content carries the JSON payload
    text = next(c.text for c in contents if getattr(c, "type", None) == "text")
    payload = json.loads(text)
    return {k: payload[k] for k in REQUIRED_KEYS}


async def main():
    coin, timeframe = sys.argv[1].upper(), sys.argv[2]
    result = await fetch_trade_call(coin, timeframe)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
```

Run it:

```bash
pip install -r examples/maf/requirements.txt
python examples/maf/demo.py BTC 4h
```

Sample output (captured live 2026-05-18 against `api.algovault.com/mcp`):

```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {
    "funding_rate": 0.00005697,
    "funding_24h_avg": 0.00005697,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8145552182.93,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN"
}
```

## Walkthrough (line-by-line - neutral narration)

The script does three things in order:

1. **Open an MCP session via MAF.** `MCPStreamableHTTPTool(name=..., url=..., description=..., load_prompts=False)` constructs a wrapper around `mcp.client.streamable_http`. The `async with tool:` context manager calls `tool.connect()` on entry (handshake + load tools) and `tool.close()` on exit. `load_prompts=False` is required because AlgoVault MCP exposes tools only; the default `load_prompts=True` would issue a `prompts/list` request that the server answers with "Method not found".

2. **Invoke `get_trade_call` directly.** `tool.call_tool("get_trade_call", coin=coin, timeframe=timeframe)` issues an MCP `tools/call` request and returns a `list[Content]`. For text-typed tool results (which AlgoVault uses), the first `Content` carries a JSON string in `.text`. Parse and project the four required keys.

3. **Print the parsed payload.** A single JSON object goes to stdout - copy-pasteable for downstream pipelines or grep-able for CI gates.

## Optional follow-on: multi-turn ChatAgent

For the full `ChatAgent` wiring (Azure OpenAI / OpenAI / Anthropic chat model on top of the same `MCPStreamableHTTPTool`):

```python
from agent_framework import ChatAgent, MCPStreamableHTTPTool
from agent_framework.openai import OpenAIChatClient  # or AzureOpenAIChatClient / etc.

tool = MCPStreamableHTTPTool(
    name="algovault",
    url="https://api.algovault.com/mcp",
    description="AlgoVault composite trade-call signals",
    load_prompts=False,
)
client = OpenAIChatClient()  # OPENAI_API_KEY in env

async with tool:
    agent = ChatAgent(
        chat_client=client,
        name="algovault-trader",
        tools=tool,
        instructions=(
            "You are a trading research assistant. Use AlgoVault tools to fetch "
            "composite trade calls, market regime, and funding-arb scans. "
            "Always cite the call, confidence, and regime when giving an answer."
        ),
    )
    response = await agent.run(
        "Get a trade call for BTC on the 4h timeframe and explain the regime."
    )
    print(response)
```

The pattern is identical for `get_trade_call`, `scan_funding_arb`, and `get_market_regime` - MAF loads all 4 AlgoVault tools at `connect()` time and the chat model picks which to call.

## 3 Recipes

### Recipe 1 - Regime-gated DCA on BTC

Your agent calls AlgoVault `get_market_regime` for `BTC` on `4h`. The agent's DCA policy fires when regime &isin; `{TRENDING_UP, RANGING}` and skips the week's DCA when the regime is `VOLATILE` or `TRENDING_DOWN`. Wired through `MCPStreamableHTTPTool.call_tool("get_market_regime", coin="BTC", timeframe="4h")`. The regime read replaces hand-tuned VIX-style heuristics with a backtested cross-venue regime classifier.

### Recipe 2 - Confidence-filtered swing entry on ETH

The agent calls `get_trade_call` for `ETH` on `1h`. The policy fires only when `call == "BUY"` AND `confidence > 70`. This is the pattern `examples/maf/demo.py` implements (with HOLD as the most common output during ranging regimes - exactly what a 90%+ PFE Win Rate model should do). Pair with your execution venue of choice.

### Recipe 3 - Funding-arb opportunity awareness

Your agent calls `scan_funding_arb` to retrieve top funding-spread opportunities across the venues AlgoVault monitors. Output is a ranked list of `{coin, longVenue, shortVenue, spreadBps}` rows. The agent uses the rank to surface awareness and route execution decisions to your risk policy. AlgoVault returns the opportunity; your agent decides whether to act.

## Production setup

- Pin `agent-framework==1.4.0` (or the latest stable from PyPI at deploy time).
- Treat `MCPStreamableHTTPTool` connect/close in a single `async with` block per request OR keep one long-lived tool per worker - both are supported.
- Free tier covers {{PRICING.free_allowance}}. For higher throughput, see <https://algovault.com/pricing>.
- AlgoVault provides analytics; your agent and your risk policy decide what (if anything) to execute.

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue intelligence.** Funding spreads, regime, and sentiment fused across 12 exchanges (Binance, Bybit, OKX, Bitget, Hyperliquid) - not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. ERC-8004 agentId `44544`. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 - live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate &middot; <span data-tr-field="call_count">383,789</span>+ calls &middot; <span data-tr-field="merkle_batch_count">100</span>+ on-chain batches &middot; <span data-tr-field="asset_count">738</span> assets</strong> &rarr; [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-maf)

## CTA

Run the demo at `examples/maf/demo.py` &middot; Pair with your MAF `ChatAgent` at `https://api.algovault.com/mcp` &middot; Verify on `https://algovault.com/track-record`.

## Install

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cowork, or any MCP-compatible client.

---

*Tutorial &copy; AlgoVault Labs &middot; MIT licensed &middot; Provenance verified 2026-05-18 &middot; Microsoft Agent Framework OFFICIAL (`github.com/microsoft/agent-framework`)*
