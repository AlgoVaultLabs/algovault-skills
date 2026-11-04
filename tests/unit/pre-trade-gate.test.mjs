// Unit tests for plugins/pre-trade-gate.
//
// Every case runs the hook script the way Claude Code runs it: the hook JSON on stdin,
// a temporary CLAUDE_PLUGIN_DATA, and the exit code, stdout and stderr read back. No
// network and no order: the "order tools" here are fixtures, and nothing calls them.
//
// PRE_TRADE_GATE_ROOT points the suite at another copy of the plugin; the mutation suite
// (pre-trade-gate-mutations.test.mjs) uses it to prove each assertion below can fail.
//
// Run: node --test tests/unit/pre-trade-gate.test.mjs

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.PRE_TRADE_GATE_ROOT
  ? resolve(process.env.PRE_TRADE_GATE_ROOT)
  : join(REPO, 'plugins', 'pre-trade-gate');
const GATE = join(ROOT, 'scripts', 'gate.mjs');
const CALLS = JSON.parse(readFileSync(join(REPO, 'tests/fixtures/pre-trade-gate/order-calls.json'), 'utf8'));
const CHECKS = JSON.parse(readFileSync(join(REPO, 'tests/fixtures/pre-trade-gate/check-results.json'), 'utf8'));
const lib = (f) => import(pathToFileURL(join(ROOT, 'scripts', 'lib', f)).href);
const { preToolUseMatcher, ALGOVAULT_TOOLS } = await lib('order-tools.mjs');
const { normalizeCoin } = await lib('normalize.mjs');

/** AlgoVault's live tools/list, read 2026-11-04. Kept here, not imported, so the plugin cannot shrink it. */
const R0_TOOLS_LIST = [
  'get_trade_call', 'get_trade_signal', 'get_market_regime', 'scan_funding_arb', 'scan_trade_calls',
  'scan_market_regimes', 'pre_trade_check', 'chat_knowledge', 'search_knowledge', 'get_track_record',
];
const ALGOVAULT_SERVERS = ['algovault', 'plugin_algovault-skills_algovault'];

/** The block messages, verbatim (approved copy). Written out here, never imported. */
const COPY1 = (coin, side) =>
  `pre-trade gate: Missing check for ${coin} ${side}. Run pre_trade_check first (or use reduce-only to close).`;
const COPY2 = (coin, side, codes) =>
  `pre-trade gate: pre_trade_check returned WAIT for ${coin} ${side} (${codes}). Execution stopped.`;

const SESSION = 'session-1';
const newData = () => mkdtempSync(join(tmpdir(), 'ptg-'));
let seq = 0;

