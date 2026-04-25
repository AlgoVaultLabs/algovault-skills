#!/usr/bin/env node
/**
 * AlgoVault × Bybit Testnet — Multi-timeframe consensus + perp entry demo.
 *
 * Runnable equivalent of Recipe 1 in docs/integrations/bybit.md.
 *   1. AlgoVault MCP read on ETH at multiple timeframes (15m + 1h).
 *   2. Consensus check — both timeframes return the same non-HOLD direction.
 *   3. Probe Bybit Linear Perpetual testnet to prove BYBIT_TESTNET path.
 *
 * The Bybit Official MCP (`bybit-official-trading-server@2.0.9`) reads
 * `BYBIT_TESTNET=true` from env to switch to testnet endpoints (verbatim
 * from README: `| BYBIT_TESTNET | No | false | Set to true to use the
 * testnet |`). This demo uses the same env contract + matching base URL
 * (`api-testnet.bybit.com`) so it runs identically with or without the
 * Bybit MCP installed.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.BYBIT_TESTNET === 'true'   (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant               (compile-time intent)
 *
 * Run:
 *   BYBIT_TESTNET=true node examples/bybit/demo.mjs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const BYBIT_TESTNET_BASE = 'https://api-testnet.bybit.com';
const ASSET = 'ETH';
const SYMBOL = 'ETHUSDT';
const TIMEFRAMES = ['15m', '1h']; // free-tier compatible (5m needs Starter+)

if (process.env.BYBIT_TESTNET !== 'true') {
  throw new Error(
    'BYBIT_TESTNET=true required — demo refuses to run against mainnet. ' +
    'See examples/bybit/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}

console.log('=== DEMO MODE ===');
console.log(`[BYBIT_TESTNET=true | base=${BYBIT_TESTNET_BASE} | mainnet_blocked=true]`);

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

// ── 2. Probe Bybit testnet instruments-info (proves BYBIT_TESTNET path) ──
{
  const url = `${BYBIT_TESTNET_BASE}/v5/market/instruments-info?category=linear&symbol=${SYMBOL}`;
  const r = await fetch(url);
  const body = await r.json();
  if (body.retCode !== 0) {
    throw new Error(`Bybit testnet probe failed: retCode=${body.retCode} retMsg=${body.retMsg}`);
  }
  const inst = body.result?.list?.[0];
  console.log(
    `[bybit testnet | instruments-info HTTP ${r.status} | ` +
    `host=${new URL(url).hostname} retCode=${body.retCode} ` +
    `symbol=${inst?.symbol} status=${inst?.status}]`
  );
}

// ── 3. Order placement (would be POST /v5/order/create with
//      X-BAPI-API-KEY + X-BAPI-SIGN if keys were provided) ──
if (consensus) {
  console.log(
    `[order | direction=${direction} ETHUSDT consensus across ${TIMEFRAMES.join('+')}; ` +
    `agent\'s policy WOULD POST /v5/order/create ` +
    `(SKIPPED — see README for authenticated demo with BYBIT_TESTNET_API_KEY/SECRET)]`
  );
} else {
  console.log('[order | SKIPPED — no consensus across timeframes (or HOLD present)]');
}

console.log('=== NO REAL ORDERS PLACED ===');
