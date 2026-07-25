# AlgoVault x LlamaIndex — Composite Trade Calls for Your LlamaIndex Agent

> <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="merkle_batch_count">100</span>+ Merkle-verified on-chain batches · <span data-tr-field="asset_count">738</span> assets covered.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-llamaindex)
> *Snapshot taken 2026-05-18 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your LlamaIndex agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2 ([agentId 44544](https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=44544)). Drop it into any `FunctionAgent`, `ReActAgent`, or custom workflow with [`llama-index-tools-mcp`](https://pypi.org/project/llama-index-tools-mcp/) — the canonical MCP bridge maintained by LlamaIndex.

> **Provenance:** `llama-index-tools-mcp==0.4.8` on PyPI (verified 2026-05-18). Streamable-HTTP transport documented at <https://developers.llamaindex.ai/python/framework/module_guides/mcp/llamaindex_mcp/>. AlgoVault MCP endpoint: `https://api.algovault.com/mcp`.

## TL;DR (3-line hook)

- One tool call returns a composite verdict: call, confidence, regime, indicators. Not 26 raw signals to vote-count.
- Cross-venue signal across major crypto perpetual-futures venues. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on Base L2. Verifiable track record, not a marketing claim.

## What you'll build (90s read)

A runnable Python script that:

1. Connects to AlgoVault MCP at `https://api.algovault.com/mcp` via `BasicMCPClient` (streamable HTTP transport).
2. Calls `get_trade_call` directly for any coin + timeframe and prints the parsed verdict.
3. (Optional) Adapts the 4 AlgoVault tools to LlamaIndex `FunctionTool` objects via `McpToolSpec` and hands them to a `FunctionAgent` so an LLM can decide which tool to call.

## Prerequisites

1. **Python >= 3.10** (`python3 --version`). The `llama-index-tools-mcp` package requires it.
2. **AlgoVault skills plugin** (optional helper pack for Claude Code / Cursor / Cline):
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Install the demo deps** (pinned in `examples/llamaindex/requirements.txt`):
   ```bash
   pip install -r examples/llamaindex/requirements.txt
   ```
4. **(Optional) LLM API key** — only needed for the follow-on `FunctionAgent` snippet below. The bare `python demo.py BTC 4h` call works without one.

## Demo: Direct trade-call read (<=80 lines)

```python
# examples/llamaindex/demo.py (excerpt — see file for full source)
import asyncio
import json
from llama_index.tools.mcp import BasicMCPClient

ALGOVAULT_MCP_URL = "https://api.algovault.com/mcp"


async def fetch_trade_call(coin: str, timeframe: str) -> dict:
    # BasicMCPClient(url) selects streamable HTTP transport by default
    # for any http(s)://... URL that does not end in /sse.
    client = BasicMCPClient(ALGOVAULT_MCP_URL)
    result = await client.call_tool(
        "get_trade_call", {"coin": coin, "timeframe": timeframe}
    )
    payload = json.loads(result.content[0].text)
    return {k: payload[k] for k in ("call", "confidence", "indicators", "regime")}


if __name__ == "__main__":
    result = asyncio.run(fetch_trade_call("BTC", "4h"))
    print(json.dumps(result, indent=2))
```

Run it:

```bash
python examples/llamaindex/demo.py BTC 4h
```

## Sample output

```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {
    "funding_rate": 0.00005667,
    "funding_24h_avg": 0.00005667,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8145289765.51,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN"
}
```

The 4 keys (`call`, `confidence`, `indicators`, `regime`) are the documented contract. The full MCP response also includes `price`, `reasoning`, `timestamp`, `coin`, `timeframe`, and `_algovault` provenance — all available in `payload` if your agent needs them.

## All 4 AlgoVault tools at a glance

`McpToolSpec(client=...).to_tool_list_async()` returns 4 LlamaIndex `FunctionTool` objects:

| Tool | Use case |
|---|---|
| `get_trade_call` | Composite BUY/SELL/HOLD verdict + confidence + regime + indicators for one coin + timeframe |
| `get_trade_call` | Back-compat alias of `get_trade_call` (same payload shape) |
| `scan_funding_arb` | Rank funding-spread opportunities across the venues |
| `get_market_regime` | Regime classification (TRENDING_UP / TRENDING_DOWN / RANGING / VOLATILE) for one coin + timeframe |

Each tool exposes the standard LlamaIndex `FunctionTool` interface — call directly via `await tool.acall(coin="BTC", timeframe="4h")` or hand the list to any agent.

## Optional: wire the tools into a FunctionAgent

If you want an LLM to decide when to call which tool, load the tools via `McpToolSpec` and pass them to a `FunctionAgent` (or `ReActAgent`):

```python
import asyncio
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.anthropic import Anthropic


async def run():
    client = BasicMCPClient("https://api.algovault.com/mcp")
    spec = McpToolSpec(client=client)
    tools = await spec.to_tool_list_async()  # 4 FunctionTool objects

    agent = FunctionAgent(
        tools=tools,
        llm=Anthropic(model="claude-sonnet-4-5"),
        system_prompt="Use the AlgoVault tools to answer trading questions.",
    )
    response = await agent.run("Get a trade call for BTC on the 4h timeframe.")
    print(response)


asyncio.run(run())
```

Requires `pip install llama-index-llms-anthropic` and an `ANTHROPIC_API_KEY`. Swap `Anthropic` for any LlamaIndex LLM (OpenAI, Mistral, Ollama, Bedrock, etc.).

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue signal.** Funding spreads, regime, and sentiment fused across venues — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="merkle_batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-llamaindex)

## Next steps

Run the demo at `examples/llamaindex/demo.py` · Pair with your LlamaIndex agent at `https://api.algovault.com/mcp` · Verify the track record on `https://algovault.com/track-record`.

## Install (helper plugin)

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cursor, or any MCP-compatible client.

---

*Tutorial (c) AlgoVault Labs · MIT licensed · Provenance verified 2026-05-18 · llama-index-tools-mcp 0.4.8 (PyPI)*
