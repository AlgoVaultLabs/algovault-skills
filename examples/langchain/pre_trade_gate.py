"""Gate a LangChain agent's orders on AlgoVault's pre_trade_check.

    from langchain.agents import create_agent
    from pre_trade_gate import PreTradeGate

    def place_order_check(args):
        if args.get("reduce_only"):
            return None  # a close opens nothing: not checked
        return {"coin": args["coin"], "side": args["side"], "sizeUsd": args["size_usd"]}

    agent = create_agent(model, tools, middleware=[PreTradeGate({"place_order": place_order_check})])

Before a mapped order tool runs, the middleware calls pre_trade_check on the order's
own size, through examples/_shared/algovault_pre_trade.py. WAIT, or a check that
cannot run, returns an error ToolMessage that says why, and the order tool is never
called. GO and CAUTION call it once, and its reply gains a line naming the decision,
the reason codes, the checked size and the cheapest venue. Every other tool runs
unchecked.

`order_tools` maps a tool name to a function from that call's args to the check's
params, or to None when the call opens no position (a close, a cancel). A function
that raises blocks the order. Requires langchain>=1,<2.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Callable, Mapping, Optional

from langchain.agents.middleware import AgentMiddleware
from langchain_core.messages import ToolMessage

try:
    import algovault_pre_trade
except ImportError:  # run from this repo: the helper lives in examples/_shared
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "_shared"))
    import algovault_pre_trade

OrderParams = Callable[[dict[str, Any]], Optional[dict[str, Any]]]


def _blocked(request: Any, message: str) -> ToolMessage:
    call = request.tool_call
    return ToolMessage(content=message, tool_call_id=call["id"], name=call["name"], status="error")


def _with_note(result: Any, note: str) -> Any:
    """The tool's reply with the check's note added. A Command passes as it is."""
    if isinstance(result, ToolMessage):
        if isinstance(result.content, str):
            result.content = f"{result.content}\n\n{note}" if result.content else note
        elif isinstance(result.content, list):
            result.content = [*result.content, {"type": "text", "text": note}]
    return result


class PreTradeGate(AgentMiddleware):
    """Runs pre_trade_check before each opening order; blocks the order on WAIT or any error."""

    def __init__(
        self,
        order_tools: Mapping[str, OrderParams],
        *,
        api_key: str | None = None,
        timeout: float = 3.0,
    ) -> None:
        super().__init__()
        self.order_tools = dict(order_tools)
        self.api_key = api_key
        self.timeout = timeout

    def _params(self, request: Any) -> dict[str, Any] | None:
        """The check's params for this call, or None when it opens no position."""
        call = request.tool_call
        to_params = self.order_tools.get(call["name"])
        return None if to_params is None else to_params(dict(call.get("args") or {}))

    def _blocked_by(self, request: Any, params: dict[str, Any], result: dict[str, Any]) -> ToolMessage | None:
        """The message that blocks the call, or None when the check passed it."""
        decision = result.get("decision")
        if decision in ("GO", "CAUTION"):
            return None
        if decision == "WAIT":
            codes = algovault_pre_trade.reason_codes(result)
            return _blocked(request, algovault_pre_trade.wait_message(params.get("coin"), params.get("side"), codes))
        return _blocked(request, algovault_pre_trade.blocked_message(f"decision {decision!r}"))

    def wrap_tool_call(self, request: Any, handler: Callable[[Any], Any]) -> Any:
        try:
            params = self._params(request)
            result = None if params is None else algovault_pre_trade.check(params, api_key=self.api_key, timeout=self.timeout)
        except Exception as exc:  # fail closed: a check that cannot run blocks the order
            return _blocked(request, algovault_pre_trade.blocked_message(exc))
        if params is None:
            return handler(request)
        blocked = self._blocked_by(request, params, result)
        if blocked is not None:
            return blocked
        note = algovault_pre_trade.pass_message(params.get("coin"), params.get("side"), result)
        return _with_note(handler(request), note)

    async def awrap_tool_call(self, request: Any, handler: Callable[[Any], Any]) -> Any:
        try:
            params = self._params(request)
            result = None if params is None else await algovault_pre_trade.acheck(params, api_key=self.api_key, timeout=self.timeout)
        except Exception as exc:  # fail closed: a check that cannot run blocks the order
            return _blocked(request, algovault_pre_trade.blocked_message(exc))
        if params is None:
            return await handler(request)
        blocked = self._blocked_by(request, params, result)
        if blocked is not None:
            return blocked
        note = algovault_pre_trade.pass_message(params.get("coin"), params.get("side"), result)
        return _with_note(await handler(request), note)
