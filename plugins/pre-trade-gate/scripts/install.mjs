#!/usr/bin/env node
/**
 * Installs the AlgoVault pre-trade gate in a harness that has no plugin path for it: the
 * Codex CLI, Cursor, Gemini CLI and Devin.
 *
 *   node install.mjs <codex|cursor|gemini|devin> [--project <dir>] [--uninstall]
 *                    [--max-age <minutes>] [--on-wait deny|ask]
 *
 * It writes the gate's two hook entries (record after pre_trade_check, gate before an order
 * tool) into the harness's config: the user's, or the project's with --project. Each entry
 * runs this checkout's adapter with the data dir as an argument and is known by that command
 * path, so --uninstall removes the gate's entries and nothing else. The config is backed up
 * before any change, a re-run that changes nothing writes nothing, and a config that does
 * not parse is refused and left as it is. options.json in the data dir carries --max-age and
 * --on-wait; the gate reads it. The data dir is ~/.algovault/pre-trade-gate, or
 * .algovault/pre-trade-gate inside the --project dir.
 *
 * A harness is offered only once the gate's two-run proof has passed in it (harnesses.mjs,
 * `proven`). --allow-unproven installs one that has not; only the proof runs use it.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HARNESSES, hookEntries } from './lib/harnesses.mjs';

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OPTIONS = Object.freeze({ max_age_minutes: 15, on_wait: 'deny' });
const INSTALLER_HARNESSES = HARNESSES.filter((h) => h.install === 'installer');
const USAGE = `usage: install.mjs <${INSTALLER_HARNESSES.map((h) => h.id).join('|')}> [--project <dir>] [--uninstall] [--max-age <minutes>] [--on-wait deny|ask]`;

/** A request the installer will not carry out. Nothing has been written when it is thrown. */
export class Refused extends Error {}

const need = (rest, flag) => {
  if (!rest.length || rest[0].startsWith('--')) throw new Refused(`${flag} needs a value`);
  return rest.shift();
};

export function parseCliArgs(args) {
  const o = { id: null, project: null, uninstall: false, maxAge: undefined, onWait: undefined, allowUnproven: false };
  const rest = [...args];
  while (rest.length) {
    const a = rest.shift();
    if (a === '--project') o.project = need(rest, a);
    else if (a === '--uninstall') o.uninstall = true;
    else if (a === '--max-age') o.maxAge = need(rest, a);
    else if (a === '--on-wait') o.onWait = need(rest, a);
    else if (a === '--allow-unproven') o.allowUnproven = true;
    else if (a.startsWith('-')) throw new Refused(`unknown option ${a}\n${USAGE}`);
    else if (o.id === null) o.id = a;
    else throw new Refused(`unexpected argument ${a}\n${USAGE}`);
  }
  if (!o.id) throw new Refused(USAGE);
  if (o.maxAge !== undefined) {
    const n = /^\d+(\.\d+)?$/.test(o.maxAge) ? Number(o.maxAge) : NaN;
    if (!(n >= 1 && n <= 240)) throw new Refused('--max-age must be a number of minutes from 1 to 240');
    o.maxAge = n;
  }
  if (o.onWait !== undefined && o.onWait !== 'deny' && o.onWait !== 'ask') throw new Refused('--on-wait must be deny or ask');
  if (o.uninstall && (o.maxAge !== undefined || o.onWait !== undefined)) throw new Refused('--uninstall takes no options');
  return o;
}

const pathsFor = (platform) => (platform === 'win32' ? path.win32 : path.posix);

/** Where the config and the data dir are, for one harness, at user or project level. */
export function targetFor(row, { project = null, home, platform = process.platform, env = process.env }) {
  const p = pathsFor(platform);
  if (project) {
    const dir = p.resolve(project);
    return {
      level: 'project',
      configPath: p.join(dir, ...row.config.project.path),
      hooksKey: row.config.project.hooksKey,
      dataDir: p.join(dir, '.algovault', 'pre-trade-gate'),
    };
  }
  const user = row.config.user;
  let configPath;
  if (platform === 'win32' && user.win32) {
    const base = env[user.win32.env];
    if (!base) throw new Refused(`${user.win32.env} is not set, so ${row.name}'s config cannot be found`);
    configPath = p.join(base, ...user.win32.path);
  } else {
    configPath = p.join(home, ...user.path);
  }
  return { level: 'user', configPath, hooksKey: user.hooksKey, dataDir: p.join(home, '.algovault', 'pre-trade-gate') };
}

