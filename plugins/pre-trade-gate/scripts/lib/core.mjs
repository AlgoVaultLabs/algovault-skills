/**
 * The harness-agnostic core of the AlgoVault pre-trade gate.
 *
 *   evaluate({event, tool_name, tool_input, tool_response, session_id, tool_use_id}, ctx)
 *     -> {decision: 'allow'|'deny'|'ask', reason, context}
 *
 * Input keys may be snake_case or camelCase, in any harness's spelling (harnesses.mjs):
 * the session key may be `session_id` or Cursor's `conversation_id`; the tool name may be
 * `mcp__<server>__<tool>`, a bare name with `mcp_server_name`, or `mcp_<server>_<tool>`;
 * `tool_input` may be a JSON string; the check's result may come in any wrapping
 * (check-response.mjs). `event` is 'record' (after a tool ran) or 'gate' (before a tool
 * runs); each harness's hook event names map onto them. A harness adapter only maps its
 * own JSON in and out: every deny must also exit 2 with the reason on stderr.
 *
 * ctx: {dataDir, env, now, harness}. The adapter resolves the data dir. Options come from
 * CLAUDE_PLUGIN_OPTION_<KEY>, else from `options.json` in the data dir (the installer
 * writes it for a harness without plugin options), else their defaults.
 *
 * record: keeps one record per pre_trade_check result; a refusal keeps nothing.
 * gate:   an opening perpetual or futures order passes only when this session holds a
 *         fresh, non-WAIT record for each {coin, side} it opens. No record, a WAIT, or
 *         anything unreadable blocks it. The gate never calls AlgoVault and holds no key.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyToolCall, isAlgoVaultTool, toolSegment, OrderReadError } from './order-tools.mjs';
import { parseCheckResponse, buildRecord } from './check-response.mjs';
import { writeRecord, readRecords, pruneRecords } from './store.mjs';
import { EVENT_KINDS } from './harnesses.mjs';

export const PREFIX = 'pre-trade gate: ';

/** The block messages. Wording approved for the gate; fill the slots, never reword. */
export const COPY = Object.freeze({
  missing: (coin, side) =>
    `pre-trade gate: Missing check for ${coin} ${side}. Run pre_trade_check first (or use reduce-only to close).`,
  wait: (coin, side, codes) =>
    `pre-trade gate: pre_trade_check returned WAIT for ${coin} ${side} (${codes.length ? codes.join(', ') : 'none'}). Execution stopped.`,
});

export const DEFAULTS = Object.freeze({ maxAgeMinutes: 15, onWait: 'deny' });

/** A setting or input the gate cannot use. The adapter blocks with this message. */
export class GateError extends Error {}

const EVENTS = new Map([
  ['record', 'record'],
  ['gate', 'gate'],
  ...Object.entries(EVENT_KINDS),
]);

/** Session keys, in the order they are tried after the harness's own. */
const SESSION_KEYS = Object.freeze(['session_id', 'sessionId', 'conversation_id', 'conversationId']);

function pick(input, snake, camel) {
  return input[snake] !== undefined ? input[snake] : input[camel];
}

const present = (v) => v !== undefined && v !== null && v !== '';

/** A tool input sent as a JSON string (Cursor) is read as its object; anything else is kept as given. */
function inputObject(v) {
  if (typeof v !== 'string') return v;
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? o : v;
  } catch {
    return v;
  }
}

/** Any harness's spelling in; one shape out. `harness` is its row in harnesses.mjs, when known. */
export function normalizeInput(raw, harness = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new GateError('could not read the hook input');
  const keys = harness && harness.sessionKey ? [harness.sessionKey, ...SESSION_KEYS] : SESSION_KEYS;
  const sessionKey = keys.find((k) => present(raw[k]));
  return {
    event: raw.event ?? pick(raw, 'hook_event_name', 'hookEventName'),
    toolName: pick(raw, 'tool_name', 'toolName'),
    serverName: pick(raw, 'mcp_server_name', 'mcpServerName'),
    toolInput: inputObject(pick(raw, 'tool_input', 'toolInput')),
    toolResponse: pick(raw, 'tool_response', 'toolResponse') ?? raw.result_json,
    sessionId: sessionKey ? raw[sessionKey] : pick(raw, 'session_id', 'sessionId'),
    toolUseId: pick(raw, 'tool_use_id', 'toolUseId'),
  };
}

