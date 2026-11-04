"""Tests for examples/_shared/algovault_pre_trade.py, the helper both pre-trade recipes call.

Default (RUN_LIVE_TESTS unset or 0): a stub MCP server on 127.0.0.1 answers initialize and
tools/call; nothing leaves the machine.

Live (RUN_LIVE_TESTS=1): a well-formed key the server does not know is refused, and the
helper raises PreTradeCheckError.
"""

from __future__ import annotations

import asyncio
import json
import os
import pathlib
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
EXAMPLES = pathlib.Path(os.environ.get("PRE_TRADE_EXAMPLES_ROOT") or REPO_ROOT / "examples")
sys.path.insert(0, str(EXAMPLES / "_shared"))

import algovault_pre_trade as av  # noqa: E402

FIXTURES = json.loads((REPO_ROOT / "tests" / "fixtures" / "pre-trade-gate" / "check-results.json").read_text())
PARAMS = {"coin": "BTC", "side": "long", "sizeUsd": 1000}

# Approved wording, filled for BTC long with the WAIT fixture's codes. Never reworded.
COPY_WAIT = (
    "pre-trade gate: pre_trade_check returned WAIT for BTC long "
    "(SIZE_ABOVE_VENUE_LIMIT, FUNDING_COST_HIGH). Execution stopped."
)

INITIALIZE_REPLY = {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {"protocolVersion": "2025-06-18", "capabilities": {"tools": {}}, "serverInfo": {"name": "stub", "version": "0"}},
}


def tool_reply(payload, *, is_error=False, request_id=2):
    result = {"content": [{"type": "text", "text": payload if isinstance(payload, str) else json.dumps(payload)}]}
    if is_error:
        result["isError"] = True
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def sse(message):
    return f"event: message\ndata: {json.dumps(message)}\n\n"


class Stub:
    """A local MCP endpoint. `answer(rpc)` returns (status, content type, body, headers)."""

    def __init__(self):
        self.requests = []
        self.init_headers = {}
        self.answer = lambda rpc: (200, "application/json", json.dumps(tool_reply(FIXTURES["go"])), {})
        stub = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = self.rfile.read(int(self.headers.get("Content-Length") or 0))
                rpc = json.loads(body)
                stub.requests.append({"rpc": rpc, "headers": {k.lower(): v for k, v in self.headers.items()}})
                if rpc.get("method") == "initialize":
                    status, ctype, text, extra = 200, "application/json", json.dumps(INITIALIZE_REPLY), stub.init_headers
                else:
                    status, ctype, text, extra = stub.answer(rpc)
                data = text.encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(data)))
                for name, value in extra.items():
                    self.send_header(name, value)
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}/mcp"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()


@pytest.fixture
def stub(monkeypatch):
    server = Stub()
    monkeypatch.setenv("ALGOVAULT_MCP_URL", server.url)
    monkeypatch.delenv("ALGOVAULT_API_KEY", raising=False)
    yield server
    server.server.shutdown()
    server.server.server_close()


def test_json_reply_returns_the_payload(stub):
    result = av.check(PARAMS)
    assert result["decision"] == "GO"
    methods = [r["rpc"]["method"] for r in stub.requests]
    assert methods == ["initialize", "tools/call"]
    assert stub.requests[1]["rpc"]["params"] == {"name": "pre_trade_check", "arguments": PARAMS}


def test_sse_reply_returns_the_payload(stub):
    stub.answer = lambda rpc: (200, "text/event-stream", sse(tool_reply(FIXTURES["caution"])), {})
    result = av.check(PARAMS)
    assert result["decision"] == "CAUTION"
    assert av.reason_codes(result) == ["REGIME_AGAINST_SIDE"]


def test_acheck_returns_the_payload(stub):
    result = asyncio.run(av.acheck(PARAMS))
    assert result["decision"] == "GO"


def test_the_key_goes_in_a_bearer_header(stub, monkeypatch):
    av.check(PARAMS, api_key="key-from-arg")
    assert [r["headers"].get("authorization") for r in stub.requests] == ["Bearer key-from-arg"] * 2

    stub.requests.clear()
    monkeypatch.setenv("ALGOVAULT_API_KEY", "key-from-env")
    av.check(PARAMS)
    assert [r["headers"].get("authorization") for r in stub.requests] == ["Bearer key-from-env"] * 2

    stub.requests.clear()
    monkeypatch.delenv("ALGOVAULT_API_KEY")
    av.check(PARAMS)
    assert [r["headers"].get("authorization") for r in stub.requests] == [None, None]


def test_every_request_names_its_client(stub):
    """The edge refuses urllib's default User-Agent (Cloudflare 1010); this stub cannot, so assert the header."""
    av.check(PARAMS)
    agents = [r["headers"].get("user-agent") for r in stub.requests]
    assert agents == ["algovault-pre-trade/0.1.0"] * 2


