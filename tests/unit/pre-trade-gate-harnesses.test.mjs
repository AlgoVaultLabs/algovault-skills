// Unit tests for the pre-trade gate's harness table, the multi-harness core, and the Codex
// adapter and plugin.
//
// The core runs over each harness's documented hook input
// (tests/fixtures/pre-trade-gate/harness-inputs.json); the Codex adapter runs the way Codex
// runs it: the hook JSON on stdin, the exit code, stdout and stderr read back. No network
// and no order: nothing here calls an order tool.
//
// PRE_TRADE_GATE_ROOT points the suite at another copy of the plugin; the mutation suite
// (pre-trade-gate-mutations.test.mjs) uses it to prove the assertions below can fail.
//
// Run: node --test tests/unit/pre-trade-gate-harnesses.test.mjs

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = process.env.PRE_TRADE_GATE_ROOT
  ? resolve(process.env.PRE_TRADE_GATE_ROOT)
  : join(REPO, 'plugins', 'pre-trade-gate');
const fixture = (f) => JSON.parse(readFileSync(join(REPO, 'tests', 'fixtures', 'pre-trade-gate', f), 'utf8'));
const CALLS = fixture('order-calls.json');
const CHECKS = fixture('check-results.json');
const INPUTS = fixture('harness-inputs.json');
const lib = (f) => import(pathToFileURL(join(ROOT, 'scripts', 'lib', f)).href);
const { HARNESSES, harness, EVENT_KINDS, installable, codexPluginHooks } = await lib('harnesses.mjs');
const { ORDER_TOOLS, ALGOVAULT_TOOLS, preToolUseMatcher, orderToolMatcher, checkToolMatcher, parseToolName } =
  await lib('order-tools.mjs');
const { evaluate } = await lib('core.mjs');

/** AlgoVault's live tools/list, read 2026-11-04. Written out here so the plugin cannot shrink it. */
const R0_TOOLS_LIST = [
  'get_trade_call', 'get_trade_signal', 'get_market_regime', 'scan_funding_arb', 'scan_trade_calls',
  'scan_market_regimes', 'pre_trade_check', 'chat_knowledge', 'search_knowledge', 'get_track_record',
];
const ALGOVAULT_SERVERS = ['algovault', 'plugin_algovault-skills_algovault', 'algo_vault'];

/** Approved copy, written out (never imported). */
const COPY1 = (coin, side) =>
  `pre-trade gate: Missing check for ${coin} ${side}. Run pre_trade_check first (or use reduce-only to close).`;
const COPY2 = (coin, side, codes) =>
  `pre-trade gate: pre_trade_check returned WAIT for ${coin} ${side} (${codes}). Execution stopped.`;
const COPY4 =
  "Sharpen your agent's edge and protect capital. Validates rules, fees, funding, and live market regimes before routing to drive safer execution and higher long-term PnL. WAIT stops execution instantly. 100% keyless, zero-custody.";

const OTHER_HARNESSES = ['codex', 'cursor', 'gemini', 'devin'];
const newData = () => mkdtempSync(join(tmpdir(), 'ptg-h-'));
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Fill a fixture's placeholders with one check result. */
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

const styleOf = (row) => (row.nameStyle.startsWith('mcp__') ? 'mcp__' : row.nameStyle.startsWith('mcp_') ? 'mcp_' : 'bare');

/** A Claude Code style call (`mcp__<server>__<tool>`) in another harness's style, on that harness's gate input. */
function inStyle(id, call) {
  const m = /^mcp__(.+)__(.+)$/.exec(call.tool_name);
  assert.ok(m, `corpus name ${call.tool_name}`);
  const [, server, tool] = m;
  const input = clone(INPUTS[id].gate);
  const style = styleOf(harness(id));
  if (style === 'bare') {
    input.tool_name = tool;
    input.mcp_server_name = server;
    input.tool_input = JSON.stringify(call.tool_input);
  } else {
    input.tool_name = style === 'mcp_' ? `mcp_${server}_${tool}` : call.tool_name;
    input.tool_input = clone(call.tool_input);
  }
  return input;
}

