# AlgoVault Skills

**20 Anthropic Agent Skills over the [AlgoVault MCP server](https://api.algovault.com/mcp).**

Each Skill is a single-prompt wrapper over 1–3 calls to AlgoVault's signal-interpretation API
(`get_market_regime`, `get_trade_signal`, `scan_funding_arb`). Install once, invoke from any
Claude Code or Cowork session, and we surface the composite verdict — your agent decides execution.

> AlgoVault provides the thesis; your agent decides execution.

## Quick start

```bash
# In Claude Code
claude plugin install AlgoVaultLabs/algovault-skills

# In Cowork — discover via the marketplace, click "install"
```

Live track record (PFE Win Rate + cumulative call count, updated continuously):
**https://algovault.com/track-record**

## The 20 Skills

<!-- SKILLS_TABLE -->
*(table populated by `scripts/gen-skill.mjs` after C3.)*
<!-- /SKILLS_TABLE -->

## How attribution works

Every Skill invocation sends `X-AlgoVault-Skill-Slug: <slug>` to the MCP server. We aggregate
these in a public counter at `https://algovault.com/analytics/skills` so you can see which
Skills drove which call volume — no user-level data, just per-Skill totals.

## Repo layout

```
algovault-skills/
├── .claude-plugin/
│   ├── plugin.json           # Plugin manifest (mcpServers, version, etc.)
│   └── marketplace.json      # Marketplace entry
├── skills/
│   ├── _template/            # SKILL.md.tmpl — generator template
│   ├── manifest.json         # Single source of truth: 20 Skill definitions
│   ├── manifest.schema.json  # JSON Schema v7 for manifest validation
│   └── <slug>/SKILL.md       # GENERATED — never hand-edit
├── scripts/
│   ├── gen-skill.mjs         # Reads manifest, emits SKILL.md per entry
│   └── skills_preflight.sh   # Pre-build environment check
├── tests/smoke/              # Live invocation tests against api.algovault.com
└── docs/MARKETPLACES.md      # Distribution status per marketplace
```

## Development

```bash
npm run preflight             # Verify env + repo + MCP reachable
npm run gen                   # Regenerate all SKILL.md files from manifest
npm test                      # Live smoke test against api.algovault.com
```

## Contributing

Skills are added via `skills/manifest.json` only — never hand-edit generated `SKILL.md` files.
Add a manifest entry, run `npm run gen`, commit both. PRs welcome.

## Built by [AlgoVault Labs](https://algovault.com)

Composable signal-interpretation tools for AI trading agents — MIT licensed.
