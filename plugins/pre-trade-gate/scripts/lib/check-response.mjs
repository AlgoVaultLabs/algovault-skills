/**
 * Read a pre_trade_check result into the record the gate keeps: {coin, side, size_usd,
 * decision, reason_codes, best_venue, as_of}. A harness hands the result over in its own
 * wrapping (a JSON string, MCP content blocks, `{content}`, Gemini CLI's `llmContent`,
 * Devin's `output`, or the parsed object); all of them read the same. A refusal, a failed
 * call, an unreadable body, or a body with no decision is not a check: it returns
 * {refusal} and nothing is recorded.
 */
import { normalizeCoin, normalizeSide } from './normalize.mjs';

export const DECISIONS = Object.freeze(['GO', 'CAUTION', 'WAIT']);

function parseText(text) {
  if (typeof text !== 'string') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The keys harnesses wrap a tool's result in, tried in this order: MCP `structuredContent`
 * and `content`, Gemini CLI `llmContent` (and a `functionResponse` part's `response`),
 * Devin `output`, a JSON-RPC `result`, and a Rust-style `Ok`. Cursor's `result_json` is a
 * JSON string, which the core passes in as the response itself.
 */
const WRAPPERS = Object.freeze(['structuredContent', 'content', 'llmContent', 'output', 'result', 'Ok', 'functionResponse', 'response']);
const MAX_DEPTH = 8;
const FAILED = Symbol('the call failed');

/** A text block (`{type: "text", text}`), or a Gemini part (`{text}`). */
const isTextBlock = (b) =>
  Boolean(b) && typeof b === 'object' && typeof b.text === 'string' && (b.type === undefined || b.type === 'text');

/** A wrapper that says the call failed: Gemini's `error`, Devin's `success: false`, a Rust-style `Err`. */
const saysFailed = (r) =>
  (r.error !== undefined && r.error !== null && r.error !== false && r.error !== '') || r.success === false || r.Err !== undefined;

/**
 * Peel wrappers until a body is reached: an object with a decision, a refusal's code, or
 * nothing left to peel. Returns that body, FAILED, or undefined when nothing is readable.
 */
function unwrap(r, depth) {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof r === 'string') return unwrap(parseText(r), depth + 1);
  if (Array.isArray(r)) {
    const block = r.find(isTextBlock);
    if (block) return unwrap(block.text, depth + 1);
    for (const item of r) {
      const body = item && typeof item === 'object' ? unwrap(item, depth + 1) : undefined;
      if (body !== undefined) return body;
    }
    return undefined;
  }
  if (!r || typeof r !== 'object') return undefined;
  if (r.isError === true) return FAILED;
  if (r.decision !== undefined) return r;
  if (saysFailed(r)) return FAILED;
  if (r.code !== undefined || r.error_code !== undefined) return r;
  for (const k of WRAPPERS) if (r[k] !== undefined && r[k] !== null) return unwrap(r[k], depth + 1);
  if (isTextBlock(r)) return unwrap(r.text, depth + 1);
  return r;
}

/**
 * @returns {{payload: object} | {refusal: string}}
 */
export function parseCheckResponse(toolResponse) {
  const r = unwrap(toolResponse, 0);
  if (r === FAILED) return { refusal: 'the check returned an error' };
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { refusal: 'the check response is unreadable' };
  const decision = typeof r.decision === 'string' ? r.decision.trim().toUpperCase() : '';
  if (!DECISIONS.includes(decision)) {
    const code = typeof r.code === 'string' ? r.code : typeof r.error_code === 'string' ? r.error_code : null;
    return { refusal: code ? `the check was refused (${code})` : 'the check response has no decision' };
  }
  return { payload: { ...r, decision } };
}

const finiteOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * @param {object} payload   a parsed check (parseCheckResponse().payload)
 * @param {object} toolInput the check's own arguments, used only when the result omits coin or side
 * @param {number} now       ms epoch: the record's age is measured from here
 * @returns {{record: object} | {refusal: string}}
 */
export function buildRecord(payload, toolInput, now) {
  const input = toolInput && typeof toolInput === 'object' ? toolInput : {};
  const coin = normalizeCoin(payload.coin ?? input.coin);
  const side = normalizeSide(payload.side ?? input.side);
  if (!coin || !side) return { refusal: 'the check names no readable coin or side' };
  const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
  return {
    record: {
      coin,
      side,
      size_usd: finiteOrNull(payload.size_usd) ?? finiteOrNull(input.sizeUsd),
      decision: payload.decision,
      reason_codes: reasons.map((x) => x && x.code).filter((c) => typeof c === 'string'),
      best_venue: payload.best_venue && typeof payload.best_venue.exchange === 'string' ? payload.best_venue.exchange : null,
      as_of: typeof payload.as_of === 'string' ? payload.as_of : null,
      recorded_at: now,
    },
  };
}
