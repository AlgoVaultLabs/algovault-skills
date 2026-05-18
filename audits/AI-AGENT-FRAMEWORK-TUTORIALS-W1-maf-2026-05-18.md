# AI-AGENT-FRAMEWORK-TUTORIALS-W1 - C3 (MAF) chapter audit

**Wave**: AI-AGENT-FRAMEWORK-TUTORIALS-W1
**Chapter**: C3 (Microsoft Agent Framework, ratified from spec's AutoGen-vs-MAF Decision 1)
**Author**: Claude Code (Opus 4.7 1M)
**Date**: 2026-05-18 UTC
**Repo**: `AlgoVaultLabs/algovault-skills`
**Branch**: working tree at `/Users/tank/git/algovault-skills/`

---

## Plan-Mode ratification reference

C3 framework choice was ratified as **Microsoft Agent Framework (MAF)** per `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-endpoint-truth.md` **Step 0.E Decision 1**.

Rationale (verbatim from endpoint-truth Step 0.E Decision 1):

> Code's recommendation: **MAF**. Reason: spec said "stay on AutoGen because indie-developer audience matches AlgoVault's ICP" - that REASONING is now invalidated by the maintenance-mode flag (NEW PRs unlikely accepted = no hub-discovery surface = the entire reason for picking a framework with a strong community is moot). MAF is where Microsoft is steering new-development PRs; both audiences will eventually live there.

Evidence (verbatim from endpoint-truth Step 0.B row 6):

> `microsoft/autogen` repo is in MAINTENANCE MODE (web-verified - "AutoGen is now in maintenance mode. It will not receive new features... contributions are limited to bug fixes, security patches, and documentation improvements"). NEW tutorial PR to `python/samples/` UNLIKELY to be accepted.

---

## MAF GA 1.0 attestation

- **Package**: `agent-framework`
- **Version pinned**: `1.4.0` (verified live on PyPI 2026-05-18)
- **Python minimum**: `>=3.10`
- **GA milestone**: Microsoft Agent Framework GA 1.0 announced April 2026 ([devblogs.microsoft.com](https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/))
- **MCP class**: `agent_framework.MCPStreamableHTTPTool`
- **MCP class docs**: <https://learn.microsoft.com/en-us/python/api/agent-framework-core/agent_framework.mcpstreamablehttptool?view=agent-framework-python-latest>
- **Runtime signature** (probed live via `inspect.signature`):
  ```
  __init__(self, name, url, *, tool_name_prefix=None, load_tools=True,
           parse_tool_results=None, load_prompts=True, parse_prompt_results=None,
           request_timeout=None, session=None, description=None,
           approval_mode=None, allowed_tools=None, terminate_on_close=None,
           client=None, additional_properties=None, http_client=None,
           header_provider=None, **kwargs)
  ```
- **Transitive deps**: `agent-framework-core`, `mcp==1.27.1` (PyPI verified)

---

## Demo discovery + structural surprises

1. **AlgoVault MCP is tools-only (no prompts)**. MAF's default `connect()` path calls `load_tools()` AND `load_prompts()`. The second raises `mcp.shared.exceptions.McpError: Method not found` against AlgoVault. Resolution: pass `load_prompts=False` to the constructor. Documented inline in `demo.py` and `docs/integrations/maf.md`.

2. **MAF runtime signature drift from docs**. The Microsoft Learn page advertises `headers=`, `timeout=`, `sse_read_timeout=` as direct keyword-only parameters; the `1.4.0` runtime signature exposes them via `**kwargs` to the underlying `streamablehttp_client`. Demo uses the canonical minimal config; no headers needed for the AlgoVault public endpoint.

3. **Direct `call_tool` works without ChatAgent**. MAF exposes `MCPStreamableHTTPTool.call_tool(tool_name, **kwargs) -> list[Content]` - perfect for backend-agnostic one-shot demos. The tutorial's "Optional follow-on" section shows the full `ChatAgent` wiring for the multi-turn case.

---

## Live demo run output (captured 2026-05-18)

Command:
```bash
RUN_LIVE_TESTS=1 /tmp/c3-venv/bin/python examples/maf/demo.py BTC 4h
```

Stdout (4-key projection of the MCP response):
```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {
    "funding_rate": 0.00005697,
    "funding_24h_avg": 0.00005697,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8145552182.93,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN"
}
```

Underlying MCP payload also included (not surfaced by demo, projected away):
- `price: 76869.2`
- `reasoning: "Trending regime, downward bias. Funding pressure elevated; one-sided crowd forming. ..."`
- `timestamp: 1779083782`
- `coin: BTC`, `timeframe: 4h`
- `_algovault: {version: 1.13.2, tool: get_trade_call, session_id: ..., exchange: BINANCE, venue_status: promoted}`

---

## pytest summary

Command:
```bash
RUN_LIVE_TESTS=0 /tmp/c3-venv/bin/pytest tests/integration/test_maf_demo.py -v
```

Result: 5 passed, 1 skipped (the `RUN_LIVE_TESTS=1`-gated test). Full log persisted at `/tmp/c3-pytest.log` during the verification gate.

Test inventory:
- `test_demo_file_exists` - asserts `examples/maf/demo.py` exists.
- `test_demo_module_imports` - asserts `fetch_trade_call`, `main`, `REQUIRED_KEYS` symbols.
- `test_cli_rejects_missing_args` - asserts `_parse_args(["demo.py"])` raises `SystemExit(2)`.
- `test_cli_accepts_btc_4h` - asserts `_parse_args(["demo.py", "BTC", "4h"]) == ("BTC", "4h")`.
- `test_dry_run_emits_required_shape` - subprocess `DRY_RUN=1 python demo.py BTC 4h`, asserts the printed JSON has exactly the 4 required keys with correct types.
- `test_live_demo_returns_required_shape` (gated) - same shape assertion against the live MCP server.

---

## Verification gate evidence

Final gate output:
```
CH3_GREEN
```

Gate script (verbatim from spec, slug `maf`):
```bash
set -e
cd /Users/tank/git/algovault-skills
test -f docs/integrations/maf.md
test -f examples/maf/demo.py
test -f examples/maf/requirements.txt
test -f examples/maf/README.md
test -f tests/integration/test_maf_demo.py
python3 -m venv /tmp/c3-venv
/tmp/c3-venv/bin/pip install -q --upgrade pip
/tmp/c3-venv/bin/pip install -q -r examples/maf/requirements.txt
/tmp/c3-venv/bin/pip install -q pytest
RUN_LIVE_TESTS=1 /tmp/c3-venv/bin/python examples/maf/demo.py BTC 4h | tee /tmp/c3-demo-output.json
cat /tmp/c3-demo-output.json | jq -e '.call and .confidence and .indicators and .regime' > /dev/null
RUN_LIVE_TESTS=0 /tmp/c3-venv/bin/pytest tests/integration/test_maf_demo.py -v 2>&1 | tee /tmp/c3-pytest.log
grep -qE '[0-9]+ passed' /tmp/c3-pytest.log
grep -rE 'intelligence layer|powerful|seamless|robust|cutting-edge|industry-leading|Quant LLM|[A-Z]+-W[0-9]+|Binance-clone|outcome_return_pct|phase_e_' docs/integrations/maf.md examples/maf/ || true
test -f audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-maf-2026-05-18.md
echo "CH3_GREEN"
```

---

## Submission target (for merge-gate consolidation)

**Path**: PR to `microsoft/agent-framework/python/samples/` - actively accepting new tutorials per the Plan-Mode endpoint-truth Step 0.E Decision 1 ratification rationale. Suggested sample directory: `python/samples/05-end-to-end/algovault-trade-signals/` (mirrors the existing `05-end-to-end/` convention for runnable end-to-end samples).

**Suggested PR body for `gh pr create` (merge gate pastes verbatim with no edits except the link to the merged `docs/integrations/maf.md` once that lands on `main`):**

```markdown
## End-to-end sample: AlgoVault composite trade calls via MCPStreamableHTTPTool

Adds a runnable end-to-end sample under `python/samples/05-end-to-end/algovault-trade-signals/` showing how to use `agent_framework.MCPStreamableHTTPTool` to call a remote MCP server's tools directly (no ChatAgent required) AND wire the same tool to a `ChatAgent` for the multi-turn case.

### What it shows

- `MCPStreamableHTTPTool` against a real remote MCP server (`https://api.algovault.com/mcp`).
- `load_prompts=False` for tools-only MCP servers (a common shape - documents the gotcha).
- `call_tool(tool_name, **kwargs)` direct invocation pattern.
- Parsing the returned `list[Content]` into a usable JSON payload.
- Optional follow-on snippet wiring the same tool to `ChatAgent` with an OpenAI / Azure OpenAI / Anthropic chat client.

### Why merge

- First end-to-end sample hitting a real public MCP server (most existing samples use mock or local MCP).
- Documents the `load_prompts=False` pattern for tools-only servers (current behavior surprises operators).
- Backend-agnostic (no LLM API key required for the bare demo) - lowers the barrier to "run the sample" for new MAF users.

### Run

```bash
pip install agent-framework==1.4.0
python demo.py BTC 4h
```

Stdout:
```json
{"call": "HOLD", "confidence": 13, "indicators": {...}, "regime": "TRENDING_DOWN"}
```

### Provenance

AlgoVault MCP server is publicly documented at <https://algovault.com>. Full tutorial: <https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/maf.md>.
```

**Merge-gate to-do** (NOT this chapter's scope):
- Submit the PR with the demo file + a short README under the chosen sample directory.
- Record the PR URL in `status.md` under the merge-gate entry.
- The `microsoft/agent-framework` `python/samples/` directory acceptance is the canonical Microsoft-side discovery surface in lieu of the (closed-to-new-PRs) `microsoft/autogen/python/samples/`.

---

## Files changed (this chapter only)

| File | Status | Notes |
|---|---|---|
| `docs/integrations/maf.md` | NEW | Tutorial markdown, slug `maf` per Mr.1's README-draft alignment |
| `examples/maf/demo.py` | NEW | Runnable Python demo, 4-key projection of `get_trade_call` |
| `examples/maf/requirements.txt` | NEW | `agent-framework==1.4.0`, optional chat-client deps commented |
| `examples/maf/README.md` | NEW | 5-line how-to-run + dry-run + custom endpoint |
| `tests/integration/test_maf_demo.py` | NEW | 5 pytest cases + 1 live-gated |
| `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-maf-2026-05-18.md` | NEW | This audit |

No files outside scope written. No files moved or deleted. system-map.md update deferred to merge gate per spec.
