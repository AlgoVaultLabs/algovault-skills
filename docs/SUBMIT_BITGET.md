# Manual submission — Bitget Agent Hub

## Surface

`github.com/BitgetLimited/agent_hub/issues` — GitHub Discussions are DISABLED. Public Issue is the cleanest channel (Bitget's Agent Hub README invites contributions; an Issue with a clear "[Community Integration]" tag fits.

## Step-by-step

```bash
gh issue create \
  --repo BitgetLimited/agent_hub \
  --title "[Community Integration] AlgoVault MCP × Bitget Agent Hub + GetClaw (with demo)" \
  --body "Hi Bitget Agent Hub team — flagging a community integration we just shipped against bitget-mcp-server@1.1.0.

**AlgoVault MCP** returns a composite trading verdict (signal/confidence/regime/factors) per call, fusing technical + funding + cross-venue intelligence into one JSON. Pair it with bitget-mcp-server + GetClaw and an agent has the analytics brain + Bitget's agent-native execution venue.

- **Tutorial:** https://algovault.com/docs/integrations/bitget
- **Runnable demo:** https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/bitget/demo.mjs
- **Track record (live, on-chain Merkle-verified):** https://algovault.com/track-record

Notable: bitget-mcp-server doesn't expose an env-var-level demo flag, so our demo wraps with three independent guards (BITGET_DEMO=true env var, MAINNET_BLOCKED=true const, hard 0.0001 BTC order cap) + explicitly tells readers to use a GetClaw demo account's API keys. Would love your team's review on whether this matches the GetClaw demo-account model you intended.

3 recipes covered: natural-language verdict + GetClaw execution / 5 Bitget AI Skills + AlgoVault complement / agent-native portfolio rebalance via GetClaw. All stay in Bitget demo; zero real-money risk in any code path.

MIT licensed. Built by AlgoVault Labs."
```

## After posting

Record the Issue URL in `docs/INTEGRATIONS_DISTRIBUTION.md` `community_submission` cell for the bitget row + flip status from `MANUAL_PENDING` to `MANUAL_SUBMITTED`.

## Optional follow-up

Once the maintainer responds positively to the Issue, consider following up with a small PR adding `skills/algovault/SKILL.md` to the `agent_hub` repo (similar to the Binance Skills Hub PR pattern in `docs/SUBMIT_BINANCE.md`).
