# Distribution Status

Canonical record of where `algovault-skills` is published.
Last verified: 2026-04-28 (DISTRIBUTION-CLOSEOUT-W1).

## Status per channel

| # | Channel | Status | Notes / Action |
|---|---|---|---|
| 1 | [GitHub source](https://github.com/AlgoVaultLabs/algovault-skills) | **LIVE** | MIT licensed; `main` branch is the canonical source. |
| 2 | [Smithery Registry](https://smithery.ai/skills/algovault) | **LIVE** | Published 2026-04-24 as 20 individual skills under the `algovault` namespace (Smithery CLI v4.x is per-skill, not bundle). Browse: <https://smithery.ai/skills/algovault>. Install one with `npx -y @smithery/cli skill add algovault/<slug>`. CI auto-republishes on every `git tag v*` via `.github/workflows/publish.yml` (loops over `skills/manifest.json`). **NOTE 2026-04-28:** `SMITHERY_API_KEY` is currently invalid (returns `401 Authentication failed`) — republish step soft-fails (`continue-on-error: true`) so distribution-closeout downstream steps still advance. Rotate the key when convenient: Smithery dashboard → API Keys → regenerate → `gh secret set SMITHERY_API_KEY --repo AlgoVaultLabs/algovault-skills`. |
| 3 | [`anthropics/claude-plugins-official`](https://github.com/anthropics/claude-plugins-official) | **FORM_PENDING_DNS_PROVISION** **2026-04-28** | Test PR [#1632](https://github.com/anthropics/claude-plugins-official/pull/1632) was auto-closed by `github-actions` bot with: *"This repo only accepts contributions from Anthropic team members. If you'd like to submit a plugin to the marketplace, please submit your plugin [here](https://form.claude.com/plugins/submit)."* — i.e., community PRs are no longer the path. The new submission form at `https://form.claude.com/plugins/submit` returned **NXDOMAIN** (verified via Cloudflare DoH + Google DoH 2026-04-28) — Anthropic infra hasn't provisioned the form hostname yet. Operators should retry the URL weekly and submit via the form when DNS resolves. publish.yml `Print Anthropic marketplace submission status` step prints the current state for ops visibility (no auto-submit until DNS resolves — per CLAUDE.md "Never invent a third-party submission endpoint without verifying it returns 200"). |
| 4 | [claudemarketplaces.com](https://claudemarketplaces.com) | **AUTO_DISCOVERY_ACTIVE 2026-04-28** | No public `/submit` URL exists — auto-aggregator from public GitHub repos with valid `.claude-plugin/marketplace.json`. Curated/featured listing requires 500+ installs per their public docs. Our `marketplace.json` validates clean against the live `claude plugin validate` schema (3 schema errors fixed in 2026-04-28 commit; `owner`+`author` were string-shape, schema requires object-shape; `source` was string `"."`, schema requires object). |
| 5 | [skillsmp.com](https://skillsmp.com) | **AUTO_DISCOVERY_ACTIVE 2026-04-28** | No public `/submit` URL exists — auto-aggregator from public GitHub repos with valid `.claude-plugin/` + SKILL.md frontmatter. All 20 SKILL.md files have valid YAML frontmatter (`name` + `description`) — gh-API-verified 2026-04-28. |

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
