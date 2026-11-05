#!/usr/bin/env node
/**
 * Cursor adapter for the AlgoVault pre-trade gate. It only maps Cursor's hook JSON in and
 * out; the logic is the harness-agnostic core in ./lib.
 *
 *   node cursor.mjs gate   [--data-dir <dir>]   beforeMCPExecution
 *   node cursor.mjs record [--data-dir <dir>]   afterMCPExecution (the check's result_json)
 *
 * Gate output is {permission, user_message, agent_message}. Deny also exits 2 with the
 * reason on stderr. A WAIT under on_wait "ask" is permission "ask", so a person can approve
 * it. Every MCP call reaches this hook (harnesses.mjs: no matcher), and Cursor blocks a
 * permission hook whose output is not valid JSON in its schema, so a pass answers
 * permission "allow", carrying the check's context to the agent when there is one.
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
  if (result.decision === 'deny') {
    return { stdout: { permission: 'deny', user_message: result.reason, agent_message: result.reason }, stderr: result.reason, exitCode: 2 };
  }
  if (result.decision === 'ask') {
    return { stdout: { permission: 'ask', user_message: result.reason, agent_message: result.reason }, exitCode: 0 };
  }
  if (result.decision === 'allow') {
    return { stdout: result.context ? { permission: 'allow', agent_message: result.context } : { permission: 'allow' }, exitCode: 0 };
  }
  throw new Error(`unknown decision "${result.decision}"`);
}

try {
  const { runAdapter } = await import('./lib/adapter.mjs');
  await runAdapter('cursor', respond);
} catch (err) {
  fail(err);
}
