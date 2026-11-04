"""Tests for examples/langchain/pre_trade_gate.py.

Default (RUN_LIVE_TESTS unset or 0): a real create_agent run, sync and async, with a
scripted model (a fake whose bind_tools returns itself) emitting the order call. The
order tool is a stub that places nothing and pre_trade_check is a stub; the endpoint
points at a closed local port, so a broken stub seam cannot reach the network.

Live (RUN_LIVE_TESTS=1): the same agent runs one real check (ALGOVAULT_API_KEY, when set).
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import pathlib
import sys

import pytest
from langchain.agents import create_agent
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
EXAMPLES = pathlib.Path(os.environ.get("PRE_TRADE_EXAMPLES_ROOT") or REPO_ROOT / "examples")
sys.path.insert(0, str(EXAMPLES / "_shared"))

import algovault_pre_trade as av  # noqa: E402


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gate_module = _load("pre_trade_gate", EXAMPLES / "langchain" / "pre_trade_gate.py")
PreTradeGate = gate_module.PreTradeGate

FIXTURES = json.loads((REPO_ROOT / "tests" / "fixtures" / "pre-trade-gate" / "check-results.json").read_text())
ORDER = {"coin": "BTC", "side": "long", "size_usd": 1000}
MODES = ["sync", "async"]


def place_order_check(args):
    if args.get("reduce_only"):
        return None
    return {"coin": args["coin"], "side": args["side"], "sizeUsd": args["size_usd"]}


class ScriptedModel(GenericFakeChatModel):
    """Replays scripted replies. bind_tools returns the model so create_agent can bind tools."""

    def bind_tools(self, tools, **kwargs):
        return self


class StubCheck:
    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.calls = []

    def __call__(self, params, *, api_key=None, timeout=3.0):
        self.calls.append(params)
        if self.error is not None:
            raise self.error
        return self.result


@pytest.fixture(autouse=True)
def no_network(request, monkeypatch):
    if not request.node.name.startswith("test_live_"):
        monkeypatch.setenv("ALGOVAULT_MCP_URL", "http://127.0.0.1:9/mcp")


@pytest.fixture
def stub_check(monkeypatch):
    def install(result=None, error=None):
        check = StubCheck(result, error)
        monkeypatch.setattr(av, "check", check)
        return check

    return install


def run_agent(gate, mode, *, tool_name="place_order", args=None):
    """One agent turn that calls `tool_name` once. Returns (stub tool calls, the ToolMessage)."""
    calls = []

    @tool
    def place_order(coin: str, side: str, size_usd: float, reduce_only: bool = False) -> str:
        """Place a perp order. A stub: it records the call and places nothing."""
        calls.append("place_order")
        return "order accepted (stub)"

    @tool
    def get_price(coin: str) -> str:
        """Read a price. A stub."""
        calls.append("get_price")
        return "100"

    model = ScriptedModel(
        messages=iter(
            [
                AIMessage(content="", tool_calls=[{"name": tool_name, "args": args or ORDER, "id": "call_1", "type": "tool_call"}]),
                AIMessage(content="done"),
            ]
        )
    )
    agent = create_agent(model, [place_order, get_price], middleware=[gate])
    inputs = {"messages": [HumanMessage("trade")]}
    state = asyncio.run(agent.ainvoke(inputs)) if mode == "async" else agent.invoke(inputs)
    replies = [m for m in state["messages"] if isinstance(m, ToolMessage)]
    assert len(replies) == 1
    return calls, replies[0]


def test_the_gate_calls_the_helper_the_tests_stub():
    assert gate_module.algovault_pre_trade is av


@pytest.mark.parametrize("mode", MODES)
def test_wait_blocks_the_order(stub_check, mode):
    check = stub_check(FIXTURES["wait"])
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode)
    assert calls == []
    assert check.calls == [{"coin": "BTC", "side": "long", "sizeUsd": 1000}]
    assert reply.status == "error"
    assert reply.content == (
        "pre-trade gate: pre_trade_check returned WAIT for BTC long "
        "(SIZE_ABOVE_VENUE_LIMIT, FUNDING_COST_HIGH). Execution stopped."
    )


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    "error",
    [av.PreTradeCheckError("pre_trade_check refused: TIER_LIMIT_REACHED"), RuntimeError("helper crashed")],
    ids=["check-error", "unexpected-error"],
)
def test_a_check_that_cannot_run_blocks_the_order(stub_check, mode, error):
    stub_check(error=error)
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode)
    assert calls == []
    assert reply.status == "error"
    assert reply.content.startswith("pre-trade gate: pre_trade_check could not run (")
    assert reply.content.endswith("), so the order is blocked.")


@pytest.mark.parametrize("mode", MODES)
def test_unreadable_order_args_block_the_order(stub_check, mode):
    check = stub_check(FIXTURES["go"])
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode, args={"coin": "BTC", "side": "long"})
    assert calls == []
    assert check.calls == []
    assert reply.status == "error"
    assert "KeyError" in reply.content


@pytest.mark.parametrize("mode", MODES)
def test_an_unknown_decision_blocks_the_order(stub_check, mode):
    stub_check({**FIXTURES["go"], "decision": "MAYBE"})
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode)
    assert calls == []
    assert reply.status == "error"


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("decision", ["go", "caution"])
def test_go_and_caution_run_the_order_once(stub_check, mode, decision):
    result = FIXTURES[decision]
    check = stub_check(result)
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode)
    assert calls == ["place_order"]
    assert len(check.calls) == 1
    assert reply.status != "error"
    assert reply.content.startswith("order accepted (stub)")
    assert av.pass_message("BTC", "long", result) in reply.content
    assert f"decision {result['decision']}" in reply.content


@pytest.mark.parametrize("mode", MODES)
def test_caution_shows_its_reasons(stub_check, mode):
    stub_check(FIXTURES["caution"])
    _, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode)
    assert "reason codes REGIME_AGAINST_SIDE" in reply.content
    assert "cheapest venue BYBIT" in reply.content


@pytest.mark.parametrize("mode", MODES)
def test_a_tool_outside_the_map_runs_unchecked(stub_check, mode):
    check = stub_check(FIXTURES["wait"])
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode, tool_name="get_price", args={"coin": "BTC"})
    assert calls == ["get_price"]
    assert check.calls == []
    assert reply.content == "100"


@pytest.mark.parametrize("mode", MODES)
def test_a_close_runs_unchecked(stub_check, mode):
    check = stub_check(FIXTURES["wait"])
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), mode, args={**ORDER, "reduce_only": True})
    assert calls == ["place_order"]
    assert check.calls == []
    assert reply.content == "order accepted (stub)"


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TESTS") != "1",
    reason="live-gated (set RUN_LIVE_TESTS=1 to hit api.algovault.com/mcp)",
)
def test_live_a_check_through_the_middleware_returns_a_decision(monkeypatch):
    real_check = av.check
    seen = []

    def spy(params, **kwargs):
        result = real_check(params, **kwargs)
        seen.append(result)
        return result

    monkeypatch.setattr(av, "check", spy)
    calls, reply = run_agent(PreTradeGate({"place_order": place_order_check}), "sync")
    assert len(seen) == 1, reply.content
    decision = seen[0]["decision"]
    print(f"live decision: {decision} {av.reason_codes(seen[0])}")
    assert decision in av.DECISIONS
    if decision == "WAIT":
        assert calls == [] and reply.status == "error"
    else:
        assert calls == ["place_order"] and f"decision {decision}" in reply.content