/** Characters a shell would read inside double quotes: a path holding one gets no hook command. */
const UNSAFE = { posix: /["`$\\\n\r]/, win32: /["`$%\n\r]/ };

/** The hook's command line: node, this checkout's adapter, the mode, the data dir. */
export function commandFor(row, mode, { dataDir, scriptsDir = SCRIPTS_DIR, platform = process.platform }) {
  const p = pathsFor(platform);
  const script = p.join(scriptsDir, row.adapter);
  const unsafe = platform === 'win32' ? UNSAFE.win32 : UNSAFE.posix;
  for (const v of [script, dataDir]) {
    if (unsafe.test(v)) throw new Refused(`cannot write a hook command for ${v}: the path holds a character the shell would read`);
  }
  return `node "${script}" ${mode} --data-dir "${dataDir}"`;
}

/** One of the gate's entries: its command runs this adapter, from this checkout or another copy of the plugin. */
export function isOurs(row, command, script) {
  if (typeof command !== 'string') return false;
  if (script && command.includes(`"${script}"`)) return true;
  const adapter = row.adapter.replace(/\./g, '\\.');
  return new RegExp(`(?:^|["/\\\\])pre-trade-gate[/\\\\]scripts[/\\\\]${adapter}"`).test(command);
}

function readConfig(file) {
  if (!existsSync(file)) return { exists: false, text: null, value: null };
  const text = readFileSync(file, 'utf8');
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Refused(`${file} is not valid JSON, so it was left as it is. Fix it, then run this again.`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Refused(`${file} is not a JSON object, so it was left as it is.`);
  return { exists: true, text, value };
}

/** The object that holds the hook events: the `hooks` key, or the whole file (Devin's hooks.v1.json). */
function eventsOf(value, hooksKey, file, create) {
  if (hooksKey === null) return value;
  if (value[hooksKey] === undefined) {
    if (!create) return null;
    value[hooksKey] = {};
  }
  const c = value[hooksKey];
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Refused(`"${hooksKey}" in ${file} is not an object, so it was left as it is.`);
  return c;
}

/** Remove the gate's entries from the two events it uses. Returns how many were removed. */
function removeOurs(row, events, file, script) {
  let removed = 0;
  for (const event of [row.events.record, row.events.gate]) {
    const list = events[event];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new Refused(`${event} in ${file} is not a list, so it was left as it is.`);
    const kept = [];
    let changed = false;
    for (const item of list) {
      if (row.config.layout === 'flat') {
        if (item && isOurs(row, item.command, script)) {
          removed += 1;
          changed = true;
        } else kept.push(item);
        continue;
      }
      if (item && Array.isArray(item.hooks)) {
        const hooks = item.hooks.filter((h) => !(h && isOurs(row, h.command, script)));
        if (hooks.length !== item.hooks.length) {
          removed += item.hooks.length - hooks.length;
          changed = true;
          if (hooks.length) kept.push({ ...item, hooks });
          continue;
        }
      }
      kept.push(item);
    }
    if (!changed) continue;
    if (kept.length) events[event] = kept;
    else delete events[event];
  }
  return removed;
}

/** JSON in the file's own indentation and line ending. */
function serialize(value, originalText) {
  const indent = (originalText && /\n([ \t]+)\S/.exec(originalText)?.[1]) || '  ';
  let text = JSON.stringify(value, null, indent);
  if (originalText === null || /\n$/.test(originalText)) text += '\n';
  return originalText && originalText.includes('\r\n') ? text.replace(/\r?\n/g, '\r\n') : text;
}

function writeAtomic(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  const mode = existsSync(file) ? statSync(file).mode & 0o777 : 0o644;
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, text, { mode });
  renameSync(tmp, file);
}

function backup(file, now) {
  const copy = `${file}.algovault-backup-${new Date(now).toISOString().replace(/[:.]/g, '-')}`;
  copyFileSync(file, copy);
  return copy;
}

/** options.json for the data dir: the flags given, the file's current values, else the defaults. */
function nextOptions(dataDir, { maxAge, onWait }) {
  const file = path.join(dataDir, 'options.json');
  let current = {};
  let text = null;
  if (existsSync(file)) {
    text = readFileSync(file, 'utf8');
    try {
      current = JSON.parse(text);
    } catch {
      throw new Refused(`${file} is not valid JSON. Fix or remove it, then run this again.`);
    }
    if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Refused(`${file} is not a JSON object.`);
  }
  const next = { ...current };
  if (maxAge !== undefined || next.max_age_minutes === undefined) next.max_age_minutes = maxAge ?? DEFAULT_OPTIONS.max_age_minutes;
  if (onWait !== undefined || next.on_wait === undefined) next.on_wait = onWait ?? DEFAULT_OPTIONS.on_wait;
  const nextText = `${JSON.stringify(next, null, 2)}\n`;
  return { file, options: next, text: nextText, changed: nextText !== text };
}

const crashLine = (row) =>
  row.failClosed
    ? `In ${row.name}, a gate that cannot run blocks the call.`
    : `In ${row.name}, a gate that crashes or times out lets the call through, so it exits 2 on every error it can catch and watches only the order tools.`;

/**
 * Run the installer. Returns 0; throws Refused for a request it will not carry out, having
 * written nothing.
 */
export function main(argv, { home = homedir(), platform = process.platform, env = process.env, now = Date.now(), scriptsDir = SCRIPTS_DIR, log = (s) => process.stdout.write(`${s}\n`) } = {}) {
  const o = parseCliArgs(argv);
  const row = INSTALLER_HARNESSES.find((h) => h.id === o.id);
  if (!row) throw new Refused(`unknown harness "${o.id}"\n${USAGE}`);
  if (!o.uninstall && !row.proven && !o.allowUnproven) {
    throw new Refused(`${row.name} is not offered yet: the gate's two-run proof has not passed in it.`);
  }
  const target = targetFor(row, { project: o.project, home, platform, env });
  const script = pathsFor(platform).join(scriptsDir, row.adapter);
  const current = readConfig(target.configPath);
  const value = current.exists ? JSON.parse(current.text) : row.config.version ? { version: row.config.version } : {};

  if (o.uninstall) {
    const events = current.exists ? eventsOf(value, target.hooksKey, target.configPath, false) : null;
    const removed = events ? removeOurs(row, events, target.configPath, script) : 0;
    if (!removed) {
      log(`The pre-trade gate is not in ${target.configPath}; nothing changed.`);
      return 0;
    }
    if (target.hooksKey !== null && Object.keys(events).length === 0) delete value[target.hooksKey];
    const saved = backup(target.configPath, now);
    writeAtomic(target.configPath, serialize(value, current.text));
    log(`Removed the pre-trade gate from ${target.configPath} (${removed} hook entries). Backup: ${saved}`);
    log(`Its data dir, ${target.dataDir}, is left in place; delete it if no other harness uses the gate.`);
    return 0;
  }

  const events = eventsOf(value, target.hooksKey, target.configPath, true);
  removeOurs(row, events, target.configPath, script);
  const entries = hookEntries(row.id, (mode) => commandFor(row, mode, { dataDir: target.dataDir, scriptsDir, platform }));
  for (const [event, list] of Object.entries(entries)) {
    if (events[event] === undefined) events[event] = [];
    events[event].push(...list);
  }
  const text = serialize(value, current.text);
  const options = nextOptions(target.dataDir, o);
  const configChanged = text !== current.text;
  if (!configChanged && !options.changed) {
    log(`The pre-trade gate is already in ${target.configPath}; nothing changed.`);
    return 0;
  }
  if (configChanged) {
    const saved = current.exists ? backup(target.configPath, now) : null;
    writeAtomic(target.configPath, text);
    log(`Added the pre-trade gate to ${target.configPath}${saved ? ` (backup: ${saved})` : ''}.`);
  }
  if (options.changed) {
    mkdirSync(target.dataDir, { recursive: true, mode: 0o700 });
    writeAtomic(options.file, options.text);
  }
  log(`Data dir: ${target.dataDir} (max_age_minutes ${options.options.max_age_minutes}, on_wait ${options.options.on_wait}).`);
  log(crashLine(row));
  if (target.level === 'project') log(`Project hooks run only once ${row.name} trusts this project.`);
  return 0;
}

const invoked = process.argv[1] && (() => {
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
})();

if (invoked) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`pre-trade gate install: ${err && err.message ? err.message : err}\n`);
    process.exitCode = 1;
  }
}
