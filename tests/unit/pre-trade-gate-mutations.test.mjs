// Proves tests/unit/pre-trade-gate.test.mjs and pre-trade-gate-harnesses.test.mjs can fail.
//
// Each mutation breaks one safety property in a COPY of plugins/pre-trade-gate, and the
// suite that holds its assertion, pointed at that copy through PRE_TRADE_GATE_ROOT, must
// go red. Each suite's unmutated copy must stay green, so a red comes from the mutation
// and not from the copying. A
// mutation whose target text is not found exactly once fails here: a refactor has to
// move the mutation with the code, never skip it.
//
// Run: node --test tests/unit/pre-trade-gate-mutations.test.mjs

import { test, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PLUGIN = join(REPO, 'plugins', 'pre-trade-gate');
const SUITE = join(REPO, 'tests', 'unit', 'pre-trade-gate.test.mjs');
const HARNESS_SUITE = join(REPO, 'tests', 'unit', 'pre-trade-gate-harnesses.test.mjs');

// Each mutation runs the suite that holds its assertion (default: the Claude Code suite).
const MUTATIONS = [
  {
    name: 'WAIT allowed',
    file: 'scripts/lib/core.mjs',
    from: "else if (r.decision === 'WAIT') waits.push(COPY.wait(leg.coin, leg.side, r.reason_codes));",
    to: "else if (r.decision === 'WAIT') passed.push(describePass(leg, r, now));",
  },
  {
    name: 'freshness ignored',
    file: 'scripts/lib/core.mjs',
    from: 'if (!isFresh(r, now, maxAgeMs)) continue;',
    to: 'if (false) continue;',
  },
  {
    name: 'side ignored',
    file: 'scripts/lib/core.mjs',
    from: 'if (r.coin !== leg.coin || r.side !== leg.side) continue;',
    to: 'if (r.coin !== leg.coin) continue;',
  },
  {
    name: 'a throw exiting 0',
    file: 'scripts/gate.mjs',
    from: 'PREFIX + message}\\n`);\n  process.exitCode = 2;',
    to: 'PREFIX + message}\\n`);\n  process.exitCode = 0;',
  },
  {
    name: 'a refusal recorded',
    file: 'scripts/lib/check-response.mjs',
    from: 'if (!DECISIONS.includes(decision)) {',
    to: 'if (false) {',
  },
  {
    name: 'onFailure removed',
    file: 'hooks/hooks.json',
    from: ',\n            "onFailure": "block"',
    to: '',
  },
  {
    name: 'reduce-only ignored',
    file: 'scripts/lib/normalize.mjs',
    from: "return v === true || (typeof v === 'string' && v.trim().toLowerCase() === 'true');",
    to: 'return false;',
  },
  {
    name: 'ask passed through on Codex',
    suite: HARNESS_SUITE,
    file: 'scripts/codex.mjs',
    from: "  if (result.decision === 'ask') return deny(result.reason);",
    to: "  if (result.decision === 'ask') return { stdout: { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: result.reason } }, exitCode: 0 };",
  },
  {
    name: 'an AlgoVault tool reaching the classifier under a broken option',
    suite: HARNESS_SUITE,
    file: 'scripts/lib/core.mjs',
    from: "  if (isAlgoVaultTool(input.toolName, input.serverName)) return { decision: 'allow', reason: 'an AlgoVault tool', context: null };\n",
    to: '',
  },
  {
    name: 'an mcp_<server>_<tool> order tool left unparsed',
    suite: HARNESS_SUITE,
    file: 'scripts/lib/order-tools.mjs',
    from: "  if (toolName.startsWith('mcp_')) {",
    to: '  if (false) {',
  },
];

const suiteOf = (m) => (m && m.suite) || SUITE;
const SUITES = [...new Set([SUITE, ...MUTATIONS.map(suiteOf)])];
const controlName = (suite) => (suite === SUITE ? 'control (no mutation)' : `control (no mutation): ${basename(suite)}`);

function countOf(haystack, needle) {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length)) n++;
  return n;
}

/** A copy of the plugin with at most one mutation applied. */
function mutatedCopy(m) {
  const dir = mkdtempSync(join(tmpdir(), 'ptg-mut-'));
  cpSync(PLUGIN, dir, { recursive: true });
  if (m) {
    const file = join(dir, m.file);
    const src = readFileSync(file, 'utf8');
    const n = countOf(src, m.from);
    if (n !== 1) throw new Error(`mutation "${m.name}": target found ${n} times in ${m.file}, expected exactly 1`);
    writeFileSync(file, src.replace(m.from, m.to));
  }
  return dir;
}

function runSuite(root, suite) {
  return new Promise((done, reject) => {
    const env = { ...process.env, PRE_TRADE_GATE_ROOT: root };
    delete env.NODE_TEST_CONTEXT; // run as a top-level test process, not as this runner's child
    const child = spawn(process.execPath, ['--test', '--test-reporter=dot', suite], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (out += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => done({ code, out }));
  });
}

const results = new Map();

before(async () => {
  const runs = [
    ...SUITES.map((suite) => ({ name: controlName(suite), m: null, suite })),
    ...MUTATIONS.map((m) => ({ name: m.name, m, suite: suiteOf(m) })),
  ];
  await Promise.all(
    runs.map(async ({ name, m, suite }) => {
      try {
        results.set(name, await runSuite(mutatedCopy(m), suite));
      } catch (err) {
        results.set(name, { error: err });
      }
    }),
  );
});

for (const suite of SUITES) {
  test(`control: the unmutated copy passes ${basename(suite)}`, () => {
    const r = results.get(controlName(suite));
    assert.ok(!r.error, r.error && r.error.message);
    assert.equal(r.code, 0, `the control run failed, so a mutation red would mean nothing:\n${r.out.slice(-3000)}`);
  });
}

for (const m of MUTATIONS) {
  test(`mutation goes red: ${m.name}`, () => {
    const r = results.get(m.name);
    assert.ok(!r.error, r.error && r.error.message);
    assert.notEqual(r.code, 0, `the suite stayed green with "${m.name}" applied`);
  });
}