function run(mode, input, { data, env = {} } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [GATE, mode], {
      env: { PATH: process.env.PATH ?? '', ...(data ? { CLAUDE_PLUGIN_DATA: data } : {}), ...env },
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

function gate(data, call, { session = SESSION, env } = {}) {
  return run(
    'gate',
    { hook_event_name: 'PreToolUse', session_id: session, tool_use_id: `toolu_g${++seq}`, tool_name: call.tool_name, tool_input: call.tool_input },
    { data, env },
  );
}

function shapeOf(payload, shape) {
  const text = JSON.stringify(payload);
  switch (shape) {
    case 'string': return text;
    case 'blocks': return [{ type: 'text', text }];
    case 'content': return { content: [{ type: 'text', text }] };
    case 'object': return payload;
    default: throw new Error(`no shape ${shape}`);
  }
}

function record(data, payload, { shape = 'blocks', session = SESSION, toolUseId, toolResponse, env } = {}) {
  return run(
    'record',
    {
      hook_event_name: 'PostToolUse',
      session_id: session,
      tool_use_id: toolUseId ?? `toolu_r${++seq}`,
      tool_name: 'mcp__algovault__pre_trade_check',
      tool_input: { coin: payload.coin ?? 'BTC', side: payload.side ?? 'long', sizeUsd: payload.size_usd ?? 1000 },
      tool_response: toolResponse ?? shapeOf(payload, shape),
    },
    { data, env },
  );
}

/** A check written straight to the store, so its age can be set. */
function storeCheck(data, { coin, side, decision, ageMinutes = 0, codes = [], session = SESSION }) {
  const dir = join(data, 'checks', session);
  mkdirSync(dir, { recursive: true });
  const rec = {
    coin, side, size_usd: 1000, decision, reason_codes: codes, best_venue: 'BINANCE',
    as_of: new Date().toISOString(), recorded_at: Date.now() - ageMinutes * 60_000,
  };
  writeFileSync(join(dir, `stored-${++seq}.json`), JSON.stringify(rec));
}

const checkFiles = (data, session = SESSION) => {
  const dir = join(data, 'checks', session);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
};

function assertDeny(r, ...messages) {
  assert.equal(r.code, 2, `expected exit 2, got ${r.code}; stderr: ${r.stderr}`);
  const out = r.json?.hookSpecificOutput;
  assert.equal(out?.permissionDecision, 'deny', `expected a deny, got ${r.stdout}`);
  for (const m of messages) {
    assert.ok(out.permissionDecisionReason.includes(m), `reason lacks: ${m}\n got: ${out.permissionDecisionReason}`);
    assert.ok(r.stderr.includes(m), `stderr lacks: ${m}`);
  }
}

function assertAllow(r, ...fragments) {
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}; stderr: ${r.stderr}`);
  const out = r.json?.hookSpecificOutput;
  assert.equal(out?.hookEventName, 'PreToolUse', `expected allow context, got: ${r.stdout}`);
  assert.equal(out.permissionDecision, undefined, 'an allow must never set permissionDecision (it would skip the permission prompt)');
  for (const f of fragments) assert.ok(out.additionalContext.includes(f), `context lacks: ${f}\n got: ${out.additionalContext}`);
}

function assertPass(r) {
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}; stderr: ${r.stderr}`);
  assert.equal(r.stdout, '', `a pass prints nothing, got: ${r.stdout}`);
}

function assertAsk(r, message) {
  assert.equal(r.code, 0, `expected exit 0, got ${r.code}; stderr: ${r.stderr}`);
  const out = r.json?.hookSpecificOutput;
  assert.equal(out?.permissionDecision, 'ask');
  assert.ok(out.permissionDecisionReason.includes(message), `reason lacks: ${message}`);
}

const gatedCases = Object.entries(CALLS.gated);

describe('hooks.json', () => {
  const hooks = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks;
  const pre = hooks.PreToolUse;
  const post = hooks.PostToolUse;

  test('two hooks, exec form, node + the gate script, timeout 10', () => {
    assert.equal(pre.length, 1);
    assert.equal(post.length, 1);
    for (const [entry, mode] of [[pre[0], 'gate'], [post[0], 'record']]) {
      assert.equal(entry.hooks.length, 1);
      const h = entry.hooks[0];
      assert.equal(h.type, 'command');
      assert.equal(h.command, 'node');
      assert.deepEqual(h.args, ['${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs', mode]);
      assert.equal(h.timeout, 10);
    }
  });

  test('the PreToolUse hook blocks when it fails: onFailure "block"', () => {
    assert.equal(pre[0].hooks[0].onFailure, 'block');
  });

  test('the PreToolUse matcher is the core derivation, and a regex (not an exact-name list)', () => {
    assert.equal(pre[0].matcher, preToolUseMatcher());
    assert.ok(/[^A-Za-z0-9_\-\s,|]/.test(pre[0].matcher), 'a matcher of only name characters is compared as an exact string');
    assert.ok(/[^A-Za-z0-9_\-\s,|]/.test(post[0].matcher));
  });

  test('the PreToolUse matcher hits every corpus order tool', () => {
    const re = new RegExp(pre[0].matcher);
    const names = [...gatedCases, ...Object.entries(CALLS.unreadable)].map(([, c]) => c.tool_name);
    for (const n of names) assert.ok(re.test(n), `matcher misses ${n}`);
  });

  test('no AlgoVault tools/list name hits the PreToolUse matcher, under any server name', () => {
    const re = new RegExp(pre[0].matcher);
    for (const t of R0_TOOLS_LIST) {
      assert.ok(ALGOVAULT_TOOLS.includes(t), `the core does not know ${t}`);
      for (const s of ALGOVAULT_SERVERS) assert.equal(re.test(`mcp__${s}__${t}`), false, `matcher hits mcp__${s}__${t}`);
    }
  });

  test('the PostToolUse matcher is pre_trade_check on any server, and nothing else', () => {
    const re = new RegExp(post[0].matcher);
    for (const s of ALGOVAULT_SERVERS) assert.ok(re.test(`mcp__${s}__pre_trade_check`));
    assert.equal(re.test('mcp__algovault__get_trade_call'), false);
    assert.equal(re.test('mcp__algovault__pre_trade_check_extra'), false);
  });
});

