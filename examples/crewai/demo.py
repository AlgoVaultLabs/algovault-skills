#!/usr/bin/env python3
"""AlgoVault x CrewAI demo - composite trade-call via MCP.

Connects to the AlgoVault MCP server using crewai-tools' `MCPServerAdapter`
(streamable-HTTP transport), invokes the `get_trade_call` tool directly,
and prints the parsed trade-call JSON (call, confidence, indicators, regime)
to stdout.

Run:
    python demo.py BTC 4h
    python demo.py ETH 1h

The bare invocation does NOT need an LLM API key - it is a direct MCP
tool call. The follow-on `Crew` + `Agent` snippet in the tutorial markdown
adds an LLM on top (and needs an OPENAI_API_KEY / ANTHROPIC_API_KEY etc).

Env:
    ALGOVAULT_MCP_URL    Override the MCP endpoint (default api.algovault.com/mcp)
    DRY_RUN              If set to "1", returns a fixture and skips the network call.
"""

from __future__ import annotations

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
    """Unwrap a CrewAI tool response into the trade-call dict.

    CrewAI MCP tools return the text-content of the first MCP content block
    as a plain string. Parse it as JSON and project down to the documented
    contract keys.
    """
    text = raw if isinstance(raw, str) else str(raw)
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"MCP tool returned non-JSON content (first 200 chars): {text[:200]!r}"
        ) from exc
    missing = [k for k in REQUIRED_KEYS if k not in payload]
    if missing:
        raise RuntimeError(
            f"MCP response missing required keys: {missing}. Raw keys: {list(payload.keys())}"
        )
    return {k: payload[k] for k in REQUIRED_KEYS}


def fetch_trade_call(coin: str, timeframe: str) -> dict[str, Any]:
    """Connect to AlgoVault MCP via CrewAI's MCPServerAdapter, invoke get_trade_call.

    The adapter is a sync context manager that owns the MCP session for its
    lifetime. We invoke the tool directly via `tool.run(**kwargs)` without
    assembling a Crew so the demo stays zero-LLM-key.
    """
    # Imported lazily so DRY_RUN mode does not need the dep installed.
    from crewai_tools import MCPServerAdapter

    server_params = {
        "url": ALGOVAULT_MCP_URL,
        "transport": "streamable-http",
    }
    # NOTE: the AlgoVault MCP schema declares `includeReasoning` and
    # `exchange` as optional (default null), but the upstream validator
    # rejects explicit-null values. Pass concrete defaults so CrewAI's
    # pydantic-backed BaseTool does not forward `None` for them.
    with MCPServerAdapter(server_params) as tools:
        by_name = {t.name: t for t in tools}
        if "get_trade_call" not in by_name:
            raise RuntimeError(
                "get_trade_call not found in MCP tools/list. "
                f"Available: {sorted(by_name)}"
            )
        raw = by_name["get_trade_call"].run(
            coin=coin,
            timeframe=timeframe,
            includeReasoning=False,
            exchange="BINANCE",
        )
        return _extract_trade_call(raw)


def main(argv: list[str]) -> int:
    coin, timeframe = _parse_args(argv)
    if os.environ.get("DRY_RUN") == "1":
        result = DRY_RUN_FIXTURE
    else:
        result = fetch_trade_call(coin, timeframe)
    print(json.dumps(result, indent=2))
    return 0


def _entrypoint() -> int:
    try:
        return main(sys.argv)
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - top-level CLI surface
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(_entrypoint())
