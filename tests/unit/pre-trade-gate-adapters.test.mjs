// Unit tests for the Cursor, Gemini CLI and Devin adapters of the pre-trade gate.
//
// Each adapter runs the way its harness runs it: the documented hook JSON on stdin
// (tests/fixtures/pre-trade-gate/harness-inputs.json), the exit code, stdout and stderr read
// back, and each answer checked against the deny shape and ask support its row in
// harnesses.mjs declares. No network and no order.
//
// PRE_TRADE_GATE_ROOT points the suite at another copy of the plugin (the mutation suite).
//
// Run: node --test tests/unit/pre-trade-gate-adapters.test.mjs

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.PRE_TRADE_GATE_ROOT
  ? resolve(process.env.PRE_TRADE_GATE_ROOT)
  : join(REPO, 'plugins', 'pre-trade-gate');
const fixture = (f) => JSON.parse(readFileSync(join(REPO, 'tests', 'fixtures', 'pre-trade-gate', f), 'utf8'));
const CHECKS = fixture('check-results.json');
const INPUTS = fixture('harness-inputs.json');
const { HARNESSES, harness } = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'harnesses.mjs')).href);

const COPY1 = (coin, side) =>
  `pre-trade gate: Missing check for ${coin} ${side}. Run pre_trade_check first (or use reduce-only to close).`;
const COPY2 = (coin, side, codes) =>
  `pre-trade gate: pre_trade_check returned WAIT for ${coin} ${side} (${codes}). Execution stopped.`;

const newData = () => mkdtempSync(join(tmpdir(), 'ptg-a-'));
const clone = (o) => JSON.parse(JSON.stringify(o));

function withCheck(template, payload) {
  const text = JSON.stringify(payload);
  const resultJson = JSON.stringify({ content: [{ type: 'text', text }] });
  const fill = (v) => {
    if (v === '__CHECK__') return text;
    if (v === '__CHECK_RESULT__') return resultJson;
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]));
    return v;
  };
  return fill(clone(template));
}

