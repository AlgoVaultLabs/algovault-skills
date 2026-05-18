# AlgoVault x LlamaIndex — runnable demo

Install deps + run a live composite trade-call:

```bash
pip install -r requirements.txt
python demo.py BTC 4h
```

Prints a `{call, confidence, indicators, regime}` JSON object from `https://api.algovault.com/mcp` via `BasicMCPClient` (streamable HTTP). Full walkthrough in [`docs/integrations/llamaindex.md`](../../docs/integrations/llamaindex.md).
