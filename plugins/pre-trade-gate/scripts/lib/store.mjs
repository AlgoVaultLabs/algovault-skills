/**
 * The check records: one JSON file per pre_trade_check, at
 * `<data dir>/checks/<session id>/<tool use id>.json`, written atomically (temp file, then
 * rename) so a reader never sees half a record. Ids are sanitised to a closed character
 * set, so a hostile id cannot leave the checks directory. Files older than 24 hours are
 * pruned whenever a record is written.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DECISIONS } from './check-response.mjs';

export const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export class StoreError extends Error {}

/** Letters, digits, `_` and `-` only, at most 128 characters; never empty. */
export function sanitizeId(raw, what) {
  const s = String(raw ?? '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 128);
  if (!s) throw new StoreError(`no ${what}`);
  return s;
}

function checksDir(dataDir) {
  if (typeof dataDir !== 'string' || dataDir === '') throw new StoreError('CLAUDE_PLUGIN_DATA is not set');
  return resolve(dataDir, 'checks');
}

function sessionDir(dataDir, sessionId) {
  const base = checksDir(dataDir);
  const dir = resolve(base, sanitizeId(sessionId, 'session id'));
  const rel = relative(base, dir);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new StoreError('the session id leaves the checks directory');
  return dir;
}

export function writeRecord(dataDir, sessionId, toolUseId, record) {
  const dir = sessionDir(dataDir, sessionId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const id = toolUseId ? sanitizeId(toolUseId, 'tool use id') : `check-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const file = join(dir, `${id}.json`);
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 });
  renameSync(tmp, file);
  return file;
}

function isRecord(r) {
  return (
    r &&
    typeof r === 'object' &&
    typeof r.coin === 'string' &&
    (r.side === 'long' || r.side === 'short') &&
    DECISIONS.includes(r.decision) &&
    typeof r.recorded_at === 'number' &&
    Number.isFinite(r.recorded_at)
  );
}

/** Every well-formed record this session holds. A missing directory is an empty list. */
export function readRecords(dataDir, sessionId) {
  const dir = sessionDir(dataDir, sessionId);
  let names;
  try {
    names = readdirSync(dir);
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    let r;
    try {
      r = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    } catch {
      continue; // a file that does not parse can only take an allow away, never add one
    }
    if (isRecord(r)) out.push(r);
  }
  return out;
}

/** Remove record files (and leftover temp files) older than 24 hours, then empty session dirs. */
export function pruneRecords(dataDir, now, maxAgeMs = PRUNE_AFTER_MS) {
  const base = checksDir(dataDir);
  let sessions;
  try {
    sessions = readdirSync(base);
  } catch {
    return;
  }
  for (const s of sessions) {
    const dir = join(base, s);
    try {
      for (const name of readdirSync(dir)) {
        const file = join(dir, name);
        try {
          if (now - statSync(file).mtimeMs > maxAgeMs) unlinkSync(file);
        } catch {
          // best effort: a file another process removed first is already pruned
        }
      }
      if (readdirSync(dir).length === 0) rmdirSync(dir);
    } catch {
      // not a directory, or removed concurrently: nothing to prune here
    }
  }
}
