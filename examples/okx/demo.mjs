#!/usr/bin/env node
/**
 * AlgoVault × OKX Demo Trading — Multi-asset regime scan + grid-bot trigger.
 *
 * Runnable equivalent of Recipe 1 in docs/integrations/okx.md.
 *   1. AlgoVault MCP regime read across BTC/ETH/SOL on 4h.
 *   2. Identify any RANGING regimes (grid-bot precondition).
 *   3. Probe OKX simulated-trading instrument-info to prove --demo path.
 *
 * The OKX MCP CLI's --demo flag (verbatim from docs/cli-reference.md:
 * "--demo | Use simulated trading (demo) mode") is the authenticated
 * pathway for grid-bot creation; this demo uses the public REST equivalent
 * with the `x-simulated-trading: 1` header (the same header the OKX MCP
 * tool emits internally) so it runs without API keys.
 *
 * HARD GUARDS (in order, before any network call):
 *   - process.env.OKX_DEMO === 'true'   (refuses to run otherwise)
 *   - MAINNET_BLOCKED constant          (compile-time intent)
 *
 * Run:
 *   OKX_DEMO=true node examples/okx/demo.mjs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

// ── Hard guards ──
export const MAINNET_BLOCKED = true;
const OKX_BASE = 'https://www.okx.com/api/v5';
const SIMULATED_HEADERS = { 'x-simulated-trading': '1' };
// AlgoVault free tier supports BTC + ETH on 15m + 1h. Production agents
// querying SOL or 4h timeframes need the Starter plan or higher; see
// examples/okx/README.md for the upgrade matrix and a 4h-on-paid-tier
// variant of this demo.
const ASSETS = ['BTC', 'ETH'];
const TIMEFRAME = '1h';

if (process.env.OKX_DEMO !== 'true') {
  throw new Error(
    'OKX_DEMO=true required — demo refuses to run against mainnet. ' +
    'See examples/okx/README.md for setup.'
  );
}
if (!MAINNET_BLOCKED) {
  throw new Error('MAINNET_BLOCKED constant must be true.');
}

console.log('=== DEMO MODE ===');
console.log('[OKX_DEMO=true | --demo equivalent header x-simulated-trading: 1 | mainnet_blocked=true]');

// ── 1. AlgoVault regime read across BTC/ETH on 1h (free-tier compatible) ──
const verdicts = [];
for (const coin of ASSETS) {
  // Sequential not parallel: the AlgoVault free tier is paced; concurrent
  // bursts can fan out into the upstream HL throttle and yield 'HL API 429'
  // for unrelated calls. Pacing serially is friendlier for tutorial demos.
  try {
    const v = await getAlgoVaultVerdict({ coin, timeframe: TIMEFRAME });
    verdicts.push({ coin, ...v });
  } catch (err) {
    console.log(`[verdict | ${coin} unavailable: ${err.message}]`);
    verdicts.push({ coin, signal: null, regime: null, _error: err.message });
  }
}
const summary = verdicts
  .map((v) => `${v.coin}=${v.regime ?? 'unavail'}`)
  .join(' ');
const rangingAssets = verdicts.filter((v) => v.regime === 'RANGING');
console.log(`[verdicts | ${summary} | ranging_count=${rangingAssets.length}]`);

// ── 2. Probe OKX simulated-trading instrument (proves --demo path) ──
{
  const url = `${OKX_BASE}/public/instruments?instType=SPOT&instId=BTC-USDT`;
  const r = await fetch(url, { headers: SIMULATED_HEADERS });
  const body = await r.json();
  const inst = body?.data?.[0];
  if (body.code !== '0') {
    throw new Error(`OKX simulated-trading probe failed: code=${body.code} msg=${body.msg}`);
  }
  console.log(
    `[okx demo | spot/instruments HTTP ${r.status} | ` +
    `code=${body.code} instId=${inst?.instId} state=${inst?.state} ` +
    `host=${new URL(url).hostname} (x-simulated-trading: 1)]`
  );
}

// ── 3. Grid-bot trigger (would be POST /api/v5/tradingBot/grid/order-algo
//      with `x-simulated-trading: 1` if keys were provided) ──
if (rangingAssets.length > 0) {
  console.log(
    `[grid-bot | ${rangingAssets.length} RANGING candidate(s); ` +
    `agent\'s policy WOULD POST /tradingBot/grid/order-algo per asset ` +
    `(SKIPPED — see README for authenticated demo with API key+secret+passphrase)]`
  );
} else {
  console.log('[grid-bot | SKIPPED — no RANGING regime in current scan]');
}

console.log('=== NO REAL ORDERS PLACED ===');
