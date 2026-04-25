# Integrations Distribution Status

Tracker for the per-exchange tutorial distribution surface produced by the
`INTEGRATIONS-W1` wave. C1 (this file) ships the empty scaffold. C2-C5
populate the GitHub `tutorial_url` and `demo_url` columns. C6 populates
`mirror_url`, `devto_url`, `community_submission`, and `status`.

**Status legend:**

- `LIVE` — surface is reachable (mirror returns 200 OR Dev.to article published OR community submission accepted)
- `PR_OPEN` — Pull Request is open against the upstream community surface (e.g. `binance/binance-skills-hub`) awaiting review
- `MANUAL_SUBMITTED` — manual submission completed (Issue/Discord post URL recorded), awaiting community response
- `MANUAL_PENDING` — manual fallback documented in `docs/SUBMIT_<EXCHANGE>.md` because no auto-API exists or the credential was unavailable at C6 time
- `PENDING` — not yet executed (default at C1 time)

## Distribution table

| exchange | tutorial_url | demo_url | mirror_url | devto_url | community_submission | status |
|---|---|---|---|---|---|---|
| binance | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| okx | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| bybit | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |
| bitget | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## Update protocol

- C2-C5: replace `tutorial_url` and `demo_url` for the respective exchange row with the GitHub blob URL.
- C6: replace `mirror_url` with the algovault.com URL, `devto_url` with the Dev.to article URL (or `MANUAL_PENDING — see docs/SUBMIT_DEVTO.md`), `community_submission` with the GitHub Issue/PR URL, and update `status` to the appropriate enum value.
- Any subsequent corrections (e.g. Bybit Discord submission post-merge) update the relevant cell + this file's git history is the audit trail.
