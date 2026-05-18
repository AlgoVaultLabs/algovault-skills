# C2 Audit — LlamaIndex integration tutorial

**Chapter**: C2 of AI-AGENT-FRAMEWORK-TUTORIALS-W1 (Tier 2 Bulk-Spec)
**Date**: 2026-05-18 UTC
**Author**: Claude Code (Opus 4.7 1M)
**Repo**: `algovault-skills` at `/Users/tank/git/algovault-skills/`
**Verdict**: CH2_GREEN

---

## Library versions probed (live PyPI, 2026-05-18)

| Package | Version pinned | Source |
|---|---|---|
| `llama-index-tools-mcp` | `==0.4.8` | `curl https://pypi.org/pypi/llama-index-tools-mcp/json` -> `.info.version` |
| `llama-index-core` | `>=0.14.0,<2.0.0` | Transitive from `llama-index-tools-mcp==0.4.8` `requires_dist` |
| `mcp` | `>=1.9.2` | Transitive from `llama-index-tools-mcp==0.4.8` `requires_dist` |
| Python | `>=3.10,<4.0` | `llama-index-tools-mcp==0.4.8` `requires_python` |

Resolved at install time (verification gate venv `/tmp/c2-venv`, Python 3.11.15):

```
anyio                       4.13.0
httpx                       0.28.1
httpx-sse                   0.4.3
llama-index-core            0.14.22
llama-index-instrumentation 0.5.0
llama-index-tools-mcp       0.4.8
llama-index-workflows       2.20.0
mcp                         1.27.1
pydantic                    2.13.4
pydantic-settings           2.14.1
pydantic_core               2.46.4
pytest                      9.0.3
```

Optional follow-on dep (commented in `requirements.txt`, only needed for the `FunctionAgent` snippet in the tutorial):

- `llama-index-llms-anthropic>=0.5.0`

---

## Live demo run output (captured `/tmp/c2-demo-output.json`)

Invocation:

```bash
RUN_LIVE_TESTS=1 /tmp/c2-venv/bin/python examples/llamaindex/demo.py BTC 4h
```

End-to-end against `https://api.algovault.com/mcp` (signal-MCP v1.13.2 in production):

```json
{
  "call": "HOLD",
  "confidence": 13,
  "price": 76854.9,
  "indicators": {
    "funding_rate": 5.697e-05,
    "funding_24h_avg": 5.697e-05,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8148510285.19,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN",
  "reasoning": "Trending regime, downward bias. Funding pressure elevated; one-sided crowd forming. Volatility neither expanding nor compressed. Trend persistence balanced. No actionable setup at this snapshot.",
  "timestamp": 1779083995,
  "coin": "BTC",
  "timeframe": "4h",
  "_algovault": {
    "version": "1.13.2",
    "tool": "get_trade_call",
    "compatible_with": ["crypto-quant-risk-mcp", "crypto-quant-backtest-mcp"],
    "session_id": "9849ea0d-adf1-4a0c-990d-6f87c0fbc980",
    "exchange": "BINANCE",
    "venue_status": "promoted"
  }
}
```

Shape check: `jq -e '.call and .confidence and .indicators and .regime'` -> `true`. Demo exits 0.

The live payload is a strict superset of the documented 4-key contract; consumer code reads only the 4 declared keys (see `docs/integrations/llamaindex.md` Sample output section).

---

## pytest summary

```
RUN_LIVE_TESTS=0 /tmp/c2-venv/bin/pytest tests/integration/test_llamaindex_demo.py -v
========================= 7 passed, 1 skipped in 0.05s =========================
```

- `test_demo_file_exists` — PASS
- `test_demo_module_imports` — PASS (asserts `fetch_trade_call`, `main`, `REQUIRED_KEYS` exposed)
- `test_cli_rejects_missing_args` — PASS (asserts `SystemExit(2)` on missing args)
- `test_cli_rejects_unknown_timeframe` — PASS (asserts `SystemExit(2)` on `7m`)
- `test_cli_accepts_btc_4h` — PASS (arg parser returns `('BTC', '4h')`)
- `test_cli_normalises_case` — PASS (`btc 4H` -> `('BTC', '4h')`)
- `test_dry_run_emits_required_shape` — PASS (subprocess with `DRY_RUN=1` returns the documented `{call, confidence, indicators, regime}` shape)
- `test_live_demo_returns_required_shape` — SKIPPED (live-gated; runs only under `RUN_LIVE_TESTS=1`)

Live mode was also exercised manually during this audit and returned the documented shape (see capture above).

---

## Forbidden-phrase canary

```bash
grep -rE 'intelligence layer|powerful|seamless|robust|cutting-edge|industry-leading|Quant LLM|[A-Z]+-W[0-9]+|Binance-clone|outcome_return_pct|phase_e_' \
  docs/integrations/llamaindex.md examples/llamaindex/
```

