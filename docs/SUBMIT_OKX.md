# Manual submission — OKX Agent Trade Kit

## Surface (recommended)

`github.com/okx/agent-trade-kit/discussions` — GitHub Discussions are ENABLED on this repo, making it the cleanest "community integration announcement" channel.

## Step-by-step

### Option A — Discussion (recommended; lower friction than Issue)

1. Visit <https://github.com/okx/agent-trade-kit/discussions/new?category=show-and-tell>
2. **Title:** `Community Integration: AlgoVault MCP × OKX Agent Trade Kit (with runnable testnet demo)`
3. **Body:**

```markdown
Hey OKX Agent Trade Kit team — wanted to flag a community integration we just shipped.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + sentiment + cross-venue intelligence into one JSON. Pair it with the OKX Agent Trade Kit's `--demo` mode and an agent has the analytics brain + the OKX execution venue.

- **Tutorial:** https://algovault.com/docs/integrations/okx
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/okx/demo.mjs (zero-key against `x-simulated-trading: 1`; with-keys via `npx -y @okx_ai/okx-trade-cli@latest --demo`)
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record

The demo specifically uses your `--demo` flag (verbatim from your `docs/cli-reference.md`) for the authenticated path + the equivalent `x-simulated-trading: 1` REST header for the zero-key path so it runs cleanly out of the box.

3 recipes covered: multi-asset regime scan + grid-bot trigger / funding-arb pair on options / risk-gated entry with confidence floor. All stay in OKX simulated trading; zero real-money risk in any code path.

Happy to evolve the tutorial based on whatever the OKX Agent Trade Kit team thinks is useful. MIT licensed. Built by AlgoVault Labs.
```

### Option B — Issue (fallback if Discussions feels off-channel)

Same body, posted as `gh issue create --repo okx/agent-trade-kit --title "..." --body-file <file>`.

## After posting

Record the Discussion/Issue URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the okx row + flip status from `MANUAL_PENDING` to `MANUAL_SUBMITTED`.
