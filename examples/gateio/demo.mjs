#!/usr/bin/env node
/**
 * AlgoVault × Gate.io futures testnet — contracts-aware sizing demo.
 *
 * This is the runnable equivalent of the Demo in docs/integrations/gateio.md:
 *   1. Read `quanto_multiplier` from Gate's testnet and convert a coin-denominated
 *      target into an integer CONTRACT count.
 *   2. Fetch a composite verdict from AlgoVault MCP for BTC 1h.
 *   3. Apply the agent's policy (call === BUY AND confidence > 70) and build the
 *      exact Gate order body the verdict implies — then PRINT it.
 *
 * ⚠️ HOST: Gate moved its futures testnet to api-testnet.gateapi.io. The older
 * fx-api-testnet.gateio.ws still resolves but returns 502 on every market-data
 * read, and `gate-api` 7.2.100 STILL SHIPS THAT DEAD HOST AS ITS DEFAULT — so a
 * client built from SDK defaults fails in a way that looks like an outage rather
 * than a misconfiguration. Both bad hosts are rejected by assertion below.
 *
 * WHY THIS DEMO DOES NOT SUBMIT (deliberate): submission needs testnet API
 * credentials minted separately from mainnet keys, plus a correct HMAC-SHA512
 * signature over a 5-line payload. Signing is documented in Recipe 3 rather than
 * hand-rolled here. This script is KEYLESS — no account, no funds.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.GATEIO_TESTNET === 'true'  (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant               (compile-time intent)
 *   - TARGET_BTC <= MAX_BTC                  (cap on every requested size)
 *   - assertTestnetHost()                    (rejects prod AND the dead legacy host)
 *
 * Run:
 *   GATEIO_TESTNET=true node examples/gateio/demo.mjs
 *
 * Docs: https://www.gate.com/docs/developers/apiv4/en/
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const GATE_WORKING_TESTNET = 'https://api-testnet.gateapi.io/api/v4'; // the one that answers
const GATE_TESTNET_BASE = GATE_WORKING_TESTNET;
const GATE_MAINNET_BASE = 'https://api.gateio.ws/api/v4';            // never used here
const GATE_DEAD_TESTNET = 'fx-api-testnet.gateio.ws';                // drained legacy host
const SAMPLE_CONTRACT = 'BTC_USDT';
const TARGET_BTC = 0.001;
const MAX_BTC = 0.001;

if (process.env.GATEIO_TESTNET !== 'true') {
  throw new Error(
    'GATEIO_TESTNET=true required — demo refuses to run against mainnet. ' +
    'See examples/gateio/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (TARGET_BTC > MAX_BTC) {
  throw new Error(`TARGET_BTC ${TARGET_BTC} exceeds cap ${MAX_BTC}.`);
}
// Reject BOTH wrong hosts: mainnet (real money) and the drained legacy testnet
// (looks like an outage, wastes an afternoon).
if (GATE_TESTNET_BASE.startsWith(GATE_MAINNET_BASE) || !GATE_TESTNET_BASE.includes('api-testnet.')) {
  throw new Error(`Refusing to run: ${GATE_TESTNET_BASE} is not the Gate testnet host.`);
}
if (GATE_TESTNET_BASE.includes(GATE_DEAD_TESTNET)) {
  throw new Error(
    `Refusing to run: ${GATE_DEAD_TESTNET} is Gate's drained legacy testnet host ` +
    `(returns 502 on every market-data read). Use ${GATE_WORKING_TESTNET} instead.`
  );
}

console.log('=== DEMO MODE ===');
console.log(`[GATEIO_TESTNET=true | base=${GATE_TESTNET_BASE} | mainnet_blocked=true]`);

// ── 1. Contract sizing — the step most likely to be silently wrong ──
// Gate sizes futures in CONTRACTS, not coins. `quanto_multiplier` is the coins-
// per-contract factor and it differs per contract, so READ it — never hardcode.
let contracts;
{
  const res = await fetch(`${GATE_TESTNET_BASE}/futures/usdt/contracts/${SAMPLE_CONTRACT}`);
  if (!res.ok) {
    throw new Error(
      `Gate testnet contract read returned ${res.status}. If this is a 502, confirm the base ` +
      `URL is ${GATE_TESTNET_BASE} and not the legacy ${GATE_DEAD_TESTNET}.`
    );
  }
  const c = await res.json();
  const multiplier = Number(c.quanto_multiplier);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(`Implausible quanto_multiplier: ${c.quanto_multiplier}`);
  }
  // Integer contract count; never round down to a rejected zero-size order.
  contracts = Math.max(Number(c.order_size_min ?? 1), Math.round(TARGET_BTC / multiplier));
  console.log(
    `[gate testnet | ${SAMPLE_CONTRACT} quanto_multiplier=${multiplier} → ` +
    `${TARGET_BTC} BTC = ${contracts} contracts | mark=${c.mark_price}]`
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
  console.log('[gate] nothing to build. Demo complete.');
  process.exit(0);
}

// Direction is the SIGN of `size` — Gate futures orders carry no `side` field.
// Positive = long, negative = short.
const order = {
  contract: SAMPLE_CONTRACT,
  size: contracts,        // positive → long
  price: '0',             // '0' + tif:'ioc' = market-style immediate-or-cancel
  tif: 'ioc',
  text: 't-algovault-demo',
};

console.log(JSON.stringify(order, null, 2));
console.log(`[gate] would submit: POST ${GATE_TESTNET_BASE}/futures/usdt/orders`);
console.log('[gate] order printed above — NOT signed, NOT sent. Demo complete.');
