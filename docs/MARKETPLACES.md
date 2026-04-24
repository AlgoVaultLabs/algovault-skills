# Distribution Status

Canonical record of where `algovault-skills` is published.
Last verified: 2026-04-24.

## Status per channel

| # | Channel | Status | Notes / Action |
|---|---|---|---|
| 1 | [GitHub source](https://github.com/AlgoVaultLabs/algovault-skills) | **LIVE** | MIT licensed; `main` branch is the canonical source. |
| 2 | [Smithery Registry](https://smithery.ai/skills/algovault) | **LIVE** | Published 2026-04-24 as 20 individual skills under the `algovault` namespace (Smithery CLI v4.x is per-skill, not bundle). Browse: <https://smithery.ai/skills/algovault>. Install one with `npx -y @smithery/cli skill add algovault/<slug>`. CI auto-republishes on every `git tag v*` via `.github/workflows/publish.yml` (loops over `skills/manifest.json`); `SMITHERY_API_KEY` repo secret provisioned. |
| 3 | [`anthropics/claude-plugins-official`](https://github.com/anthropics/claude-plugins-official) | **PENDING_PR** | Workflow opens a fork-based PR when `ANTHROPIC_PR_TOKEN` repo secret is set (a GitHub PAT with `public_repo` scope on a fork). Until then, manual fork + PR per the [Anthropic plugin marketplace docs](https://code.claude.com/docs/en/plugin-marketplaces). |
| 4 | [claudemarketplaces.com](https://claudemarketplaces.com) | **MANUAL_SUBMITTED** (target) | No public submission API exists (verified `https://claudemarketplaces.com/api/` → HTTP 404 on 2026-04-24). See [SUBMIT_CLAUDEMARKETPLACES.md](./SUBMIT_CLAUDEMARKETPLACES.md) for the human-driven submission steps. |
| 5 | [skillsmp.com](https://skillsmp.com) | **MANUAL_SUBMITTED** (target) | No public submission API exists (verified `https://skillsmp.com/api/` → HTTP 404 on 2026-04-24). See [SUBMIT_SKILLSMP.md](./SUBMIT_SKILLSMP.md) for the human-driven submission steps. |

## Re-publish flow

To ship a new version (e.g., adding a Skill):

1. Edit `skills/manifest.json` to add the entry.
2. `npm run gen` → regenerates the affected `SKILL.md` and the README table.
3. `npm test` → live smoke test against `api.algovault.com`.
4. `git tag v0.1.X && git push origin main --tags` → triggers
   [`.github/workflows/publish.yml`](../.github/workflows/publish.yml).
5. Update the **Status per channel** rows in this file with the date the
   workflow last ran clean.

## Health check

[`.github/workflows/marketplace-check.yml`](../.github/workflows/marketplace-check.yml)
runs daily at 08:00 UTC and verifies:
- Repo still public + `plugin.json` valid.
- `api.algovault.com/mcp` reachable + tools/list returns 3 tools.
- Smithery search still finds the 20 `algovault/<slug>` skills.
- Telegram WARNING fires on any failure (using `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` repo secrets).

## Pre-flight requirements before re-publishing

The repo's `scripts/skills_preflight.sh` must print `PREFLIGHT_GREEN`. Required tools:
- `gh` — authenticated against `AlgoVaultLabs`.
- `npm` (npm scripts; we did NOT use pnpm — see decision A6 in the wave plan).
- `npx @smithery/cli` (no global install needed).
- `curl` + `jq` (for the MCP handshake probe).
