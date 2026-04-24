# Manual Submission — claudemarketplaces.com

> **Why manual?** As of 2026-04-24, `claudemarketplaces.com` has no public
> submission API (`https://claudemarketplaces.com/api/` → HTTP 404). The
> publish workflow CANNOT auto-submit. Per the AlgoVault factuality law, we
> document the exact human steps rather than fake automation.

## Prerequisites

- Repo is public at `https://github.com/AlgoVaultLabs/algovault-skills`.
- `v0.1.0` (or later) tag has been pushed.
- `.claude-plugin/plugin.json` is valid (auto-checked in CI).

## Steps

1. Sign in at [claudemarketplaces.com](https://claudemarketplaces.com) (Google or GitHub).
2. Navigate to **Submit Plugin** (or equivalent — UI may have changed).
3. Fill the submission form:
   - **Name:** `algovault-skills`
   - **GitHub URL:** `https://github.com/AlgoVaultLabs/algovault-skills`
   - **Plugin manifest path:** `.claude-plugin/plugin.json`
   - **Description:** `20 Agent Skills over AlgoVault MCP — composite verdicts, regime, cross-venue arb`
   - **Category:** *Trading / Finance / Research* (whichever exists)
   - **Tags:** `mcp, trading, crypto, finance, signal, agent`
   - **License:** MIT
   - **Maintainer email:** *(internal — do not commit)*
4. Submit. Approval typically takes 24-72h.
5. On approval, update `docs/MARKETPLACES.md` row #4 status from `MANUAL_SUBMITTED (target)` → `LIVE` with the listing URL and the approval date.

## Verification

After approval, `https://claudemarketplaces.com/plugin/algovault-skills` (or equivalent slug) should load.

## If the API ships

If `claudemarketplaces.com` publishes a submission API (watch their docs page),
remove this manual doc and add an automated step to `.github/workflows/publish.yml`.
Update `docs/MARKETPLACES.md` accordingly.
