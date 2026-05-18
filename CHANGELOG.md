# Changelog

All notable changes to `@algovaultlabs/skills` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-18 — Framework integrations

### Added — 4 drop-in framework tutorials + runnable demos

- **`docs/integrations/langchain.md`** + **`examples/langchain/demo.py`** — pairs AlgoVault MCP with `langchain-mcp-adapters` (streamable HTTP). Composite verdict returned to a LangChain agent tool-call.
- **`docs/integrations/llamaindex.md`** + **`examples/llamaindex/demo.py`** — pairs AlgoVault MCP with `llama-index-tools-mcp`. Composite verdict surfaced to a LlamaIndex agent workflow.
- **`docs/integrations/maf.md`** + **`examples/maf/demo.py`** — pairs AlgoVault MCP with Microsoft Agent Framework (`agent-framework`). Composite verdict callable from a MAF agent.
- **`docs/integrations/crewai.md`** + **`examples/crewai/demo.py`** — pairs AlgoVault MCP with CrewAI (`crewai-tools[mcp]`). Composite verdict accessible from a CrewAI agent.

Each demo is runnable as `python examples/<framework>/demo.py BTC 4h` — ≤5 minutes to first call. `pytest` integration tests included for each (dry-run by default; live-gated via `RUN_LIVE_TESTS=1`).

### Added — README Framework integrations subsection

- `README.md` extended with a 4-row Framework integrations table mirroring the existing 4-row Exchange integrations table.

### Submission targets

- Hub-PR drafts ready for: `langchain-ai/langchain` (community integrations), `run-llama/llama_index` (community tools), Microsoft Agent Framework samples, `crewAIInc/crewAI-examples`. Drafts persisted in `audits/AI-AGENT-FRAMEWORK-TUTORIALS-W1-<framework>-2026-05-18.md`.

## [0.1.0] - 2026-04-26 — Initial release

- 20 Anthropic Agent Skills over AlgoVault MCP.
- 4 exchange integration tutorials: Binance, OKX, Bybit, Bitget.