function run(id, mode, input, { env = {}, args = [] } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [join(ROOT, 'scripts', harness(id).adapter), mode, ...args], {
      env: { PATH: process.env.PATH ?? '', ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      let json = null;
      if (stdout.trim()) {
        try {
          json = JSON.parse(stdout);
        } catch {
          json = { unparseable: stdout };
        }
      }
      done({ code, stdout, stderr, json });
    });
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

function storeCheck(data, session, { decision, codes = [] }) {
  const dir = join(data, 'checks', session);
  mkdirSync(dir, { recursive: true });
  const rec = {
    coin: 'BTC', side: 'long', size_usd: 1000, decision, reason_codes: codes, best_venue: 'BINANCE',
    as_of: new Date().toISOString(), recorded_at: Date.now(),
  };
  writeFileSync(join(dir, `stored-${Math.random().toString(16).slice(2)}.json`), JSON.stringify(rec));
}

/** The deny each row declares, read back from an adapter's answer. */
function assertDeniedAs(id, r, message) {
  const row = harness(id);
  assert.equal(r.code, 2, `${id}: expected exit 2, got ${r.code}; stderr: ${r.stderr}`);
  assert.ok(r.stderr.includes(message), `${id}: stderr lacks the reason: ${r.stderr}`);
  if (row.deny === 'permission') {
    assert.deepEqual(r.json, { permission: 'deny', user_message: message, agent_message: message });
  } else if (row.deny === 'decision') {
    assert.deepEqual(r.json, { decision: 'deny', reason: message });
  } else if (row.deny === 'exit-2') {
    assert.equal(r.stdout, '', `${id}: a deny by exit code prints nothing`);
  } else if (row.deny === 'permissionDecision') {
    assert.equal(r.json?.hookSpecificOutput?.permissionDecision, 'deny');
  } else {
    assert.fail(`${id}: no assertion for deny shape ${row.deny}`);
  }
}

/** A pass: Cursor must answer permission "allow" (no answer blocks there); the others print nothing. */
function assertPassedAs(id, r, context) {
  assert.equal(r.code, 0, `${id}: expected exit 0, got ${r.code}; stderr: ${r.stderr}`);
  if (harness(id).deny === 'permission') {
    assert.equal(r.json?.permission, 'allow', `${id}: ${r.stdout}`);
    if (context) for (const f of context) assert.ok(r.json.agent_message.includes(f), `${id}: agent_message lacks ${f}`);
    else assert.equal(r.json.agent_message, undefined);
  } else {
    assert.equal(r.stdout, '', `${id}: an allow prints nothing, got: ${r.stdout}`);
  }
}

const ADAPTED = ['cursor', 'gemini', 'devin'];
const session = (id) => INPUTS[id].gate[harness(id).sessionKey];

describe('the adapters', () => {
  test('every row names an adapter that exists', () => {
    for (const h of HARNESSES) assert.ok(existsSync(join(ROOT, 'scripts', h.adapter)), `${h.id}: no ${h.adapter}`);
  });
});

describe('Cursor, Gemini CLI and Devin: JSON in and out', { concurrency: true }, () => {
  for (const id of ADAPTED) {
    test(`${id}: an unchecked order is denied with the missing-check message`, async () => {
      assertDeniedAs(id, await run(id, 'gate', INPUTS[id].gate, { args: ['--data-dir', newData()] }), COPY1('BTC', 'long'));
    });

    test(`${id}: record, then the order passes`, async () => {
      const data = newData();
      const rec = await run(id, 'record', withCheck(INPUTS[id].record, CHECKS.caution), { args: ['--data-dir', data] });
      assert.equal(rec.code, 0, rec.stderr);
      assert.equal(rec.stdout, '');
      assertPassedAs(id, await run(id, 'gate', INPUTS[id].gate, { args: ['--data-dir', data] }), ['decision CAUTION', 'REGIME_AGAINST_SIDE']);
    });

    test(`${id}: a WAIT under on_wait ask ${harness(id).ask ? 'asks a person' : 'is denied (no ask)'}`, async () => {
      const data = newData();
      writeFileSync(join(data, 'options.json'), JSON.stringify({ on_wait: 'ask' }));
      storeCheck(data, session(id), { decision: 'WAIT', codes: ['FUNDING_COST_HIGH'] });
      const r = await run(id, 'gate', INPUTS[id].gate, { args: ['--data-dir', data] });
      const message = COPY2('BTC', 'long', 'FUNDING_COST_HIGH');
      if (harness(id).ask) {
        assert.equal(r.code, 0, r.stderr);
        assert.deepEqual(r.json, { permission: 'ask', user_message: message, agent_message: message });
      } else {
        assertDeniedAs(id, r, message);
      }
    });

    test(`${id}: a tool that is not an order passes`, async () => {
      const input = clone(INPUTS[id].gate);
      input.tool_name = id === 'cursor' ? 'create_issue' : id === 'gemini' ? 'mcp_github_create_issue' : 'mcp__github__create_issue';
      if (id === 'cursor') input.mcp_server_name = 'github';
      input.tool_input = id === 'cursor' ? '{"title":"x"}' : { title: 'x' };
      assertPassedAs(id, await run(id, 'gate', input, { args: ['--data-dir', newData()] }));
    });

    test(`${id}: an AlgoVault tool passes with a broken option and no data dir`, async () => {
      const input = clone(INPUTS[id].gate);
      input.tool_name = id === 'cursor' ? 'pre_trade_check' : id === 'gemini' ? 'mcp_algovault_pre_trade_check' : 'mcp__algovault__pre_trade_check';
      if (id === 'cursor') input.mcp_server_name = 'algovault';
      assertPassedAs(id, await run(id, 'gate', input, { env: { CLAUDE_PLUGIN_OPTION_ORDER_TOOLS: '(' } }));
    });

    for (const [name, mode, input, args] of [
      ['an unknown mode', 'approve', INPUTS[id].gate, ['--data-dir', '/tmp']],
      ['stdin that is not JSON', 'gate', '{not json', ['--data-dir', '/tmp']],
      ['an order with no data dir', 'gate', INPUTS[id].gate, []],
      ['record with no data dir', 'record', withCheck(INPUTS[id].record, CHECKS.go), []],
    ]) {
      test(`${id}: every error exits 2: ${name}`, async () => {
        const r = await run(id, mode, input, { args });
        assert.equal(r.code, 2, `exit ${r.code}; stderr: ${r.stderr}`);
        assert.match(r.stderr, /^pre-trade gate: /);
      });
    }
  }
});
