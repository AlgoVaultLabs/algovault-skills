#!/usr/bin/env node
/**
 * AlgoVault × Aster futures testnet — verdict-to-order-request preview.
 *
 * This is the runnable equivalent of the Demo in docs/integrations/aster.md:
 *   1. Fetch a composite verdict from AlgoVault MCP for BTC 1h.
 *   2. Apply the agent's policy (call === BUY AND confidence > 70).
 *   3. Build the exact Aster V3 order request the verdict implies — and PRINT it.
 *
 * WHY THIS DEMO DOES NOT SUBMIT (deliberate):
 *   - Aster closed V1 API-key creation on 2026-03-25, so a new reader cannot
 *     obtain the simple HMAC credentials at all. V3 is the only path forward.
 *   - V3 authenticates with an EIP-712 wallet signature (chainId 714 on
 *     testnet), which needs a funded testnet wallet plus a separately minted
 *     API wallet. Hand-rolling that signature in a tutorial is how people ship
 *     broken signers; the correct construction is documented in Recipe 3.
 *
 * This script is therefore KEYLESS: no account, no funds, no API wallet.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.ASTER_TESTNET === 'true'  (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant              (compile-time intent)
 *   - SAMPLE_QTY <= MAX_QTY                 (cap on every requested size)
 *   - base host must be the testnet host    (not the live host)
 *
 * Run:
 *   ASTER_TESTNET=true node examples/aster/demo.mjs
 *
 * Docs: https://github.com/asterdex/api-docs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const ASTER_TESTNET_BASE = 'https://fapi.asterdex-testnet.com';
const ASTER_MAINNET_BASE = 'https://fapi.asterdex.com';
const SAMPLE_SYMBOL = 'BTCUSDT';
const SAMPLE_QTY = 0.001;
const MAX_QTY = 0.001;
// EIP-712 chainId differs by environment. 714 = testnet, 1666 = mainnet.
// A copy-pasted mainnet signer silently fails against testnet.
const TESTNET_CHAIN_ID = 714;

if (process.env.ASTER_TESTNET !== 'true') {
  throw new Error(
    'ASTER_TESTNET=true required — demo refuses to run against mainnet. ' +
    'See examples/aster/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (SAMPLE_QTY > MAX_QTY) {
  throw new Error(`SAMPLE_QTY ${SAMPLE_QTY} exceeds cap ${MAX_QTY}.`);
}
if (ASTER_TESTNET_BASE === ASTER_MAINNET_BASE || !ASTER_TESTNET_BASE.includes('-testnet.')) {
  throw new Error(`Refusing to run: ${ASTER_TESTNET_BASE} is not a testnet host.`);
}

console.log('=== DEMO MODE ===');
console.log(`[ASTER_TESTNET=true | base=${ASTER_TESTNET_BASE} | mainnet_blocked=true]`);

// ── 1. Reachability + clock drift + symbol listing (all keyless) ──
// The V3 nonce is in MICROSECONDS and must be within ±10s of server time, so
// a drifting local clock is a real failure mode worth surfacing up front.
{
  const ping = await fetch(`${ASTER_TESTNET_BASE}/fapi/v1/ping`);
  if (!ping.ok) throw new Error(`Aster testnet ping returned ${ping.status}`);

  const t = await fetch(`${ASTER_TESTNET_BASE}/fapi/v1/time`).then((r) => r.json());
  const drift = Math.abs(Date.now() - Number(t.serverTime));

  const info = await fetch(`${ASTER_TESTNET_BASE}/fapi/v1/exchangeInfo`).then((r) => r.json());
  const listed = (info.symbols ?? []).some((s) => s.symbol === SAMPLE_SYMBOL);

  console.log(
    `[aster testnet | ping HTTP ${ping.status} | ${SAMPLE_SYMBOL} ` +
    `${listed ? 'tradable' : 'NOT LISTED'} | serverTime drift ${drift}ms]`
  );
  if (drift > 10_000) {
    console.warn('[aster] WARNING: local clock is >10s from server time — a V3 nonce would be rejected.');
  }
  if (!listed) {
    console.log('[aster] symbol not listed on testnet — nothing to build.');
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
  console.log('[aster] nothing to build. Demo complete.');
  process.exit(0);
}

const request = {
  endpoint: 'POST /fapi/v3/order',
  eip712: {
    // Domain the API wallet signs under, on TESTNET.
    name: 'AsterSignTransaction',
    version: '1',
    chainId: TESTNET_CHAIN_ID,
    verifyingContract: '0x0000000000000000000000000000000000000000',
  },
  params: {
    symbol: SAMPLE_SYMBOL,
    side: 'BUY',
    type: 'MARKET',
    quantity: String(SAMPLE_QTY),
    user: '<master wallet address>',
    signer: '<API wallet (AGENT) address>',
    // MICROSECONDS, within ±10s of server time — not milliseconds.
    nonce: `${Date.now() * 1000}`,
    signature: '<EIP-712 signature over the URL-encoded param string>',
  },
};

console.log(JSON.stringify(request, null, 2));
console.log(`[aster] would submit: POST ${ASTER_TESTNET_BASE}/fapi/v3/order`);
console.log('[aster] request printed above — NOT signed, NOT sent. Demo complete.');
