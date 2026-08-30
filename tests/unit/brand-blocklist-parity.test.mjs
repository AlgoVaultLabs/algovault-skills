// Parity + behaviour lock for the VENDORED brand blocklist.
// CROSS-REPO-TUTORIAL-PRODUCER-GATE-W1.
//
// `ops/brand-forbidden-phrases.json` here is a VENDORED copy. The canonical file
// lives in crypto-quant-signal-mcp at the same path, and
// `ops/brand-forbidden-phrases.json.sha256` is a copy of THAT file's hash — the one
// canonical hash. This repo records no hash of its own, because a second recorded
// hash is a second thing that can drift.
//
// The hash alone is NOT sufficient. Per CLAUDE.md's shared-primitive law, "a hash
// cannot catch a re-vendor from a stale source that also re-records the hash", so
// this file pins BEHAVIOUR as well: the phrase class must still catch the strings it
// exists for, and must still spare the venue rate-limit prose it must never touch.
//
// Run: node --test tests/unit/brand-blocklist-parity.test.mjs

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadBlocklist,
  checkBlocklist,
  vendorParityOk,
  stripCodeCommentsOnly,
} from '../../scripts/check-brand-copy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const JSON_PATH = join(ROOT, 'ops', 'brand-forbidden-phrases.json');
const SHA_PATH = `${JSON_PATH}.sha256`;

test('vendored blocklist and its .sha256 both exist', () => {
  assert.ok(existsSync(JSON_PATH), 'ops/brand-forbidden-phrases.json missing');
  assert.ok(existsSync(SHA_PATH), 'ops/brand-forbidden-phrases.json.sha256 missing');
});

test('vendored copy matches the ONE canonical hash', () => {
  const actual = createHash('sha256').update(readFileSync(JSON_PATH)).digest('hex');
  const recorded = readFileSync(SHA_PATH, 'utf8').trim();
  assert.equal(
    actual,
    recorded,
    'Vendored blocklist drifted from its recorded hash. Re-vendor BOTH files together from ' +
      'crypto-quant-signal-mcp:ops/brand-forbidden-phrases.json{,.sha256} — never hand-edit this copy.',
  );
  assert.match(recorded, /^[0-9a-f]{64}$/);
});

test('vendorParityOk() agrees', () => {
  assert.equal(vendorParityOk(), true);
});

test('blocklist loads and is not empty (vacuity guard)', () => {
  const bl = loadBlocklist(JSON_PATH);
  assert.ok(bl, 'blocklist failed to load');
  assert.ok(bl.length > 0, 'blocklist is empty — the gate would verify nothing');
});

test('every phrase cites its ratifying authority', () => {
  const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  for (const p of raw.phrases) {
    assert.ok(p.id && p.pattern && p.correction, `${p.id}: incomplete phrase row`);
    assert.ok(p.ratified, `${p.id}: must cite where this was ratified`);
  }
});

test('every exemption carries a reason', () => {
  const raw = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  for (const e of raw.exempt_paths ?? []) {
    assert.ok(e.path && e.phrase_id, 'exemption missing path/phrase_id');
    assert.ok(e.reason && e.reason.length > 40, `${e.path}: exemption must state WHY`);
  }
});

// ── BEHAVIOUR: what a hash cannot check ──────────────────────────────────────

