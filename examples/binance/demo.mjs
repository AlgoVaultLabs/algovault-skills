#!/usr/bin/env node
/**
 * AlgoVault × Binance Spot Testnet — Confidence-filtered swing-entry demo.
 *
 * This is the runnable equivalent of Recipe 2 in
 * docs/integrations/binance.md. It demonstrates the full agent loop:
 *   1. Fetch a composite verdict from AlgoVault MCP for ETH 1h.
 *   2. Apply the agent's policy (signal === BUY AND confidence > 70).
 *   3. Validate a small LIMIT order against Binance Spot Testnet via
 *      `POST /api/v3/order/test` (HMAC-signed if keys are set; otherwise
 *      a connectivity probe via GET /api/v3/exchangeInfo).
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.BINANCE_TESTNET === 'true'   (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant                 (compile-time intent)
 *   - SAMPLE_QTY <= 0.001 ETH                  (cap on every requested size)
 *
 * Run:
 *   BINANCE_TESTNET=true node examples/binance/demo.mjs
 *
 * Optional (unlocks the authenticated order/test step):
 *   BINANCE_TESTNET=true \
 *     BINANCE_TESTNET_API_KEY=<key> \
 *     BINANCE_TESTNET_API_SECRET=<secret> \
 *     node examples/binance/demo.mjs
 *
 * Get testnet keys at https://testnet.binance.vision (sign in with GitHub).
 */

import crypto from 'node:crypto';
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const BINANCE_TESTNET_BASE = 'https://testnet.binance.vision/api';
const SAMPLE_SYMBOL = 'ETHUSDT';
const SAMPLE_QTY = 0.001; // ETH; <= cap
const MAX_QTY = 0.001;

if (process.env.BINANCE_TESTNET !== 'true') {
  throw new Error(
    'BINANCE_TESTNET=true required — demo refuses to run against mainnet. ' +
    'See examples/binance/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (SAMPLE_QTY > MAX_QTY) {
  throw new Error(`SAMPLE_QTY ${SAMPLE_QTY} exceeds cap ${MAX_QTY}.`);
}

console.log('=== DEMO MODE ===');
console.log(`[BINANCE_TESTNET=true | base=${BINANCE_TESTNET_BASE} | mainnet_blocked=true]`);

// ── 1. Connectivity probe to Binance Spot Testnet ──
{
  const url = `${BINANCE_TESTNET_BASE}/v3/exchangeInfo?symbol=${SAMPLE_SYMBOL}`;
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`Binance Spot Testnet exchangeInfo failed: HTTP ${r.status}`);
  }
  const info = await r.json();
  const sym = info.symbols?.[0];
  console.log(
    `[binance testnet | exchangeInfo HTTP ${r.status} | ` +
    `symbol=${sym?.symbol} status=${sym?.status} ` +
    `host=${new URL(url).hostname}]`
  );
}

// ── 2. Fetch AlgoVault verdict on ETH 1h ──
let verdict;
try {
  verdict = await getAlgoVaultVerdict({ coin: 'ETH', timeframe: '1h' });
} catch (err) {
  // Free-tier 429 or upstream HL throttle: surface and exit cleanly so the
  // smoke gate doesn't false-RED. Tutorial readers see the exact failure
  // mode they'd encounter in production.
  console.log(`[verdict | unavailable: ${err.message}]`);
  console.log('=== NO REAL ORDERS PLACED ===');
  process.exit(0);
}
console.log(
  `[verdict | signal=${verdict.signal} confidence=${verdict.confidence} ` +
  `regime=${verdict.regime} tool=${verdict._algovault?.tool}]`
);

// ── 3. Apply the agent's policy ──
const policyFires = verdict.signal === 'BUY' && verdict.confidence > 70;
console.log(`[policy | fires=${policyFires} (signal===BUY && confidence>70)]`);

// ── 4. Validate the test order if policy fires AND keys are set ──
const apiKey = process.env.BINANCE_TESTNET_API_KEY;
const apiSecret = process.env.BINANCE_TESTNET_API_SECRET;

if (policyFires && apiKey && apiSecret) {
  const ts = Date.now();
  const params = new URLSearchParams({
    symbol: SAMPLE_SYMBOL,
    side: 'BUY',
    type: 'LIMIT',
    timeInForce: 'GTC',
    quantity: String(SAMPLE_QTY),
    price: '1.00', // intentionally far below market — order/test only validates
    timestamp: String(ts),
    recvWindow: '5000',
  });
  const signature = crypto.createHmac('sha256', apiSecret).update(params.toString()).digest('hex');
  params.append('signature', signature);

  const r = await fetch(`${BINANCE_TESTNET_BASE}/v3/order/test`, {
    method: 'POST',
    headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const body = await r.text();
  console.log(
    `[order/test | HTTP ${r.status} | body=${body || '{}'} | ` +
    'note: order/test validates but does NOT submit]'
  );
} else if (policyFires) {
  console.log('[order/test | SKIPPED — no BINANCE_TESTNET_API_KEY/SECRET set; connectivity-only run]');
} else {
  console.log('[order/test | SKIPPED — policy did not fire]');
}

console.log('=== NO REAL ORDERS PLACED ===');
