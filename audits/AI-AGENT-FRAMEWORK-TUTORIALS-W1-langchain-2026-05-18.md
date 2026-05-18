# C1 Audit — LangChain integration tutorial

**Chapter**: C1 of AI-AGENT-FRAMEWORK-TUTORIALS-W1 (Tier 2 Bulk-Spec)
**Date**: 2026-05-18 UTC
**Author**: Claude Code (Opus 4.7 1M)
**Repo**: `algovault-skills` at `/Users/tank/git/algovault-skills/`
**Verdict**: CH1_GREEN

---

## Library versions probed (live PyPI, 2026-05-18)

| Package | Version pinned | Source |
|---|---|---|
| `langchain-mcp-adapters` | `==0.2.2` | `curl https://pypi.org/pypi/langchain-mcp-adapters/json` → `.info.version` |
| `langchain-core` | `>=1.0.0,<2.0.0` | Transitive from `langchain-mcp-adapters==0.2.2` `requires_dist` |
| `mcp` | `>=1.9.2` | Transitive from `langchain-mcp-adapters==0.2.2` `requires_dist` |
| Python | `>=3.10` | `langchain-mcp-adapters==0.2.2` `requires_python` |

Resolved at install time (verification gate venv `/tmp/c1-venv`, Python 3.11.15):

```
langchain-core            1.4.0
langchain-mcp-adapters    0.2.2
langchain-protocol        0.0.15
mcp                       1.27.1
```

Optional follow-on deps (commented in `requirements.txt`, only needed for the `create_react_agent` snippet in the tutorial):

- `langchain==0.3.27`
- `langgraph==0.6.10`
- `langchain-anthropic==0.3.21`

---

## Live demo run output (captured `/tmp/c1-demo-output.json`)

Invocation:

```bash
RUN_LIVE_TESTS=1 /tmp/c1-venv/bin/python examples/langchain/demo.py BTC 4h
```

End-to-end against `https://api.algovault.com/mcp` (signal-MCP v1.13.2 in production):

```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {
    "funding_rate": 5.667e-05,
    "funding_24h_avg": 5.667e-05,
    "funding_state": "ELEVATED",
    "oi_change_pct": 0,
    "volume_24h": 8145289765.51,
    "trend_persistence": "MEDIUM",
    "breakout_pending": "INACTIVE"
  },
  "regime": "TRENDING_DOWN"
}
```

Shape check: `jq -e '.call and .confidence and .indicators and .regime'` → `true`. Demo exits 0.

---

## pytest summary

```
RUN_LIVE_TESTS=0 /tmp/c1-venv/bin/pytest tests/integration/test_langchain_demo.py -v
========================= 5 passed, 1 skipped in 0.07s =========================
```

- `test_demo_file_exists` — PASS
- `test_demo_module_imports` — PASS
- `test_cli_rejects_missing_args` — PASS (asserts `SystemExit(2)` on missing args)
- `test_cli_accepts_btc_4h` — PASS (arg parser returns `('BTC', '4h')`)
- `test_dry_run_emits_required_shape` — PASS (subprocess run with `DRY_RUN=1` returns the documented `{call, confidence, indicators, regime}` shape)
- `test_live_demo_returns_required_shape` — SKIPPED (live-gated; runs only under `RUN_LIVE_TESTS=1`)

Live mode was also exercised manually during this audit and returned the documented shape (see capture above).

---

## Forbidden-phrase canary

```bash
grep -rE 'intelligence layer|powerful|seamless|robust|cutting-edge|industry-leading|Quant LLM|[A-Z]+-W[0-9]+|Binance-clone|outcome_return_pct|phase_e_' \
  docs/integrations/langchain.md examples/langchain/
```

Exit 1 (grep no matches) — canary green across both the tutorial markdown and the entire `examples/langchain/` directory.

---

## Files created (Scope adherence)

