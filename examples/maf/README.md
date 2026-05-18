# AlgoVault x Microsoft Agent Framework (MAF) demo

One-shot trade-call against `https://api.algovault.com/mcp` via MAF's
`MCPStreamableHTTPTool`. No LLM API key required for the bare demo.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python demo.py BTC 4h
```

Expected stdout: a JSON object with `call`, `confidence`, `indicators`,
`regime` (full sample in the tutorial at `docs/integrations/maf.md`).

## Dry-run (no network)

```bash
DRY_RUN=1 python demo.py BTC 4h
```

## Custom endpoint

```bash
ALGOVAULT_MCP_URL=https://api.algovault.com/mcp python demo.py ETH 1h
```

## Multi-turn ChatAgent

See the "Optional follow-on" section in `docs/integrations/maf.md` for the
full `ChatAgent`-wired snippet (Azure OpenAI / OpenAI / Anthropic chat model
backends).
