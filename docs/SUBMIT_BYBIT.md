# Manual submission — Bybit Official Trading MCP

## Surface

`github.com/bybit-exchange/trading-mcp/issues` — GitHub Discussions are DISABLED on this repo. Public Issue is the cleanest channel (vs Discord which requires invite + is harder for the maintainer to triage).

## Placeholder tokens

All `<UPPERCASE_TOKEN>` strings below are substituted by `scripts/generate_skill_submission.mjs --exchange BYBIT` from live API. CI canary `tests/unit/submit-template-consistency.test.mjs` blocks reintroduction of hardcoded values.

## Step-by-step

PR / Issue title (generator output: `PR_TITLE.txt`):

<!-- PR_TITLE_START -->
[Community Integration] AlgoVault MCP × bybit-official-trading-server (with testnet demo)
<!-- PR_TITLE_END -->

PR / Issue body (generator output: `PR_BODY.md`):

<!-- PR_BODY_START -->
Hi <EXCHANGE_TITLE> team — flagging a community integration we just shipped against bybit-official-trading-server@2.0.9.

**<PFE_WR>% PFE Win Rate across <TOTAL_CALLS> Merkle-verified signals on Base L2.**

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + cross-venue intelligence into one JSON. Pair it with bybit-official-trading-server and an agent has the analytics brain + the <EXCHANGE_TITLE> execution venue.

- **Tutorial:** <TUTORIAL_URL>
- **Runnable demo:** <DEMO_URL> (uses `BYBIT_TESTNET=true` env var verbatim from your README, hits `api-testnet.bybit.com`)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record · <BATCH_COUNT> batches anchored

The agent calls `get_trade_call(coin, timeframe, exchange="<EXCHANGE_UPPER>")` and gets one composite verdict back (current MCP server version: `<VERSION>`).

3 recipes covered: multi-timeframe consensus → perp entry / volatility breakout watch with conditional orders / hedge-aware DCA on existing position. All stay in <EXCHANGE_TITLE> testnet; zero real-money risk in any code path.

Happy to evolve the tutorial based on whatever the team thinks is useful. MIT licensed. Built by AlgoVault Labs.
<!-- PR_BODY_END -->

```bash
gh issue create \
  --repo bybit-exchange/trading-mcp \
  --title "$(cat /tmp/skill-<EXCHANGE_LOWER>-*/PR_TITLE.txt)" \
  --body-file /tmp/skill-<EXCHANGE_LOWER>-*/PR_BODY.md
```

## After posting

Record the Issue URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the <EXCHANGE_LOWER> row + flip status from `MANUAL_PENDING` to `MANUAL_SUBMITTED`.

## Provenance

Template last verified live <PROVENANCE_DATE>.
