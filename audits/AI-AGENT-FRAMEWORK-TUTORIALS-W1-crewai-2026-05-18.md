# AI-AGENT-FRAMEWORK-TUTORIALS-W1 -- C4 (CrewAI) audit

**Author**: Claude Code (Opus 4.7 1M)
**Date**: 2026-05-18 UTC
**Chapter**: C4 -- CrewAI integration tutorial
**Plan-Mode ratification**: per `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-endpoint-truth.md` Step 0.E Decision 2 -- C4 = CrewAI (recommendation: match NPM-readme-DRAFT.md placeholder + established `crewai-tools` MCP adapter + largest active multi-agent community). OpenHands MCP HALT-class was released, but CrewAI was selected to keep the Cowork-prepared README zero-find-and-replace.

---

## Dependency pinning

| Package | Pinned version | PyPI live | Python constraint |
|---|---|---|---|
| `crewai` | `1.14.4` | `1.14.4` (latest stable, verified 2026-05-18) | `>=3.10, <3.14` |
| `crewai-tools[mcp]` | `1.14.4` | `1.14.4` (latest stable, verified 2026-05-18) | `>=3.10, <3.14` |
| `mcpadapt` | `0.1.20` | resolved transitive via `crewai-tools[mcp]` extra | `>=3.10` |
| `mcp` | `1.26.0` | resolved transitive via `mcpadapt` (`>=1.6.0`) | `>=3.10` |

