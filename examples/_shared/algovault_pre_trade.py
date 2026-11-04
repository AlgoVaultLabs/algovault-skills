"""AlgoVault pre_trade_check from Python - the one helper every Python recipe calls.

    from algovault_pre_trade import check, PreTradeCheckError

    result = check({"coin": "BTC", "side": "long", "sizeUsd": 1000})
    result["decision"]                 # "GO" | "CAUTION" | "WAIT"
    reason_codes(result)               # e.g. ["REGIME_AGAINST_SIDE"]

`check` opens the remote MCP server the way examples/_shared/algovault-helper.mjs does
(initialize, then tools/call; the transport is stateless), reads a JSON or an SSE body,
and returns the tool's result: coin, side, size_usd, decision, reasons[].code,
best_venue, as_of and the rest of the payload.

It raises PreTradeCheckError whenever the check cannot run: a transport error, an
isError result (a spent allowance, a refused key), a body it cannot parse, or no
decision. A recipe that blocks the order on PreTradeCheckError fails closed.

Standard library only. A key goes in `Authorization: Bearer`: pass `api_key`, or set
ALGOVAULT_API_KEY. ALGOVAULT_MCP_URL overrides the endpoint.
"""

from __future__ import annotations

import asyncio
import http.client
import json
import os
import urllib.error
import urllib.request
from typing import Any

DEFAULT_MCP_URL = "https://api.algovault.com/mcp"
DECISIONS = ("GO", "CAUTION", "WAIT")

_ACCEPT = "application/json, text/event-stream"
_PROTOCOL_VERSION = "2025-11-05"  # the version algovault-helper.mjs sends
_CLIENT_INFO = {"name": "algovault-pre-trade", "version": "0.1.0"}
# urllib's default User-Agent (Python-urllib/3.x) is refused at the edge with Cloudflare
# error 1010 (HTTP 403, measured 2026-11-04); a client that names itself is served.
_USER_AGENT = "algovault-pre-trade/0.1.0"


class PreTradeCheckError(Exception):
    """The check could not run, so there is no decision to act on. Block the order."""


def _post(url: str, message: dict[str, Any], headers: dict[str, str], timeout: float):
    request = urllib.request.Request(
        url, data=json.dumps(message).encode("utf-8"), headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.headers, response.read()
    except urllib.error.HTTPError as exc:
        raise PreTradeCheckError(f"HTTP {exc.code} from {url}") from exc
    except (urllib.error.URLError, http.client.HTTPException, OSError, ValueError) as exc:
        raise PreTradeCheckError(f"could not reach {url}: {exc}") from exc


def _sse_messages(text: str) -> list[Any]:
    """The JSON payload of every event in a text/event-stream body."""
    messages: list[Any] = []
    data: list[str] = []
    for line in text.splitlines() + [""]:
        if line.startswith("data:"):
            value = line[5:]
            data.append(value[1:] if value.startswith(" ") else value)
        elif line == "" and data:
            messages.append(json.loads("\n".join(data)))
            data = []
    return messages


def _reply(headers, body: bytes, request_id: int) -> dict[str, Any]:
    """The JSON-RPC reply to `request_id`, from a JSON or an SSE body."""
    try:
        text = body.decode("utf-8")
        if "text/event-stream" in (headers.get("Content-Type") or ""):
            candidates = _sse_messages(text)
        else:
            candidates = [json.loads(text)]
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PreTradeCheckError(f"the server's reply could not be parsed: {exc}") from exc
    for message in candidates:
        if isinstance(message, dict) and message.get("id") == request_id:
            return message
    raise PreTradeCheckError("the server's reply held no answer to the request")


def _error_text(error: Any) -> str:
    if isinstance(error, dict) and isinstance(error.get("message"), str):
        return error["message"]
    return json.dumps(error)


def _payload(result: dict[str, Any]) -> Any:
    """The tool's JSON payload: structuredContent, else the first text block."""
    structured = result.get("structuredContent")
    if isinstance(structured, dict):
        return structured
    for block in result.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str):
            try:
                return json.loads(block["text"])
            except json.JSONDecodeError:
                return block["text"]
    return None


