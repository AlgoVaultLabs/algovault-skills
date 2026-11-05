// Unit tests for plugins/pre-trade-gate/scripts/install.mjs, and the README's install lines.
//
// The installer runs as a user runs it, on a temporary HOME (and a temporary project for
// --project); nothing touches a real harness config. Unproven harnesses are installed with
// --allow-unproven, the flag the proof runs use.
//
// PRE_TRADE_GATE_ROOT points the suite at another copy of the plugin (the mutation suite).
//
// Run: node --test tests/unit/pre-trade-gate-install.test.mjs

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// The real path: Node gives install.mjs its own real path, and macOS's tmpdir is a symlink.
const ROOT = realpathSync(process.env.PRE_TRADE_GATE_ROOT ? resolve(process.env.PRE_TRADE_GATE_ROOT) : join(REPO, 'plugins', 'pre-trade-gate'));
const SCRIPTS = join(ROOT, 'scripts');
const INSTALL = join(SCRIPTS, 'install.mjs');
const { HARNESSES, harness, hookEntries } = await import(pathToFileURL(join(SCRIPTS, 'lib', 'harnesses.mjs')).href);
const { targetFor, commandFor } = await import(pathToFileURL(INSTALL).href);

const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const read = (f) => readFileSync(f, 'utf8');
const json = (f) => JSON.parse(read(f));

