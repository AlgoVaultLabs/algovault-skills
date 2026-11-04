#!/usr/bin/env node
/**
 * Claude Code adapter for the AlgoVault pre-trade gate. It only maps Claude Code's hook
 * JSON in and out; the logic is the harness-agnostic core in ./lib.
 *
 *   node gate.mjs record   PostToolUse on pre_trade_check: keep the check's record
 *   node gate.mjs gate     PreToolUse: pass, or block an opening order with no fresh check
 *
 * Exit codes: 0 passes (an allow may carry additionalContext; it never sets
 * permissionDecision "allow", which would skip the user's own permission prompt);
 * 2 blocks, with the reason on stderr. Nothing exits 1: every error, including one
 * loading the core, exits 2 with its reason, and the PreToolUse hook's
 * `onFailure: "block"` covers a gate that cannot start at all.
 */
const PREFIX = 'pre-trade gate: ';
const mode = process.argv[2];

function fail(err) {
  const message = err && err.message ? err.message : String(err);
  process.stderr.write(`${message.startsWith(PREFIX) ? message : PREFIX + message}\n`);
  process.exitCode = 2;
}

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);

async function readStdin() {
  if (process.stdin.isTTY) throw new Error('no hook input on stdin');
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

function emit(json) {
  process.stdout.write(`${JSON.stringify(json)}\n`);
}

try {
  if (mode !== 'record' && mode !== 'gate') throw new Error(`unknown mode "${mode}" (expected record or gate)`);
  const { evaluate } = await import('./lib/core.mjs');
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('could not read the hook input');
  }
  const result = evaluate(
    { ...input, event: mode },
    { dataDir: process.env.CLAUDE_PLUGIN_DATA, env: process.env, now: Date.now() },
  );
  if (mode === 'gate') {
    if (result.decision === 'deny') {
      emit({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: result.reason },
      });
      process.stderr.write(`${result.reason}\n`);
      process.exitCode = 2;
    } else if (result.decision === 'ask') {
      emit({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: result.reason },
      });
    } else if (result.decision === 'allow') {
      if (result.context) emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: result.context } });
    } else {
      throw new Error(`unknown decision "${result.decision}"`);
    }
  }
} catch (err) {
  fail(err);
}