function core(id, input, { data, env = {}, now = Date.now() } = {}) {
  return evaluate(input, { dataDir: data, env, now, harness: harness(id) });
}

/** The harness's AlgoVault tool name in its own style. */
function algovaultCall(id, tool, server = 'algovault') {
  const input = clone(INPUTS[id].gate);
  const style = styleOf(harness(id));
  if (style === 'bare') {
    input.tool_name = tool;
    input.mcp_server_name = server;
  } else input.tool_name = style === 'mcp_' ? `mcp_${server}_${tool}` : `mcp__${server}__${tool}`;
  input.tool_input = style === 'bare' ? '{"coin":"BTC","side":"long","sizeUsd":1000}' : { coin: 'BTC', side: 'long', sizeUsd: 1000 };
  return input;
}

function withSession(id, input, session) {
  const out = clone(input);
  out[harness(id).sessionKey] = session;
  return out;
}

function storeCheck(data, session, { coin = 'BTC', side = 'long', decision, ageMinutes = 0, codes = [] }) {
  const dir = join(data, 'checks', session);
  mkdirSync(dir, { recursive: true });
  const rec = {
    coin, side, size_usd: 1000, decision, reason_codes: codes, best_venue: 'BINANCE',
    as_of: new Date().toISOString(), recorded_at: Date.now() - ageMinutes * 60_000,
  };
  writeFileSync(join(dir, `stored-${Math.random().toString(16).slice(2)}.json`), JSON.stringify(rec));
}

const sessionOf = (id) => INPUTS[id].gate[harness(id).sessionKey];
const recordFiles = (data, session) => {
  const dir = join(data, 'checks', session);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
};

