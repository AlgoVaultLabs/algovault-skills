# AlgoVault x CrewAI -- Composite Trade Calls for Your CrewAI Crew

> <!-- snapshot: 2026-07-21 -- live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="merkle_batch_count">100</span>+ Merkle-verified on-chain batches · <span data-tr-field="asset_count">738</span> assets covered.</strong>
> Don't trust -- [verify the track record →](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-crewai)
> *Snapshot taken 2026-05-18 -- live numbers refreshed in-page from <https://algovault.com/api/performance-public>*

AlgoVault MCP gives your CrewAI agents a **composite verdict** in one call -- direction, confidence, regime, and cross-venue funding/sentiment context -- backed by a publicly auditable record anchored to Base L2 ([agentId 44544](https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=44544)). Drop it into any `Crew` or `Agent` workflow via [`crewai-tools`](https://pypi.org/project/crewai-tools/) and the official `MCPServerAdapter`.

> **Provenance:** `crewai==1.14.4` + `crewai-tools[mcp]==1.14.4` on PyPI (verified 2026-05-18). Streamable-HTTP transport documented at <https://docs.crewai.com/en/mcp/overview> and <https://docs.crewai.com/en/mcp/streamable-http>. Adapter source: [`crewAIInc/crewAI-tools`](https://github.com/crewAIInc/crewAI-tools/blob/main/crewai_tools/adapters/mcp_adapter.py). AlgoVault MCP endpoint: `https://api.algovault.com/mcp`.

## TL;DR (3-line hook)

- One tool call returns a composite verdict: call, confidence, regime, indicators. Not 26 raw signals to vote-count.
- Cross-venue signal across major crypto perpetual-futures venues. Funding spreads, regime alignment, volatility -- fused.
- Every signal Merkle-anchored on Base L2. Verifiable track record, not a marketing claim.

## What you'll build (90s read)

A runnable Python script that:

1. Connects to AlgoVault MCP at `https://api.algovault.com/mcp` via `MCPServerAdapter` (streamable-HTTP).
2. Loads the 4 AlgoVault tools as CrewAI `BaseTool` objects.
3. Invokes `get_trade_call` for any coin + timeframe and prints the parsed verdict.
4. (Optional) Wires the tools into a `Crew` with a research `Agent` so an LLM can decide when to call which tool.

## Prerequisites

1. **Python >=3.10, <3.14** (`python3 --version`). The `crewai` and `crewai-tools` packages require it.
2. **AlgoVault skills plugin** (optional helper pack for Claude Code / Cursor / Cline):
   ```bash
   claude plugin install AlgoVaultLabs/algovault-skills
   ```
3. **Install the demo deps** (pinned in `examples/crewai/requirements.txt`):
   ```bash
   pip install -r examples/crewai/requirements.txt
   ```
4. **(Optional) LLM API key** -- only needed for the follow-on `Crew` + `Agent` snippet below. The bare `python demo.py BTC 4h` call works without one.

## Demo: Direct trade-call read (<=80 lines)

```python
# examples/crewai/demo.py (excerpt -- see file for full source)
import json
from crewai_tools import MCPServerAdapter

ALGOVAULT_MCP_URL = "https://api.algovault.com/mcp"


def fetch_trade_call(coin: str, timeframe: str) -> dict:
    server_params = {
        "url": ALGOVAULT_MCP_URL,
        "transport": "streamable-http",
    }
    with MCPServerAdapter(server_params) as tools:
        by_name = {t.name: t for t in tools}
        raw = by_name["get_trade_call"].run(
            coin=coin,
            timeframe=timeframe,
            includeReasoning=False,
            exchange="BINANCE",
        )
    payload = json.loads(raw)
    return {k: payload[k] for k in ("call", "confidence", "indicators", "regime")}


if __name__ == "__main__":
    result = fetch_trade_call("BTC", "4h")
    print(json.dumps(result, indent=2))
```

Run it:

```bash
python examples/crewai/demo.py BTC 4h
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

The 4 keys (`call`, `confidence`, `indicators`, `regime`) are the documented contract. The full MCP response also includes `price`, `reasoning`, `timestamp`, `_algovault` provenance, and `closest_tradeable` -- all available in `payload` if your agent needs them.

## All 4 AlgoVault tools at a glance

`MCPServerAdapter(...)` yields 4 CrewAI `BaseTool` objects when used as a context manager:

| Tool | Use case |
|---|---|
| `get_trade_call` | Composite BUY/SELL/HOLD verdict + confidence + regime + indicators for one coin + timeframe |
| `get_trade_call` | Back-compat alias of `get_trade_call` (same payload shape) |
| `scan_funding_arb` | Rank funding-spread opportunities across the venues |
| `get_market_regime` | Regime classification (TRENDING_UP / TRENDING_DOWN / RANGING / VOLATILE) for one coin + timeframe |

Each is invokable directly via `tool.run(**kwargs)`, or assignable to a CrewAI `Agent` for LLM-driven tool selection.

## Optional: wire the tools into a Crew

If you want an LLM to decide when to call which tool, pass the `tools` list to an `Agent` and run a `Crew`:

```python
from crewai import Agent, Crew, Task
from crewai_tools import MCPServerAdapter

server_params = {
    "url": "https://api.algovault.com/mcp",
    "transport": "streamable-http",
}

with MCPServerAdapter(server_params) as tools:
    analyst = Agent(
        role="Crypto market analyst",
        goal="Read AlgoVault's composite verdict for the requested asset and explain it.",
        backstory="A quantitative analyst that calls AlgoVault MCP for cross-venue signal.",
        tools=list(tools),
        verbose=True,
    )
    task = Task(
        description="Get a trade call for BTC on the 4h timeframe and summarise the verdict.",
        expected_output="A one-paragraph summary citing call, confidence, and regime.",
        agent=analyst,
    )
    crew = Crew(agents=[analyst], tasks=[task])
    print(crew.kickoff())
```

Requires an LLM provider key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc) plus a model identifier; CrewAI uses `litellm` under the hood so most providers work. The bare demo above does not.

## Why AlgoVault?

- **Composite verdict, not raw indicators.** One JSON response replaces 26-indicator vote-counting.
- **Cross-venue signal.** Funding spreads, regime, and sentiment fused across venues -- not derivable from any single-venue API.
- **Publicly verified.** Every signal anchored to Base L2 via Merkle proof. Verify before you subscribe.
- <!-- snapshot: 2026-07-21 -- live source of truth: /api/performance-public + /api/merkle-batches -->
<strong><span data-tr-field="pfe_wr">91.5%</span> PFE Win Rate · <span data-tr-field="call_count">383,789</span>+ calls · <span data-tr-field="merkle_batch_count">100</span>+ on-chain batches</strong> → [view live track record](https://algovault.com/track-record?utm_source=tutorial&utm_medium=repo&utm_campaign=integration-crewai)

## Next steps

Run the demo at `examples/crewai/demo.py` · Pair with your CrewAI Crew at `https://api.algovault.com/mcp` · Verify the track record on `https://algovault.com/track-record`.

## Install (helper plugin)

```bash
claude plugin install AlgoVaultLabs/algovault-skills
```

Once installed, every Skill in the [pack](https://github.com/AlgoVaultLabs/algovault-skills) is one-line invokable from Claude Code, Cursor, or any MCP-compatible client.

---

*Tutorial (c) AlgoVault Labs · MIT licensed · Provenance verified 2026-05-18 · crewai 1.14.4 + crewai-tools 1.14.4 (PyPI)*
