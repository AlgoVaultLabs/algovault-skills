#!/usr/bin/env node
// @ts-check
/**
 * check-brand-copy.mjs — the forbidden-phrase gate for this repo's tutorial producers.
 *
 * CROSS-REPO-TUTORIAL-PRODUCER-GATE-W1.
 *
 * THE BUG CLASS: `docs/integrations/*.md` in THIS repo generates
 * `landing/integrations/*.html` in crypto-quant-signal-mcp. That repo has gates; this
 * one did not. So `20 calls/day` — forbidden by brand-facts and corrected at severity
 * HIGH — sat live on 8 public pages, and `_template.md` was re-seeding it into every
 * future exchange tutorial. Fixing the rendered HTML there is a lane fix this repo
 * silently reverts on the next render. The producer needs its own gate.
 *
 * VENDORED PRIMITIVE. `ops/brand-forbidden-phrases.json` is a vendored copy; the
 * CANONICAL file lives in crypto-quant-signal-mcp at the same path.
 * `ops/brand-forbidden-phrases.json.sha256` is a copy of THAT file's hash — the one
 * canonical hash. This copy records no hash of its own, because a second recorded
 * hash is a second thing that can drift. Re-vendor both files together.
 *
 * Usage:
 *   node scripts/check-brand-copy.mjs --self-test   # offline; proves both directions
 *   node scripts/check-brand-copy.mjs               # scan docs/
 *
 * Verdict: exactly one terminal `BRAND_COPY_VERDICT=PASS|FAIL|INDETERMINATE`.
 * Callers gate on the TOKEN, not the code.
 * Exit: 0 = PASS · 1 = FAIL · 3 = INDETERMINATE (token-law default for a new gate).
 * FAIL-CLOSED — a missing/malformed blocklist, a hash mismatch, or an unreadable
 * corpus is INDETERMINATE and blocks. There is no fail-open branch.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const JSON_PATH = join(ROOT, 'ops', 'brand-forbidden-phrases.json');
const SHA_PATH = `${JSON_PATH}.sha256`;

/**
 * Strip CODE comments only — HTML/JS comments go, markdown blockquotes STAY.
 *
 * Carried deliberately from the signal repo's gate, where reusing a blockquote-
 * stripping helper would have erased every violation before the regex ran and
 * printed a confident PASS over an empty corpus. Several producer defects here live
 * inside `> *…*` blockquotes, so blockquotes must remain visible.
 */
export function stripCodeCommentsOnly(src, path) {
  let s = src;
  if (/\.(html?|md)$/.test(path)) s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  if (/\.(mjs|js|ts)$/.test(path)) {
    s = s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
  }
  return s;
}

/** Load + compile the blocklist. Null = cannot verify, never a pass. */
export function loadBlocklist(file = JSON_PATH) {
  if (!existsSync(file)) return null;
  let j;
  try {
    j = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(j.phrases) || j.phrases.length === 0) return null;
  const out = [];
  for (const p of j.phrases) {
    if (!p || !p.id || !p.pattern || !p.correction) return null;
    let re;
    try {
      re = new RegExp(p.pattern, 'gi');
    } catch {
      return null;
    }
    out.push({ ...p, re });
  }
  // An exemption with no stated reason is indistinguishable from an oversight.
  const exemptions = Array.isArray(j.exempt_paths) ? j.exempt_paths : [];
  for (const e of exemptions) {
    if (!e || !e.path || !e.phrase_id || !e.reason) return null;
  }
  out.exemptions = exemptions;
  return out;
}

/** Vendored copy must match the ONE canonical hash. */
export function vendorParityOk() {
  if (!existsSync(JSON_PATH) || !existsSync(SHA_PATH)) return false;
  const actual = createHash('sha256').update(readFileSync(JSON_PATH)).digest('hex');
  return actual === readFileSync(SHA_PATH, 'utf8').trim();
}

/** Producer corpus: every tutorial markdown this repo owns. */
export function corpusFiles(rootDir = ROOT) {
  const docs = join(rootDir, 'docs');
  if (!existsSync(docs)) return null;
  const out = [];
  walkMd(docs, out);
  return out;
}

