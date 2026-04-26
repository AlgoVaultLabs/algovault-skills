# How to add a new Skill or Integration

WEBSITE-REFRESH-W1 C8 turned the discoverability surfaces (signal-MCP `landing/skills.html`, `landing/index.html` Use Cases section, `landing/llms.txt`, `landing/llms-full.txt`, both repo READMEs) into manifest-driven outputs. Adding a new Skill is a manifest edit + a CI push. Adding a new Integration is a manifest edit + tutorial markdown + demo script + CI push.

The build script: [`scripts/build_landing.mjs`](../scripts/build_landing.mjs).

---

## How to add a new Skill (~3 min)

### 1. Add a manifest entry

Edit [`skills/manifest.json`](../skills/manifest.json) and append a new object. Required fields (per [`skills/manifest.schema.json`](../skills/manifest.schema.json)):

```json
{
  "slug": "my-new-skill",
  "name": "My New Skill",
  "description": "One-sentence summary that becomes the card paragraph + GitHub deep-link description.",
  "difficulty": "Beginner|Intermediate|Advanced|Research|Expert",
  "tools": ["get_trade_signal"],
  "prompt": "Verbatim natural-language prompt the user types into Claude Code.",
  "pattern": "Short tag describing the strategy pattern (e.g. 'batch calling, confidence filtering')."
}
```

### 2. Generate the SKILL.md file

```bash
npm run gen
```

This runs [`scripts/gen-skill.mjs`](../scripts/gen-skill.mjs) which reads the manifest and emits `skills/my-new-skill/SKILL.md`.

### 3. Commit + push

```bash
git add skills/manifest.json skills/my-new-skill/
git commit -m "feat(skills): add my-new-skill"
git push origin main
```

### 4. CI auto-regenerates discoverability surfaces

`.github/workflows/dispatch-landing-rebuild.yml` (this repo) detects the manifest change + fires `repository_dispatch` to `crypto-quant-signal-mcp`. That repo's `regenerate-landing.yml` checks out both repos as siblings, runs `node algovault-skills/scripts/build_landing.mjs --target .`, commits the regenerated surfaces, pushes — auto-deploy fires; new Skill appears on `algovault.com/skills` within ~2 min total.

### 5. Verify

```bash
curl -fsS https://algovault.com/skills | grep my-new-skill
curl -fsS https://algovault.com/llms-full.txt | grep "My New Skill"
```

Both should match.

---

## How to add a new Integration (~10 min)

### 1. Add a manifest entry

Edit [`integrations/manifest.json`](../integrations/manifest.json) and append a new object. Required fields per [`integrations/manifest.schema.json`](../integrations/manifest.schema.json):

```json
{
  "slug": "kraken",
  "name": "Kraken",
  "package": "kraken/kraken-mcp-server",
  "package_install": "npx -y kraken-mcp-server@1.0.0",
  "package_version": "1.0.0",
  "repo_url": "https://github.com/kraken/kraken-mcp-server",
  "docs_url": "https://github.com/kraken/kraken-mcp-server/blob/main/README.md",
  "demo_flag": "KRAKEN_TESTNET=true",
  "tutorial_url_repo": "https://github.com/AlgoVaultLabs/algovault-skills/blob/main/docs/integrations/kraken.md",
  "mirror_url_web": "https://algovault.com/docs/integrations/kraken",
  "demo_url": "https://github.com/AlgoVaultLabs/algovault-skills/tree/main/examples/kraken",
  "devto_url": "MANUAL_PENDING",
  "community_submission_url": "MANUAL_PENDING",
  "status": "PENDING",
  "launch_date": "2026-XX-XX",
  "icon": "🐙",
  "tagline": "Composite verdict + Kraken MCP for Spot Testnet execution",
  "recipes": ["regime-gated-dca", "confidence-filtered-swing", "funding-arb-pair"]
}
```

### 2. Write the tutorial markdown

Create `docs/integrations/kraken.md` from the canonical template at [`docs/integrations/_template.md`](../docs/integrations/_template.md). Fill in all `{{placeholders}}` with verified content.

### 3. Write the demo script