describe('an opening order with no check is blocked', { concurrency: true }, () => {
  for (const [name, call] of gatedCases) {
    test(name, async () => {
      const r = await gate(newData(), call);
      assertDeny(r, ...call.legs.map(([c, s]) => COPY1(c, s)));
    });
  }
});

describe('a fresh GO for every leg passes, with context', { concurrency: true }, () => {
  for (const [name, call] of gatedCases) {
    test(name, async () => {
      const data = newData();
      for (const [coin, side] of call.legs) storeCheck(data, { coin, side, decision: 'GO' });
      const r = await gate(data, call);
      assertAllow(r, 'decision GO', 'checked size 1000 USD', 'cheapest venue BINANCE', 'not size');
    });
  }
});

describe('freshness, side, coin and decision', { concurrency: true }, () => {
  const representative = ['okx_swap_place_long', 'bybit_linear_create_long', 'generic_coin_side'].map((k) => [k, CALLS.gated[k]]);
  for (const [name, call] of representative) {
    const [coin, side] = call.legs[0];
    const other = side === 'long' ? 'short' : 'long';
    test(`${name}: a stale check (16 min > 15) is blocked`, async () => {
      const data = newData();
      storeCheck(data, { coin, side, decision: 'GO', ageMinutes: 16 });
      assertDeny(await gate(data, call), COPY1(coin, side));
    });
    test(`${name}: a check for the other side is blocked`, async () => {
      const data = newData();
      storeCheck(data, { coin, side: other, decision: 'GO' });
      assertDeny(await gate(data, call), COPY1(coin, side));
    });
    test(`${name}: a check for another coin is blocked`, async () => {
      const data = newData();
      storeCheck(data, { coin: 'DOGE', side, decision: 'GO' });
      assertDeny(await gate(data, call), COPY1(coin, side));
    });
    test(`${name}: another session's check does not count`, async () => {
      const data = newData();
      storeCheck(data, { coin, side, decision: 'GO', session: 'session-2' });
      assertDeny(await gate(data, call), COPY1(coin, side));
    });
    test(`${name}: CAUTION passes with its reason codes`, async () => {
      const data = newData();
      storeCheck(data, { coin, side, decision: 'CAUTION', codes: ['REGIME_AGAINST_SIDE'] });
      assertAllow(await gate(data, call), 'decision CAUTION', 'REGIME_AGAINST_SIDE');
    });
    test(`${name}: WAIT is blocked with its codes`, async () => {
      const data = newData();
      storeCheck(data, { coin, side, decision: 'WAIT', codes: ['SIZE_ABOVE_VENUE_LIMIT', 'FUNDING_COST_HIGH'] });
      assertDeny(await gate(data, call), COPY2(coin, side, 'SIZE_ABOVE_VENUE_LIMIT, FUNDING_COST_HIGH'));
    });
    test(`${name}: WAIT asks a person under on_wait ask`, async () => {
      const data = newData();
      storeCheck(data, { coin, side, decision: 'WAIT', codes: ['FUNDING_COST_HIGH'] });
      const r = await gate(data, call, { env: { CLAUDE_PLUGIN_OPTION_ON_WAIT: 'ask' } });
      assertAsk(r, COPY2(coin, side, 'FUNDING_COST_HIGH'));
    });
  }

  test('the newest fresh check decides: a WAIT after a GO blocks', async () => {
    const data = newData();
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'GO', ageMinutes: 5 });
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'WAIT', ageMinutes: 1, codes: ['FUNDING_COST_HIGH'] });
    assertDeny(await gate(data, CALLS.gated.okx_swap_place_long), COPY2('BTC', 'long', 'FUNDING_COST_HIGH'));
  });

  test('the newest fresh check decides: a GO after a WAIT passes', async () => {
    const data = newData();
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'WAIT', ageMinutes: 5, codes: ['FUNDING_COST_HIGH'] });
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'GO', ageMinutes: 1 });
    assertAllow(await gate(data, CALLS.gated.okx_swap_place_long), 'decision GO');
  });

  test('max_age_minutes: a 20-minute-old check passes at 30 and is blocked at the default', async () => {
    const data = newData();
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'GO', ageMinutes: 20 });
    const call = CALLS.gated.okx_swap_place_long;
    assertAllow(await gate(data, call, { env: { CLAUDE_PLUGIN_OPTION_MAX_AGE_MINUTES: '30' } }), 'decision GO');
    assertDeny(await gate(data, call), COPY1('BTC', 'long'));
  });

  test('a batch with one unchecked leg is blocked, naming that leg only', async () => {
    const data = newData();
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'GO' });
    const r = await gate(data, CALLS.gated.okx_swap_batch_place);
    assertDeny(r, COPY1('ETH', 'short'));
    assert.ok(!r.json.hookSpecificOutput.permissionDecisionReason.includes('BTC'));
  });

  test('a batch with one WAIT leg is blocked', async () => {
    const data = newData();
    storeCheck(data, { coin: 'BTC', side: 'long', decision: 'GO' });
    storeCheck(data, { coin: 'SOL', side: 'long', decision: 'WAIT', codes: ['REGIME_VOLATILE'] });
    assertDeny(await gate(data, CALLS.gated.bybit_linear_batch), COPY2('SOL', 'long', 'REGIME_VOLATILE'));
  });
});

