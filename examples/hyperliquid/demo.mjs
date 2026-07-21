#!/usr/bin/env node
/**
 * AlgoVault × Hyperliquid testnet — verdict-to-order-payload preview.
 *
 * This is the runnable equivalent of the Demo in
 * docs/integrations/hyperliquid.md. It demonstrates the agent loop:
 *   1. Fetch a composite verdict from AlgoVault MCP for ETH 1h.
 *   2. Apply the agent's policy (signal === BUY AND confidence > 70).
 *   3. Resolve the asset index from Hyperliquid testnet metadata and build
 *      the exact `order` action the verdict implies — then PRINT it.
 *
 * WHY THIS DEMO DOES NOT SUBMIT (deliberate, not a limitation):
 *   - Hyperliquid's testnet faucet requires a PRIOR MAINNET DEPOSIT from the
 *     same address (see the testnet-faucet docs), so a clean wallet cannot
 *     fund itself. A submitting demo would be unrunnable for most readers.
 *   - Order submission needs an EIP-712 "phantom agent" signature under a
 *     hardcoded chainId 1337 domain. There is no official JS SDK; hand-rolling
 *     that signature in a tutorial is exactly how people ship broken signers.
 *   Submission is documented instead in Recipe 3 via the OFFICIAL Python SDK.
 *
 * This script is therefore KEYLESS: no account, no funds, no API wallet.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.HYPERLIQUID_TESTNET === 'true'  (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant                    (compile-time intent)
 *   - SAMPLE_SIZE <= MAX_SIZE                     (cap on every requested size)
 *   - assertTestnetHost()                         (base URL must be the testnet host)
 *
 * Run:
 *   HYPERLIQUID_TESTNET=true node examples/hyperliquid/demo.mjs
 *
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const HL_TESTNET_BASE = 'https://api.hyperliquid-testnet.xyz';
const HL_MAINNET_BASE = 'https://api.hyperliquid.xyz';
const SAMPLE_COIN = 'ETH';
const SAMPLE_SIZE = 0.01; // ETH; <= cap
const MAX_SIZE = 0.01;

if (process.env.HYPERLIQUID_TESTNET !== 'true') {
  throw new Error(
    'HYPERLIQUID_TESTNET=true required — demo refuses to run against mainnet. ' +
    'See examples/hyperliquid/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}
if (SAMPLE_SIZE > MAX_SIZE) {
  throw new Error(`SAMPLE_SIZE ${SAMPLE_SIZE} exceeds cap ${MAX_SIZE}.`);
}
// Belt-and-braces: the mainnet host must never appear in the base URL. The two
// hosts differ by one path segment, so a typo is a plausible failure mode.
if (HL_TESTNET_BASE === HL_MAINNET_BASE || !HL_TESTNET_BASE.includes('testnet')) {
  throw new Error(`Refusing to run: ${HL_TESTNET_BASE} is not a testnet host.`);
}

console.log('=== DEMO MODE ===');
console.log(`[HYPERLIQUID_TESTNET=true | base=${HL_TESTNET_BASE} | mainnet_blocked=true]`);

// ── 1. Composite verdict from AlgoVault ──
const verdict = await getAlgoVaultVerdict({ coin: SAMPLE_COIN, timeframe: '1h' });
console.log(
  `[algovault] ${SAMPLE_COIN} 1h → signal=${verdict.signal} ` +
  `confidence=${verdict.confidence} regime=${verdict.regime}`
);

// ── 2. The agent's policy decides. AlgoVault supplies analytics only. ──
const policyFires = verdict.signal === 'BUY' && Number(verdict.confidence) > 70;
if (!policyFires) {
  console.log(
    `[policy] no action — policy requires signal=BUY AND confidence>70, ` +
    `got signal=${verdict.signal} confidence=${verdict.confidence}.`
  );
  console.log('[hyperliquid] nothing to build. Demo complete.');
  process.exit(0);
}

// ── 3. Resolve the asset index from live testnet metadata ──
// Hyperliquid identifies assets by INTEGER INDEX (the `a` field), not ticker.
// The index is the position of the coin in the `universe` array from `/info`.
const metaRes = await fetch(`${HL_TESTNET_BASE}/info`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'meta' }),
});
if (!metaRes.ok) {
  throw new Error(`Hyperliquid testnet /info returned ${metaRes.status}`);
}
const meta = await metaRes.json();
const assetIndex = meta.universe.findIndex((a) => a.name === SAMPLE_COIN);
if (assetIndex < 0) {
  throw new Error(`${SAMPLE_COIN} not found in testnet universe.`);
}
console.log(`[hyperliquid] asset ${SAMPLE_COIN} resolved to index ${assetIndex} (testnet meta)`);

// A marketable IOC limit — the same shape the official SDK's market_open()
// submits. Hyperliquid has no true market order type.
const mids = await fetch(`${HL_TESTNET_BASE}/info`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'allMids' }),
}).then((r) => r.json());
const mid = Number(mids[SAMPLE_COIN]);
const limitPx = Number.isFinite(mid) ? (mid * 1.005).toFixed(2) : null;

const action = {
  type: 'order',
  orders: [
    {
      a: assetIndex,               // asset index
      b: true,                     // isBuy
      p: limitPx,                  // limit price (IOC, ~0.5% marketable)
      s: String(SAMPLE_SIZE),      // size, as a string
      r: false,                    // reduceOnly
      t: { limit: { tif: 'Ioc' } },
    },
  ],
  grouping: 'na',
};

console.log(JSON.stringify(action, null, 2));
console.log(`[hyperliquid] would submit: POST ${HL_TESTNET_BASE}/exchange`);
console.log('[hyperliquid] payload printed above — NOT signed, NOT sent. Demo complete.');