Exit 1 (grep no matches) — canary green across both the tutorial markdown and the entire `examples/llamaindex/` directory. No wave IDs, no brand-voice traps, no internal-detail leaks.

---

## Files created (Scope adherence)

| Path | Purpose | Lines |
|---|---|---|
| `docs/integrations/llamaindex.md` | Tutorial markdown (mirrors `binance.md` template) | 132 |
| `examples/llamaindex/demo.py` | Runnable CLI demo | 115 |
| `examples/llamaindex/requirements.txt` | Pinned dependencies | 11 |
| `examples/llamaindex/README.md` | 5-line how-to-run | 11 |
| `tests/integration/test_llamaindex_demo.py` | dry-run + live-gated tests | 108 |
| `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-llamaindex-2026-05-18.md` | This audit | — |

`tests/integration/__init__.py` already created by C1; NOT modified.

Files outside Scope: none touched. Firewall held.

---

## LlamaHub PR-acceptance policy change (CRITICAL — for future framework waves)

The Plan Mode artifact's flag `L (SUBMISSION-PATH-PIVOT)` was confirmed against the live `run-llama/llama_index` repo. Quoting verbatim from <https://raw.githubusercontent.com/run-llama/llama_index/main/CONTRIBUTING.md> (probed 2026-05-18):

> "While we welcome contributions, **we are no longer accepting new integration packages** in this repository. New integrations should be maintained in their own repositories and published to PyPI independently. PRs that add a new `pyproject.toml` will be automatically closed."

**Implication for this chapter**: the spec's AC-C1-5 analog ("LlamaHub PR drafted; URL recorded for merge gate") is **NOT applicable for C2**. There is no monorepo PR to file. C2's submission path is one of the two community-discovery options drafted below — both are ready for the merge gate to pick.

**Implication for future framework waves**: every chapter that planned a "PR to upstream monorepo" submission step needs a Plan-Mode probe of the target repo's CONTRIBUTING.md (or equivalent integration-submission policy doc) BEFORE crafting the PR. The list of frameworks with confirmed "no new integration packages" policies as of 2026-05-18 includes:

- **LlamaIndex** (`run-llama/llama_index`) — verbatim quote above.
- **AutoGen** (`microsoft/autogen`) — README states the repo is in maintenance mode; new contributions limited to "bug fixes, security patches, and documentation improvements" (per Plan Mode endpoint-truth artifact probe #6).

The pattern (upstream monorepos closing to new integration packages and pushing maintainers to independent repos + PyPI) is sector-wide. Future waves should grep for `pyproject.toml will be automatically closed` or `maintenance mode` in CONTRIBUTING.md / README.md as a structural pre-check.

---

## Submission-path drafts (both ready for merge-gate pick)

Per the LlamaHub policy-change finding above, C2 prepares two community-discovery surfaces. The merge gate (or Mr.1) picks one or both for actual shipping.

### Option A — Community blog post

**Target**: `https://blog.llamaindex.ai` (community submissions accepted via the official LlamaIndex Discord `#blog` channel — DM a moderator with the draft).

**Suggested title**:

> Wiring AlgoVault MCP into a LlamaIndex Agent in 30 Lines

**Draft body** (paste into the blog submission form, or publish directly to dev.to / Medium as a fallback):

````markdown
# Wiring AlgoVault MCP into a LlamaIndex Agent in 30 Lines

LlamaIndex's `llama-index-tools-mcp` package gives you a one-line bridge to any MCP server. This walkthrough wires a publicly-hosted MCP server — [AlgoVault](https://algovault.com) — into a LlamaIndex agent and gets a composite BUY/SELL/HOLD trade call across 5 crypto perp venues in 30 lines of Python.

AlgoVault returns one composite verdict per call: `call`, `confidence`, `regime`, and a bundle of indicators (funding state, trend persistence, breakout pending, etc.) — fused across Binance, Bybit, OKX, Bitget, and Hyperliquid. Every signal is Merkle-anchored on Base L2 ([agentId 44544](https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=44544)); you can verify the full track record at <https://algovault.com/track-record>.

## Setup

```bash
pip install llama-index-tools-mcp==0.4.8
```

Requires Python >= 3.10.

## The 30-line script

```python
import asyncio
import json
from llama_index.tools.mcp import BasicMCPClient


async def fetch_trade_call(coin: str, timeframe: str) -> dict:
    client = BasicMCPClient("https://api.algovault.com/mcp")
    result = await client.call_tool(
        "get_trade_call", {"coin": coin, "timeframe": timeframe}
    )
    return json.loads(result.content[0].text)


if __name__ == "__main__":
    payload = asyncio.run(fetch_trade_call("BTC", "4h"))
    print(json.dumps(payload, indent=2))
```

## Output

```json
{
  "call": "HOLD",
  "confidence": 13,
  "regime": "TRENDING_DOWN",
  "indicators": {
    "funding_state": "ELEVATED",
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  }
}
```

## Wiring it into a FunctionAgent

Use `McpToolSpec` to adapt the 4 AlgoVault tools to LlamaIndex `FunctionTool` objects and hand them to a `FunctionAgent`:

```python
from llama_index.tools.mcp import BasicMCPClient, McpToolSpec
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.anthropic import Anthropic

client = BasicMCPClient("https://api.algovault.com/mcp")
spec = McpToolSpec(client=client)
tools = await spec.to_tool_list_async()

agent = FunctionAgent(
    tools=tools,
    llm=Anthropic(model="claude-sonnet-4-5"),
    system_prompt="Use the AlgoVault tools to answer trading questions.",
)
response = await agent.run("Get a trade call for BTC on the 4h timeframe.")
```

Full walkthrough + runnable script: <https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/llamaindex.md>.
````

### Option B — GitHub Discussion on `run-llama/llama_index`

**Target**: <https://github.com/run-llama/llama_index/discussions> (category: `Show and tell` or `Community`).

**Suggested title**:

> Show and tell: AlgoVault MCP — composite crypto trade calls for your LlamaIndex agent

**Draft body**:

````markdown
Sharing a tutorial + runnable demo wiring AlgoVault MCP into a LlamaIndex agent.

**What AlgoVault is**: a publicly-hosted MCP server returning composite BUY/SELL/HOLD trade calls across 5 crypto perp venues (Binance, Bybit, OKX, Bitget, Hyperliquid). Every signal is Merkle-anchored on Base L2 ([agentId 44544](https://basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=44544)) — you can verify the full track record at <https://algovault.com/track-record>.

**What the tutorial covers**: connecting via `BasicMCPClient` (streamable HTTP), the 4 tools (`get_trade_call`, `get_trade_signal`, `scan_funding_arb`, `get_market_regime`), and an optional `FunctionAgent` wiring with `McpToolSpec`.

**Try it**:

```bash
pip install llama-index-tools-mcp==0.4.8
python -c "
import asyncio, json
from llama_index.tools.mcp import BasicMCPClient

async def main():
    client = BasicMCPClient('https://api.algovault.com/mcp')
    result = await client.call_tool('get_trade_call', {'coin': 'BTC', 'timeframe': '4h'})
    print(json.dumps(json.loads(result.content[0].text), indent=2))

asyncio.run(main())
"
```

Full walkthrough + runnable script: <https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/llamaindex.md>.

Happy to answer questions about MCP streamable-HTTP transport quirks, the `McpToolSpec` -> `FunctionTool` adapter, or AlgoVault's verification model.
````

**Submission status**: `drafts ready for merge-gate selection`. Merge gate picks Option A (blog) for broader discovery OR Option B (Discussion) for lower-friction shipping. Both can ship.

---

## Frozen upstream contracts honored (from C2 brief)

- Canonical 1-liner: present in tutorial intro (verbatim, <=20 words).
- `https://api.algovault.com/mcp`: present in tutorial + demo + sample-output + both submission-path drafts.
- 4 live tools enumerated in tutorial table (`get_trade_call`, `get_trade_signal`, `scan_funding_arb`, `get_market_regime`).
- Live-bind spans for all 4 stats: `<span data-tr-field="pfe_wr">90.47%</span>`, `<span data-tr-field="total_calls">96,864</span>`, `<span data-tr-field="merkle_batches">38</span>`, `<span data-tr-field="asset_count">738</span>`.
- 5 venues in canonical order: "Binance, Bybit, OKX, Bitget, Hyperliquid".
- ERC-8004 agentId 44544 cross-link to Basescan.
- Snapshot date 2026-05-18 in both snapshot-comment blocks.

---

## Notes for merge gate

- `BasicMCPClient.call_tool(tool_name, arguments)` returns an `mcp.types.CallToolResult` with `.content` as a list of `TextContent` blocks. The demo's `_extract_payload` helper reads `result.content[0].text` and `json.loads()` it — the same shape AlgoVault's MCP server has emitted across the entire v1.13.x line. If a future signal-MCP version changes the content-block shape, the test `test_live_demo_returns_required_shape` will fail at the live edge.
- The optional follow-on `FunctionAgent` snippet in the tutorial references `claude-sonnet-4-5` as the example model and `llama-index-llms-anthropic` as the LLM adapter — swap for whichever LlamaIndex LLM adapter the reader has an API key for. Snippet is reference-only; demo.py does NOT depend on any chat model.
- `BasicMCPClient(url)` selects streamable HTTP transport for any `http(s)://...` URL whose path does NOT end in `/sse` (per `enable_sse()` source in `llama_index.tools.mcp.client`). The AlgoVault endpoint `/mcp` falls into the streamable-HTTP bucket — no transport flag needed.