describe('what passes unchecked', { concurrency: true }, () => {
  for (const [name, call] of Object.entries(CALLS.passes)) {
    test(name, async () => assertPass(await gate(newData(), call)));
  }

  for (const t of R0_TOOLS_LIST) {
    test(`AlgoVault ${t}, even with a broken order_tools option and no data dir`, async () => {
      for (const s of ALGOVAULT_SERVERS) {
        const r = await run(
          'gate',
          { hook_event_name: 'PreToolUse', session_id: SESSION, tool_name: `mcp__${s}__${t}`, tool_input: { coin: 'BTC', side: 'long', sizeUsd: 1000 } },
          { env: { CLAUDE_PLUGIN_OPTION_ORDER_TOOLS: '(' } },
        );
        assertPass(r);
      }
    });
  }
});

describe('unreadable input is blocked', { concurrency: true }, () => {
  for (const [name, call] of Object.entries(CALLS.unreadable)) {
    test(name, async () => {
      const r = await gate(newData(), call);
      assertDeny(r, 'pre-trade gate: could not read');
    });
  }

  test('stdin that is not JSON', async () => {
    const r = await run('gate', '{not json', { data: newData() });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /pre-trade gate: could not read the hook input/);
  });

  test('stdin that is a JSON array', async () => {
    const r = await run('gate', '[1,2]', { data: newData() });
    assert.equal(r.code, 2);
  });
});

