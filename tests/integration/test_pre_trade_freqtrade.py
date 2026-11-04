"""Tests for examples/freqtrade/algovault_gate.py.

Default (RUN_LIVE_TESTS unset or 0): the mixin on a stand-in for IStrategy (no Freqtrade
install), with pre_trade_check stubbed and the endpoint pointed at a closed local port.

Live (RUN_LIVE_TESTS=1): one real check through confirm_trade_entry in dry-run mode
(ALGOVAULT_API_KEY, when set).
"""

from __future__ import annotations

import ast
import importlib.util
import json
import logging
import os
import pathlib
import sys
from datetime import datetime, timezone

import pytest

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


gate_module = _load("algovault_gate", EXAMPLES / "freqtrade" / "algovault_gate.py")
FIXTURES = json.loads((REPO_ROOT / "tests" / "fixtures" / "pre-trade-gate" / "check-results.json").read_text())


class RunMode:
    """Freqtrade's RunMode is a StrEnum; the mixin reads `.value` like Freqtrade code does."""

    def __init__(self, value):
        self.value = value


class StandInIStrategy:
    """IStrategy's own confirm_trade_entry returns True."""

    def confirm_trade_entry(self, *args, **kwargs):
        return True


class Strategy(gate_module.AlgoVaultPreTradeGate, StandInIStrategy):
    def __init__(self, runmode="dry_run"):
        self.config = {"runmode": RunMode(runmode)}


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


def confirm(strategy, *, pair="BTC/USDT:USDT", side="long", amount=0.5, rate=60000.0, order_type="limit"):
    return strategy.confirm_trade_entry(
        pair=pair,
        order_type=order_type,
        amount=amount,
        rate=rate,
        time_in_force="GTC",
        current_time=datetime.now(timezone.utc),
        entry_tag=None,
        side=side,
    )


def test_the_mixin_calls_the_helper_the_tests_stub():
    assert gate_module.algovault_pre_trade is av


def test_wait_skips_the_entry(stub_check, caplog):
    check = stub_check(FIXTURES["wait"])
    with caplog.at_level(logging.WARNING):
        assert confirm(Strategy()) is False
    assert len(check.calls) == 1
    assert (
        "pre-trade gate: pre_trade_check returned WAIT for BTC long "
        "(SIZE_ABOVE_VENUE_LIMIT, FUNDING_COST_HIGH). Execution stopped."
    ) in caplog.text


@pytest.mark.parametrize(
    "error",
    [av.PreTradeCheckError("HTTP 503 from x"), RuntimeError("helper crashed"), TimeoutError("slow")],
    ids=["check-error", "unexpected-error", "timeout"],
)
def test_a_check_that_cannot_run_skips_the_entry(stub_check, error):
    stub_check(error=error)
    assert confirm(Strategy()) is False


def test_an_unknown_decision_skips_the_entry(stub_check):
    stub_check({**FIXTURES["go"], "decision": "MAYBE"})
    assert confirm(Strategy()) is False


@pytest.mark.parametrize("decision", ["go", "caution"])
def test_go_and_caution_enter(stub_check, decision, caplog):
    check = stub_check(FIXTURES[decision])
    with caplog.at_level(logging.INFO):
        assert confirm(Strategy()) is True
    assert len(check.calls) == 1
    assert av.pass_message("BTC", "long", FIXTURES[decision]) in caplog.text


@pytest.mark.parametrize("runmode", ["backtest", "hyperopt", "plot", "webserver", "other"])
def test_outside_live_and_dry_run_it_enters_with_no_call(stub_check, runmode):
    check = stub_check(FIXTURES["wait"])
    assert confirm(Strategy(runmode)) is True
    assert check.calls == []


@pytest.mark.parametrize("runmode", ["live", "dry_run"])
def test_live_and_dry_run_are_checked(stub_check, runmode):
    check = stub_check(FIXTURES["wait"])
    assert confirm(Strategy(runmode)) is False
    assert len(check.calls) == 1


def test_an_unreadable_runmode_skips_the_entry(stub_check):
    check = stub_check(FIXTURES["go"])
    strategy = Strategy()
    strategy.config = {}
    assert confirm(strategy) is False
    assert check.calls == []


def test_the_check_reads_the_order(stub_check):
    check = stub_check(FIXTURES["go"])
    confirm(Strategy(), pair="BTC/USDT:USDT", side="short", amount=0.5, rate=60000.0, order_type="market")
    assert check.calls == [{"coin": "BTC", "side": "short", "sizeUsd": 30000.0, "holdHours": 8, "orderType": "market"}]


def test_the_hold_window_is_a_strategy_setting(stub_check):
    check = stub_check(FIXTURES["go"])

    class LongerHold(Strategy):
        algovault_hold_hours = 24

    confirm(LongerHold())
    assert check.calls[0]["holdHours"] == 24


@pytest.mark.parametrize(
    "pair, coin",
    [
        ("BTC/USDT:USDT", "BTC"),
        ("ETH/USDC:USDC", "ETH"),
        ("1000PEPE/USDT:USDT", "PEPE"),
        ("1000000MOG/USDT:USDT", "MOG"),
        ("kPEPE/USDC:USDC", "PEPE"),
        ("KAVA/USDT:USDT", "KAVA"),
    ],
)
def test_the_pair_s_base_coin_is_checked(stub_check, pair, coin):
    check = stub_check(FIXTURES["go"])
    confirm(Strategy(), pair=pair)
    assert check.calls[0]["coin"] == coin


def test_a_spot_pair_enters_unchecked(stub_check):
    check = stub_check(FIXTURES["wait"])
    assert confirm(Strategy(), pair="BTC/USDT") is True
    assert check.calls == []


@pytest.mark.parametrize("field, value", [("side", "buy"), ("order_type", "stop")])
def test_an_unknown_side_or_order_type_skips_the_entry(stub_check, field, value):
    check = stub_check(FIXTURES["go"])
    assert confirm(Strategy(), **{field: value}) is False
    assert check.calls == []


def test_a_base_class_veto_still_applies(stub_check):
    stub_check(FIXTURES["go"])

    class Vetoing(StandInIStrategy):
        def confirm_trade_entry(self, *args, **kwargs):
            return False

    class Gated(gate_module.AlgoVaultPreTradeGate, Vetoing):
        def __init__(self):
            self.config = {"runmode": RunMode("dry_run")}

    assert confirm(Gated()) is False


def test_the_sample_strategy_puts_the_gate_before_istrategy():
    path = EXAMPLES / "freqtrade" / "GatedStrategy.py"
    source = path.read_text()
    compile(source, str(path), "exec")  # a syntax error fails here; Freqtrade is not installed
    tree = ast.parse(source)
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == "GatedStrategy"]
    assert len(classes) == 1
    assert [base.id for base in classes[0].bases] == ["AlgoVaultPreTradeGate", "IStrategy"]


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TESTS") != "1",
    reason="live-gated (set RUN_LIVE_TESTS=1 to hit api.algovault.com/mcp)",
)
def test_live_a_check_through_confirm_trade_entry_returns_a_decision(monkeypatch):
    real_check = av.check
    seen = []

    def spy(params, **kwargs):
        result = real_check(params, **kwargs)
        seen.append(result)
        return result

    monkeypatch.setattr(av, "check", spy)
    entered = confirm(Strategy("dry_run"), amount=0.01, rate=100000.0)
    assert len(seen) == 1
    print(f"live decision: {seen[0]['decision']} {av.reason_codes(seen[0])}")
    assert seen[0]["decision"] in av.DECISIONS
    assert entered is (seen[0]["decision"] != "WAIT")
