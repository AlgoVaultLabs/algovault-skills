# AlgoVault x CrewAI -- runnable demo

Install deps + run a live composite trade-call:

```bash
pip install -r requirements.txt
python demo.py BTC 4h
```

Prints a `{call, confidence, indicators, regime}` JSON object from `https://api.algovault.com/mcp`. Full walkthrough in [`docs/integrations/crewai.md`](../../docs/integrations/crewai.md).