def test_a_session_id_is_sent_only_when_the_server_issues_one(stub):
    av.check(PARAMS)
    assert stub.requests[1]["headers"].get("mcp-session-id") is None  # stateless: none issued, none sent

    stub.requests.clear()
    stub.init_headers = {"mcp-session-id": "session-1"}
    av.check(PARAMS)
    assert stub.requests[1]["headers"].get("mcp-session-id") == "session-1"


@pytest.mark.parametrize(
    "name, answer, needle",
    [
        ("a refusal", lambda rpc: (200, "text/event-stream", sse(tool_reply(FIXTURES["refusal"], is_error=True)), {}), "TIER_LIMIT_REACHED"),
        ("isError with a decision", lambda rpc: (200, "application/json", json.dumps(tool_reply(FIXTURES["go"], is_error=True)), {}), "refused"),
        ("a body that is not JSON", lambda rpc: (200, "application/json", "<html>bad gateway</html>", {}), "could not be parsed"),
        ("no decision", lambda rpc: (200, "application/json", json.dumps(tool_reply({"coin": "BTC"})), {}), "no decision"),
        ("an unknown decision", lambda rpc: (200, "application/json", json.dumps(tool_reply({**FIXTURES["go"], "decision": "MAYBE"})), {}), "no decision"),
        ("a text block that is not JSON", lambda rpc: (200, "application/json", json.dumps(tool_reply("not json")), {}), "no decision"),
        ("a JSON-RPC error", lambda rpc: (200, "application/json", json.dumps({"jsonrpc": "2.0", "id": 2, "error": {"code": -32602, "message": "Invalid params"}}), {}), "Invalid params"),
        ("HTTP 500", lambda rpc: (500, "text/plain", "boom", {}), "HTTP 500"),
        ("an SSE body with no reply", lambda rpc: (200, "text/event-stream", "event: ping\n\n", {}), "no answer"),
        ("a reply to another request", lambda rpc: (200, "application/json", json.dumps(tool_reply(FIXTURES["go"], request_id=99)), {}), "no answer"),
    ],
)
def test_a_check_that_cannot_run_raises(stub, name, answer, needle):
    stub.answer = answer
    with pytest.raises(av.PreTradeCheckError) as caught:
        av.check(PARAMS)
    assert needle in str(caught.value), name


def test_a_server_that_does_not_answer_raises(monkeypatch):
    with socket.socket() as s:  # a port nobody listens on
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    monkeypatch.setenv("ALGOVAULT_MCP_URL", f"http://127.0.0.1:{port}/mcp")
    with pytest.raises(av.PreTradeCheckError, match="could not reach"):
        av.check(PARAMS)


def test_a_slow_server_times_out(stub):
    def slow(rpc):
        time.sleep(1.5)
        return 200, "application/json", json.dumps(tool_reply(FIXTURES["go"])), {}

    stub.answer = slow
    started = time.monotonic()
    with pytest.raises(av.PreTradeCheckError, match="could not reach"):
        av.check(PARAMS, timeout=0.3)
    assert time.monotonic() - started < 1.4


def test_params_must_be_a_dict():
    with pytest.raises(av.PreTradeCheckError):
        av.check("BTC long")


def test_the_wait_message_is_the_approved_copy():
    codes = av.reason_codes(FIXTURES["wait"])
    assert av.wait_message("BTC", "long", codes) == COPY_WAIT
    assert av.wait_message("BTC", "long", []).endswith("(none). Execution stopped.")


def test_the_blocked_and_pass_messages_say_why():
    assert av.blocked_message(av.PreTradeCheckError("HTTP 503 from x")) == (
        "pre-trade gate: pre_trade_check could not run (HTTP 503 from x), so the order is blocked."
    )
    assert "KeyError: 'size_usd'" in av.blocked_message(KeyError("size_usd"))
    note = av.pass_message("BTC", "long", FIXTURES["caution"])
    assert note == (
        "pre-trade gate: BTC long passed pre_trade_check: decision CAUTION, reason codes REGIME_AGAINST_SIDE, "
        "checked size 1000 USD, cheapest venue BYBIT."
    )


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_TESTS") != "1",
    reason="live-gated (set RUN_LIVE_TESTS=1 to hit api.algovault.com/mcp)",
)
def test_live_a_bad_key_raises():
    """A well-formed key the server does not know is refused, not metered."""
    with pytest.raises(av.PreTradeCheckError) as caught:
        av.check(PARAMS, api_key="av_live_" + "0" * 24)
    print(f"bad key: {caught.value}")
    # The server must have read the key: an edge refusal (HTTP 403) would also raise, for another reason.
    assert not str(caught.value).startswith(("HTTP ", "could not reach")), str(caught.value)
