#!/usr/bin/env node
/**
 * scripts/generate_skill_submission.mjs
 * =====================================
 *
 * Reads `docs/SUBMIT_<EXCHANGE>.md` template + fetches live AlgoVault API
 * data, emits ready-to-paste submission artifacts:
 *
 *   <output-dir>/SKILL.md      — only when template has a SKILL_MD block
 *   <output-dir>/PR_TITLE.txt  — single-line title
 *   <output-dir>/PR_BODY.md    — issue / discussion / PR body
 *   <output-dir>/SUMMARY.md    — operator-readable summary of resolved values
 *
 * Why this exists: per BINANCE-SKILLS-HUB-SUBMISSION-W1, hardcoded
 * track-record numbers in SUBMIT_*.md files rotted between 2026-04-25 and
 * 2026-05-08 (`89.5% / 54,629+ / 15+` was wrong by ~24,000 calls and 13 batches
 * in two weeks). The template is now the single source of truth for the
 * submission shape; this script substitutes live values at run time.
 *
 * Usage:
 *   node scripts/generate_skill_submission.mjs --exchange BINANCE
 *   node scripts/generate_skill_submission.mjs --exchange BYBIT --output-dir /tmp/foo/
 *
 * Exit codes:
 *   0  — success; all artifacts written
 *   1  — fetch failure, sanity-bound failure, or unresolved placeholder
 *   2  — usage error (missing --exchange, invalid arg, etc.)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const PERF_URL = process.env.ALGOVAULT_PERF_URL || 'https://api.algovault.com/api/performance-public';
const MERKLE_URL = process.env.ALGOVAULT_MERKLE_URL || 'https://api.algovault.com/api/merkle-batches';
const HEALTH_URL = process.env.ALGOVAULT_HEALTH_URL || 'https://api.algovault.com/health';

const TUTORIAL_BASE = 'https://algovault.com/docs/integrations';
const DEMO_BASE = 'https://github.com/AlgoVaultLabs/algovault-skills/blob/main/examples';

const SUPPORTED = ['BINANCE', 'BYBIT', 'OKX', 'BITGET', 'HYPERLIQUID', 'KRAKEN'];

function parseArgs(argv) {
  const out = { exchange: null, outputDir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--exchange' || a === '-e') out.exchange = (argv[++i] || '').toUpperCase();
    else if (a === '--output-dir' || a === '-o') out.outputDir = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.error(`Usage: generate_skill_submission.mjs --exchange <NAME> [--output-dir <path>]`);
      console.error(`Supported: ${SUPPORTED.join(', ')} (extensible via SUBMIT_<NAME>.md)`);
      process.exit(2);
    }
  }
  return out;
}

function die(msg, code = 1) {
  console.error(`GEN_FAIL: ${msg}`);
  process.exit(code);
}

async function fetchJson(url, sanityCheck) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) die(`fetch ${url} returned HTTP ${res.status}`);
  let body;
  try { body = await res.json(); } catch (e) { die(`fetch ${url} returned non-JSON: ${e.message}`); }
  if (sanityCheck) {
    const err = sanityCheck(body);
    if (err) die(`sanity check failed for ${url}: ${err}`);
  }
  return body;
}

function formatTotalCalls(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    die(`totalCalls invalid: ${n}`);
  }
  const floored = Math.floor(n / 1000) * 1000;
  return floored.toLocaleString('en-US') + '+';
}

function formatPfeWr(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) die(`pfeWinRate invalid: ${raw}`);
  return (raw * 100).toFixed(1);
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function extractBlock(template, startMarker, endMarker) {
  const startIdx = template.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = template.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) die(`template has ${startMarker} but no matching ${endMarker}`);
  return template.slice(startIdx + startMarker.length, endIdx).trim();
}

function substitute(text, subs) {
  let out = text;
  for (const [token, value] of Object.entries(subs)) {
    out = out.split(token).join(value);
  }
  return out;
}

function unresolvedPlaceholders(text) {
  const matches = text.match(/<[A-Z][A-Z0-9_]+>/g);
  if (!matches) return [];
  return [...new Set(matches)];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.exchange) die('--exchange is required (e.g. --exchange BINANCE)', 2);

  const exchangeUpper = args.exchange;
  const exchangeLower = exchangeUpper.toLowerCase();
  const exchangeTitle = titleCase(exchangeUpper);
  const tutorialUrl = `${TUTORIAL_BASE}/${exchangeLower}`;
  const demoUrl = `${DEMO_BASE}/${exchangeLower}/demo.mjs`;
  const provenanceDate = isoDate();

  const templatePath = join(REPO_ROOT, 'docs', `SUBMIT_${exchangeUpper}.md`);
  if (!existsSync(templatePath)) {
    die(`template not found: ${templatePath} (expected for exchange ${exchangeUpper})`);
  }
  const template = await readFile(templatePath, 'utf8');

  console.error(`[gen] fetching live data...`);
  const [perf, merkle, health] = await Promise.all([
    fetchJson(PERF_URL, (b) => {
      const wr = b?.overall?.pfeWinRate;
      const tc = b?.overall?.totalCalls;
      if (typeof wr !== 'number' || wr < 0.5 || wr > 1.0) return `pfeWinRate ${wr} outside [0.5, 1.0]`;
      if (typeof tc !== 'number' || tc < 1000) return `totalCalls ${tc} too low (need > 1000)`;
      return null;
    }),
    fetchJson(MERKLE_URL, (b) => {
      const n = Array.isArray(b?.batches) ? b.batches.length : null;
      if (n == null || n <= 0) return `batches.length invalid: ${n}`;
      return null;
    }),
    fetchJson(HEALTH_URL, (b) => {
      if (!b?.version || !/^\d+\.\d+\.\d+$/.test(b.version)) return `version "${b?.version}" not semver`;
      return null;
    }),
  ]);

  const subs = {
    '<PFE_WR>': formatPfeWr(perf.overall.pfeWinRate),
    '<TOTAL_CALLS>': formatTotalCalls(perf.overall.totalCalls),
    '<BATCH_COUNT>': String(merkle.batches.length),
    '<VERSION>': health.version,
    '<EXCHANGE_UPPER>': exchangeUpper,
    '<EXCHANGE_LOWER>': exchangeLower,
    '<EXCHANGE_TITLE>': exchangeTitle,
    '<TUTORIAL_URL>': tutorialUrl,
    '<DEMO_URL>': demoUrl,
    '<PROVENANCE_DATE>': provenanceDate,
  };

  const skillMdRaw = extractBlock(template, '<!-- SKILL_MD_START -->', '<!-- SKILL_MD_END -->');
  const prTitleRaw = extractBlock(template, '<!-- PR_TITLE_START -->', '<!-- PR_TITLE_END -->');
  const prBodyRaw = extractBlock(template, '<!-- PR_BODY_START -->', '<!-- PR_BODY_END -->');
  if (!prTitleRaw) die(`template ${templatePath} missing PR_TITLE block`);
  if (!prBodyRaw) die(`template ${templatePath} missing PR_BODY block`);

  // Internal-only comments live in the template (`<!-- LITERAL: ... -->`
  // markers exempt the canary from forbidden-literal checks). Strip them
  // from generator output so submission artifacts are clean.
  const stripInternalComments = (s) =>
    s
      .replace(/[ \t]*<!--\s*LITERAL:[\s\S]*?-->/g, '')
      .replace(/[ \t]+$/gm, '');

  let skillMd = null;
  if (skillMdRaw) {
    skillMd = substitute(skillMdRaw, subs);
    skillMd = skillMd.replace(/^```markdown\n/, '').replace(/\n```\s*$/, '');
    skillMd = stripInternalComments(skillMd);
  }
  const prTitle = stripInternalComments(substitute(prTitleRaw, subs));
  const prBody = stripInternalComments(substitute(prBodyRaw, subs));

  const checkArtifacts = { 'PR_TITLE': prTitle, 'PR_BODY': prBody };
  if (skillMd) checkArtifacts['SKILL.md'] = skillMd;
  for (const [name, content] of Object.entries(checkArtifacts)) {
    const left = unresolvedPlaceholders(content);
    if (left.length) die(`${name} has unresolved placeholders: ${left.join(', ')}`);
  }

  const outputDir = args.outputDir || `/tmp/skill-${exchangeLower}-${Date.now()}/`;
  await mkdir(outputDir, { recursive: true });

  const summary = [
    `# ${exchangeUpper} skill submission — generator output`,
    ``,
    `**Generated:** ${new Date().toISOString()}`,
    `**Template:** docs/SUBMIT_${exchangeUpper}.md`,
    `**Output dir:** ${outputDir}`,
    ``,
    `## Resolved values`,
    ``,
    `| token | value |`,
    `|---|---|`,
    ...Object.entries(subs).map(([k, v]) => `| \`${k}\` | \`${v}\` |`),
    ``,
    `## Provenance`,
    ``,
    `- \`/api/performance-public.overall.pfeWinRate\` = \`${perf.overall.pfeWinRate}\` → \`${subs['<PFE_WR>']}\`%`,
    `- \`/api/performance-public.overall.totalCalls\` = \`${perf.overall.totalCalls}\` → \`${subs['<TOTAL_CALLS>']}\``,
    `- \`/api/merkle-batches.batches.length\` = \`${merkle.batches.length}\` → \`${subs['<BATCH_COUNT>']}\``,
    `- \`/health.version\` = \`${health.version}\` → \`${subs['<VERSION>']}\``,
    ``,
    `## Artifacts written`,
    ``,
    skillMd ? `- \`SKILL.md\` (${skillMd.length} bytes) — paste into fork at \`skills/algovault/SKILL.md\`` : `- (no SKILL.md — template has no \`<!-- SKILL_MD_START -->\` block; this is an Issue / Discussion submission)`,
    `- \`PR_TITLE.txt\` (${prTitle.length} bytes)`,
    `- \`PR_BODY.md\` (${prBody.length} bytes)`,
    ``,
    `## Next step`,
    ``,
    `Review artifacts, then run the \`gh\` invocation from \`docs/SUBMIT_${exchangeUpper}.md\`.`,
    ``,
  ].join('\n');

  await writeFile(join(outputDir, 'PR_TITLE.txt'), prTitle + '\n');
  await writeFile(join(outputDir, 'PR_BODY.md'), prBody + '\n');
  await writeFile(join(outputDir, 'SUMMARY.md'), summary);
  if (skillMd) await writeFile(join(outputDir, 'SKILL.md'), skillMd + '\n');

  console.error(`[gen] wrote artifacts to ${outputDir}`);
  console.log(outputDir);
}

main().catch((e) => die(`uncaught: ${e.stack || e.message || e}`));