// RE-SCOPED 2026-08-29 (OPS-SKILLS-BLOCKLIST-PARITY-DESTALE-W1). These fixtures used to
// target `per-day-quota`, and had been RED on a clean checkout since the blocklist was
// re-vendored at 1aee754: that vendor retired the class, and the test asserting it still
// fires was not brought along. An exemption and its test are a pair; so are a phrase class
// and its behaviour lock.
//
// The retirement is correct and is NOT undone here. Ruling R-B (2026-08-09) gave the free
// tier a real per-UTC-day cap, so `100 calls/day` became an accurate statement the gate was
// blocking — it refused a deploy over legitimate copy. `free-hold-promise` replaced it:
// ruling R-A made every verdict chargeable, so "HOLDs are free" is a pricing misstatement,
// and the expensive kind, because ~99% of verdicts are holds.
//
// The fixtures deliberately mirror the ones in check-brand-copy.mjs selfTest(). That is not
// accidental duplication — those fixtures ARE the declared contract, and this file's job is
// to catch a vendored copy that no longer satisfies it. A fixture set of its own invention
// would drift from the contract it is supposed to be pinning.
//
// The retired class's strings are kept, INVERTED, for the same reason selfTest() keeps them:
// they are the regression lock proving the ban is gone. Delete them and a silently
// reinstated pattern would block every pricing page again while every other assertion here
// still passed.
const FIXTURES = {
  // must fire — the LIVE class, in the paraphrases it actually shipped as
  'a.md': 'HOLD verdicts are free and never charged.',
  'b.md': 'A HOLD is free, so scan as often as you like.',
  'c.md': 'Batch scans give you free HOLDs at no quota cost.',
  'd.md': 'A HOLD is never charged against your allowance.',
  'e.md': "HOLDs don't count towards your monthly quota.",
  // must NOT fire — the corrected allowance (200/month since ruling R-B, not the old 100)
  'ok1.md': 'Free tier: 200 calls/month, every coin and timeframe.',
  // must NOT fire — real VENUE API rate limits, exchange facts that survive untouched
  'ok2.md': 'rate limits are **per-IP, not per-key** (2,400 weight/min, 1,200 order/min)',
  'ok3.md': '10/s per UID and 3/s per IP on the place-order endpoint.',
  'ok4.md': '<!-- retired: HOLDs are free --> Every verdict counts, HOLD included.',
  // must NOT fire — RETIRED class, inverted: a real daily cap is legitimate copy now
  'ok5.md': 'Free tier covers 100 calls/day per IP — plenty for development.',
  'ok6.md': 'Starter covers 1,000 calls per day.',
  // must NOT fire — the TRUE statement of the same fact is not collateral damage; the
  // pattern is directional, needing HOLD adjacent to a free/never-charged claim
  'ok7.md': 'Every verdict counts, HOLD included.',
};
const MUST_FIRE = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'];
const MUST_NOT_FIRE = ['ok1.md', 'ok2.md', 'ok3.md', 'ok4.md', 'ok5.md', 'ok6.md', 'ok7.md'];
const read = (f) => {
  if (!(f in FIXTURES)) throw new Error(`fixture missing: ${f}`);
  return FIXTURES[f];
};

test('fires on every free-HOLD paraphrase, not just one literal', () => {
  const bl = loadBlocklist(JSON_PATH);
  assert.ok(MUST_FIRE.length > 0, 'must-fire corpus is empty — this test would verify nothing');
  for (const f of MUST_FIRE) {
    assert.equal(checkBlocklist([f], read, bl, '').length, 1, `should fire on ${f}`);
  }
});

test('spares the correction, real venue rate limits, and the retired per-day class', () => {
  const bl = loadBlocklist(JSON_PATH);
  assert.ok(
    MUST_NOT_FIRE.length > 0,
    'must-not-fire corpus is empty — this test would verify nothing',
  );
  // Non-vacuity: a blocklist that fires on NOTHING would pass every assertion below for the
  // wrong reason. The must-fire test above is what makes these meaningful, so assert here
  // that the class is actually live rather than trusting test ordering.
  assert.equal(
    checkBlocklist(['a.md'], read, bl, '').length,
    1,
    'the live class fires on nothing — every must-not-fire assertion below is vacuous',
  );
  for (const f of MUST_NOT_FIRE) {
    assert.equal(
      checkBlocklist([f], read, bl, '').length,
      0,
      `${f} is legitimate copy and must never be flagged`,
    );
  }
});

test('markdown blockquotes stay visible — the vacuity trap', () => {
  // Several producer defects live inside `> *…*`. A stripper that ate blockquotes
  // would make the whole scan pass over an empty corpus.
  const bq = '> *HOLD verdicts are free and never charged*';
  assert.match(stripCodeCommentsOnly(bq, 'x.md'), /HOLD verdicts are free/);
});

test('loader is fail-closed on a missing file', () => {
  assert.equal(loadBlocklist(join(ROOT, 'ops', 'does-not-exist.json')), null);
});
