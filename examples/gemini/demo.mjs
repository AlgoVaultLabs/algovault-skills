#!/usr/bin/env node
/**
 * AlgoVault × Gemini Sandbox — Multi-timeframe consensus + perp watch demo.
 *
 * Runnable equivalent of Recipe 1 in docs/integrations/gemini.md.
 *   1. AlgoVault MCP read on ETH at two timeframes (15m + 1h).
 *   2. Consensus check — both timeframes return the same non-HOLD direction.
 *   3. Keyless Gemini sandbox public probe to prove the sandbox path.
 *
 * Run:
 *   GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1 node examples/gemini/demo.mjs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const base = process.env.GEMINI_API_BASE_URL || '';
if (!base.includes('sandbox')) {
  throw new Error(
    'GEMINI_API_BASE_URL must contain "sandbox" — demo refuses to run against mainnet. ' +
    'Run: GEMINI_API_BASE_URL=https://api.sandbox.gemini.com/v1 node examples/gemini/demo.mjs'
  );
}
const ASSET = 'ETH';
const TIMEFRAMES = ['15m', '1h']; // free-tier compatible

console.log('=== DEMO MODE ===');
console.log(`[GEMINI_API_BASE_URL=${base} | mainnet_blocked=true]`);

// ── 1. Multi-timeframe AlgoVault read on ETH ──
const verdicts = [];
for (const tf of TIMEFRAMES) {
  try {
    const v = await getAlgoVaultVerdict({ coin: ASSET, timeframe: tf });
    verdicts.push({ tf, ...v });
  } catch (err) {
    console.log(`[verdict | ${tf} unavailable: ${err.message}]`);
    verdicts.push({ tf, signal: null, _error: err.message });
  }
}
const summary = verdicts
  .map((v) => `${v.tf}=${v.signal ?? 'unavail'}@${v.confidence ?? '-'}`)
  .join(' ');
const directions = new Set(verdicts.map((v) => v.signal).filter(Boolean));
const consensus = directions.size === 1 && !directions.has('HOLD') && verdicts.every((v) => v.signal);
const direction = consensus ? [...directions][0] : null;
console.log(`[verdicts | ${summary} | consensus=${consensus} direction=${direction ?? '-'}]`);

// ── 2. Keyless Gemini sandbox public probe (proves sandbox path) ──
try {
  const r = await fetch(`${base}/pubticker/btcusd`);
  const body = await r.json();
  console.log(
    `[gemini sandbox | pubticker HTTP ${r.status} | ` +
    `host=api.sandbox.gemini.com last=${body.last ?? '-'}]`
  );
} catch (err) {
  console.log(`[gemini sandbox | pubticker unavailable: ${err.message}]`);
}

// ── 3. Order placement (always SKIPPED in this demo) ──
console.log('[order | SKIPPED — see README for gemini_new_order via MCP with sandbox keys]');

console.log('=== NO REAL ORDERS PLACED ===');
