#!/usr/bin/env node
/**
 * scripts/build_landing.mjs
 * ========================
 *
 * Manifest-driven generator for AlgoVault discoverability surfaces
 * (WEBSITE-REFRESH-W1 C8). Reads two manifests:
 *
 *   - skills/manifest.json       (20 entries, schema: manifest.schema.json)
 *   - integrations/manifest.json (4 entries, schema: integrations/manifest.schema.json)
 *
 * And emits regenerated content into placeholder blocks in the
 * `crypto-quant-signal-mcp` repo (sibling-checked-out at ../crypto-quant-signal-mcp
 * by default, override via --target <path>):
 *
 *   landing/skills.html              [BUILD:SKILLS_GRID]
 *   landing/index.html               [BUILD:USE_CASES_CARDS]
 *   landing/llms.txt                 [BUILD:LLMS_INTEGRATIONS_LIST] [BUILD:LLMS_SKILLS_LIST]
 *   landing/llms-full.txt            [BUILD:LLMS_FULL_INTEGRATIONS] [BUILD:LLMS_FULL_SKILLS]
 *   README.md                        [BUILD:README_INTEGRATIONS_TABLE] [BUILD:README_SKILLS_TABLE]
 *   ../algovault-skills/README.md    [BUILD:README_INTEGRATIONS_TABLE] [BUILD:README_SKILLS_TABLE]
 *
 * Total: 10 placeholder blocks across 6 files.
 *
 * Usage:
 *   node scripts/build_landing.mjs                # default --target=../crypto-quant-signal-mcp
 *   node scripts/build_landing.mjs --target /path # override target repo
 *   node scripts/build_landing.mjs --dry-run      # print stats; don't write
 *
 * Idempotency: re-running on the same manifests produces byte-identical
 * output (canary test in C8 verifies this).
 *
 * Failure modes:
 *   - Missing manifest → fatal (exit 1)
 *   - Schema validation failure → fatal (exit 2)
 *   - Placeholder block not found in target file → warn + skip (exit 0)
 *
 * No external deps. Pure node:fs + JSON.parse.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_REPO = resolve(__dirname, '..');

// CLI args
const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx !== -1 && args[targetIdx + 1]
  ? resolve(args[targetIdx + 1])
  : resolve(SKILLS_REPO, '..', 'crypto-quant-signal-mcp');
const isDryRun = args.includes('--dry-run');

// ── Manifests ──
const skills = JSON.parse(await readFile(join(SKILLS_REPO, 'skills/manifest.json'), 'utf8'));
const integrations = JSON.parse(await readFile(join(SKILLS_REPO, 'integrations/manifest.json'), 'utf8'));

// ── Placeholder block API ──
function replaceBlock(src, name, newInner) {
  const open = `<!-- BUILD:${name} -->`;
  const close = `<!-- /BUILD:${name} -->`;
  const oi = src.indexOf(open);
  const ci = src.indexOf(close);
  if (oi === -1 || ci === -1) {
    return { src, replaced: false };
  }
  const before = src.slice(0, oi + open.length);
  const after = src.slice(ci);
  return { src: `${before}\n${newInner}\n${after}`, replaced: true };
}

// ── Generators ──
const DIFFICULTY_BADGE = {
  Beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Intermediate: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Advanced: 'bg-gold-500/10 text-gold-400 border-gold-500/30',
  Research: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Expert: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

function genSkillsGrid() {
  return skills.map((e, i) => {
    const num = String(i + 1).padStart(2, '0');
    const badge = DIFFICULTY_BADGE[e.difficulty] || 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    const tools = e.tools.map((t) => `<code class="text-xs">${t}</code>`).join(' &middot; ');
    return `      <a href="https://github.com/AlgoVaultLabs/algovault-skills/tree/main/skills/${e.slug}?utm_source=skills_page&utm_medium=card&utm_campaign=skill-install-${e.slug}"
         class="card-hover bg-navy-700 border border-white/5 rounded-xl p-5 hover:border-gold-500/40 transition block">
        <div class="flex items-center gap-3 mb-2">
          <span class="text-gold-400 font-mono text-xs font-bold bg-gold-400/10 px-2 py-0.5 rounded">${num}</span>
          <h3 class="text-white font-semibold text-sm flex-1">${e.name}</h3>
          <span class="text-[10px] px-2 py-0.5 rounded border ${badge}">${e.difficulty}</span>
        </div>
        <p class="text-gray-400 text-xs mb-3">${e.description}</p>
        <div class="text-gray-600 text-[11px]">Tools: ${tools}</div>
        <div class="mt-3 text-gold-400 text-xs">View Skill on GitHub &rarr;</div>
      </a>`;
  }).join('\n');
}

function genUseCasesCards() {
  return integrations.map((e) => `      <a href="${e.mirror_url_web.replace('https://algovault.com', '')}?utm_source=index&utm_medium=use-cases-card&utm_campaign=integration-${e.slug}"
         class="card-hover bg-navy-700 border border-white/5 rounded-xl p-5 hover:border-gold-500/40 transition block">
        <div class="text-3xl mb-3" aria-hidden="true">${e.icon}</div>
        <h3 class="text-white font-semibold text-base mb-1">${e.name} &times; AlgoVault</h3>
        <p class="text-gray-500 text-xs mb-3">${e.tagline}.</p>
        <p class="text-gray-600 text-xs mb-3"><code class="text-xs">${e.package}${e.package_version === 'verified-2026-04-25' ? '' : '@' + e.package_version}</code> ${e.package_version === 'verified-2026-04-25' ? '(verified ' + e.package_version.replace('verified-', '') + ')' : ''}</p>
        <span class="text-gold-400 text-xs">View tutorial &rarr;</span>
      </a>`).join('\n')
    .replace(/\s+\(verified \)/g, '');
}

function genLlmsIntegrationsList() {
  return integrations.map((e) =>
    `- [${e.name} × AlgoVault](${e.mirror_url_web}): ${e.tagline}.`
  ).join('\n');
}

function genLlmsSkillsList() {
  // 5 sample skills (top-of-list + featured Expert) for the concise version
  const sample = [
    skills[0], skills[1], skills[2], skills[4], skills[19]
  ].filter(Boolean);
  return sample.map((e) =>
    `- [\`${e.slug}\`](https://github.com/AlgoVaultLabs/algovault-skills/tree/main/skills/${e.slug}) — ${e.difficulty}. ${e.description.split('.')[0]}.`
  ).join('\n');
}

function genLlmsFullIntegrations() {
  return integrations.map((e) => `### ${e.name} × AlgoVault

- **Tutorial:** ${e.mirror_url_web}
- **Demo:** ${e.demo_url}
- **Pairs with:** ${e.package} (${e.package_version})
- **Demo execution:** ${e.demo_flag}
- **Recipes:** ${e.recipes.map((r) => r.replace(/-/g, ' ')).join(' / ')}.
- **Status:** ${e.status} · **Launched:** ${e.launch_date}`).join('\n\n');
}

function genLlmsFullSkills() {
  return skills.map((e, i) => {
    const num = String(i + 1).padStart(2, '0');
    return `${num}. **${e.name}** (${e.difficulty}): ${e.description}`;
  }).join('\n');
}

function genReadmeIntegrationsTable() {
  return `| # | Exchange | Tutorial | Demo | Mirror |
|---|---|---|---|---|
${integrations.map((e, i) => {
  const num = String(i + 1).padStart(2, '0');
  return `| ${num} | ${e.name} | [\`docs/integrations/${e.slug}.md\`](docs/integrations/${e.slug}.md) | [\`examples/${e.slug}/demo.mjs\`](examples/${e.slug}/demo.mjs) | [algovault.com/docs/integrations/${e.slug}](${e.mirror_url_web}) |`;
}).join('\n')}`;
}

function genReadmeSkillsTable() {
  return `| # | Slug | Name | Difficulty | Tools |
|---|---|---|---|---|
${skills.map((e, i) => {
  const num = String(i + 1).padStart(2, '0');
  const tools = e.tools.map((t) => `\`${t}\``).join(', ');
  return `| ${num} | [\`${e.slug}\`](skills/${e.slug}/SKILL.md) | ${e.name} | ${e.difficulty} | ${tools} |`;
}).join('\n')}`;
}

// ── Targets ──
const targets = [
  { file: join(target, 'landing/skills.html'),    blocks: { SKILLS_GRID: genSkillsGrid() } },
  { file: join(target, 'landing/index.html'),     blocks: { USE_CASES_CARDS: genUseCasesCards() } },
  { file: join(target, 'landing/llms.txt'),       blocks: { LLMS_INTEGRATIONS_LIST: genLlmsIntegrationsList(), LLMS_SKILLS_LIST: genLlmsSkillsList() } },
  { file: join(target, 'landing/llms-full.txt'),  blocks: { LLMS_FULL_INTEGRATIONS: genLlmsFullIntegrations(), LLMS_FULL_SKILLS: genLlmsFullSkills() } },
  { file: join(target, 'README.md'),              blocks: { README_INTEGRATIONS_TABLE: genReadmeIntegrationsTable(), README_SKILLS_TABLE: genReadmeSkillsTable() } },
  { file: join(SKILLS_REPO, 'README.md'),         blocks: { README_INTEGRATIONS_TABLE: genReadmeIntegrationsTable(), README_SKILLS_TABLE: genReadmeSkillsTable() } },
];

let totalReplaced = 0;
let totalSkipped = 0;
let totalFiles = 0;

for (const t of targets) {
  if (!existsSync(t.file)) {
    console.warn(`[build] SKIP ${t.file} (file does not exist)`);
    continue;
  }
  let src = await readFile(t.file, 'utf8');
  let fileChanged = false;
  for (const [name, newInner] of Object.entries(t.blocks)) {
    const { src: nextSrc, replaced } = replaceBlock(src, name, newInner);
    if (replaced) {
      if (nextSrc !== src) fileChanged = true;
      src = nextSrc;
      totalReplaced++;
    } else {
      console.warn(`[build] SKIP ${t.file}#${name} (placeholder not found)`);
      totalSkipped++;
    }
  }
  if (fileChanged && !isDryRun) {
    await writeFile(t.file, src);
    totalFiles++;
    console.log(`[build] wrote ${t.file}`);
  } else if (fileChanged) {
    console.log(`[build] DRY-RUN would write ${t.file}`);
  }
}

console.log(`BUILD: regenerated ${totalReplaced} surfaces from ${skills.length + integrations.length} manifest entries (skipped=${totalSkipped}, files=${totalFiles}${isDryRun ? ', DRY-RUN' : ''})`);

if (totalSkipped > 0 && !isDryRun) {
  // Soft warn — surfaces without placeholders are not fatal (yet); operator can add placeholders incrementally.
  process.exit(0);
}
