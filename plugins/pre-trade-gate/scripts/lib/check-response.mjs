/**
 * Read a pre_trade_check result into the record the gate keeps: {coin, side, size_usd,
 * decision, reason_codes, best_venue, as_of}. A harness hands the result over in one of
 * several shapes (a string, MCP content blocks, `{content}`, or the parsed object); all of
 * them read the same. A refusal, an unreadable body, or a body with no decision is not a
 * check: it returns {refusal} and nothing is recorded.
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

function textOfBlocks(blocks) {
  const block = blocks.find((b) => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string');
  return block ? block.text : undefined;
}

/**
 * @returns {{payload: object} | {refusal: string}}
 */
export function parseCheckResponse(toolResponse) {
  let r = toolResponse;
  if (typeof r === 'string') r = parseText(r);
  else if (Array.isArray(r)) r = parseText(textOfBlocks(r));
  else if (r && typeof r === 'object') {
    if (r.isError === true) return { refusal: 'the check returned an error' };
    if (r.structuredContent && typeof r.structuredContent === 'object') r = r.structuredContent;
    else if (Array.isArray(r.content)) r = parseText(textOfBlocks(r.content));
    else if (r.type === 'text' && typeof r.text === 'string') r = parseText(r.text);
  }
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { refusal: 'the check response is unreadable' };
  if (r.isError === true) return { refusal: 'the check returned an error' };
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
