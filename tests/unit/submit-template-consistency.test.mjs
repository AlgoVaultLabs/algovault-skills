// Unit tests for docs/SUBMIT_*.md template consistency.
//
// Per BINANCE-SKILLS-HUB-SUBMISSION-W1, every SUBMIT_*.md file is a
// `<PLACEHOLDER>`-driven template consumed by
// `scripts/generate_skill_submission.mjs`. Hardcoded values (PFE WR %,
// totalCalls, batch count, MCP server semver, legacy `get_trade_signal`
// tool name) are forbidden — they rot at the cadence of every shipped
// wave and create silent staleness.
//
// This canary fails the build if any forbidden literal appears outside
// a documented exempt context. Mirror of the
// `crypto-quant-signal-mcp/tests/unit/copy-consistency.test.ts` pattern,
// adapted for `node --test`.
//
// Run: `node --test tests/unit/submit-template-consistency.test.mjs`

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const DOCS_DIR = join(REPO_ROOT, 'docs');

const TEMPLATED_FILES = readdirSync(DOCS_DIR)
  .filter((f) => /^SUBMIT_(BINANCE|BYBIT|OKX|BITGET)\.md$/.test(f))
  .map((f) => join('docs', f));

// Forbidden literal patterns. Each pattern represents a value that drifts
// over time and should be `<PLACEHOLDER>`-substituted at generator-run time.
const FORBIDDEN = [
  {
    name: 'PFE WR % literal (e.g. "89.5%", "90.1%")',
    re: /\b\d{1,3}\.\d%/g,
  },
  {
    name: 'Total-calls "+"-suffix literal (e.g. "54,629+", "78,000+")',
    re: /\b\d{1,3}(?:,\d{3})+\+/g,
  },
  {
    name: 'Bare semver MCP version (e.g. "1.10.7", "v1.9.0")',
    re: /\bv?\d+\.\d+\.\d+\b/g,
  },
  {
    name: 'Legacy tool name "get_trade_signal" (renamed to get_trade_call per OUTPUT-SANITIZE-W1)',
    re: /\bget_trade_signal\b/g,
  },
];

// Exempt contexts (per-line). A line containing any of these markers is
// allowed to reference literals — these markers indicate the line is
// either a placeholder example, a documented constants block, or a
// non-template description (e.g. README columns, third-party tool
// versions).
const EXEMPT_LINE_PATTERNS = [
  /<[A-Z][A-Z0-9_]+>/, // line contains a placeholder token like <VERSION>
  /<!--\s*LITERAL:/i, // explicit literal marker comment
  /^\s*\|\s*Example/, // markdown-table "Example" column header / row
  /^\s*\|\s*`<[A-Z]/, // markdown-table cell describing a placeholder e.g. `<VERSION>`
  // Third-party artifact versions are NOT AlgoVault values and shouldn't
  // be templated. Whitelist them by exact substring on the line.
  /bybit-official-trading-server@/i,
  /bitget-mcp-server@/i,
];

function isExempt(line) {
  return EXEMPT_LINE_PATTERNS.some((re) => re.test(line));
}

test('TEMPLATED_FILES list is non-empty (sanity check)', () => {
  assert.ok(TEMPLATED_FILES.length >= 4, `expected ≥4 SUBMIT_*.md files, got ${TEMPLATED_FILES.length}`);
});

for (const relPath of TEMPLATED_FILES) {
  const absPath = join(REPO_ROOT, relPath);
  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');

  test(`${relPath} — no hardcoded forbidden literals outside exempt contexts`, () => {
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isExempt(line)) continue;
      for (const { name, re } of FORBIDDEN) {
        re.lastIndex = 0;
        const matches = line.match(re);
        if (matches) {
          violations.push({ lineNum: i + 1, line: line.trim(), match: matches[0], rule: name });
        }
      }
    }
    if (violations.length > 0) {
      const detail = violations
        .map((v) => `  L${v.lineNum} [${v.rule}]: "${v.match}" → ${v.line.slice(0, 120)}`)
        .join('\n');
      assert.fail(
        `${relPath} has ${violations.length} forbidden literal(s):\n${detail}\n\nFix: replace each literal with the appropriate <PLACEHOLDER> token (see docs/SUBMIT_${relPath.includes('BINANCE') ? 'BINANCE' : 'BYBIT'}.md "Placeholder tokens" table) and re-run \`node scripts/generate_skill_submission.mjs --exchange <X>\` to substitute live values.`
      );
    }
  });

  test(`${relPath} — has at least one <PLACEHOLDER> token (smoke check)`, () => {
    const placeholders = content.match(/<[A-Z][A-Z0-9_]+>/g) || [];
    assert.ok(
      placeholders.length >= 3,
      `expected ≥3 <PLACEHOLDER> tokens in ${relPath}, found ${placeholders.length}: ${[...new Set(placeholders)].join(', ')}`
    );
  });

  test(`${relPath} — has PR_TITLE and PR_BODY block markers`, () => {
    assert.match(content, /<!-- PR_TITLE_START -->/, 'missing PR_TITLE_START marker');
    assert.match(content, /<!-- PR_TITLE_END -->/, 'missing PR_TITLE_END marker');
    assert.match(content, /<!-- PR_BODY_START -->/, 'missing PR_BODY_START marker');
    assert.match(content, /<!-- PR_BODY_END -->/, 'missing PR_BODY_END marker');
  });
}

test('SUBMIT_BINANCE.md — has SKILL_MD block markers (only file with SKILL.md submission shape)', () => {
  const content = readFileSync(join(REPO_ROOT, 'docs', 'SUBMIT_BINANCE.md'), 'utf8');
  assert.match(content, /<!-- SKILL_MD_START -->/);
  assert.match(content, /<!-- SKILL_MD_END -->/);
});
