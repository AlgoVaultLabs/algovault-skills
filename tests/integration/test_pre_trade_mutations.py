"""Proves the pre-trade recipe tests can fail.

Each mutation breaks one safety property in a COPY of examples/_shared, examples/langchain
and examples/freqtrade, and the recipe tests, pointed at that copy through
PRE_TRADE_EXAMPLES_ROOT, must fail (pytest exit 1, not a crash). The unmutated copy must
pass, so a failure comes from the mutation and not from the copying. A mutation whose
target text is not found exactly once fails here: a refactor has to move the mutation
with the code, never skip it. The runs never go live.
"""

from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
EXAMPLES = REPO_ROOT / "examples"
SUITE = [
    REPO_ROOT / "tests" / "integration" / "test_pre_trade_helper.py",
    REPO_ROOT / "tests" / "integration" / "test_pre_trade_langchain.py",
    REPO_ROOT / "tests" / "integration" / "test_pre_trade_freqtrade.py",
]
_SYNC_CHECK = "algovault_pre_trade.check(params, api_key=self.api_key, timeout=self.timeout)"
_ASYNC_CHECK = "algovault_pre_trade.acheck(params, api_key=self.api_key, timeout=self.timeout)"
_ERROR_PATH = (
    "\n        except Exception as exc:  # fail closed: a check that cannot run blocks the order"
    "\n            return _blocked(request, algovault_pre_trade.blocked_message(exc))"
)
_ERROR_PATH_CALLS = "\n        except Exception as exc:  # fail closed: a check that cannot run blocks the order\n            return "

MUTATIONS = {
    "the error path calling the handler": [
        ("langchain/pre_trade_gate.py", _SYNC_CHECK + _ERROR_PATH, _SYNC_CHECK + _ERROR_PATH_CALLS + "handler(request)"),
        ("langchain/pre_trade_gate.py", _ASYNC_CHECK + _ERROR_PATH, _ASYNC_CHECK + _ERROR_PATH_CALLS + "await handler(request)"),
    ],
    "WAIT returning True": [
        (
            "freqtrade/algovault_gate.py",
            'logger.warning(algovault_pre_trade.wait_message(params["coin"], side, codes))\n            return False',
            'logger.warning(algovault_pre_trade.wait_message(params["coin"], side, codes))\n            return True',
        ),
    ],
    "the runmode guard removed": [
        (
            "freqtrade/algovault_gate.py",
            '            if getattr(runmode, "value", runmode) not in TRADE_MODES:\n                return True\n',
            "",
        ),
    ],
}


def _copy(edits):
    """A copy of the three example folders with `edits` applied; returns its examples root."""
    root = pathlib.Path(tempfile.mkdtemp(prefix="ptg-py-mut-")) / "examples"
    for name in ("_shared", "langchain", "freqtrade"):
        shutil.copytree(EXAMPLES / name, root / name, ignore=shutil.ignore_patterns("__pycache__"))
    for relative, old, new in edits:
        path = root / relative
        source = path.read_text()
        count = source.count(old)
        if count != 1:
            raise AssertionError(f"mutation target found {count} times in {relative}, expected exactly 1:\n{old}")
        path.write_text(source.replace(old, new))
    return root


def _run(edits):
    root = _copy(edits)
    env = {**os.environ, "PRE_TRADE_EXAMPLES_ROOT": str(root), "PYTHONDONTWRITEBYTECODE": "1"}
    env.pop("RUN_LIVE_TESTS", None)
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *map(str, SUITE)],
        cwd=REPO_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=300,
    )
    return proc.returncode, proc.stdout[-3000:] + proc.stderr[-2000:]


@pytest.fixture(scope="module")
def results():
    runs = {"control (no mutation)": [], **MUTATIONS}
    with ThreadPoolExecutor(max_workers=len(runs)) as pool:
        futures = {name: pool.submit(_run, edits) for name, edits in runs.items()}
        return {name: future.result() for name, future in futures.items()}


def test_control_the_unmutated_copy_passes(results):
    code, out = results["control (no mutation)"]
    assert code == 0, f"the control run failed, so a mutation failure would mean nothing:\n{out}"


@pytest.mark.parametrize("name", list(MUTATIONS))
def test_mutation_fails_the_suite(results, name):
    code, out = results[name]
    assert code == 1, f'"{name}" applied: expected failing tests (exit 1), got exit {code}:\n{out}'