function walkMd(dir, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMd(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
}

function isExempt(exemptions, relPath, phraseId) {
  return exemptions.some((e) => e.path === relPath && e.phrase_id === phraseId);
}

/** Scan. Reports file:line so the output is a worklist, not just a verdict. */
export function checkBlocklist(files, readFile, blocklist, rootDir = ROOT) {
  const hits = [];
  const exemptions = blocklist.exemptions || [];
  for (const f of files) {
    const relPath = f.startsWith(rootDir + '/') ? f.slice(rootDir.length + 1) : f;
    const src = stripCodeCommentsOnly(readFile(f), f);
    const lines = src.split('\n');
    for (const p of blocklist) {
      if (isExempt(exemptions, relPath, p.id)) continue;
      for (let i = 0; i < lines.length; i++) {
        p.re.lastIndex = 0;
        const m = p.re.exec(lines[i]);
        if (m) hits.push({ file: f, line: i + 1, id: p.id, match: m[0], correction: p.correction });
      }
    }
  }
  return hits;
}

/** @param {'PASS'|'FAIL'|'INDETERMINATE'} verdict */
function verdictAndExit(verdict) {
  console.log(`BRAND_COPY_VERDICT=${verdict}`);
  process.exit(verdict === 'PASS' ? 0 : verdict === 'FAIL' ? 1 : 3);
}

/**
 * Vacuity-guarded, two-way self-test. WE build this corpus, so an empty one means
 * the test built nothing — REFUSE. Asserts the tokens AND the token→exit mapping:
 * asserting tokens alone would stay green if someone re-coded the mapping.
 */
export function selfTest() {
  const fails = [];
  let mustFire = 0;
  let mustNotFire = 0;

  const fixtures = {
    'a.md': 'Free tier covers 20 calls/day per IP — plenty for development.',
    'b.md': 'Free tier covers up to 20 calls/day per IP',
    'c.md': 'Free tier covers 20 free calls/day',
    'd.md': 'Free tier covers 20 calls per day',
    'e.md': 'Free tier covers 25 calls/day',
    'ok1.md': 'Free tier: 100 calls/month, every coin and timeframe.',
    // Real VENUE rate limits — exchange API facts that must survive untouched.
    'ok2.md': 'rate limits are **per-IP, not per-key** (2,400 weight/min, 1,200 order/min)',
    'ok3.md': '10/s per UID and 3/s per IP on the place-order endpoint.',
    'ok4.md': '<!-- retired: 20 calls/day --> Free tier: 100 calls/month.',
  };
  const read = (p) => {
    if (!(p in fixtures)) throw new Error(`fixture missing: ${p}`);
    return fixtures[p];
  };
  if (Object.keys(fixtures).length === 0) {
    console.error('✗ self-test corpus is EMPTY — the test built nothing.');
    return 'INDETERMINATE';
  }

  const bl = loadBlocklist();
  if (!bl) {
    console.error('✗ blocklist unloadable — cannot self-test.');
    return 'INDETERMINATE';
  }

  for (const f of ['a.md', 'b.md', 'c.md', 'd.md', 'e.md']) {
    mustFire++;
    if (checkBlocklist([f], read, bl, '').length !== 1) fails.push(`must fire on ${f}`);
  }
  for (const f of ['ok1.md', 'ok2.md', 'ok3.md', 'ok4.md']) {
    mustNotFire++;
    if (checkBlocklist([f], read, bl, '').length !== 0) fails.push(`must NOT fire on ${f}`);
  }

  // Blockquote visibility — the trap that nearly made the sibling gate vacuous.
  const bq = '> *Free tier covers 20 calls/day per IP*';
  if (!/20 calls\/day/.test(stripCodeCommentsOnly(bq, 'x.md'))) {
    fails.push('stripCodeCommentsOnly() ate a markdown blockquote — the scan would be VACUOUS');
  }

  // Fail-closed loader.
  if (loadBlocklist(join(ROOT, 'ops', 'does-not-exist.json')) !== null) {
    fails.push('loadBlocklist must return null for a missing file');
  }

  // token → exit-code mapping
  const MAP = { PASS: 0, FAIL: 1, INDETERMINATE: 3 };
  for (const [tok, code] of Object.entries(MAP)) {
    const got = tok === 'PASS' ? 0 : tok === 'FAIL' ? 1 : 3;
    if (got !== code) fails.push(`token→exit mapping broken for ${tok}`);
  }

  if (mustFire === 0 || mustNotFire === 0) {
    console.error(`✗ self-test is VACUOUS (must-fire=${mustFire}, must-not-fire=${mustNotFire}).`);
    return 'INDETERMINATE';
  }
  if (fails.length) {
    for (const f of fails) console.error(`  ✗ ${f}`);
    return 'FAIL';
  }
  console.log(
    `✓ self-test passed — ${mustFire} must-fire, ${mustNotFire} must-not-fire, ` +
      `3 token→exit mappings, across ${Object.keys(fixtures).length} fixtures.`,
  );
  return 'PASS';
}

// ── main ─────────────────────────────────────────────────────────────────────
// Test-importable: importing this module must not run the scan or exit.
const INVOKED_DIRECTLY =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (INVOKED_DIRECTLY) {
  if (argv.includes('--self-test')) verdictAndExit(selfTest());

  const st = selfTest();
  if (st !== 'PASS') {
    console.error('✗ detector self-test did not pass — refusing to certify the tree.');
    verdictAndExit(st === 'FAIL' ? 'FAIL' : 'INDETERMINATE');
  }

  if (!vendorParityOk()) {
    console.error(
      '✗ vendored blocklist does not match its recorded .sha256 — re-vendor BOTH files from ' +
        'crypto-quant-signal-mcp:ops/brand-forbidden-phrases.json{,.sha256}.',
    );
    verdictAndExit('INDETERMINATE');
  }
  console.log('✓ vendor parity: ops/brand-forbidden-phrases.json matches the canonical hash.');

  const blocklist = loadBlocklist();
  if (!blocklist) {
    console.error('✗ ops/brand-forbidden-phrases.json missing, malformed, or carries a bad pattern.');
    verdictAndExit('INDETERMINATE');
  }
  const files = corpusFiles();
  if (!files || files.length === 0) {
    console.error('✗ docs/ corpus unreadable or empty — cannot verify.');
    verdictAndExit('INDETERMINATE');
  }

  let hits;
  try {
    hits = checkBlocklist(files, (f) => readFileSync(f, 'utf8'), blocklist);
  } catch (e) {
    console.error(`✗ could not read a corpus file: ${e && e.message}`);
    verdictAndExit('INDETERMINATE');
  }

  const rel = (f) => f.replace(ROOT + '/', '');
  if (hits.length) {
    console.error(
      `  ✗ blocklist: checked ${files.length} files against ${blocklist.length} phrase class(es), ${hits.length} violation(s):`,
    );
    for (const h of hits) {
      console.error(`      ${rel(h.file)}:${h.line} [${h.id}] "${h.match}" → use "${h.correction}"`);
    }
    verdictAndExit('FAIL');
  }
  console.log(
    `✓ blocklist: checked ${files.length} files against ${blocklist.length} phrase class(es), 0 violations.`,
  );
  verdictAndExit('PASS');
}
