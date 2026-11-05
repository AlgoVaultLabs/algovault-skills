/**
 * The harnesses the pre-trade gate runs in: one row each, as data. The adapters, the
 * installer, the generated hook files, the README test and algovault.com's /docs test all
 * read this table. Nothing else names a harness's events, input keys or config files.
 *
 * `proven` is the date and evidence of the two-run proof in a real run of that harness: an
 * unchecked order is denied with the missing-check message, and after a non-WAIT check the
 * same order reaches a stub that places nothing. A harness whose `proven` is null is not
 * offered: the installer refuses it, and the README and algovault.com do not list it.
 *
 * This file imports nothing, so it can be read on its own (algovault.com's /docs test loads
 * it at a pinned commit). The matcher strings are literals; a unit test pins each to the
 * generator in order-tools.mjs, so an order tool added there cannot be missed here.
 */

/** Seconds a hook may run. Gemini CLI counts in milliseconds. */
const TIMEOUT_SECONDS = 10;

/** Every MCP tool except AlgoVault's (lookahead): Claude Code blocks a gate that cannot run. */
const CLAUDE_GATE_MATCHER =
  '^mcp__(?!.*__(?:get_trade_call|get_trade_signal|get_market_regime|scan_funding_arb|scan_trade_calls|scan_market_regimes|pre_trade_check|chat_knowledge|search_knowledge|get_track_record)$)';

/** The built-in order tools only, without lookahead, for a harness that lets a crashed hook through. */
const ORDER_TOOL_NAMES =
  'swap_place_order|futures_place_order|swap_batch_orders|futures_batch_orders|swap_place_algo_order|swap_place_move_stop_order|futures_place_algo_order|futures_place_move_stop_order|createOrder|batchCreateOrders|place_order|create_order|open_position';

export const HARNESSES = Object.freeze([
  {
    id: 'claude-code',
    name: 'Claude Code',
    adapter: 'gate.mjs',
    events: { gate: 'PreToolUse', record: 'PostToolUse' },
    nameStyle: 'mcp__<server>__<tool>',
    sessionKey: 'session_id',
    deny: 'permissionDecision',
    ask: true,
    // onFailure "block" on the PreToolUse hook: a gate that cannot run blocks the call.
    failClosed: true,
    matcher: { gate: CLAUDE_GATE_MATCHER, record: '^mcp__.*__pre_trade_check$' },
    install: 'plugin',
    config: null,
    trust: null,
    proven: {
      date: '2026-11-04',
      evidence:
        'claude -p --plugin-dir from a fresh clone, stub OKX server: an unchecked swap_place_order was denied with the missing-check message (stub 0 calls); after a CAUTION check the same order reached the stub once',
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    adapter: 'codex.mjs',
    events: { gate: 'PreToolUse', record: 'PostToolUse' },
    nameStyle: 'mcp__<server>__<tool>',
    sessionKey: 'session_id',
    deny: 'permissionDecision',
    // "ask" is parsed but not supported: the hook run fails and the call goes through.
    ask: false,
    // A failed, timed-out or malformed hook does not block, and no option makes it.
    failClosed: false,
    matcher: { gate: `^mcp__.+__(?:${ORDER_TOOL_NAMES})$`, record: '^mcp__.+__(?:pre_trade_check)$' },
    install: 'installer',
    plugin: { hooks: 'hooks/codex.json', root: '${PLUGIN_ROOT}' },
    config: {
      layout: 'groups',
      timeout: { unit: 's', value: TIMEOUT_SECONDS },
      // With CODEX_HOME set, Codex reads its user hooks from $CODEX_HOME/hooks.json (measured 2026-11-05).
      user: { path: ['.codex', 'hooks.json'], homeEnv: { env: 'CODEX_HOME', path: ['hooks.json'] }, hooksKey: 'hooks' },
      project: { path: ['.codex', 'hooks.json'], hooksKey: 'hooks' },
    },
    // Measured 2026-11-05: a project's .codex/hooks.json loads only in a project Codex trusts, and
    // a new or changed hook is listed untrusted, and does not run, until the user trusts it.
    trust: { project: true, hooks: true },
    proven: {
      date: '2026-11-05',
      evidence:
        'codex exec (codex-cli 0.166.0-alpha.5.1) in a scratch project set up by install.mjs codex --project, stub OKX server: an unchecked swap_place_order was blocked by the PreToolUse hook with the missing-check message (stub 0 calls); after a GO check the same order reached the stub once',
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    adapter: 'cursor.mjs',
    events: { gate: 'beforeMCPExecution', record: 'afterMCPExecution' },
    nameStyle: '<tool> + mcp_server_name',
    sessionKey: 'conversation_id',
    deny: 'permission',
    ask: true,
    // failClosed: true waits for a matcher measured to keep AlgoVault tools out: without one,
    // a gate that fails closed could block the check itself. How `matcher` applies to the MCP
    // events is not documented, so the hooks see every MCP call and pass AlgoVault's first.
    failClosed: false,
    matcher: { gate: null, record: null },
    install: 'installer',
    config: {
      layout: 'flat',
      version: 1,
      timeout: { unit: 's', value: TIMEOUT_SECONDS },
      user: { path: ['.cursor', 'hooks.json'], hooksKey: 'hooks' },
      project: { path: ['.cursor', 'hooks.json'], hooksKey: 'hooks' },
    },
    trust: null,
    proven: null,
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    adapter: 'gemini.mjs',
    events: { gate: 'BeforeTool', record: 'AfterTool' },
    nameStyle: 'mcp_<server>_<tool>',
    sessionKey: 'session_id',
    deny: 'decision',
    ask: false,
    // Other non-zero exits warn and continue.
    failClosed: false,
    matcher: { gate: `^mcp_.+_(?:${ORDER_TOOL_NAMES})$`, record: '^mcp_.+_(?:pre_trade_check)$' },
    install: 'installer',
    config: {
      layout: 'groups',
      timeout: { unit: 'ms', value: TIMEOUT_SECONDS * 1000 },
      user: { path: ['.gemini', 'settings.json'], hooksKey: 'hooks' },
      project: { path: ['.gemini', 'settings.json'], hooksKey: 'hooks' },
    },
    trust: null,
    proven: null,
  },
  {
    id: 'devin',
    name: 'Devin',
    adapter: 'devin.mjs',
    events: { gate: 'PreToolUse', record: 'PostToolUse' },
    nameStyle: 'mcp__<server>__<tool>',
    sessionKey: 'session_id',
    deny: 'exit-2',
    ask: false,
    // Failures other than exit 2 do not block.
    failClosed: false,
    matcher: { gate: `^mcp__.+__(?:${ORDER_TOOL_NAMES})$`, record: '^mcp__.+__(?:pre_trade_check)$' },
    install: 'installer',
    config: {
      layout: 'groups',
      timeout: { unit: 's', value: TIMEOUT_SECONDS },
      user: { path: ['.config', 'devin', 'config.json'], win32: { env: 'APPDATA', path: ['devin', 'config.json'] }, hooksKey: 'hooks' },
      // In .devin/hooks.v1.json the hooks object is the whole file.
      project: { path: ['.devin', 'hooks.v1.json'], hooksKey: null },
    },
    trust: null,
    proven: null,
  },
].map(deepFreeze));

function deepFreeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v);
  return Object.freeze(o);
}