describe('record', { concurrency: true }, () => {
  for (const shape of ['string', 'blocks', 'content', 'object']) {
    test(`a ${shape} tool_response records, and the order then passes`, async () => {
      const data = newData();
      const r = await record(data, CHECKS.caution, { shape });
      assert.equal(r.code, 0, r.stderr);
      const files = checkFiles(data);
      assert.equal(files.length, 1);
      const rec = JSON.parse(readFileSync(join(data, 'checks', SESSION, files[0]), 'utf8'));
      assert.equal(rec.coin, 'BTC');
      assert.equal(rec.side, 'long');
      assert.equal(rec.size_usd, 1000);
      assert.equal(rec.decision, 'CAUTION');
      assert.deepEqual(rec.reason_codes, ['REGIME_AGAINST_SIDE']);
      assert.equal(rec.best_venue, 'BYBIT');
      assert.equal(rec.as_of, '2026-11-04T06:27:36.625Z');
      assert.equal(typeof rec.recorded_at, 'number');
      assertAllow(await gate(data, CALLS.gated.okx_swap_place_long), 'decision CAUTION', 'REGIME_AGAINST_SIDE', 'cheapest venue BYBIT');
    });
  }

  test('a recorded WAIT blocks the order with its codes', async () => {
    const data = newData();
    assert.equal((await record(data, CHECKS.wait)).code, 0);
    assertDeny(await gate(data, CALLS.gated.okx_swap_place_long), COPY2('BTC', 'long', 'SIZE_ABOVE_VENUE_LIMIT, FUNDING_COST_HIGH'));
  });

  for (const shape of ['string', 'blocks', 'content', 'object']) {
    test(`a refusal (${shape}) records nothing`, async () => {
      const data = newData();
      const r = await record(data, CHECKS.refusal, { shape });
      assert.equal(r.code, 0, r.stderr);
      assert.equal(checkFiles(data).length, 0);
      assertDeny(await gate(data, CALLS.gated.okx_swap_place_long), COPY1('BTC', 'long'));
    });
  }

  test('an isError result records nothing, even one that carries a decision', async () => {
    const data = newData();
    const text = JSON.stringify(CHECKS.go);
    await record(data, CHECKS.go, { toolResponse: { isError: true, content: [{ type: 'text', text }] } });
    assert.equal(checkFiles(data).length, 0);
  });

  test('a response with no decision records nothing', async () => {
    const data = newData();
    const { decision, ...noDecision } = CHECKS.go;
    await record(data, noDecision);
    assert.equal(checkFiles(data).length, 0);
  });

  test('a "../" session id stays inside the checks directory', async () => {
    const data = newData();
    const r = await record(data, CHECKS.go, { session: '../../escape', toolUseId: '../../../x' });
    assert.equal(r.code, 0, r.stderr);
    const sessions = readdirSync(join(data, 'checks'));
    assert.equal(sessions.length, 1);
    assert.ok(!relative(join(data, 'checks'), join(data, 'checks', sessions[0])).startsWith('..'));
    assert.deepEqual(readdirSync(data), ['checks'], 'nothing written outside the checks directory');
    assert.ok(!existsSync(join(data, '..', 'escape')));
    assert.ok(!existsSync(join(data, '..', 'x.json')));
  });

  test('records older than 24 hours are pruned when a check is recorded', async () => {
    const data = newData();
    storeCheck(data, { coin: 'ETH', side: 'long', decision: 'GO', session: 'old-session' });
    const old = join(data, 'checks', 'old-session');
    const file = join(old, readdirSync(old)[0]);
    const dayAgo = (Date.now() - 25 * 3600_000) / 1000;
    utimesSync(file, dayAgo, dayAgo);
    await record(data, CHECKS.go);
    assert.equal(existsSync(old), false);
    assert.equal(checkFiles(data).length, 1);
  });

  test('a tool other than pre_trade_check records nothing', async () => {
    const data = newData();
    const r = await run('record', {
      hook_event_name: 'PostToolUse', session_id: SESSION, tool_use_id: 'toolu_other',
      tool_name: 'mcp__algovault__get_trade_call', tool_input: {}, tool_response: shapeOf(CHECKS.go, 'blocks'),
    }, { data });
    assert.equal(r.code, 0);
    assert.equal(checkFiles(data).length, 0);
  });
});

