#!/usr/bin/env node
/**
 * Codex adapter for the AlgoVault pre-trade gate. It only maps Codex's hook JSON in and
 * out; the logic is the harness-agnostic core in ./lib.
 *
 *   node codex.mjs record [--data-dir <dir>]   PostToolUse on pre_trade_check
 *   node codex.mjs gate   [--data-dir <dir>]   PreToolUse on an order tool
 *
 * Deny: hookSpecificOutput.permissionDecision "deny" and exit 2, the reason on stderr.
 * A WAIT under on_wait "ask" is denied too: Codex parses "ask" but does not support it,
 * so the hook run would fail and the order would go through. Allow: additionalContext
 * only, never permissionDecision "allow". Codex lets a crashed hook through, so the gate
 * exits 2 on every error it can catch, and its matcher (harnesses.mjs) names the order
 * tools alone: a gate that fails can never stand between the agent and its check.
 */
const PREFIX = 'pre-trade gate: ';

function fail(err) {
  const message = err && err.message ? err.message : String(err);
  process.stderr.write(`${message.startsWith(PREFIX) ? message : PREFIX + message}\n`);
  process.exitCode = 2;
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

function deny(reason) {
  return {
    stdout: { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } },
    stderr: reason,
    exitCode: 2,
  };
}

function respond(mode, result) {
  if (mode === 'record') return { exitCode: 0 };
  if (result.decision === 'deny') return deny(result.reason);
  if (result.decision === 'ask') return deny(result.reason);
  if (result.decision === 'allow') {
    if (!result.context) return { exitCode: 0 };
    return { stdout: { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: result.context } }, exitCode: 0 };
  }
  throw new Error(`unknown decision "${result.decision}"`);
}

try {
  const { runAdapter } = await import('./lib/adapter.mjs');
  await runAdapter('codex', respond);
} catch (err) {
  fail(err);
}
