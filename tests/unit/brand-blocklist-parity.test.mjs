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

const FIXTURES = {
  // must fire — the phrase CLASS, not one literal
  'a.md': 'Free tier covers 20 calls/day per IP — plenty for development.',
  'b.md': 'Free tier covers up to 20 calls/day per IP',
  'c.md': 'Free tier covers 20 free calls/day',
  'd.md': 'Free tier covers 20 calls per day',
  'e.md': 'Free tier covers 25 calls/day',
  // must NOT fire — the correction, and real VENUE API rate limits
  'ok1.md': 'Free tier: 100 calls/month, every coin and timeframe.',
  'ok2.md': 'rate limits are **per-IP, not per-key** (2,400 weight/min, 1,200 order/min)',
  'ok3.md': '10/s per UID and 3/s per IP on the place-order endpoint.',
};
const read = (f) => FIXTURES[f];

test('fires on every per-day quota phrasing, including a future number', () => {
  const bl = loadBlocklist(JSON_PATH);
  for (const f of ['a.md', 'b.md', 'c.md', 'd.md', 'e.md']) {
    assert.equal(checkBlocklist([f], read, bl, '').length, 1, `should fire on ${f}`);
  }
});

test('spares the correction and real venue rate limits', () => {
  const bl = loadBlocklist(JSON_PATH);
  for (const f of ['ok1.md', 'ok2.md', 'ok3.md']) {
    assert.equal(
      checkBlocklist([f], read, bl, '').length,
      0,
      `${f} is legitimate exchange documentation and must never be flagged`,
    );
  }
});

test('markdown blockquotes stay visible — the vacuity trap', () => {
  // Several producer defects live inside `> *…*`. A stripper that ate blockquotes
  // would make the whole scan pass over an empty corpus.
  const bq = '> *Free tier covers 20 calls/day per IP*';
  assert.match(stripCodeCommentsOnly(bq, 'x.md'), /20 calls\/day/);
});

test('loader is fail-closed on a missing file', () => {
  assert.equal(loadBlocklist(join(ROOT, 'ops', 'does-not-exist.json')), null);
});
