# Manual submission — OKX Agent Trade Kit

## Surface (recommended)

`github.com/okx/agent-trade-kit/discussions` — GitHub Discussions are ENABLED on this repo, making it the cleanest "community integration announcement" channel.

## Placeholder tokens

All `<UPPERCASE_TOKEN>` strings below are substituted by `scripts/generate_skill_submission.mjs --exchange OKX` from live API. CI canary `tests/unit/submit-template-consistency.test.mjs` blocks reintroduction of hardcoded values.

## Step-by-step

### Option A — Discussion (recommended; lower friction than Issue)

1. Visit <https://github.com/okx/agent-trade-kit/discussions/new?category=show-and-tell>
2. Use the title from `PR_TITLE.txt`:

<!-- PR_TITLE_START -->
Community Integration: AlgoVault MCP × OKX Agent Trade Kit (with runnable testnet demo)
<!-- PR_TITLE_END -->

3. Use the body from `PR_BODY.md`:

<!-- PR_BODY_START -->
Hey <EXCHANGE_TITLE> Agent Trade Kit team — wanted to flag a community integration we just shipped.

**<PFE_WR>% PFE Win Rate across <TOTAL_CALLS> Merkle-verified signals on Base L2.**

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + sentiment + cross-venue intelligence into one JSON. Pair it with the <EXCHANGE_TITLE> Agent Trade Kit's `--demo` mode and an agent has the analytics brain + the <EXCHANGE_TITLE> execution venue.

- **Tutorial:** <TUTORIAL_URL>
- **Runnable demo:** <DEMO_URL> (zero-key against `x-simulated-trading: 1`; with-keys via `npx -y @okx_ai/okx-trade-cli@latest --demo`)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record · <BATCH_COUNT> batches anchored

The agent calls `get_trade_call(coin, timeframe, exchange="<EXCHANGE_UPPER>")` and gets one composite verdict back (current MCP server version: `<VERSION>`).

The demo specifically uses your `--demo` flag (verbatim from your `docs/cli-reference.md`) for the authenticated path + the equivalent `x-simulated-trading: 1` REST header for the zero-key path so it runs cleanly out of the box.

3 recipes covered: multi-asset regime scan + grid-bot trigger / funding-arb pair on options / risk-gated entry with confidence floor. All stay in <EXCHANGE_TITLE> simulated trading; zero real-money risk in any code path.

Happy to evolve the tutorial based on whatever the <EXCHANGE_TITLE> Agent Trade Kit team thinks is useful. MIT licensed. Built by AlgoVault Labs.
<!-- PR_BODY_END -->

### Option B — Issue (fallback if Discussions feels off-channel)

```bash
gh issue create \
  --repo okx/agent-trade-kit \
  --title "$(cat /tmp/skill-<EXCHANGE_LOWER>-*/PR_TITLE.txt)" \
  --body-file /tmp/skill-<EXCHANGE_LOWER>-*/PR_BODY.md
```

## After posting

Record the Discussion/Issue URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the <EXCHANGE_LOWER> row + flip status from `MANUAL_PENDING` to `MANUAL_SUBMITTED`.

## Provenance

Template last verified live <PROVENANCE_DATE>.
