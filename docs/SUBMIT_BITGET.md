# Manual submission — Bitget Agent Hub

## Surface

`github.com/BitgetLimited/agent_hub/issues` — GitHub Discussions are DISABLED. Public Issue is the cleanest channel (Bitget's Agent Hub README invites contributions; an Issue with a clear "[Community Integration]" tag fits.

## Placeholder tokens

All `<UPPERCASE_TOKEN>` strings below are substituted by `scripts/generate_skill_submission.mjs --exchange BITGET` from live API. CI canary `tests/unit/submit-template-consistency.test.mjs` blocks reintroduction of hardcoded values.

## Step-by-step

PR / Issue title (generator output: `PR_TITLE.txt`):

<!-- PR_TITLE_START -->
[Community Integration] AlgoVault MCP × Bitget Agent Hub + GetClaw (with demo)
<!-- PR_TITLE_END -->

PR / Issue body (generator output: `PR_BODY.md`):

<!-- PR_BODY_START -->
Hi <EXCHANGE_TITLE> Agent Hub team — flagging a community integration we just shipped against bitget-mcp-server@1.1.0.

**<PFE_WR>% PFE Win Rate across <TOTAL_CALLS> Merkle-verified signals on Base L2.**

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + cross-venue intelligence into one JSON. Pair it with bitget-mcp-server + GetClaw and an agent has the analytics brain + <EXCHANGE_TITLE>'s agent-native execution venue.

- **Tutorial:** <TUTORIAL_URL>
- **Runnable demo:** <DEMO_URL>
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record · <BATCH_COUNT> batches anchored

The agent calls `get_trade_call(coin, timeframe, exchange="<EXCHANGE_UPPER>")` and gets one composite verdict back (current MCP server version: `<VERSION>`).

Notable: bitget-mcp-server doesn't expose an env-var-level demo flag, so our demo wraps with three independent guards (`BITGET_DEMO=true` env var, `MAINNET_BLOCKED=true` const, hard 0.0001 BTC order cap) + explicitly tells readers to use a GetClaw demo account's API keys. Would love your team's review on whether this matches the GetClaw demo-account model you intended.

3 recipes covered: natural-language verdict + GetClaw execution / 5 <EXCHANGE_TITLE> AI Skills + AlgoVault complement / agent-native portfolio rebalance via GetClaw. All stay in <EXCHANGE_TITLE> demo; zero real-money risk in any code path.

MIT licensed. Built by AlgoVault Labs.
<!-- PR_BODY_END -->

```bash
gh issue create \
  --repo BitgetLimited/agent_hub \
  --title "$(cat /tmp/skill-<EXCHANGE_LOWER>-*/PR_TITLE.txt)" \
  --body-file /tmp/skill-<EXCHANGE_LOWER>-*/PR_BODY.md
```

## After posting

Record the Issue URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the <EXCHANGE_LOWER> row + flip status from `MANUAL_PENDING` to `MANUAL_SUBMITTED`.

## Optional follow-up

Once the maintainer responds positively to the Issue, consider following up with a small PR adding `skills/algovault/SKILL.md` to the `agent_hub` repo (similar to the Binance Skills Hub PR pattern in `docs/SUBMIT_BINANCE.md`).

## Provenance

Template last verified live <PROVENANCE_DATE>.
