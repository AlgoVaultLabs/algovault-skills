# Integrations Distribution Status

Tracker for the per-exchange tutorial distribution surface produced by the
`INTEGRATIONS-W1` wave. Updated by C6 — mirrors LIVE on algovault.com,
GitHub blob URLs LIVE, Dev.to + community submissions queued for manual
post by the architect (per spec ambiguity H + I default).

**Status legend:**

- `LIVE` — surface is reachable (mirror returns 200 OR Dev.to article published OR community submission accepted)
- `PR_OPEN` — Pull Request is open against the upstream community surface (e.g. `binance/binance-skills-hub`) awaiting review
- `MANUAL_SUBMITTED` — manual submission completed (Issue/Discord post URL recorded), awaiting community response
- `MANUAL_PENDING` — manual fallback documented in `docs/SUBMIT_<EXCHANGE>.md` because no auto-API exists or the credential was unavailable at C6 time
- `PENDING` — not yet executed (default at C1 time)

## Distribution table

| exchange | tutorial_url | demo_url | mirror_url | devto_url | community_submission | status |
|---|---|---|---|---|---|---|
| binance | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/binance.md | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/binance/demo.mjs | https://algovault.com/docs/integrations/binance | MANUAL_PENDING — see [`docs/SUBMIT_DEVTO.md`](./SUBMIT_DEVTO.md) | MANUAL_PENDING — PR-to-add-skill template in [`docs/SUBMIT_BINANCE.md`](./SUBMIT_BINANCE.md) | LIVE (mirror+tutorial+demo); MANUAL_PENDING (devto+community) |
| okx | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/okx.md | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/okx/demo.mjs | https://algovault.com/docs/integrations/okx | MANUAL_PENDING — see [`docs/SUBMIT_DEVTO.md`](./SUBMIT_DEVTO.md) | ✅ MANUAL_SUBMITTED 2026-04-28 — https://github.com/okx/agent-trade-kit/discussions/13 | LIVE (mirror+tutorial+demo+community); MANUAL_PENDING (devto) |
| bybit | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/bybit.md | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/bybit/demo.mjs | https://algovault.com/docs/integrations/bybit | MANUAL_PENDING — see [`docs/SUBMIT_DEVTO.md`](./SUBMIT_DEVTO.md) |  ✅ MANUAL_SUBMITTED 2026-04-29 — https://github.com/bybit-exchange/trading-mcp/issues/12 | LIVE (mirror+tutorial+demo); MANUAL_PENDING (devto+community) |
| bitget | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/bitget.md | https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples/bitget/demo.mjs | https://algovault.com/docs/integrations/bitget | MANUAL_PENDING — see [`docs/SUBMIT_DEVTO.md`](./SUBMIT_DEVTO.md) | MANUAL_PENDING — Issue template in [`docs/SUBMIT_BITGET.md`](./SUBMIT_BITGET.md) | LIVE (mirror+tutorial+demo); MANUAL_PENDING (devto+community) |

## Why MANUAL_PENDING for Dev.to + community submissions

**Dev.to:** `DEV_TO_API_KEY` was not present in `~/.algovault/secrets` or any repo `.env` at C6 execution time (verified 2026-04-25). Per spec C6's factuality clause, fell back to `docs/SUBMIT_DEVTO.md` — the architect can either provision the key for a future wave's auto-publish OR post the 4 articles manually (~3 min each via the Dev.to UI).

**Community submissions:** Opening 4 simultaneous Issues/PRs across 4 exchange repos as the `AlgoVaultFi` GitHub account would risk looking like spam — and risk being caught by GitHub's anti-spam heuristics. Generated `docs/SUBMIT_<EXCHANGE>.md` files instead with prepared Issue/Discussion/PR bodies, ready to paste. Architect or community-relations lead reviews tone + posts at a measured cadence (recommend one per day across the 4 to avoid pattern-flagging).

## Verification

Mirror health (run any time, no auth required):

```bash
for ex in binance okx bybit bitget; do
  printf "  %-7s -> " "$ex"
  curl -fsS -o /dev/null -w "HTTP=%{http_code}\n" "https://algovault.com/docs/integrations/$ex"
done
```

UTM-tagged track-record links (web channel):

```bash
for ex in binance okx bybit bitget; do
  printf "  %-7s -> " "$ex"
  curl -fsS -o /dev/null -w "HTTP=%{http_code}\n" "https://algovault.com/track-record?utm_source=tutorial&utm_medium=web&utm_campaign=integration-$ex"
done
```

Both should print 4× `HTTP=200`.

## Update protocol

- **After Dev.to publish:** replace `MANUAL_PENDING — see ...` in the `devto_url` cell with the Dev.to article URL + flip `status` to `LIVE (mirror+tutorial+demo+devto); MANUAL_PENDING (community)`.
- **After community Issue/PR opens:** replace `MANUAL_PENDING — Issue template in ...` in `community_submission` with the Issue/PR URL + flip status to `MANUAL_SUBMITTED` (or `PR_OPEN` for Binance).
- **After community submission accepted/closed:** flip `status` to fully `LIVE`.
- Git history is the audit trail.
