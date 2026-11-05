#!/usr/bin/env node
/**
 * Gemini CLI adapter for the AlgoVault pre-trade gate. It only maps Gemini CLI's hook JSON
 * in and out; the logic is the harness-agnostic core in ./lib.
 *
 *   node gemini.mjs gate   [--data-dir <dir>]   BeforeTool on an order tool
 *   node gemini.mjs record [--data-dir <dir>]   AfterTool on pre_trade_check
 *
 * Deny: {decision: "deny", reason} and exit 2, the reason on stderr. Gemini CLI documents no
 * "ask", so a WAIT under on_wait "ask" is denied too. Allow: exit 0 with no output, which
 * leaves the call to Gemini CLI's own rules; an explicit decision could override them.
 * Gemini CLI lets other failures through, so the gate exits 2 on every error it can catch,
 * and its matcher (harnesses.mjs) names the order tools alone.
 */
const PREFIX = 'pre-trade gate: ';

function fail(err) {
  const message = err && err.message ? err.message : String(err);
  process.stderr.write(`${message.startsWith(PREFIX) ? message : PREFIX + message}\n`);
  process.exitCode = 2;
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

const deny = (reason) => ({ stdout: { decision: 'deny', reason }, stderr: reason, exitCode: 2 });

function respond(mode, result) {
  if (mode === 'record') return { exitCode: 0 };
  if (result.decision === 'deny') return deny(result.reason);
  if (result.decision === 'ask') return deny(result.reason);
  if (result.decision === 'allow') return { exitCode: 0 };
  throw new Error(`unknown decision "${result.decision}"`);
}

try {
  const { runAdapter } = await import('./lib/adapter.mjs');
  await runAdapter('gemini', respond);
} catch (err) {
  fail(err);
}