def _refusal_text(payload: Any) -> str:
    if isinstance(payload, dict):
        code = payload.get("code") or payload.get("error_code")
        message = payload.get("message") or payload.get("error")
        first_line = message.splitlines()[0] if isinstance(message, str) and message else ""
        text = ": ".join(part for part in (code, first_line) if isinstance(part, str) and part)
        if text:
            return text
    if isinstance(payload, str) and payload:
        return payload.splitlines()[0]
    return "the server refused the call"


def check(params: dict[str, Any], *, api_key: str | None = None, timeout: float = 3.0) -> dict[str, Any]:
    """Run pre_trade_check on `params` and return its result.

    `params` are the tool's arguments: coin, side ("long" | "short") and sizeUsd are
    required; holdHours, orderType, leverage, stopPct, rules and the rest are optional.
    `timeout` bounds each of the two HTTP requests, in seconds.

    Raises PreTradeCheckError when the check cannot run.
    """
    if not isinstance(params, dict):
        raise PreTradeCheckError("params must be a dict of pre_trade_check arguments")
    url = os.environ.get("ALGOVAULT_MCP_URL") or DEFAULT_MCP_URL
    key = api_key if api_key is not None else os.environ.get("ALGOVAULT_API_KEY")
    headers = {"Content-Type": "application/json", "Accept": _ACCEPT, "User-Agent": _USER_AGENT}
    if key:
        headers["Authorization"] = f"Bearer {key}"

    init_headers, init_body = _post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": _PROTOCOL_VERSION, "capabilities": {}, "clientInfo": _CLIENT_INFO},
        },
        headers,
        timeout,
    )
    init = _reply(init_headers, init_body, 1)
    if "error" in init:
        raise PreTradeCheckError(f"initialize failed: {_error_text(init['error'])}")
    # Stateless servers send no session id; forward one only when the server issues it.
    session_id = init_headers.get("mcp-session-id")
    if session_id:
        headers["mcp-session-id"] = session_id

    call_headers, call_body = _post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "pre_trade_check", "arguments": params},
        },
        headers,
        timeout,
    )
    reply = _reply(call_headers, call_body, 2)
    if "error" in reply:
        raise PreTradeCheckError(f"pre_trade_check failed: {_error_text(reply['error'])}")
    result = reply.get("result")
    if not isinstance(result, dict):
        raise PreTradeCheckError("the server's reply held no result")
    payload = _payload(result)
    if result.get("isError"):
        raise PreTradeCheckError(f"pre_trade_check refused: {_refusal_text(payload)}")
    if not isinstance(payload, dict) or payload.get("decision") not in DECISIONS:
        raise PreTradeCheckError("pre_trade_check returned no decision")
    return payload


async def acheck(params: dict[str, Any], *, api_key: str | None = None, timeout: float = 3.0) -> dict[str, Any]:
    """`check` for async code: runs it in a worker thread."""
    return await asyncio.to_thread(check, params, api_key=api_key, timeout=timeout)


def reason_codes(result: dict[str, Any]) -> list[str]:
    """The reason codes of a check result, in order."""
    reasons = result.get("reasons") if isinstance(result, dict) else None
    return [r["code"] for r in reasons or [] if isinstance(r, dict) and isinstance(r.get("code"), str)]


def wait_message(coin: Any, side: Any, codes: list[str]) -> str:
    """The block message for a WAIT. Approved wording: fill the slots, never reword."""
    return f"pre-trade gate: pre_trade_check returned WAIT for {coin} {side} ({', '.join(codes) if codes else 'none'}). Execution stopped."


def blocked_message(error: BaseException | str) -> str:
    """The block message for a check that could not run."""
    if isinstance(error, BaseException) and not isinstance(error, PreTradeCheckError):
        error = f"{type(error).__name__}: {error}"
    return f"pre-trade gate: pre_trade_check could not run ({error}), so the order is blocked."


def pass_message(coin: Any, side: Any, result: dict[str, Any]) -> str:
    """What a passed check tells the agent: decision, reason codes, checked size, cheapest venue."""
    codes = reason_codes(result)
    size = result.get("size_usd")
    venue = result.get("best_venue")
    exchange = venue.get("exchange") if isinstance(venue, dict) else None
    return (
        f"pre-trade gate: {coin} {side} passed pre_trade_check: decision {result.get('decision')}, "
        f"reason codes {', '.join(codes) if codes else 'none'}, "
        f"checked size {f'{size} USD' if size is not None else 'not given'}, "
        f"cheapest venue {exchange or 'not given'}."
    )