/*
 * The three options. Claude Code exports each as CLAUDE_PLUGIN_OPTION_<KEY>; a harness
 * without plugin options reads `options.json` in the data dir, which the installer writes.
 * The environment wins per key. An unset option takes its default; a set but unusable one
 * is an error, never a silent default. order_tools is read for every call it might
 * classify; the other two only once an order is gated, so a bad value blocks orders and
 * nothing else. None is read for an AlgoVault tool.
 */
export const OPTION_KEYS = Object.freeze(['max_age_minutes', 'on_wait', 'order_tools']);
export const OPTIONS_FILE = 'options.json';

const envKey = (key) => `CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`;

/** `options.json` in the data dir: {} when there is none; an error when it cannot be used. */
export function readOptionsFile(dataDir) {
  if (typeof dataDir !== 'string' || dataDir === '') return {};
  const file = join(dataDir, OPTIONS_FILE);
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    throw new GateError(`could not read the options file ${file}`);
  }
  let o;
  try {
    o = JSON.parse(raw);
  } catch {
    throw new GateError(`the options file ${file} is not valid JSON`);
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new GateError(`the options file ${file} is not a JSON object`);
  for (const k of OPTION_KEYS) {
    const v = o[k];
    if (v !== undefined && v !== null && typeof v !== 'string' && typeof v !== 'number') {
      throw new GateError(`the ${k} option in ${file} must be a string or a number`);
    }
  }
  return o;
}

/** The options file, read only when the environment leaves an option unset. */
export function readFileOptions(env, dataDir) {
  return OPTION_KEYS.every((k) => env?.[envKey(k)] !== undefined && env?.[envKey(k)] !== null) ? {} : readOptionsFile(dataDir);
}

const optionValue = (env, fileOptions, key) => {
  const v = env?.[envKey(key)];
  if (v !== undefined && v !== null) return String(v).trim();
  const f = fileOptions?.[key];
  return f === undefined || f === null ? '' : String(f).trim();
};

export function readOrderTools(env, fileOptions = {}) {
  const tools = optionValue(env, fileOptions, 'order_tools');
  if (tools === '') return null;
  try {
    return new RegExp(tools);
  } catch {
    throw new GateError(`the order_tools option is not a valid regular expression: ${tools}`);
  }
}

export function readMaxAgeMinutes(env, fileOptions = {}) {
  const age = optionValue(env, fileOptions, 'max_age_minutes');
  if (age === '') return DEFAULTS.maxAgeMinutes;
  const n = /^\d+(\.\d+)?$/.test(age) ? Number(age) : NaN;
  if (!(n >= 1 && n <= 240)) throw new GateError(`the max_age_minutes option must be a number from 1 to 240, not "${age}"`);
  return n;
}

export function readOnWait(env, fileOptions = {}) {
  const wait = optionValue(env, fileOptions, 'on_wait').toLowerCase();
  if (wait === '') return DEFAULTS.onWait;
  if (wait !== 'deny' && wait !== 'ask') throw new GateError(`the on_wait option must be deny or ask, not "${wait}"`);
  return wait;
}

/** Records that may still pass an order: written no more than maxAge ago (a minute of clock skew allowed). */
export function isFresh(record, now, maxAgeMs) {
  const age = now - record.recorded_at;
  return age >= -60_000 && age <= maxAgeMs;
}

/** The newest fresh record for one {coin, side}, or null. */
export function newestFreshRecord(records, leg, now, maxAgeMs) {
  let best = null;
  for (const r of records) {
    if (r.coin !== leg.coin || r.side !== leg.side) continue;
    if (!isFresh(r, now, maxAgeMs)) continue;
    if (!best || r.recorded_at > best.recorded_at) best = r;
  }
  return best;
}

