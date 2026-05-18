"""Smoke + live-gated tests for examples/llamaindex/demo.py.

Default (RUN_LIVE_TESTS unset or 0): dry-run only - asserts the demo
imports, parses CLI args, and emits the documented shape from the
fixture.

Live (RUN_LIVE_TESTS=1): calls api.algovault.com/mcp end-to-end.
"""

from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import subprocess
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
DEMO_PATH = REPO_ROOT / "examples" / "llamaindex" / "demo.py"
REQUIRED_KEYS = {"call", "confidence", "indicators", "regime"}


def _load_demo_module():
    spec = importlib.util.spec_from_file_location("llamaindex_demo", DEMO_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_demo_file_exists():
    assert DEMO_PATH.is_file(), f"demo.py not found at {DEMO_PATH}"


def test_demo_module_imports():
    module = _load_demo_module()
    assert hasattr(module, "fetch_trade_call")
    assert hasattr(module, "main")
    assert module.REQUIRED_KEYS == ("call", "confidence", "indicators", "regime")


def test_cli_rejects_missing_args():
    module = _load_demo_module()
    with pytest.raises(SystemExit) as exc_info:
        module._parse_args(["demo.py"])
    assert exc_info.value.code == 2


def test_cli_rejects_unknown_timeframe():
    module = _load_demo_module()
    with pytest.raises(SystemExit) as exc_info:
        module._parse_args(["demo.py", "BTC", "7m"])
    assert exc_info.value.code == 2


def test_cli_accepts_btc_4h():
    module = _load_demo_module()
    coin, timeframe = module._parse_args(["demo.py", "BTC", "4h"])
    assert coin == "BTC"
    assert timeframe == "4h"


def test_cli_normalises_case():
    module = _load_demo_module()
    coin, timeframe = module._parse_args(["demo.py", "btc", "4H"])
    assert coin == "BTC"
    assert timeframe == "4h"


def test_dry_run_emits_required_shape():
    """DRY_RUN=1 path returns the fixture so the demo prints a valid shape
    without needing network or the llama-index-tools-mcp dep installed."""
    env = {**os.environ, "DRY_RUN": "1"}
    proc = subprocess.run(
        [sys.executable, str(DEMO_PATH), "BTC", "4h"],
        env=env,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    payload = json.loads(proc.stdout)
    assert set(payload.keys()) == REQUIRED_KEYS
    assert payload["call"] in {"BUY", "SELL", "HOLD"}
    assert isinstance(payload["confidence"], (int, float))
    assert isinstance(payload["indicators"], dict)
    assert isinstance(payload["regime"], str)


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TESTS") != "1",
    reason="live-gated (set RUN_LIVE_TESTS=1 to hit api.algovault.com/mcp)",
)
def test_live_demo_returns_required_shape():
    """End-to-end against the live MCP server. Requires network."""
    proc = subprocess.run(
        [sys.executable, str(DEMO_PATH), "BTC", "4h"],
        check=True,
        capture_output=True,
        text=True,
        timeout=90,
    )
    payload = json.loads(proc.stdout)
    # Live payload is a strict SUPERSET of the required keys (also carries
    # price, reasoning, timestamp, coin, timeframe, _algovault).
    assert REQUIRED_KEYS.issubset(payload.keys())
    assert payload["call"] in {"BUY", "SELL", "HOLD"}
    assert 0 <= payload["confidence"] <= 100
    assert isinstance(payload["indicators"], dict) and payload["indicators"]
    assert isinstance(payload["regime"], str) and payload["regime"]
