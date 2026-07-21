#!/usr/bin/env node
/**
 * AlgoVault × BingX VST (demo trading) — confidence-filtered entry validator.
 *
 * This is the runnable equivalent of the Demo in docs/integrations/bingx.md.
 * It demonstrates the full agent loop:
 *   1. Fetch a composite verdict from AlgoVault MCP for BTC 1h.
 *   2. Apply the agent's policy (call === BUY AND confidence > 70).
 *   3. Validate a small MARKET order against BingX's VST demo host via
 *      `POST /openApi/swap/v2/trade/order/test` (HMAC-signed if keys are set;
 *      otherwise a connectivity probe via the public contracts endpoint).
 *
 * BingX publishes NO official client SDK, so this uses plain fetch +
 * node:crypto — zero third-party dependencies.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.BINGX_TESTNET === 'true'   (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant               (compile-time intent)
 *   - SAMPLE_QTY <= MAX_QTY                  (cap on every requested size)
 *   - base host must be the VST host         (not the live host)
 *   - only the /order/test endpoint is ever called — never /trade/order
 *
 * Run:
 *   BINGX_TESTNET=true node examples/bingx/demo.mjs
 *
 * Optional (unlocks the authenticated dry-run step):
 *   BINGX_TESTNET=true \
 *     BINGX_API_KEY=<key> \
 *     BINGX_API_SECRET=<secret> \
 *     node examples/bingx/demo.mjs
 *
 * Docs: https://bingx-api.github.io/docs/
 */

import crypto from 'node:crypto';
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const BINGX_VST_BASE = 'https://open-api-vst.bingx.com';   // demo / paper host
const BINGX_LIVE_BASE = 'https://open-api.bingx.com';      // never used here
const SAMPLE_SYMBOL = 'BTC-USDT';
const SAMPLE_QTY = 0.001;
const MAX_QTY = 0.001;

if (process.env.BINGX_TESTNET !== 'true') {
  throw new Error(
    'BINGX_TESTNET=true required — demo refuses to run against mainnet. ' +
    'See examples/bingx/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (SAMPLE_QTY > MAX_QTY) {
  throw new Error(`SAMPLE_QTY ${SAMPLE_QTY} exceeds cap ${MAX_QTY}.`);
}
if (BINGX_VST_BASE === BINGX_LIVE_BASE || !BINGX_VST_BASE.includes('-vst.')) {
  throw new Error(`Refusing to run: ${BINGX_VST_BASE} is not the VST demo host.`);
}

console.log('=== DEMO MODE ===');
console.log(`[BINGX_TESTNET=true | base=${BINGX_VST_BASE} | mainnet_blocked=true]`);

// ── 1. Connectivity probe against the VST host (keyless) ──
// NOTE: symbols on the VST host are NORMAL (BTC-USDT), not "-VST"-suffixed.
// The VST universe is a strict SUBSET of live, so confirm the symbol is
// actually tradable on the demo host before building an order for it.
{
  const r = await fetch(`${BINGX_VST_BASE}/openApi/swap/v2/quote/contracts`);
  if (!r.ok) throw new Error(`BingX VST contracts returned ${r.status}`);
  const body = await r.json();
  const contracts = Array.isArray(body?.data) ? body.data : [];
  const found = contracts.some((c) => c.symbol === SAMPLE_SYMBOL);
  console.log(
    `[bingx vst | contracts HTTP ${r.status} | ${SAMPLE_SYMBOL} ` +
    `${found ? 'tradable' : 'NOT LISTED'} on the demo host (${contracts.length} total)]`
  );
  if (!found) {
    console.log('[bingx] symbol absent from the VST universe — nothing to validate.');
    process.exit(0);
  }
}

// ── 2. Composite verdict from AlgoVault ──
const verdict = await getAlgoVaultVerdict({ coin: 'BTC', timeframe: '1h' });
console.log(
  `[verdict | call=${verdict.call} confidence=${verdict.confidence} ` +
  `regime=${verdict.regime} tool=get_trade_call]`
);

// ── 3. The agent's policy decides. AlgoVault supplies analytics only. ──
const policyFires = verdict.call === 'BUY' && Number(verdict.confidence) > 70;
console.log(`[policy | fires=${policyFires} (call===BUY && confidence>70)]`);

if (!policyFires) {
  console.log('[order/test | SKIPPED — policy did not fire]');
  console.log('=== NO REAL ORDERS PLACED ===');
  process.exit(0);
}

const apiKey = process.env.BINGX_API_KEY;
const apiSecret = process.env.BINGX_API_SECRET;
if (!apiKey || !apiSecret) {
  console.log('[order/test | SKIPPED — set BINGX_API_KEY + BINGX_API_SECRET to run the dry-run]');
  console.log('=== NO REAL ORDERS PLACED ===');
  process.exit(0);
}

// ── 4. Signed DRY-RUN. /order/test validates signature + params, places nothing. ──
const params = {
  symbol: SAMPLE_SYMBOL,
  side: 'BUY',
  positionSide: 'LONG',
  type: 'MARKET',
  quantity: SAMPLE_QTY,
  timestamp: Date.now(),
};
// ASCII-sort by key, join k=v&…, and sign the RAW string (do not URL-encode
// before signing — a classic BingX signature failure).
const paramString = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
const signature = crypto.createHmac('sha256', apiSecret).update(paramString).digest('hex');

const res = await fetch(
  `${BINGX_VST_BASE}/openApi/swap/v2/trade/order/test?${paramString}&signature=${signature}`,
  {
    method: 'POST',
    headers: {
      'X-BX-APIKEY': apiKey,
      // Documented as required on all requests by BingX's own reference.
      'X-SOURCE-KEY': 'BX-AI-SKILL',
    },
  },
);
const out = await res.json();
console.log(`[order/test | HTTP ${res.status} | code=${out?.code} msg=${out?.msg ?? 'ok'}]`);
console.log('=== NO REAL ORDERS PLACED (dry-run endpoint only) ===');