describe('the harness table', () => {
  const FIELDS = ['id', 'name', 'adapter', 'events', 'nameStyle', 'sessionKey', 'deny', 'ask', 'failClosed', 'matcher', 'install', 'trust', 'proven'];

  test('one row per harness, each with every field', () => {
    assert.deepEqual(HARNESSES.map((h) => h.id), ['claude-code', ...OTHER_HARNESSES]);
    for (const h of HARNESSES) {
      for (const f of FIELDS) assert.ok(f in h, `${h.id} lacks ${f}`);
      assert.match(h.adapter, /^[a-z-]+\.mjs$/, `${h.id}: adapter`);
      assert.ok(h.proven === null || (/^\d{4}-\d{2}-\d{2}$/.test(h.proven.date) && h.proven.evidence.length > 40), `${h.id}: proven`);
    }
  });

  test("Claude Code's row is proven and holds hooks.json's matchers", () => {
    const row = harness('claude-code');
    const hooks = JSON.parse(readFileSync(join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks;
    assert.ok(row.proven);
    assert.equal(row.matcher.gate, preToolUseMatcher());
    assert.equal(row.matcher.gate, hooks.PreToolUse[0].matcher);
    assert.equal(row.matcher.record, hooks.PostToolUse[0].matcher);
    assert.equal(row.failClosed, true);
    assert.equal(hooks.PreToolUse[0].hooks[0].onFailure, 'block');
  });

  test('a harness that lets a crashed hook through gates on the order tools alone, without lookahead', () => {
    for (const h of HARNESSES.filter((x) => !x.failClosed && x.matcher.gate)) {
      const style = styleOf(h);
      assert.equal(h.matcher.gate, orderToolMatcher(style), `${h.id}: the gate matcher is not the order-tool table's`);
      assert.equal(h.matcher.record, checkToolMatcher(style), `${h.id}: the record matcher`);
      for (const m of [h.matcher.gate, h.matcher.record]) assert.doesNotMatch(m, /\(\?<?[=!]/, `${h.id}: lookaround in ${m}`);
    }
  });

  test('no AlgoVault tool is an order tool', () => {
    for (const t of R0_TOOLS_LIST) assert.equal(ORDER_TOOLS.has(t), false, `${t} is in the order-tool table`);
    for (const t of ALGOVAULT_TOOLS) assert.equal(ORDER_TOOLS.has(t), false);
  });

  test('each generated matcher hits every corpus order tool, and no AlgoVault tools/list name', () => {
    const corpus = [...Object.values(CALLS.gated), ...Object.values(CALLS.unreadable)].map((c) => /^mcp__(.+)__(.+)$/.exec(c.tool_name));
    for (const h of HARNESSES.filter((x) => x.matcher.gate && styleOf(x) !== 'bare')) {
      const style = styleOf(h);
      const gateRe = new RegExp(h.matcher.gate);
      const recordRe = new RegExp(h.matcher.record);
      const name = (server, tool) => (style === 'mcp_' ? `mcp_${server}_${tool}` : `mcp__${server}__${tool}`);
      for (const [, server, tool] of corpus) assert.ok(gateRe.test(name(server, tool)), `${h.id} misses ${name(server, tool)}`);
      for (const t of R0_TOOLS_LIST) {
        for (const s of ALGOVAULT_SERVERS) assert.equal(gateRe.test(name(s, t)), false, `${h.id} gate matcher hits ${name(s, t)}`);
      }
      for (const s of ALGOVAULT_SERVERS) assert.ok(recordRe.test(name(s, 'pre_trade_check')), `${h.id} record misses ${s}`);
      assert.equal(recordRe.test(name('algovault', 'get_trade_call')), false);
      assert.equal(recordRe.test(name('algovault', 'pre_trade_check_extra')), false);
    }
  });

  test('a hook that fails closed has a matcher that keeps AlgoVault out', () => {
    for (const h of HARNESSES.filter((x) => x.failClosed)) assert.ok(h.matcher.gate, `${h.id} fails closed with no matcher`);
  });

  test('every hook event maps onto gate or record', () => {
    for (const h of HARNESSES) {
      assert.equal(EVENT_KINDS[h.events.gate], 'gate');
      assert.equal(EVENT_KINDS[h.events.record], 'record');
    }
  });

  test('the installer offers only proven harnesses', () => {
    assert.deepEqual(
      installable().map((h) => h.id),
      HARNESSES.filter((h) => h.install === 'installer' && h.proven !== null).map((h) => h.id),
    );
  });
});

describe('tool names, in each of the three styles', () => {
  const cases = [
    [['mcp__okx__swap_place_order'], { tool: 'swap_place_order', server: 'okx', full: 'mcp__okx__swap_place_order' }],
    [['swap_place_order', 'okx'], { tool: 'swap_place_order', server: 'okx', full: 'mcp__okx__swap_place_order' }],
    [['mcp_okx_swap_place_order'], { tool: 'swap_place_order', server: 'okx', full: 'mcp__okx__swap_place_order' }],
    [['mcp_my_okx_swap_place_order'], { tool: 'swap_place_order', server: 'my_okx', full: 'mcp__my_okx__swap_place_order' }],
    [['mcp_okx-trade_createOrder'], { tool: 'createOrder', server: 'okx-trade', full: 'mcp__okx-trade__createOrder' }],
    [['mcp_okx_spot_place_order'], { tool: 'spot_place_order', server: 'okx', full: 'mcp__okx__spot_place_order' }],
    [['mcp_hl_place_order'], { tool: 'place_order', server: 'hl', full: 'mcp__hl__place_order' }],
    [['mcp_algo_vault_pre_trade_check'], { tool: 'pre_trade_check', server: 'algo_vault', full: 'mcp__algo_vault__pre_trade_check' }],
    [['mcp_github_create_issue'], { tool: 'mcp_github_create_issue', server: null, full: 'mcp_github_create_issue' }],
  ];
  for (const [args, want] of cases) test(`${args.join(' + ')}`, () => assert.deepEqual(parseToolName(...args), want));
});

describe("the core over each harness's documented input", { concurrency: true }, () => {
  for (const id of OTHER_HARNESSES) {
    const session = sessionOf(id);

    test(`${id}: an unchecked order is blocked with the missing-check message`, () => {
      const r = core(id, INPUTS[id].gate, { data: newData() });
      assert.equal(r.decision, 'deny');
      assert.equal(r.reason, COPY1('BTC', 'long'));
    });

    test(`${id}: its pre_trade_check result records, and the order then passes`, () => {
      const data = newData();
      assert.equal(core(id, withCheck(INPUTS[id].record, CHECKS.caution), { data }).reason, 'recorded');
      assert.equal(recordFiles(data, session).length, 1);
      const r = core(id, INPUTS[id].gate, { data });
      assert.equal(r.decision, 'allow');
      for (const f of ['decision CAUTION', 'REGIME_AGAINST_SIDE', 'checked size 1000 USD', 'cheapest venue BYBIT']) assert.ok(r.context.includes(f), f);
    });

    test(`${id}: a recorded WAIT blocks the order with its codes`, () => {
      const data = newData();
      core(id, withCheck(INPUTS[id].record, CHECKS.wait), { data });
      const r = core(id, INPUTS[id].gate, { data });
      assert.equal(r.decision, 'deny');
      assert.equal(r.reason, COPY2('BTC', 'long', 'SIZE_ABOVE_VENUE_LIMIT, FUNDING_COST_HIGH'));
    });

    test(`${id}: a refusal records nothing`, () => {
      const data = newData();
      core(id, withCheck(INPUTS[id].record, CHECKS.refusal), { data });
      assert.equal(recordFiles(data, session).length, 0);
      assert.equal(core(id, INPUTS[id].gate, { data }).decision, 'deny');
    });

    test(`${id}: its session key keys the records`, () => {
      const data = newData();
      core(id, withCheck(INPUTS[id].record, CHECKS.go), { data });
      assert.equal(core(id, INPUTS[id].gate, { data }).decision, 'allow');
      assert.equal(core(id, withSession(id, INPUTS[id].gate, 'another-session'), { data }).decision, 'deny');
    });

    test(`${id}: every corpus order in its name style is gated, and every corpus pass passes`, () => {
      for (const [name, call] of Object.entries(CALLS.gated)) {
        const r = core(id, inStyle(id, call), { data: newData() });
        assert.equal(r.decision, 'deny', `${name}`);
        for (const [coin, side] of call.legs) assert.ok(r.reason.includes(COPY1(coin, side)), `${name}: ${coin} ${side}`);
      }
      for (const [name, call] of Object.entries(CALLS.passes)) {
        assert.equal(core(id, inStyle(id, call), { data: newData() }).decision, 'allow', name);
      }
    });

    test(`${id}: an AlgoVault tool passes under a broken option, with or without a data dir`, () => {
      const broken = newData();
      writeFileSync(join(broken, 'options.json'), '{"max_age_minutes": ');
      for (const t of R0_TOOLS_LIST) {
        for (const s of ALGOVAULT_SERVERS) {
          const call = algovaultCall(id, t, s);
          assert.equal(core(id, call, { env: { CLAUDE_PLUGIN_OPTION_ORDER_TOOLS: '(' } }).decision, 'allow', `${t} on ${s}, env`);
          assert.equal(core(id, call, { data: broken }).decision, 'allow', `${t} on ${s}, options file`);
        }
      }
    });
  }

  test('a failed call in any wrapping records nothing', () => {
    const failed = {
      codex: (i) => ({ ...i, tool_response: { ...i.tool_response, isError: true } }),
      cursor: (i) => ({ ...i, result_json: JSON.stringify({ isError: true, content: JSON.parse(i.result_json).content }) }),
      gemini: (i) => ({ ...i, tool_response: { ...i.tool_response, error: { message: 'MCP error' } } }),
      devin: (i) => ({ ...i, tool_response: { ...i.tool_response, success: false, error: 'timeout' } }),
    };
    for (const id of OTHER_HARNESSES) {
      const data = newData();
      const r = core(id, failed[id](withCheck(INPUTS[id].record, CHECKS.go)), { data });
      assert.match(r.reason, /not recorded: the check returned an error/, id);
      assert.equal(recordFiles(data, sessionOf(id)).length, 0, id);
    }
  });

  test('other wrappings record too: a Gemini llmContent string, a Codex Ok result, a bare JSON string', () => {
    const variants = [
      ['gemini', (i) => ({ ...i, tool_response: { llmContent: JSON.stringify(CHECKS.go), returnDisplay: '' } })],
      ['gemini', (i) => ({ ...i, tool_response: { llmContent: [{ functionResponse: { name: 'pre_trade_check', response: { content: [{ type: 'text', text: JSON.stringify(CHECKS.go) }] } } }] } })],
      ['codex', (i) => ({ ...i, tool_response: { Ok: { content: [{ type: 'text', text: JSON.stringify(CHECKS.go) }] } } })],
      ['codex', (i) => ({ ...i, tool_response: JSON.stringify(CHECKS.go) })],
    ];
    for (const [id, make] of variants) {
      const data = newData();
      assert.equal(core(id, make(withCheck(INPUTS[id].record, CHECKS.go)), { data }).reason, 'recorded', id);
      assert.equal(core(id, INPUTS[id].gate, { data }).decision, 'allow', id);
    }
  });

  test('a single-underscore spot order is not read as place_order', () => {
    const call = { ...clone(INPUTS.gemini.gate), tool_name: 'mcp_okx_spot_place_order', tool_input: CALLS.passes.okx_spot.tool_input };
    assert.equal(core('gemini', call, { data: newData() }).decision, 'allow');
  });

  test("a tool input sent as a JSON string is read, and one that does not parse blocks the order", () => {
    const bad = { ...clone(INPUTS.cursor.gate), tool_input: '{"instId": "BTC-USDT-SWAP", ' };
    const r = core('cursor', bad, { data: newData() });
    assert.equal(r.decision, 'deny');
    assert.match(r.reason, /could not read/);
  });
});

describe('options.json in the data dir', { concurrency: true }, () => {
  const id = 'codex';
  const session = sessionOf(id);
  const withOptions = (o) => {
    const data = newData();
    writeFileSync(join(data, 'options.json'), typeof o === 'string' ? o : JSON.stringify(o));
    return data;
  };

  test('max_age_minutes: a 20-minute-old check passes at 30, and is blocked without the file', () => {
    const data = withOptions({ max_age_minutes: 30 });
    storeCheck(data, session, { decision: 'GO', ageMinutes: 20 });
    assert.equal(core(id, INPUTS[id].gate, { data }).decision, 'allow');
    const bare = newData();
    storeCheck(bare, session, { decision: 'GO', ageMinutes: 20 });
    assert.equal(core(id, INPUTS[id].gate, { data: bare }).decision, 'deny');
  });

  test('on_wait ask turns a WAIT into ask', () => {
    const data = withOptions({ on_wait: 'ask' });
    storeCheck(data, session, { decision: 'WAIT', codes: ['FUNDING_COST_HIGH'] });
    const r = core(id, INPUTS[id].gate, { data });
    assert.equal(r.decision, 'ask');
    assert.equal(r.reason, COPY2('BTC', 'long', 'FUNDING_COST_HIGH'));
  });

  test('the environment wins over the file, key by key', () => {
    const data = withOptions({ max_age_minutes: 30 });
    storeCheck(data, session, { decision: 'GO', ageMinutes: 20 });
    assert.equal(core(id, INPUTS[id].gate, { data, env: { CLAUDE_PLUGIN_OPTION_MAX_AGE_MINUTES: '15' } }).decision, 'deny');
  });

  test('order_tools from the file replaces the built-in list', () => {
    const data = withOptions({ order_tools: 'mcp__hyperliquid__market_open' });
    const call = { ...clone(INPUTS[id].gate), tool_name: 'mcp__hyperliquid__market_open', tool_input: { coin: 'ETH', is_buy: false, sz: 1 } };
    assert.equal(core(id, call, { data }).reason, COPY1('ETH', 'short'));
    assert.equal(core(id, INPUTS[id].gate, { data }).decision, 'allow', 'a built-in tool the regex does not name passes');
  });

  for (const [name, body] of [
    ['not JSON', '{"max_age_minutes": '],
    ['not an object', '[15]'],
    ['an object value', '{"on_wait": {"value": "ask"}}'],
    ['out of range', '{"max_age_minutes": 500}'],
    ['an unknown on_wait', '{"on_wait": "allow"}'],
  ]) {
    test(`a file that is ${name} blocks the order`, () => {
      assert.throws(() => core(id, INPUTS[id].gate, { data: withOptions(body) }), /options file|max_age_minutes|on_wait/);
    });
  }
});

function runCodex(mode, input, { env = {}, args = [] } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [join(ROOT, 'scripts', 'codex.mjs'), mode, ...args], {
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

function assertCodexDeny(r, message) {
  assert.equal(r.code, 2, `expected exit 2, got ${r.code}; stderr: ${r.stderr}`);
  const out = r.json?.hookSpecificOutput;
  assert.equal(out?.hookEventName, 'PreToolUse');
  assert.equal(out?.permissionDecision, 'deny', `expected a deny, got ${r.stdout}`);
  assert.equal(out.permissionDecisionReason, message);
  assert.ok(r.stderr.includes(message), `stderr lacks the reason: ${r.stderr}`);
}

describe('the Codex adapter', { concurrency: true }, () => {
  const gateIn = INPUTS.codex.gate;
  const recordIn = (payload) => withCheck(INPUTS.codex.record, payload);
  const session = sessionOf('codex');

  test('an unchecked order: permissionDecision deny, exit 2, the missing-check message', async () => {
    assertCodexDeny(await runCodex('gate', gateIn, { env: { PLUGIN_DATA: newData() } }), COPY1('BTC', 'long'));
  });

  test('a WAIT under on_wait ask is denied, never asked (Codex does not support ask)', async () => {
    const data = newData();
    writeFileSync(join(data, 'options.json'), JSON.stringify({ on_wait: 'ask' }));
    storeCheck(data, session, { decision: 'WAIT', codes: ['FUNDING_COST_HIGH'] });
    const r = await runCodex('gate', gateIn, { args: ['--data-dir', data] });
    assertCodexDeny(r, COPY2('BTC', 'long', 'FUNDING_COST_HIGH'));
  });

  test('record, then the order passes with additionalContext only', async () => {
    const data = newData();
    const rec = await runCodex('record', recordIn(CHECKS.caution), { args: ['--data-dir', data] });
    assert.equal(rec.code, 0, rec.stderr);
    assert.equal(rec.stdout, '');
    const r = await runCodex('gate', gateIn, { args: ['--data-dir', data] });
    assert.equal(r.code, 0, r.stderr);
    const out = r.json?.hookSpecificOutput;
    assert.equal(out?.hookEventName, 'PreToolUse');
    assert.equal(out.permissionDecision, undefined, 'an allow must never set permissionDecision');
    assert.ok(out.additionalContext.includes('decision CAUTION'));
  });

  test('a tool that is not an order passes with no output', async () => {
    const call = { ...clone(gateIn), tool_name: 'mcp__github__create_issue', tool_input: { title: 'x' } };
    const r = await runCodex('gate', call, { args: ['--data-dir', newData()] });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stdout, '');
  });

  test('an AlgoVault tool passes with a broken option and no data dir', async () => {
    const r = await runCodex('gate', algovaultCall('codex', 'pre_trade_check'), { env: { CLAUDE_PLUGIN_OPTION_ORDER_TOOLS: '(' } });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stdout, '');
  });

  test('the data dir: CLAUDE_PLUGIN_DATA, else PLUGIN_DATA, else --data-dir', async () => {
    const [a, b, c] = [newData(), newData(), newData()];
    storeCheck(c, session, { decision: 'GO' });
    assert.equal((await runCodex('gate', gateIn, { args: ['--data-dir', c] })).code, 0);
    assert.equal((await runCodex('gate', gateIn, { env: { PLUGIN_DATA: b }, args: ['--data-dir', c] })).code, 2);
    storeCheck(b, session, { decision: 'GO' });
    assert.equal((await runCodex('gate', gateIn, { env: { PLUGIN_DATA: b }, args: ['--data-dir', c] })).code, 0);
    assert.equal((await runCodex('gate', gateIn, { env: { CLAUDE_PLUGIN_DATA: a, PLUGIN_DATA: b } })).code, 2);
  });

  for (const [name, mode, input, opts] of [
    ['an unknown mode', 'approve', gateIn, {}],
    ['an unknown argument', 'gate', gateIn, { args: ['--data', '/tmp'] }],
    ['stdin that is not JSON', 'gate', '{not json', { args: ['--data-dir', '/tmp'] }],
    ['stdin that is a JSON array', 'gate', '[1,2]', { args: ['--data-dir', '/tmp'] }],
    ['an order with no data dir', 'gate', gateIn, {}],
    ['record with no data dir', 'record', withCheck(INPUTS.codex.record, CHECKS.go), {}],
  ]) {
    test(`every error exits 2: ${name}`, async () => {
      const r = await runCodex(mode, input, opts);
      assert.equal(r.code, 2, `exit ${r.code}; stderr: ${r.stderr}`);
      assert.match(r.stderr, /^pre-trade gate: /);
    });
  }

  test('every error exits 2: a broken options file on an order', async () => {
    const data = newData();
    writeFileSync(join(data, 'options.json'), '{');
    const r = await runCodex('gate', gateIn, { args: ['--data-dir', data] });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /options file/);
  });
});

describe('the Codex plugin', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'plugin.json'), 'utf8'));
  const claudeManifest = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));

  test('the root plugin.json is the portable manifest, pointing Codex at its own hooks file', () => {
    assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
    assert.equal(manifest.name, claudeManifest.name);
    assert.equal(manifest.version, claudeManifest.version);
    assert.equal(manifest.description, COPY4);
    assert.equal(manifest.extensions['com.openai'].hooks, './hooks/codex.json');
    assert.ok(existsSync(join(ROOT, 'hooks', 'codex.json')));
  });

  test('hooks/codex.json is what the table generates, and runs codex.mjs from the plugin root', () => {
    const file = JSON.parse(readFileSync(join(ROOT, 'hooks', 'codex.json'), 'utf8'));
    assert.deepEqual(file, codexPluginHooks(), 'run: node plugins/pre-trade-gate/scripts/build-hooks.mjs');
    const row = harness('codex');
    for (const mode of ['gate', 'record']) {
      const [group] = file.hooks[row.events[mode]];
      assert.equal(group.matcher, row.matcher[mode]);
      assert.deepEqual(group.hooks, [{ type: 'command', command: `node "\${PLUGIN_ROOT}/scripts/codex.mjs" ${mode}`, timeout: 10 }]);
    }
  });

  test('the Codex marketplace lists the gate, and every plugin the legacy marketplace lists', () => {
    const market = JSON.parse(readFileSync(join(REPO, '.agents', 'plugins', 'marketplace.json'), 'utf8'));
    const legacy = JSON.parse(readFileSync(join(REPO, '.claude-plugin', 'marketplace.json'), 'utf8'));
    const gate = market.plugins.find((p) => p.name === 'algovault-pre-trade-gate');
    assert.deepEqual(gate.source, { source: 'local', path: './plugins/pre-trade-gate' });
    assert.ok(existsSync(join(REPO, gate.source.path, 'plugin.json')));
    for (const p of market.plugins) {
      assert.ok(p.policy && typeof p.policy.installation === 'string' && typeof p.policy.authentication === 'string', p.name);
      assert.equal(typeof p.category, 'string', p.name);
    }
    // Codex reads only this file once it exists, so a plugin missing here vanishes from Codex.
    for (const p of legacy.plugins) assert.ok(market.plugins.some((m) => m.name === p.name), `${p.name} is missing`);
  });
});
