"""AlgoVault x LlamaIndex - minimal MCP demo.

Usage:
    python demo.py <COIN> <TIMEFRAME>

Example:
    python demo.py BTC 4h

Calls `get_trade_call` on the public AlgoVault MCP server at
https://api.algovault.com/mcp via `BasicMCPClient` from
`llama-index-tools-mcp` (streamable HTTP transport) and prints the parsed
trade call as a single JSON object on stdout. Exits 0 on success, 1 on error.

No LLM API key is required - the demo wires the MCP client directly. To
plug the loaded tools into a LlamaIndex agent (ReActAgent / FunctionAgent),
see `docs/integrations/llamaindex.md`.

Set DRY_RUN=1 to skip the network call and emit a minimal-shape fixture
suitable for CI dry-run tests.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any

ENDPOINT = "https://api.algovault.com/mcp"
TOOL_NAME = "get_trade_call"
VALID_TIMEFRAMES = {"5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d"}
REQUIRED_KEYS = ("call", "confidence", "indicators", "regime")


def _parse_args(argv: list[str]) -> tuple[str, str]:
    """Parse `[script, COIN, TIMEFRAME]` from argv. Raise SystemExit(2) on misuse."""
    if len(argv) != 3:
        sys.stderr.write(
            "usage: python demo.py <COIN> <TIMEFRAME>\n"
            f"       TIMEFRAME in {sorted(VALID_TIMEFRAMES)}\n"
        )
        raise SystemExit(2)
    coin = argv[1].strip().upper()
    timeframe = argv[2].strip().lower()
    if not coin:
        sys.stderr.write("COIN must be a non-empty string (e.g. BTC, ETH, SOL).\n")
        raise SystemExit(2)
    if timeframe not in VALID_TIMEFRAMES:
        sys.stderr.write(
            f"TIMEFRAME '{timeframe}' invalid - must be one of "
            f"{sorted(VALID_TIMEFRAMES)}.\n"
        )
        raise SystemExit(2)
    return coin, timeframe


def _extract_payload(result: Any) -> dict:
    """Pull the JSON payload out of an MCP CallToolResult."""
    if not hasattr(result, "content") or not result.content:
        raise ValueError("MCP call returned no content block")
    block = result.content[0]
    text = getattr(block, "text", None)
    if not text:
        raise ValueError("MCP content block has no .text field")
    return json.loads(text)


async def fetch_trade_call(coin: str, timeframe: str) -> dict:
    """Open an MCP session and return the parsed `get_trade_call` payload.

    Uses `BasicMCPClient(url)` which selects streamable HTTP transport by
    default for any `http(s)://` URL that does not end in `/sse`.
    """
    from llama_index.tools.mcp import BasicMCPClient

    client = BasicMCPClient(ENDPOINT)
    result = await client.call_tool(TOOL_NAME, {"coin": coin, "timeframe": timeframe})
    return _extract_payload(result)


def _dry_run_fixture(coin: str, timeframe: str) -> dict:
    """Static fixture emitted when DRY_RUN=1 - exercises shape without network."""
    return {
        "call": "HOLD",
        "confidence": 50,
        "indicators": {
            "funding_rate": 0.0,
            "funding_state": "NEUTRAL",
            "trend_persistence": "MEDIUM",
        },
        "regime": "RANGING",
    }


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv if argv is None else argv)
    try:
        coin, timeframe = _parse_args(argv)
    except SystemExit as exc:
        return int(exc.code or 2)
    try:
        if os.environ.get("DRY_RUN") == "1":
            payload = _dry_run_fixture(coin, timeframe)
        else:
            payload = asyncio.run(fetch_trade_call(coin, timeframe))
    except Exception as exc:  # noqa: BLE001 - top-level CLI guard
        sys.stderr.write(f"error: {type(exc).__name__}: {exc}\n")
        return 1
    sys.stdout.write(json.dumps(payload) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