/** The row for one harness id. */
export function harness(id) {
  const row = HARNESSES.find((h) => h.id === id);
  if (!row) throw new Error(`unknown harness "${id}" (expected ${HARNESSES.map((h) => h.id).join(', ')})`);
  return row;
}

/** Hook events mapped onto the core's two: 'gate' (before a tool runs) and 'record' (after). */
export const EVENT_KINDS = Object.freeze(
  Object.fromEntries(HARNESSES.flatMap((h) => [[h.events.gate, 'gate'], [h.events.record, 'record']])),
);

/** The harnesses the installer offers: proven, and installed by it rather than as a plugin. */
export const installable = () => HARNESSES.filter((h) => h.install === 'installer' && h.proven);

/**
 * The hook entries for one harness, by event, in its own config's layout:
 *   groups  {<event>: [{matcher, hooks: [{type: "command", command, timeout}]}]}  Codex, Gemini CLI, Devin
 *   flat    {<event>: [{command, timeout, matcher?, failClosed?}]}                  Cursor
 * @param {string} id
 * @param {(mode: 'gate'|'record') => string} command the command line for each mode
 */
export function hookEntries(id, command) {
  const h = harness(id);
  if (!h.config) throw new Error(`${h.name} is not configured by hook entries`);
  const timeout = h.config.timeout.value;
  const out = {};
  for (const mode of ['record', 'gate']) {
    const matcher = h.matcher[mode];
    if (h.config.layout === 'flat') {
      const entry = { command: command(mode), timeout };
      if (matcher) entry.matcher = matcher;
      if (mode === 'gate' && h.failClosed) entry.failClosed = true;
      out[h.events[mode]] = [entry];
    } else {
      const group = matcher ? { matcher } : {};
      group.hooks = [{ type: 'command', command: command(mode), timeout }];
      out[h.events[mode]] = [group];
    }
  }
  return out;
}

/** The description written beside the gate's hooks wherever a config holds one. */
export const HOOKS_DESCRIPTION =
  'AlgoVault pre-trade gate: keeps a record of each pre_trade_check, and blocks an opening perpetual or futures order with no recent non-WAIT check for its coin and side.';

/** hooks/codex.json, the Codex plugin's hooks file: the same entries the installer writes, run from the plugin root. */
export function codexPluginHooks() {
  const h = harness('codex');
  return {
    description: HOOKS_DESCRIPTION,
    hooks: hookEntries('codex', (mode) => `node "${h.plugin.root}/scripts/${h.adapter}" ${mode}`),
  };
}