describe('every error exits 2, never 0 or 1', { concurrency: true }, () => {
  test('record with no CLAUDE_PLUGIN_DATA', async () => {
    const r = await record(undefined, CHECKS.go);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /CLAUDE_PLUGIN_DATA is not set/);
  });

  test('gate on an order with no CLAUDE_PLUGIN_DATA', async () => {
    const r = await gate(undefined, CALLS.gated.okx_swap_place_long);
    assert.equal(r.code, 2);
    assert.equal(r.stdout, '');
  });

  test('gate on an order when CLAUDE_PLUGIN_DATA is a file, not a directory', async () => {
    const dir = newData();
    const file = join(dir, 'not-a-dir');
    writeFileSync(file, 'x');
    const r = await gate(file, CALLS.gated.okx_swap_place_long);
    assert.equal(r.code, 2, `stderr: ${r.stderr}`);
    assert.equal(r.stdout, '', 'an error must not print an allow');
    assert.match(r.stderr, /^pre-trade gate: /);
  });

  test('an unknown mode', async () => {
    const r = await run('approve', { tool_name: 'mcp__okx__swap_place_order' }, { data: newData() });
    assert.equal(r.code, 2);
  });

  test('max_age_minutes out of range blocks orders only', async () => {
    const data = newData();
    const env = { CLAUDE_PLUGIN_OPTION_MAX_AGE_MINUTES: '500' };
    const r = await gate(data, CALLS.gated.okx_swap_place_long, { env });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /max_age_minutes/);
    assertPass(await gate(data, CALLS.passes.unrelated_tool, { env }));
  });

  test('on_wait with an unknown value blocks orders', async () => {
    const r = await gate(newData(), CALLS.gated.okx_swap_place_long, { env: { CLAUDE_PLUGIN_OPTION_ON_WAIT: 'allow' } });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /on_wait/);
  });

  test('an invalid order_tools regex blocks every tool but AlgoVault\'s', async () => {
    const r = await gate(newData(), CALLS.passes.unrelated_tool, { env: { CLAUDE_PLUGIN_OPTION_ORDER_TOOLS: '([' } });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /order_tools/);
  });
});

describe('order_tools replaces the built-in list', { concurrency: true }, () => {
  const env = { CLAUDE_PLUGIN_OPTION_ORDER_TOOLS: 'mcp__hyperliquid__market_open' };
  const marketOpen = { tool_name: 'mcp__hyperliquid__market_open', tool_input: { coin: 'ETH', is_buy: false, sz: 1 } };

  test('a tool the regex names is gated', async () => {
    assertDeny(await gate(newData(), marketOpen, { env }), COPY1('ETH', 'short'));
  });

  test('and passes once checked', async () => {
    const data = newData();
    storeCheck(data, { coin: 'ETH', side: 'short', decision: 'GO' });
    assertAllow(await gate(data, marketOpen, { env }), 'decision GO');
  });

  test('a built-in order tool the regex does not name passes', async () => {
    assertPass(await gate(newData(), CALLS.gated.bybit_linear_create_long, { env }));
  });

  test('a declared tool with no coin or side is blocked as unreadable', async () => {
    assertDeny(await gate(newData(), { tool_name: 'mcp__hyperliquid__market_open', tool_input: { sz: 1 } }, { env }), 'could not read');
  });
});

describe('coin normalisation (both sides of the comparison)', () => {
  const cases = [
    ['BTC', 'BTC'], ['btc', 'BTC'], ['BTC-USDT-SWAP', 'BTC'], ['BTC-USDT-261225', 'BTC'], ['BTCUSDT', 'BTC'],
    ['BTC/USDT:USDT', 'BTC'], ['BTCUSD', 'BTC'], ['BTCUSDH26', 'BTC'], ['BTCPERP', 'BTC'], ['BTC-26DEC25', 'BTC'],
    ['1000PEPEUSDT', 'PEPE'], ['1000PEPE', 'PEPE'], ['kPEPE', 'PEPE'], ['10000LADYSUSDT', 'LADYS'], ['ETH_USDT', 'ETH'],
    ['1INCHUSDT', '1INCH'], ['PERP', 'PERP'], ['USDC', 'USDC'],
  ];
  for (const [raw, want] of cases) test(`${raw} -> ${want}`, () => assert.equal(normalizeCoin(raw), want));
  for (const bad of ['', '  ', 'BTC USDT', 42, null, undefined]) test(`unreadable: ${JSON.stringify(bad)}`, () => assert.equal(normalizeCoin(bad), null));

  test('a PEPE check passes a 1000PEPEUSDT order', async () => {
    const data = newData();
    storeCheck(data, { coin: 'PEPE', side: 'short', decision: 'GO' });
    assertAllow(await gate(data, CALLS.gated.bybit_linear_create_multiplier), 'PEPE short');
  });
});
