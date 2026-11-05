#!/usr/bin/env node
/**
 * Devin CLI adapter for the AlgoVault pre-trade gate. It only maps Devin's hook JSON in and
 * out; the logic is the harness-agnostic core in ./lib.
 *
 *   node devin.mjs gate   [--data-dir <dir>]   PreToolUse on an order tool
 *   node devin.mjs record [--data-dir <dir>]   PostToolUse on pre_trade_check
 *
 * Deny: exit 2 with the reason on stderr. A WAIT under on_wait "ask" is denied too. Allow:
 * exit 0 with no output, never {"decision": "approve"}, which would skip Devin's own
 * permission rules. Devin lets every failure but exit 2 through, so the gate exits 2 on
 * every error it can catch, and its matcher (harnesses.mjs) names the order tools alone.
 */
const PREFIX = 'pre-trade gate: ';

function fail(err) {
  const message = err && err.message ? err.message : String(err);
  process.stderr.write(`${message.startsWith(PREFIX) ? message : PREFIX + message}\n`);
  process.exitCode = 2;
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

function respond(mode, result) {
  if (mode === 'record') return { exitCode: 0 };
  if (result.decision === 'deny' || result.decision === 'ask') return { stderr: result.reason, exitCode: 2 };
  if (result.decision === 'allow') return { exitCode: 0 };
  throw new Error(`unknown decision "${result.decision}"`);
}

try {
  const { runAdapter } = await import('./lib/adapter.mjs');
  await runAdapter('devin', respond);
} catch (err) {
  fail(err);
}
