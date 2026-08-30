// OPS-SKILLS-QUOTA-SKIP-CLASS-W1 — behaviour lock for the smoke suite's refusal triage.
//
// The suite it guards runs against the live server, so its SKIP branches only fire
// when the account happens to be throttled or out of allowance. That is not a
// verification strategy — the quota-exhaustion branch went unexercised long enough
// for the classifier to be wrong about it. These fixtures fire every branch on
// demand, offline, with no network and no quota consumed.
//
// Importing the classifier from its own module is deliberate: importing it from
// invoke-all-skills.mjs would register that suite's live `test()` and fire a 20-call
// production run inside `npm run test:unit`.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  classifyToolError,
  QUOTA_CODES,
  UPSTREAM_THROTTLE_RE,
} from "../smoke/lib/classify-tool-error.mjs";

// Captured verbatim from a live refusal, 2026-08-30, api.algovault.com.
const LIVE_QUOTA_BODY = {
  code: "TIER_LIMIT_REACHED",
  error_code: "TIER_LIMIT_REACHED",
  message: "Free monthly quota used: 200/200. Access returns 2026-08-31 (2 days).",
  limit: "monthly",
  monthly_limit: 200,
  current_usage: 200,
  tier: "free",
  resets_at: "2026-08-31T12:51:40.134Z",
  usage_display: "200/200",
};

test("vacuity guard: the fixtures and the code set are non-empty", () => {
  assert.ok(QUOTA_CODES.size > 0, "QUOTA_CODES is empty — every quota check would fall through");
  assert.ok(Object.keys(LIVE_QUOTA_BODY).length > 0, "live fixture is empty");
});

test("the live TIER_LIMIT_REACHED body is a SKIP, not a defect", () => {
  const v = classifyToolError(LIVE_QUOTA_BODY, JSON.stringify(LIVE_QUOTA_BODY).slice(0, 100));
  assert.equal(v.skip, true);
  assert.equal(v.kind, "quota");
  assert.match(v.reason, /TIER_LIMIT_REACHED/);
});

test("the reason carries usage and reset date, so a reader knows when to retry", () => {
  const v = classifyToolError(LIVE_QUOTA_BODY, "");
  assert.match(v.reason, /200\/200/);
  assert.match(v.reason, /2026-08-31T12:51:40\.134Z/);
});

test("REGRESSION LOCK: the old text-only predicate could not have caught it", () => {
  // This is the whole defect, pinned. The message contains no `429`, no
  // `Too Many Requests`, no `rate limit` — so the pre-fix regex classified a spent
  // allowance as a broken skill, twenty times over.
  const errMsg = JSON.stringify(LIVE_QUOTA_BODY).slice(0, 100);
  assert.equal(
    UPSTREAM_THROTTLE_RE.test(errMsg),
    false,
    "if this ever matches, the regression this test pins has changed shape",
  );
  assert.equal(classifyToolError(LIVE_QUOTA_BODY, errMsg).skip, true);
});

test("error_code alone is enough — `code` is not required", () => {
  const v = classifyToolError({ error_code: "TIER_LIMIT_REACHED" }, "");
  assert.equal(v.skip, true);
  assert.equal(v.kind, "quota");
});

test("an upstream venue 429 still SKIPs — it has no structured code, only prose", () => {
  const body = { error: "HL API 429: Too Many Requests" };
  const v = classifyToolError(body, body.error);
  assert.equal(v.skip, true);
  assert.equal(v.kind, "upstream-throttle");
});

test("a real defect is NOT skipped — the gate still has teeth", () => {
  for (const [body, msg] of [
    [{ error: "coin not found" }, "coin not found"],
    [{ error: "invalid timeframe" }, "invalid timeframe"],
    [{ code: "SOMETHING_ELSE" }, '{"code":"SOMETHING_ELSE"}'],
    [{}, "{}"],
  ]) {
    const v = classifyToolError(body, msg);
    assert.equal(v.skip, false, `must NOT skip: ${msg}`);
    assert.equal(v.kind, "defect");
  }
});

test("a non-string code cannot smuggle a skip past the check", () => {
  for (const code of [null, undefined, 42, {}, ["TIER_LIMIT_REACHED"]]) {
    assert.equal(classifyToolError({ code }, "boom").skip, false, `code=${JSON.stringify(code)}`);
  }
});

test("malformed input degrades to defect rather than throwing", () => {
  for (const bad of [null, undefined, "a string", 7]) {
    assert.doesNotThrow(() => classifyToolError(bad, "boom"));
    assert.equal(classifyToolError(bad, "boom").skip, false);
  }
});
