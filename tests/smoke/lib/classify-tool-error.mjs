/**
 * OPS-SKILLS-QUOTA-SKIP-CLASS-W1 — one place that decides whether an `isError: true`
 * tool response means "the server refused us for capacity reasons" (SKIP) or "this
 * skill is broken" (HARD FAIL).
 *
 * WHY THIS IS ITS OWN MODULE. The smoke suite registers a live `test()` at import
 * time, so a unit test could not import the classifier from it without firing a
 * 20-call run against production. This file has no side effects and sits outside
 * BOTH runner globs (`tests/smoke/*.mjs`, `tests/unit/*.mjs` — neither is
 * recursive), so it is importable from either without being collected as a suite.
 *
 * THE DEFECT THIS EXISTS TO FIX. The predicate used to be a single regex over the
 * response text — `/429|Too Many Requests|rate.?limit/i`. Monthly quota exhaustion
 * contains none of those strings: the server reports it as `TIER_LIMIT_REACHED`
 * with `"Free monthly quota used: 200/200."`. So a run that had merely spent its
 * free allowance reported all 20 skills as HARD FAIL — twenty innocent skills
 * accused, measured 2026-08-30. False reds are how a suite stops being read.
 *
 * MATCH ON THE STRUCTURED FIELD, NOT THE PROSE. `code` / `error_code` are contract;
 * `message` is copy and will drift (it already carries a date and a price). The
 * regex leg is KEPT for the upstream-provider case, where a venue's 429 arrives
 * wrapped as free text with no code of its own — that one has no structured field
 * to match, so text is all there is.
 */

/** Server refusals that are capacity/allowance, not a broken skill. */
export const QUOTA_CODES = new Set([
  'TIER_LIMIT_REACHED', // monthly or daily allowance spent (free tier: 200/month, 100/UTC-day)
  'RATE_LIMITED', // short-window throttle, if the server ever names it
]);

/** Upstream venue throttles arrive as prose with no code — text is all we have. */
export const UPSTREAM_THROTTLE_RE = /429|Too Many Requests|rate.?limit/i;

/**
 * @param {unknown} parsed  the parsed `result.content[0].text` payload
 * @param {string}  errMsg  the human-readable message the caller would log
 * @returns {{skip: boolean, reason: string, kind: 'quota'|'upstream-throttle'|'defect'}}
 */
export function classifyToolError(parsed, errMsg) {
  const code = parsed?.code ?? parsed?.error_code;
  if (typeof code === 'string' && QUOTA_CODES.has(code)) {
    const usage = parsed?.usage_display ? ` (${parsed.usage_display}` : '';
    const resets = parsed?.resets_at ? `, resets ${parsed.resets_at})` : usage ? ')' : '';
    return { skip: true, kind: 'quota', reason: `${code}${usage}${resets}` };
  }
  if (UPSTREAM_THROTTLE_RE.test(String(errMsg ?? ''))) {
    return { skip: true, kind: 'upstream-throttle', reason: String(errMsg) };
  }
  return { skip: false, kind: 'defect', reason: String(errMsg ?? '') };
}
