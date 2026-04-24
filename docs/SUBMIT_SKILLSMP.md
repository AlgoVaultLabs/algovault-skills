# Manual Submission — skillsmp.com

> **Why manual?** As of 2026-04-24, `skillsmp.com` has no public submission
> API (`https://skillsmp.com/api/` → HTTP 404). The publish workflow CANNOT
> auto-submit. Per the AlgoVault factuality law, we document the exact human
> steps rather than fake automation.

## Prerequisites

- Repo is public at `https://github.com/AlgoVaultLabs/algovault-skills`.
- `v0.1.0` (or later) tag has been pushed.
- All 20 SKILL.md files have valid YAML frontmatter (auto-checked by generator).

## Steps

1. Sign in at [skillsmp.com](https://skillsmp.com) (Google or GitHub).
2. Find the **Submit / Add Skill** flow (UI may vary).
3. For each of the 20 Skills (or, if skillsmp.com supports plugin-bundles, submit the whole pack as one unit):
   - **Skill slug:** matches `skills/<slug>/SKILL.md`
   - **GitHub source:** `https://github.com/AlgoVaultLabs/algovault-skills/blob/main/skills/<slug>/SKILL.md`
   - **Description:** copy from the SKILL.md frontmatter
   - **Tags:** `mcp, trading, crypto, finance, agent`
4. If skillsmp.com supports a single manifest URL, submit:
   - `https://raw.githubusercontent.com/AlgoVaultLabs/algovault-skills/main/skills/manifest.json`
5. Approval timing varies; track in `docs/MARKETPLACES.md` row #5.

## Verification

After approval, search `algovault` on skillsmp.com — expect ≥1 result per Skill.

## If the API ships

If `skillsmp.com` publishes a submission API, replace this manual doc with an
automated step in `.github/workflows/publish.yml`. Update `docs/MARKETPLACES.md`.
