/**
 * The shell every adapter shares except Claude Code's (gate.mjs, kept as shipped): read the
 * hook JSON from stdin, find the data dir, run the core, and hand its result to the
 * adapter's own `respond`, which maps it into that harness's JSON. Every error exits 2 with
 * its reason on stderr: exit 2 is the one way to block that every harness honours.
 *
 *   node <adapter>.mjs <record|gate> [--data-dir <dir>]
 *
 * The data dir is CLAUDE_PLUGIN_DATA or PLUGIN_DATA (set for a plugin's hooks), else the
 * --data-dir the installer writes into the hook's command.
 */
export const PREFIX = 'pre-trade gate: ';

const MODES = new Set(['record', 'gate']);

/** {mode, dataDir}: the mode, and the --data-dir argument when given. Anything else is an error. */
export function parseArgs(args) {
  const [mode, ...rest] = args;
  if (!MODES.has(mode)) throw new Error(`unknown mode "${mode}" (expected record or gate)`);
  let dataDir;
  while (rest.length) {
    const flag = rest.shift();
    if (flag === '--data-dir' && rest.length && rest[0] !== '') dataDir = rest.shift();
    else throw new Error(`unknown argument "${flag}"`);
  }
  return { mode, dataDir };
}

export function resolveDataDir(env, dataDirArg) {
  for (const v of [env.CLAUDE_PLUGIN_DATA, env.PLUGIN_DATA, dataDirArg]) {
    if (typeof v === 'string' && v !== '') return v;
  }
  return undefined;
}

export function reasonOf(err) {
  const message = err && err.message ? err.message : String(err);
  return message.startsWith(PREFIX) ? message : PREFIX + message;
}

async function readStdin() {
  if (process.stdin.isTTY) throw new Error('no hook input on stdin');
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

/**
 * Run one hook call. `respond(mode, result, row)` returns {stdout?: object, stderr?: string,
 * exitCode: 0 | 2}; it may throw, which blocks.
 */
export async function runAdapter(harnessId, respond) {
  const { mode, dataDir } = parseArgs(process.argv.slice(2));
  const [{ evaluate }, { harness }] = await Promise.all([import('./core.mjs'), import('./harnesses.mjs')]);
  const row = harness(harnessId);
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('could not read the hook input');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('could not read the hook input');
  const result = evaluate(
    { ...input, event: mode },
    { dataDir: resolveDataDir(process.env, dataDir), env: process.env, now: Date.now(), harness: row },
  );
  const out = respond(mode, result, row);
  if (out.exitCode !== 0 && out.exitCode !== 2) throw new Error(`an adapter answered with exit code ${out.exitCode}`);
  if (out.stdout !== undefined) process.stdout.write(`${JSON.stringify(out.stdout)}\n`);
  if (out.stderr) process.stderr.write(`${out.stderr}\n`);
  process.exitCode = out.exitCode;
}