| Path | Purpose | Lines |
|---|---|---|
| `docs/integrations/langchain.md` | Tutorial markdown (mirrors `binance.md` template) | 116 |
| `examples/langchain/demo.py` | Runnable CLI demo | 132 |
| `examples/langchain/requirements.txt` | Pinned dependencies | 12 |
| `examples/langchain/README.md` | 5-line how-to-run | 11 |
| `tests/integration/__init__.py` | pytest package marker | 0 |
| `tests/integration/test_langchain_demo.py` | dry-run + live-gated tests | 96 |
| `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-langchain-2026-05-18.md` | This audit | — |

Files outside Scope: none touched. Firewall held.

---

## Hub-PR draft (ready for merge gate to ship)

**Target**: `langchain-ai/langchain-mcp-adapters` examples directory (preferred — matches the canonical bridge package the tutorial uses) OR community blog at <https://blog.langchain.com> as an alternate discovery surface.

**Status**: draft markdown ready for merge-gate submission. PR not opened from this chapter — per AC-C1-5 the PR URL is recorded for merge gate to consolidate.

**Suggested PR title**:

> Add AlgoVault MCP example — composite trade calls in 30 lines

**Suggested PR body** (paste into `gh pr create --body-file -`):

````markdown
## What

Adds an end-to-end example of using `langchain-mcp-adapters` against the publicly-hosted [AlgoVault MCP server](https://api.algovault.com/mcp). AlgoVault returns a composite trade-call (call, confidence, regime, indicators) across 5 crypto perp venues with a publicly verifiable track record (Merkle-anchored on Base L2).

## Why

Most MCP examples wire to a local stdio server. This adds a streamable-HTTP example against a production endpoint, which exercises the canonical `MultiServerMCPClient` + `tool.ainvoke({...})` path and gives readers a working agent in 30 lines.

## Files

- `examples/algovault/demo.py` — direct tool call + ReAct agent variant
- `examples/algovault/requirements.txt` — pinned `langchain-mcp-adapters==0.2.2`
- `examples/algovault/README.md` — run instructions

## Try it

```bash
pip install -r examples/algovault/requirements.txt
python examples/algovault/demo.py BTC 4h
```

Full walkthrough at <https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/langchain.md>.

## Verification

End-to-end demo capture (2026-05-18):

```json
{
  "call": "HOLD",
  "confidence": 13,
  "indicators": {"funding_state": "ELEVATED", "trend_persistence": "MEDIUM", "...": "..."},
  "regime": "TRENDING_DOWN"
}
```

AlgoVault track record (live, Merkle-anchored): <https://algovault.com/track-record>.
````

**Submission target URL**: <https://github.com/langchain-ai/langchain-mcp-adapters>
**Submission status**: `draft ready for merge-gate submission`

---

## Frozen upstream contracts honored (from C1 brief)

- Canonical 1-liner: present in tutorial intro (verbatim, ≤20 words).
- `https://api.algovault.com/mcp`: present in tutorial + demo + sample-output.
- 4 live tools enumerated in tutorial table (`get_trade_call`, `get_trade_signal`, `scan_funding_arb`, `get_market_regime`).
- Live-bind spans for all 4 stats: `<span data-tr-field="pfe_wr">90.47%</span>`, `<span data-tr-field="total_calls">96,864</span>`, `<span data-tr-field="merkle_batches">38</span>`, `<span data-tr-field="asset_count">738</span>`.
- 5 venues in canonical order: "Binance, Bybit, OKX, Bitget, Hyperliquid".
- ERC-8004 agentId 44544 cross-link to Basescan.
- Snapshot date 2026-05-18 in both snapshot-comment blocks.

---

## Notes for merge gate

- One implementation detail surfaced during the live probe: `langchain-mcp-adapters==0.2.2` returns the tool response as `list[dict]` with `{"type": "text", "text": "<json>", "id": "..."}` shape — not the `list[TextContent]` shape some other MCP adapters use. The demo's `_extract_trade_call` helper handles both. If a future adapter version changes the shape, the test `test_dry_run_emits_required_shape` will keep the contract honest (fixture path); the live test (`test_live_demo_returns_required_shape`) will catch any regression at the live edge.
- The optional follow-on `create_react_agent` snippet in the tutorial references `anthropic:claude-sonnet-4-5` as the example model string — swap for whichever chat-model identifier the reader has an API key for. Snippet is reference-only; demo.py does NOT depend on any chat model.