Create `examples/kraken/demo.mjs` and `examples/kraken/README.md`. Mirror the structure of [`examples/binance/`](../examples/binance/). Hard guards required:
- `KRAKEN_TESTNET=true` env var (or whatever the integration's demo flag is)
- `MAINNET_BLOCKED = true` constant
- Order size cap (smallest tradeable unit)

### 4. Commit + push

```bash
git add integrations/manifest.json docs/integrations/kraken.md examples/kraken/
git commit -m "feat(integrations): add Kraken integration"
git push origin main
```

### 5. CI auto-regenerates

Same flow as Skills — `dispatch-landing-rebuild.yml` fires on manifest change → `regenerate-landing.yml` rebuilds `landing/index.html` Use Cases section + READMEs + llms.txt + llms-full.txt + sitemap.xml. The mirror page (`landing/integrations/kraken.html`) is rendered separately by `scripts/render-integrations.mjs` (lives in `crypto-quant-signal-mcp`); architect runs that script to render the new mirror after pushing the tutorial.

### 6. Optional: community submission

Create `docs/SUBMIT_KRAKEN.md` with a prepared Issue/PR/Discussion body for the upstream repo (mirror the format of `docs/SUBMIT_BINANCE.md`).

---

## What gets regenerated automatically

| Surface | Source | Generator |
|---|---|---|
| `landing/skills.html` (20-card grid) | `skills/manifest.json` | `scripts/build_landing.mjs#SKILLS_GRID` |
| `landing/index.html` (Use Cases section) | `integrations/manifest.json` | `scripts/build_landing.mjs#USE_CASES_CARDS` |
| `landing/llms.txt` (Integrations + sample Skills) | both manifests | `scripts/build_landing.mjs#LLMS_INTEGRATIONS_LIST` + `LLMS_SKILLS_LIST` |
| `landing/llms-full.txt` (full Integrations + all 20 Skills) | both manifests | `scripts/build_landing.mjs#LLMS_FULL_INTEGRATIONS` + `LLMS_FULL_SKILLS` |
| `crypto-quant-signal-mcp/README.md` (Integrations + Skills tables) | both manifests | `scripts/build_landing.mjs#README_INTEGRATIONS_TABLE` + `README_SKILLS_TABLE` |
| `algovault-skills/README.md` (Integrations + Skills tables) | both manifests | `scripts/build_landing.mjs#README_INTEGRATIONS_TABLE` + `README_SKILLS_TABLE` |
| `landing/integrations/<slug>.html` (mirror pages) | `docs/integrations/<slug>.md` | `crypto-quant-signal-mcp/scripts/render-integrations.mjs` (separate script) |

**NOT regenerated automatically (yet):**
- `landing/sitemap.xml` — currently hand-maintained; future C9 work could add it.
- `landing/docs.html` per-card install footer — currently hand-edited; would need `BUILD:DOCS_INSTALL_FOOTERS` placeholder and an additional generator function.

---

## How to verify locally before push

```bash
node scripts/build_landing.mjs --target ../crypto-quant-signal-mcp --dry-run
```

The `--dry-run` flag prints what would be regenerated without writing. Use this to preview changes before committing.

After actual run (drops `--dry-run`), run the build twice in a row + verify zero diff to confirm idempotency:

```bash
node scripts/build_landing.mjs --target ../crypto-quant-signal-mcp
git add . && git diff --quiet  # should produce no output
node scripts/build_landing.mjs --target ../crypto-quant-signal-mcp
git diff --quiet  # confirm: no further drift
```

---

## Rollback procedure

If a manifest edit breaks the build OR a regenerated surface looks wrong:

```bash
# In whichever repo the issue is:
git revert <sha-of-bad-commit>
git push origin main
```

The CI fires the regenerate flow again; surfaces converge back to the prior good state.

For DEPLOYED-but-bad surfaces on `algovault.com`: the static catch-all serves `/var/www/algovault/*.html` files cached for 60s. After rollback + auto-deploy completion (~30s), the bad files are overwritten + the next user's request gets the corrected version within 60s of deploy.

---

## See also

- `scripts/build_landing.mjs` — the generator (zero deps, ~200 LOC)
- `skills/manifest.schema.json` — JSON Schema for Skill entries
- `integrations/manifest.schema.json` — JSON Schema for Integration entries
- `crypto-quant-signal-mcp/.github/workflows/regenerate-landing.yml` — cross-repo CI receiver
- `algovault-skills/.github/workflows/dispatch-landing-rebuild.yml` — CI dispatch trigger
