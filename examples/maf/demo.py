#!/usr/bin/env python3
"""AlgoVault x Microsoft Agent Framework (MAF) demo - composite trade-call via MCP.

Connects to the AlgoVault MCP server with `agent_framework.MCPStreamableHTTPTool`
and invokes the `get_trade_call` tool directly (no chat model required for the
bare demo). Prints the parsed trade-call JSON (call, confidence, indicators,
regime) to stdout.

Run:
    python demo.py BTC 4h
    python demo.py ETH 1h

The bare invocation does NOT need an LLM API key - it is a direct MCP tool
call via MAF's `MCPStreamableHTTPTool.call_tool(...)`. The follow-on
`ChatAgent` wiring snippet in the tutorial markdown adds an Azure OpenAI /
OpenAI / Anthropic chat model on top.

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
        "funding_rate": 0.00005697,
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


def _extract_trade_call(contents: Any) -> dict[str, Any]:
    """Unwrap a MAF MCPStreamableHTTPTool.call_tool() return into the trade-call dict.

    `tool.call_tool(...)` returns a list of content items. The MCP server emits
    a single text-typed Content carrying the JSON payload; pick the first text
    content and parse it.
    """
    if not isinstance(contents, list) or not contents:
        raise RuntimeError(
            f"MAF call_tool returned unexpected shape: {type(contents).__name__}"
        )
    text: str | None = None
    for item in contents:
        item_type = getattr(item, "type", None)
        item_text = getattr(item, "text", None)
        if item_type == "text" and item_text is not None:
            text = item_text
            break
    if text is None:
        raise RuntimeError(
            f"No text content in call_tool return; got: {[type(c).__name__ for c in contents]}"
        )

    payload = json.loads(text)
    missing = [k for k in REQUIRED_KEYS if k not in payload]
    if missing:
        raise RuntimeError(
            f"MCP response missing required keys: {missing}. Raw keys: {list(payload.keys())}"
        )
    return {k: payload[k] for k in REQUIRED_KEYS}


async def fetch_trade_call(coin: str, timeframe: str) -> dict[str, Any]:
    """Connect to AlgoVault MCP via MAF and invoke get_trade_call."""
    # Imported lazily so DRY_RUN mode does not need the dep installed.
    from agent_framework import MCPStreamableHTTPTool

    # NB: load_prompts=False because AlgoVault MCP does not implement
    # the prompts/list method (tools-only server). MAF's default connect()
    # path otherwise raises "Method not found".
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
        return _extract_trade_call(contents)


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