function install(args, { home, allowUnproven = true }) {
  const flags = allowUnproven ? [...args, '--allow-unproven'] : args;
  const r = spawnSync(process.execPath, [INSTALL, ...flags], {
    env: { PATH: process.env.PATH ?? '', HOME: home },
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** The entries the installer must write: the table's, with this checkout's command line. */
function expectedEntries(id, dataDir) {
  const row = harness(id);
  return hookEntries(id, (mode) => `node "${join(SCRIPTS, row.adapter)}" ${mode} --data-dir "${dataDir}"`);
}

const backups = (file) => readdirSync(dirname(file)).filter((f) => f.startsWith(`${file.split('/').pop()}.algovault-backup-`));

/** A config holding other hooks in the gate's own events, in each harness's layout. */
const FOREIGN = {
  codex: {
    description: 'team hooks',
    hooks: {
      PreToolUse: [{ matcher: '^Bash$', hooks: [{ type: 'command', command: 'python3 ~/.codex/policy.py', timeout: 30 }] }],
      PostToolUse: [{ hooks: [{ type: 'command', command: 'node ~/.codex/audit.mjs', statusMessage: 'auditing' }] }],
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi' }] }],
    },
  },
  cursor: {
    version: 1,
    hooks: {
      beforeMCPExecution: [{ command: './hooks/audit.sh' }],
      afterMCPExecution: [{ command: './hooks/audit.sh' }],
      beforeShellExecution: [{ command: './hooks/shell.sh', matcher: 'rm', timeout: 30 }],
    },
  },
  gemini: {
    theme: 'Default',
    mcpServers: { okx: { command: 'okx-trade-mcp' } },
    hooks: { BeforeTool: [{ matcher: 'write_file|replace', hooks: [{ name: 'security-check', type: 'command', command: '$GEMINI_PROJECT_DIR/.gemini/hooks/security.sh', timeout: 5000 }] }] },
  },
  devin: {
    model: 'default',
    hooks: { PreToolUse: [{ matcher: 'exec', hooks: [{ type: 'command', command: './scripts/validate.sh', timeout: 10 }] }] },
  },
};

const userConfig = (id, home) => targetFor(harness(id), { home, platform: process.platform, env: {} }).configPath;

describe('install, re-run, uninstall', { concurrency: true }, () => {
  for (const id of ['codex', 'cursor', 'gemini', 'devin']) {
    const row = harness(id);

    test(`${id}: merges into a config that has other hooks, and keeps them`, () => {
      const home = tmp('ptg-home-');
      const file = userConfig(id, home);
      mkdirSync(dirname(file), { recursive: true });
      const original = `${JSON.stringify(FOREIGN[id], null, 2)}\n`;
      writeFileSync(file, original);
      const r = install([id], { home });
      assert.equal(r.code, 0, r.stderr);
      const after = json(file);
      const dataDir = join(home, '.algovault', 'pre-trade-gate');
      const events = row.config.user.hooksKey ? after[row.config.user.hooksKey] : after;
      const before = row.config.user.hooksKey ? FOREIGN[id][row.config.user.hooksKey] : FOREIGN[id];
      for (const [event, list] of Object.entries(expectedEntries(id, dataDir))) {
        const prior = before[event] ?? [];
        assert.deepEqual(events[event].slice(0, prior.length), prior, `${id}: ${event} lost or changed a foreign hook`);
        assert.deepEqual(events[event].slice(prior.length), list, `${id}: ${event} is not the table's entry`);
      }
      for (const [k, v] of Object.entries(FOREIGN[id])) {
        if (k !== row.config.user.hooksKey) assert.deepEqual(after[k], v, `${id}: ${k} changed`);
      }
      assert.deepEqual(json(join(dataDir, 'options.json')), { max_age_minutes: 15, on_wait: 'deny' });
      const [bak] = backups(file);
      assert.ok(bak, 'no backup written');
      assert.equal(read(join(dirname(file), bak)), original, 'the backup is not the original');
    });

    test(`${id}: a re-run changes nothing, and uninstall leaves the rest byte-identical`, () => {
      const home = tmp('ptg-home-');
      const file = userConfig(id, home);
      mkdirSync(dirname(file), { recursive: true });
      const original = `${JSON.stringify(FOREIGN[id], null, 4)}\n`;
      writeFileSync(file, original);
      assert.equal(install([id], { home }).code, 0);
      const installed = read(file);
      const options = read(join(home, '.algovault', 'pre-trade-gate', 'options.json'));
      const r = install([id], { home });
      assert.equal(r.code, 0, r.stderr);
      assert.match(r.stdout, /nothing changed/);
      assert.equal(read(file), installed);
      assert.equal(read(join(home, '.algovault', 'pre-trade-gate', 'options.json')), options);
      assert.equal(backups(file).length, 1, 'a re-run that changes nothing writes no backup');
      const u = install([id, '--uninstall'], { home });
      assert.equal(u.code, 0, u.stderr);
      assert.equal(read(file), original, `${id}: uninstall did not restore the rest byte for byte`);
      assert.match(install([id, '--uninstall'], { home }).stdout, /nothing changed/);
    });

    test(`${id}: a malformed config is refused and left untouched`, () => {
      const home = tmp('ptg-home-');
      const file = userConfig(id, home);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, '{ "hooks": ');
      const r = install([id], { home });
      assert.equal(r.code, 1);
      assert.match(r.stderr, /not valid JSON/);
      assert.equal(read(file), '{ "hooks": ');
      assert.equal(backups(file).length, 0);
      assert.equal(existsSync(join(home, '.algovault')), false, 'nothing written');
    });

    test(`${id}: a fresh config, at project level, with the data dir inside the project`, () => {
      const home = tmp('ptg-home-');
      const project = tmp('ptg-proj-');
      const r = install([id, '--project', project, '--max-age', '30', '--on-wait', 'ask'], { home });
      assert.equal(r.code, 0, r.stderr);
      const file = join(project, ...row.config.project.path);
      const dataDir = join(project, '.algovault', 'pre-trade-gate');
      const written = json(file);
      const events = row.config.project.hooksKey ? written[row.config.project.hooksKey] : written;
      assert.deepEqual(events, expectedEntries(id, dataDir));
      if (row.config.version) assert.equal(written.version, row.config.version);
      assert.deepEqual(json(join(dataDir, 'options.json')), { max_age_minutes: 30, on_wait: 'ask' });
      assert.equal(existsSync(join(home, '.algovault')), false, 'a project install writes nothing under HOME');
      assert.equal(install([id, '--project', project], { home }).stdout.includes('nothing changed'), true, 'a re-run keeps the options');
    });
  }

  test("a foreign hook in the gate's own group survives uninstall", () => {
    const home = tmp('ptg-home-');
    const file = userConfig('codex', home);
    assert.equal(install(['codex'], { home }).code, 0);
    const v = json(file);
    v.hooks.PreToolUse[0].hooks.push({ type: 'command', command: 'node ~/.codex/also.mjs' });
    writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`);
    assert.equal(install(['codex', '--uninstall'], { home }).code, 0);
    assert.deepEqual(json(file).hooks.PreToolUse, [{ matcher: harness('codex').matcher.gate, hooks: [{ type: 'command', command: 'node ~/.codex/also.mjs' }] }]);
    assert.equal(json(file).hooks.PostToolUse, undefined);
  });

  test("an entry from another copy of the plugin is replaced, not duplicated", () => {
    const home = tmp('ptg-home-');
    const file = userConfig('codex', home);
    mkdirSync(dirname(file), { recursive: true });
    const old = { type: 'command', command: 'node "/old/clone/plugins/pre-trade-gate/scripts/codex.mjs" gate --data-dir "/old/data"', timeout: 10 };
    writeFileSync(file, `${JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'x', hooks: [old] }] } }, null, 2)}\n`);
    assert.equal(install(['codex'], { home }).code, 0);
    const pre = json(file).hooks.PreToolUse;
    assert.equal(pre.length, 1);
    assert.ok(pre[0].hooks[0].command.includes(join(SCRIPTS, 'codex.mjs')));
  });

  test('a hooks key that is not an object is refused untouched', () => {
    const home = tmp('ptg-home-');
    const file = userConfig('gemini', home);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, '{"hooks": []}\n');
    assert.equal(install(['gemini'], { home }).code, 1);
    assert.equal(read(file), '{"hooks": []}\n');
  });

  test('an unproven harness is refused without --allow-unproven, and nothing is written', () => {
    for (const row of HARNESSES.filter((h) => h.install === 'installer' && !h.proven)) {
      const home = tmp('ptg-home-');
      const r = install([row.id], { home, allowUnproven: false });
      assert.equal(r.code, 1, `${row.id} was installed unproven`);
      assert.match(r.stderr, /not offered yet/);
      assert.deepEqual(readdirSync(home), [], `${row.id}: something was written`);
    }
  });

  test('a proven harness installs without --allow-unproven', () => {
    for (const row of HARNESSES.filter((h) => h.install === 'installer' && h.proven)) {
      assert.equal(install([row.id], { home: tmp('ptg-home-'), allowUnproven: false }).code, 0, row.id);
    }
  });

  test('bad arguments are refused', () => {
    const home = tmp('ptg-home-');
    for (const args of [[], ['claude-code'], ['codex', '--max-age', '0'], ['codex', '--max-age', '500'], ['codex', '--on-wait', 'allow'], ['codex', '--uninstall', '--max-age', '5'], ['codex', '--frob']]) {
      assert.equal(install(args, { home }).code, 1, args.join(' '));
    }
    assert.deepEqual(readdirSync(home), []);
  });
});

describe('paths', () => {
  test('Devin on Windows: %APPDATA%\\devin\\config.json', () => {
    const t = targetFor(harness('devin'), { home: 'C:\\Users\\u', platform: 'win32', env: { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' } });
    assert.equal(t.configPath, 'C:\\Users\\u\\AppData\\Roaming\\devin\\config.json');
    assert.equal(t.dataDir, 'C:\\Users\\u\\.algovault\\pre-trade-gate');
    assert.equal(t.hooksKey, 'hooks');
    assert.throws(() => targetFor(harness('devin'), { home: 'C:\\Users\\u', platform: 'win32', env: {} }), /APPDATA/);
  });

  test('Windows commands quote backslash paths; a path the shell would read is refused', () => {
    const cmd = commandFor(harness('devin'), 'gate', { dataDir: 'C:\\Users\\u\\.algovault\\pre-trade-gate', scriptsDir: 'C:\\algovault-skills\\plugins\\pre-trade-gate\\scripts', platform: 'win32' });
    assert.equal(cmd, 'node "C:\\algovault-skills\\plugins\\pre-trade-gate\\scripts\\devin.mjs" gate --data-dir "C:\\Users\\u\\.algovault\\pre-trade-gate"');
    for (const bad of ['/tmp/a"b', '/tmp/$HOME', '/tmp/`x`', '/tmp/a\\b']) {
      assert.throws(() => commandFor(harness('codex'), 'gate', { dataDir: bad, platform: 'darwin' }), /character the shell would read/);
    }
  });

  test('user configs at the documented paths', () => {
    const home = '/home/u';
    const want = { codex: '/home/u/.codex/hooks.json', cursor: '/home/u/.cursor/hooks.json', gemini: '/home/u/.gemini/settings.json', devin: '/home/u/.config/devin/config.json' };
    for (const [id, p] of Object.entries(want)) assert.equal(targetFor(harness(id), { home, platform: 'linux', env: {} }).configPath, p);
    assert.equal(targetFor(harness('devin'), { project: '/w', home, platform: 'linux' }).configPath, '/w/.devin/hooks.v1.json');
    assert.equal(targetFor(harness('devin'), { project: '/w', home, platform: 'linux' }).hooksKey, null);
  });
});

describe('the README', () => {
  const readme = read(join(REPO, 'README.md'));

  test('offers the installer for exactly the proven harnesses', () => {
    for (const row of HARNESSES.filter((h) => h.install === 'installer')) {
      assert.equal(readme.includes(`install.mjs ${row.id}`), Boolean(row.proven), `${row.id}: proven ${Boolean(row.proven)}`);
    }
  });
});
