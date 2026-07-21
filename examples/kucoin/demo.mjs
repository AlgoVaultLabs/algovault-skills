#!/usr/bin/env node
/**
 * AlgoVault × KuCoin Futures — confidence-filtered order VALIDATOR.
 *
 * This is the runnable equivalent of the Demo in docs/integrations/kucoin.md:
 *   1. Fetch a composite verdict from AlgoVault MCP for BTC 1h.
 *   2. Apply the agent's policy (call === BUY AND confidence > 70).
 *   3. Validate a small order via `POST /api/v1/orders/test` (HMAC-signed if
 *      credentials are set; otherwise a public connectivity probe).
 *
 * ⚠️ THERE IS NO KUCOIN SANDBOX. KuCoin retired it on 2023-07-10 and every
 * historical sandbox host is NXDOMAIN. `/api/v1/orders/test` VALIDATES an
 * order payload — signature, symbol, sizing, permissions — and returns
 * WITHOUT placing a trade. It does NOT fill, does NOT simulate a matching
 * engine, and gives NO simulated balances. Do not describe it as a testnet.
 *
 * The live endpoint `/api/v1/orders` appears NOWHERE in this file, so there is
 * no code path here that can place an order.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.KUCOIN_DRY_RUN === 'true'  (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant               (compile-time intent)
 *   - SAMPLE_SIZE <= MAX_SIZE                (cap on every requested size)
 *   - ORDER_PATH must end in '/test'         (structural: no live order path)
 *
 * Run:
 *   KUCOIN_DRY_RUN=true node examples/kucoin/demo.mjs
 *
 * Optional (unlocks the authenticated validation step):
 *   KUCOIN_DRY_RUN=true \
 *     KUCOIN_API_KEY=<key> KUCOIN_API_SECRET=<secret> \
 *     KUCOIN_API_PASSPHRASE=<passphrase> \
 *     node examples/kucoin/demo.mjs
 *
 * Docs: https://www.kucoin.com/docs-new
 */

import crypto from 'node:crypto';
import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const KUCOIN_FUTURES_BASE = 'https://api-futures.kucoin.com'; // futures ≠ spot host
const ORDER_PATH = '/api/v1/orders/test';                     // VALIDATION only
const SAMPLE_SYMBOL = 'XBTUSDTM';
const SAMPLE_SIZE = 1;   // contracts
const MAX_SIZE = 1;

if (process.env.KUCOIN_DRY_RUN !== 'true') {
  throw new Error(
    'KUCOIN_DRY_RUN=true required — this demo is validation-only. ' +
    'See examples/kucoin/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (SAMPLE_SIZE > MAX_SIZE) {
  throw new Error(`SAMPLE_SIZE ${SAMPLE_SIZE} exceeds cap ${MAX_SIZE}.`);
}
// Structural guard: this file may only ever talk to the validation endpoint.
if (!ORDER_PATH.endsWith('/test')) {
  throw new Error(`Refusing to run: ${ORDER_PATH} is not the validation endpoint.`);
}

console.log('=== VALIDATION-ONLY MODE (KuCoin has no sandbox) ===');
console.log(`[KUCOIN_DRY_RUN=true | base=${KUCOIN_FUTURES_BASE} | path=${ORDER_PATH}]`);

// ── 1. Public connectivity probe (keyless) ──
{
  const t = await fetch(`${KUCOIN_FUTURES_BASE}/api/v1/timestamp`);
  if (!t.ok) throw new Error(`KuCoin futures timestamp returned ${t.status}`);
  const contracts = await fetch(`${KUCOIN_FUTURES_BASE}/api/v1/contracts/active`)
    .then((r) => (r.ok ? r.json() : { data: [] }));
  const listed = (contracts.data ?? []).some((c) => c.symbol === SAMPLE_SYMBOL);
  console.log(
    `[kucoin futures | timestamp HTTP ${t.status} | ${SAMPLE_SYMBOL} ` +
    `${listed ? 'listed' : 'NOT LISTED'}]`
  );
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
  console.log('[orders/test | SKIPPED — policy did not fire]');
  console.log('=== NO ORDERS PLACED (validation endpoint only) ===');
  process.exit(0);
}

const apiKey = process.env.KUCOIN_API_KEY;
const apiSecret = process.env.KUCOIN_API_SECRET;
const apiPassphrase = process.env.KUCOIN_API_PASSPHRASE;
if (!apiKey || !apiSecret || !apiPassphrase) {
  console.log(
    '[orders/test | SKIPPED — set KUCOIN_API_KEY + KUCOIN_API_SECRET + ' +
    'KUCOIN_API_PASSPHRASE to run the validation step]'
  );
  console.log('=== NO ORDERS PLACED (validation endpoint only) ===');
  process.exit(0);
}

// ── 4. Signed VALIDATION request ──
const body = JSON.stringify({
  clientOid: crypto.randomUUID(),
  symbol: SAMPLE_SYMBOL,
  side: 'buy',
  type: 'market',
  size: SAMPLE_SIZE,
  leverage: 1,
});
const timestamp = Date.now().toString();
const sign = (secret, plain) =>
  crypto.createHmac('sha256', secret).update(plain).digest('base64');

// KC-API-SIGN covers timestamp + METHOD + endpoint + body, in that order.
const signature = sign(apiSecret, `${timestamp}POST${ORDER_PATH}${body}`);
// From key version 2 the passphrase is itself HMAC'd — never sent in plaintext.
const encryptedPassphrase = sign(apiSecret, apiPassphrase);

const res = await fetch(`${KUCOIN_FUTURES_BASE}${ORDER_PATH}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'KC-API-KEY': apiKey,
    'KC-API-SIGN': signature,
    'KC-API-TIMESTAMP': timestamp,
    'KC-API-PASSPHRASE': encryptedPassphrase,
    'KC-API-KEY-VERSION': '3',
  },
  body,
});
const out = await res.json().catch(() => ({}));
console.log(`[orders/test | HTTP ${res.status} | code=${out?.code ?? 'n/a'} msg=${out?.msg ?? 'ok'}]`);
console.log('=== NO ORDERS PLACED (validation endpoint only) ===');