function describePass(leg, r, now) {
  const minutes = Math.max(0, Math.round((now - r.recorded_at) / 60_000));
  const codes = r.reason_codes.length ? r.reason_codes.join(', ') : 'none';
  const size = r.size_usd === null ? 'not given' : `${r.size_usd} USD`;
  const venue = r.best_venue ?? 'not given';
  return `${leg.coin} ${leg.side} passed on a pre_trade_check from ${minutes} min ago: decision ${r.decision}, reason codes ${codes}, checked size ${size}, cheapest venue ${venue}.`;
}

function gate(input, { dataDir, env, now }) {
  // Never an AlgoVault tool, whatever the options say: a broken setting must not block the check itself.
  if (isAlgoVaultTool(input.toolName, input.serverName)) return { decision: 'allow', reason: 'an AlgoVault tool', context: null };
  const fileOptions = readFileOptions(env, dataDir);
  let classified;
  try {
    classified = classifyToolCall(input.toolName, input.toolInput, {
      orderTools: readOrderTools(env, fileOptions),
      serverName: input.serverName,
    });
  } catch (err) {
    if (err instanceof OrderReadError) {
      return { decision: 'deny', reason: `${PREFIX}${err.message}, so the order is blocked.`, context: null };
    }
    throw err;
  }
  if (!classified.legs) return { decision: 'allow', reason: classified.pass, context: null };

  const maxAgeMs = readMaxAgeMinutes(env, fileOptions) * 60_000;
  const onWait = readOnWait(env, fileOptions);
  const records = readRecords(dataDir, input.sessionId);
  const missing = [];
  const waits = [];
  const passed = [];
  for (const leg of classified.legs) {
    const r = newestFreshRecord(records, leg, now, maxAgeMs);
    if (!r) missing.push(COPY.missing(leg.coin, leg.side));
    else if (r.decision === 'WAIT') waits.push(COPY.wait(leg.coin, leg.side, r.reason_codes));
    else if (r.decision === 'GO' || r.decision === 'CAUTION') passed.push(describePass(leg, r, now));
    else missing.push(COPY.missing(leg.coin, leg.side));
  }
  if (missing.length) return { decision: 'deny', reason: [...missing, ...waits].join('\n'), context: null };
  if (waits.length) return { decision: onWait === 'ask' ? 'ask' : 'deny', reason: waits.join('\n'), context: null };
  const note = 'The gate matches coin and side, not size.';
  return { decision: 'allow', reason: 'checked', context: `${PREFIX}${passed.join(' ')} ${note}` };
}

function record(input, { dataDir, now }) {
  if (toolSegment(String(input.toolName ?? ''), input.serverName) !== 'pre_trade_check') {
    return { decision: 'allow', reason: 'not a pre_trade_check', context: null };
  }
  const parsed = parseCheckResponse(input.toolResponse);
  if (parsed.refusal) return { decision: 'allow', reason: `not recorded: ${parsed.refusal}`, context: null };
  const built = buildRecord(parsed.payload, input.toolInput, now);
  if (built.refusal) return { decision: 'allow', reason: `not recorded: ${built.refusal}`, context: null };
  writeRecord(dataDir, input.sessionId, input.toolUseId, built.record);
  pruneRecords(dataDir, now);
  return { decision: 'allow', reason: 'recorded', context: null };
}

/**
 * @param {object} rawInput the hook input (any harness's spelling), with `event`
 * @param {{dataDir: string, env: object, now: number, harness?: object}} ctx `harness` is its row in harnesses.mjs
 */
export function evaluate(rawInput, ctx) {
  const input = normalizeInput(rawInput, ctx.harness);
  const kind = EVENTS.get(input.event);
  if (kind === 'gate') return gate(input, ctx);
  if (kind === 'record') return record(input, ctx);
  throw new GateError(`unknown event "${input.event}"`);
}
