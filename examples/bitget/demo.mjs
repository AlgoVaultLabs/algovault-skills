#!/usr/bin/env node
/**
 * AlgoVault × Bitget Agent Hub — Natural-language verdict + GetClaw demo.
 *
 * Runnable equivalent of Recipe 1 in docs/integrations/bitget.md.
 *   1. AlgoVault MCP read on BTC at 1h.
 *   2. Render verdict as a natural-language instruction (or HOLD if policy
 *      doesn't fire).
 *   3. Probe Bitget contract specs (proves api.bitget.com reachable +
 *      records minTradeNum).
 *
 * IMPORTANT: bitget-mcp-server@1.1.0 has NO env-var-level demo flag —
 * Bitget's demo gating is platform-side via a separate GetClaw demo
 * account (per Bitget Agent Hub's announcement). This demo enforces
 * demo-mode at the WRAPPER level via three independent guards:
 *   1. process.env.BITGET_DEMO === 'true'
 *   2. MAINNET_BLOCKED constant === true
 *   3. SAMPLE_QTY <= MAX_QTY_BTC = 0.0001
 * Operators MUST also use Bitget API keys scoped to a GetClaw demo
 * account. The wrapper cannot enforce that from outside; it can only
 * refuse to run if BITGET_DEMO is not set.
 *
 * Run:
 *   BITGET_DEMO=true node examples/bitget/demo.mjs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const MAX_QTY_BTC = 0.0001;
const SAMPLE_QTY_BTC = 0.0001;
const BITGET_BASE = 'https://api.bitget.com/api/v2';
const ASSET = 'BTC';
const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '1h';

if (process.env.BITGET_DEMO !== 'true') {
  throw new Error(
    'BITGET_DEMO=true required — demo refuses to run against mainnet. ' +
    'Demo also requires GetClaw demo account credentials; see examples/bitget/README.md.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (SAMPLE_QTY_BTC > MAX_QTY_BTC) {
  throw new Error(`SAMPLE_QTY_BTC ${SAMPLE_QTY_BTC} exceeds cap ${MAX_QTY_BTC}.`);
}

console.log('=== DEMO MODE ===');
console.log(
  '[BITGET_DEMO=true | wrapper-enforced (MCP server has no built-in demo flag) | ' +
  `mainnet_blocked=true | qty<=${MAX_QTY_BTC} BTC]`
);

// ── 1. AlgoVault verdict ──
let verdict;
try {
  verdict = await getAlgoVaultVerdict({ coin: ASSET, timeframe: TIMEFRAME });
} catch (err) {
  console.log(`[verdict | unavailable: ${err.message}]`);
  console.log('[instruction | "HOLD — AlgoVault verdict unavailable"]');
  console.log('=== NO REAL ORDERS PLACED ===');
  process.exit(0);
}
console.log(
  `[verdict | signal=${verdict.signal} confidence=${verdict.confidence} ` +
  `regime=${verdict.regime} tool=${verdict._algovault?.tool}]`
);

// ── 2. Render natural-language instruction (the GetClaw input) ──
const policyFires = verdict.signal === 'BUY' && verdict.confidence > 70;
const instruction = policyFires
  ? `BUY ${SAMPLE_QTY_BTC} BTC because confidence is ${verdict.confidence}% and regime is ${verdict.regime}`
  : `HOLD — ${verdict.signal}@${verdict.confidence}% does not meet policy (signal===BUY && confidence>70)`;
console.log(`[instruction | "${instruction}"]`);

// ── 3. Probe Bitget contract specs (proves api.bitget.com reachable) ──
{
  const url = `${BITGET_BASE}/mix/market/contracts?productType=USDT-FUTURES`;
  const r = await fetch(url);
  const body = await r.json();
  if (body.code !== '00000') {
    throw new Error(`Bitget contracts probe failed: code=${body.code} msg=${body.msg}`);
  }
  const contract = body.data?.find((c) => c.symbol === SYMBOL);
  console.log(
    `[bitget | contracts HTTP ${r.status} | host=${new URL(url).hostname} ` +
    `${SYMBOL} minTradeNum=${contract?.minTradeNum} ` +
    `symbolType=${contract?.symbolType}]`
  );
}

// ── 4. GetClaw execution (would be POST /v2/mix/order/place-order via the
//      bitget-mcp-server tools; SKIPPED here without demo-account keys) ──
if (policyFires) {
  console.log(
    `[getclaw | natural-language instruction WOULD be passed to bitget-mcp-server ` +
    `for execution inside the GetClaw demo account ` +
    `(SKIPPED — see README for authenticated POST /v2/mix/order/place-order with ` +
    `BITGET_API_KEY/SECRET/PASSPHRASE)]`
  );
} else {
  console.log('[getclaw | SKIPPED — policy did not fire]');
}

console.log('=== NO REAL ORDERS PLACED ===');
