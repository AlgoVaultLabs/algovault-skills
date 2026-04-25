# Manual submission — Bybit Official Trading MCP

## Surface

`github.com/bybit-exchange/trading-mcp/issues` — GitHub Discussions are DISABLED on this repo. Public Issue is the cleanest channel (vs Discord which requires invite + is harder for the maintainer to triage).

## Step-by-step

```bash
gh issue create \
  --repo bybit-exchange/trading-mcp \
  --title "[Community Integration] AlgoVault MCP × bybit-official-trading-server (with testnet demo)" \
  --body "Hi Bybit team — flagging a community integration we just shipped against bybit-official-trading-server@2.0.9.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + cross-venue intelligence into one JSON. Pair it with bybit-official-trading-server and an agent has the analytics brain + the Bybit execution venue.

- **Tutorial:** https://algovault.com/docs/integrations/bybit
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/bybit/demo.mjs (uses BYBIT_TESTNET=true env var verbatim from your README, hits api-testnet.bybit.com)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record

3 recipes covered: multi-timeframe consensus → perp entry / volatility breakout watch with conditional orders / hedge-aware DCA on existing position. All stay in Bybit testnet; zero real-money risk in any code path.

Happy to evolve the tutorial based on whatever the team thinks is useful. MIT licensed. Built by AlgoVault Labs."
```

## After posting

Record the Issue URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the bybit row + flip status from `MANUAL_PENDING` to `MANUAL_SUBMITTED`.
