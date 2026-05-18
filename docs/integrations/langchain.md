# AlgoVault x LangChain — Composite Trade Calls for Your LangChain Agent

> <!-- snapshot: 2026-05-18 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">90.47%</span> PFE Win Rate · <span data-tr-field="total_calls">96,864</span>+ calls · <span data-tr-field="merkle_batches">38</span>+ Merkle-verified on-chain batches · <span data-tr-field="asset_count">738</span> assets covered.</strong>
> Don't trust — [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-langchain)
> *Snapshot taken 2026-05-18 — live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your LangChain agent a **composite verdict** in one call — direction, confidence, regime, and cross-venue funding/sentiment context — backed by a publicly auditable record anchored to Base L2 ([agentId 44544](https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=44544)). Drop it into any `create_react_agent` or LangGraph workflow with [`langchain-mcp-adapters`](https://pypi.org/project/langchain-mcp-adapters/) — the canonical MCP bridge maintained by LangChain.

> **Provenance:** `langchain-mcp-adapters==0.2.2` on PyPI (verified 2026-05-18). Streamable-HTTP transport documented at <https://docs.langchain.com/oss/python/langchain/mcp> and <https://reference.langchain.com/python/langchain-mcp-adapters>. AlgoVault MCP endpoint: `https://api.algovault.com/mcp`.

## TL;DR (3-line hook)

- One tool call returns a composite verdict: call, confidence, regime, indicators. Not 26 raw signals to vote-count.
- Cross-venue signal across 5 crypto perp venues: Binance, Bybit, OKX, Bitget, Hyperliquid. Funding spreads, regime alignment, volatility — fused.
- Every signal Merkle-anchored on Base L2. Verifiable track record, not a marketing claim.

## What you'll build (90s read)

A runnable Python script that:

1. Connects to AlgoVault MCP at `https://api.algovault.com/mcp` via `MultiServerMCPClient`.
2. Loads the 4 AlgoVault tools as LangChain `BaseTool` objects.
3. Invokes `get_trade_call` for any coin + timeframe and prints the parsed verdict.
4. (Optional) Wires the tools into a `create_react_agent` so an LLM can decide when to call which tool.

## Prerequisites

1. **Python >= 3.10** (`python3 --version`). The langchain-mcp-adapters package requires it.
2. **AlgoVault skills plugin** (optional helper pack for Claude Code / Cursor / Cline):
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Install the demo deps** (pinned in `examples/langchain/requirements.txt`):
   ```bash
   pip install -r examples/langchain/requirements.txt
   ```
4. **(Optional) LLM API key** — only needed for the follow-on `create_react_agent` snippet below. The bare `python demo.py BTC 4h` call works without one.

## Demo: Direct trade-call read (<=80 lines)

```python
# examples/langchain/demo.py (excerpt — see file for full source)
import asyncio
import json
from langchain_mcp_adapters.client import MultiServerMCPClient

ALGOVAULT_MCP_URL = "https://api.algovault.com/mcp"


async def fetch_trade_call(coin: str, timeframe: str) -> dict:
    client = MultiServerMCPClient({
        "algovault": {
            "url": ALGOVAULT_MCP_URL,
            "transport": "streamable_http",
        }
    })
    tools = await client.get_tools()
    by_name = {t.name: t for t in tools}

    raw = await by_name["get_trade_call"].ainvoke(
        {"coin": coin, "timeframe": timeframe}
    )
    payload = json.loads(raw if isinstance(raw, str) else raw[0].text)
    return {k: payload[k] for k in ("call", "confidence", "indicators", "regime")}


if __name__ == "__main__":
    result = asyncio.run(fetch_trade_call("BTC", "4h"))
    print(json.dumps(result, indent=2))
```

Run it:

```bash
python examples/langchain/demo.py BTC 4h
```

## Sample output

```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {
    "funding_rate": 0.00005632,
    "funding_24h_avg": 0.00005632,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8144688081.84,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN"
}
```

The 4 keys (`call`, `confidence`, `indicators`, `regime`) are the documented contract. The full MCP response also includes `price`, `reasoning`, `timestamp`, `_algovault` provenance, and `closest_tradeable` — all available in `payload` if your agent needs them.

## All 4 AlgoVault tools at a glance

`MultiServerMCPClient.get_tools()` returns 4 LangChain `BaseTool` objects:

| Tool | Use case |
|---|---|
| `get_trade_call` | Composite BUY/SELL/HOLD verdict + confidence + regime + indicators for one coin + timeframe |
| `get_trade_signal` | Back-compat alias of `get_trade_call` (same payload shape) |
| `scan_funding_arb` | Rank funding-spread opportunities across the 5 venues |
| `get_market_regime` | Regime classification (TRENDING_UP / TRENDING_DOWN / RANGING / VOLATILE) for one coin + timeframe |

Each is invokable via `tool.ainvoke({...})`.

## Optional: wire the tools into a ReAct agent

If you want an LLM to decide when to call which tool, drop the same `tools` list into `create_react_agent`:

```python
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

async def run():
    client = MultiServerMCPClient({
        "algovault": {
            "url": "https://api.algovault.com/mcp",
            "transport": "streamable_http",
        }
    })
    tools = await client.get_tools()
    agent = create_react_agent("anthropic:claude-sonnet-4-5", tools)
    result = await agent.ainvoke({
        "messages": [
            {"role": "user", "content": "Get a trade call for BTC on the 4h timeframe."}
        ]
    })
    print(result["messages"][-1].content)
```

Requires `pip install langchain langgraph langchain-anthropic` and an `ANTHROPIC_API_KEY`. Swap the model string for any LangChain chat-model identifier.

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue signal.** Funding spreads, regime, and sentiment fused across 5 venues — not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-05-18 — live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">90.47%</span> PFE Win Rate · <span data-tr-field="total_calls">96,864</span>+ calls · <span data-tr-field="merkle_batches">38</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-langchain)

## Next steps

Run the demo at `examples/langchain/demo.py` · Pair with your LangChain agent at `https://api.algovault.com/mcp` · Verify the track record on `https://algovault.com/track-record`.

## Install (helper plugin)

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cursor, or any MCP-compatible client.

---

*Tutorial (c) AlgoVault Labs · MIT licensed · Provenance verified 2026-05-18 · langchain-mcp-adapters 0.2.2 (PyPI)*