Demo runs on Python `3.12.13` (the wave's reference interpreter, per the existing langchain C1 verification gate setup). Lower-bound `>=3.10` matches `crewai`'s own floor.

---

## Canonical API surface (verified live from source, not docs)

The `crewai-tools` package's MCP adapter is `MCPServerAdapter`, sourced at `crewai_tools/adapters/mcp_adapter.py` and re-exported at `crewai_tools.__init__`. It delegates to `mcpadapt.MCPAdapt` with a `CrewAIAdapter` (see `mcpadapt/core.py` -- `TRANSPORTS = {"sse": sse_client, "streamable-http": streamablehttp_client, "ws": websocket_client}`).

Canonical connection config (kwargs verified against `mcpadapt.core.mctptools` source):

```python
from crewai_tools import MCPServerAdapter

server_params = {
    "url": "https://api.algovault.com/mcp",
    "transport": "streamable-http",  # HYPHEN (not underscore)
}
with MCPServerAdapter(server_params) as tools:
    # tools is a ToolCollection of CrewAI BaseTool objects
    by_name = {t.name: t for t in tools}
    raw = by_name["get_trade_call"].run(coin="BTC", timeframe="4h",
                                         includeReasoning=False,
                                         exchange="BINANCE")
    payload = json.loads(raw)
```

**Transport kwarg distinguishing note**: CrewAI's adapter uses `"streamable-http"` (HYPHEN); `langchain-mcp-adapters` (C1) uses `"streamable_http"` (UNDERSCORE). Both are documented; do not interchange.

---

## Mid-execution surprise + resolution

**Symptom**: First `tool.run(coin="BTC", timeframe="4h")` call returned a string starting with `MCP error -32602: Input validation error: Invalid arguments for tool get_trade_call: [ {"code":"invalid_type","expected":"boolean","received":"null","path":["includeReasoning"]}, ... ]`.

**Root cause**: `CrewAIAdapter._run` in `mcpadapt/crewai_adapter.py` filters out `None` kwargs ONLY when the schema's `prop_schema.get("type")` is a list containing `"null"` OR `anyOf` includes a `null` option. The AlgoVault MCP `get_trade_call` schema declares `includeReasoning` and `exchange` as `{"anyOf": [{"type": "boolean"}, {"type": "null"}], "default": null}` -- the adapter therefore PASSES `None` through to the upstream MCP. The upstream zod schema (in `crypto-quant-signal-mcp`) accepts these as optional-absent but rejects explicit-null.

**Resolution (no upstream change needed)**: Demo passes concrete non-null defaults `includeReasoning=False, exchange="BINANCE"`. Documented at the call site in `examples/crewai/demo.py` so future readers do not regress. Documented in the tutorial markdown for follow-on `Crew + Agent` snippet users.

**Why not bypass via `tool._run`**: would skip pydantic validation and the call-side `args_schema` enforcement that CrewAI builds. The explicit-defaults path is the cleaner one.

---

## Live verification gate run

Sequence per spec:

```bash
set -e
cd /Users/tank/git/algovault-skills
# (six file-exists tests passed)
python3 -m venv /tmp/c4-venv    # Python 3.12.13
/tmp/c4-venv/bin/pip install -q --upgrade pip
/tmp/c4-venv/bin/pip install -q -r examples/crewai/requirements.txt
/tmp/c4-venv/bin/pip install -q pytest
RUN_LIVE_TESTS=1 /tmp/c4-venv/bin/python examples/crewai/demo.py BTC 4h
RUN_LIVE_TESTS=0 /tmp/c4-venv/bin/pytest tests/integration/test_crewai_demo.py -v
grep -rE 'intelligence layer|powerful|seamless|robust|cutting-edge|industry-leading|Quant LLM|[A-Z]+-W[0-9]+|Binance-clone|outcome_return_pct|phase_e_' docs/integrations/crewai.md examples/crewai/
```

### Demo output (live MCP call against `api.algovault.com/mcp`)

```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {
    "funding_rate": 5.728e-05,
    "funding_24h_avg": 5.728e-05,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8155258784.74,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN"
}
```

`jq -e '.call and .confidence and .indicators and .regime'` -> exit 0 (SHAPE_OK).

### pytest summary

```
collected 6 items
tests/integration/test_crewai_demo.py::test_demo_file_exists PASSED
tests/integration/test_crewai_demo.py::test_demo_module_imports PASSED
tests/integration/test_crewai_demo.py::test_cli_rejects_missing_args PASSED
tests/integration/test_crewai_demo.py::test_cli_accepts_btc_4h PASSED
tests/integration/test_crewai_demo.py::test_dry_run_emits_required_shape PASSED
tests/integration/test_crewai_demo.py::test_live_demo_returns_required_shape SKIPPED
========================= 5 passed, 1 skipped in 0.03s =========================
```

The 1 skipped is the `RUN_LIVE_TESTS=1`-gated end-to-end test (off in default CI; verified manually via the demo run above).

### Forbidden-phrase canary

`grep -rE '...' docs/integrations/crewai.md examples/crewai/` -> NO MATCH. Result: `NO_LEAK`.

### Gate verdict

`CH4_GREEN`.

---

## Brand-voice trap notes (CrewAI marketing language NOT echoed)

CrewAI's own PyPI summary + docs use phrasing that overlaps our `feedback_public_copy_professional_concise.md` forbidden list. Audit of what we did NOT borrow:

| CrewAI marketing phrase | Where they use it | Why forbidden for our copy |
|---|---|---|
| "Cutting-edge framework" | PyPI `crewai` summary | Matches `cutting-edge` in our canary regex |
| "collaborative intelligence" | docs.crewai.com/en/introduction | Matches `intelligence layer` pattern + generic vague-tech marketing |
| "seamlessly" | docs.crewai.com tool-integration section | Matches `seamless` in our canary regex |
| "powerful" | various docs ("powerful AI agents") | Matches `powerful` in our canary regex |

Tutorial copy describes CrewAI in plain neutral terms: "multi-agent orchestration framework", "`Crew` or `Agent` workflow", "LLM-driven tool selection". Pitch lines capped at 2 (opening "AlgoVault MCP gives your CrewAI agents a composite verdict" + closing "Why AlgoVault?" recap).

---

## Submission target -- framework community-hub PR

**Primary target**: `crewAIInc/crewAI-tools` -- the canonical home of the MCP adapter our tutorial uses. Submission path: PR to `docs/` or `README.md`'s integrations/examples list. The repo accepts community contributions; CONTRIBUTING.md present.

**Draft submission body** (ready for merge gate to ship as a PR comment + Discussion announcement):

> **Title**: docs: Add AlgoVault MCP integration example to community examples
>
> **Body**:
> Adds a runnable example showing `MCPServerAdapter` + `streamable-http` transport against [AlgoVault MCP](https://api.algovault.com/mcp) -- a composite BUY/SELL/HOLD trade-call server with a publicly verifiable on-chain track record.
>
> - Tutorial: <https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/crewai.md>
> - Runnable demo: <https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/crewai/demo.py>
> - Provenance verified 2026-05-18 against `crewai==1.14.4` + `crewai-tools[mcp]==1.14.4`.
>
> Direct invocation (no LLM key needed) AND a follow-on `Crew + Agent` snippet are both shown. The demo is gated `RUN_LIVE_TESTS=1` so default test runs do not hit the network. AlgoVault MCP's free tier covers 20 calls/day per IP -- plenty for local exploration.
>
> Happy to adjust the example placement (`docs/examples/`, `README.md` table, or a new community-recipes section) to match maintainer preference.

**Secondary surfaces** (covered by the wave's 4 marketing artifacts at the merge gate, not here):
- GitHub Discussion on `AlgoVaultLabs/crypto-quant-signal-mcp` -- title "v1.14.0 -- Framework integrations live: LangChain · LlamaIndex · AutoGen · CrewAI".
- dev.to draft for the next Autopub Tuesday cron.
- X post via `Xpost.md` queue.

---

## Files written this chapter

| Path | Purpose |
|---|---|
| `docs/integrations/crewai.md` | Tutorial markdown (mirror of C1's structure + CrewAI-specific demo + Crew snippet). |
| `examples/crewai/demo.py` | Runnable Python demo (`python demo.py BTC 4h`); zero-LLM-key direct tool invocation. |
| `examples/crewai/requirements.txt` | Pinned `crewai==1.14.4` + `crewai-tools[mcp]==1.14.4` + transitive `mcpadapt==0.1.20` + `mcp==1.26.0`. |
| `examples/crewai/README.md` | 5-line "How to run" block. |
| `tests/integration/test_crewai_demo.py` | pytest smoke: import + CLI arg-parse + dry-run shape + live-gated end-to-end. |
| `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-crewai-2026-05-18.md` | This file. |

Files NOT touched (per C4 firewall): C1/C2/C3 tutorials/examples/tests; `README.md`; `package.json`; `CHANGELOG.md`; `system-map.md` (merge gate); `landing/`; `scripts/`; anything in `/Users/tank/crypto-quant-signal-mcp/`.

---

## Status

`CH4_GREEN` -- all gates pass. Ready for merge gate consolidation alongside C1 (LangChain, already shipped), C2 (LlamaIndex), and C3 (AutoGen/MAF).
