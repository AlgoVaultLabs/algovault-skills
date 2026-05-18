#!/usr/bin/env python3
"""AlgoVault x LangChain demo - composite trade-call via MCP.

Calls the AlgoVault MCP server's `get_trade_call` tool through the
langchain-mcp-adapters streamable-HTTP client and prints the parsed
trade-call JSON (call, confidence, indicators, regime) to stdout.

Run:
    python demo.py BTC 4h
    python demo.py ETH 1h

The bare invocation does NOT need an LLM API key - it is a direct MCP
tool call. The follow-on `create_react_agent` example in the tutorial
markdown adds an LLM on top.

Env:
    ALGOVAULT_MCP_URL    Override the MCP endpoint (default api.algovault.com/mcp)
    DRY_RUN              If set to "1", returns a fixture and skips the network call.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any

ALGOVAULT_MCP_URL = os.environ.get(
    "ALGOVAULT_MCP_URL", "https://api.algovault.com/mcp"
)

# Keys we re-emit from the MCP tool response (the tool returns more
# than this; the demo prints the minimal contract documented in the
# tutorial so verification gates can pattern-match deterministically).
REQUIRED_KEYS = ("call", "confidence", "indicators", "regime")

DRY_RUN_FIXTURE: dict[str, Any] = {
    "call": "HOLD",
    "confidence": 13,
    "indicators": {
        "funding_rate": 0.00005632,
        "funding_state": "ELEVATED",
        "trend_persistence": "MEDIUM",
        "breakout_pending": "INACTIVE",
    },
    "regime": "TRENDING_DOWN",
}


def _parse_args(argv: list[str]) -> tuple[str, str]:
    if len(argv) != 3:
        print(
            "usage: demo.py <COIN> <TIMEFRAME>  e.g.  demo.py BTC 4h",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return argv[1].upper(), argv[2]


def _extract_trade_call(raw: Any) -> dict[str, Any]:
    """Unwrap a langchain-mcp-adapters tool response into the trade-call dict.

    `tool.ainvoke({...})` can return:
      - a plain string (the MCP text content concatenated)
      - a list of dicts like [{"type": "text", "text": "...", "id": "..."}]
      - a list of MCP TextContent objects with a `.text` attribute
      - a dict with a "content" list (raw JSON-RPC envelope)
    Handle all four.
    """
    if isinstance(raw, str):
        text = raw
    elif isinstance(raw, list) and raw:
        first = raw[0]
        if isinstance(first, dict) and "text" in first:
            text = first["text"]
        elif hasattr(first, "text"):
            text = first.text
        else:
            text = str(first)
    elif isinstance(raw, dict) and "content" in raw:
        text = raw["content"][0]["text"]
    else:
        text = str(raw)

    payload = json.loads(text)
    missing = [k for k in REQUIRED_KEYS if k not in payload]
    if missing:
        raise RuntimeError(
            f"MCP response missing required keys: {missing}. Raw keys: {list(payload.keys())}"
        )
    return {k: payload[k] for k in REQUIRED_KEYS}


async def fetch_trade_call(coin: str, timeframe: str) -> dict[str, Any]:
    """Connect to AlgoVault MCP, find get_trade_call, invoke it, return the parsed payload."""
    # Imported lazily so DRY_RUN mode does not need the dep installed.
    from langchain_mcp_adapters.client import MultiServerMCPClient

    client = MultiServerMCPClient(
        {
            "algovault": {
                "url": ALGOVAULT_MCP_URL,
                "transport": "streamable_http",
            }
        }
    )
    tools = await client.get_tools()
    by_name = {t.name: t for t in tools}
    if "get_trade_call" not in by_name:
        raise RuntimeError(
            f"get_trade_call not found in MCP tools/list. Available: {sorted(by_name)}"
        )
    raw = await by_name["get_trade_call"].ainvoke(
        {"coin": coin, "timeframe": timeframe}
    )
    return _extract_trade_call(raw)


async def _amain(argv: list[str]) -> int:
    coin, timeframe = _parse_args(argv)
    if os.environ.get("DRY_RUN") == "1":
        result = DRY_RUN_FIXTURE
    else:
        result = await fetch_trade_call(coin, timeframe)
    print(json.dumps(result, indent=2))
    return 0


def main() -> int:
    try:
        return asyncio.run(_amain(sys.argv))
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - top-level CLI surface
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
