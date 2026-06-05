#!/usr/bin/env node
/**
 * AlgoVault × Alpaca — Multi-timeframe consensus + paper crypto order demo.
 *
 * Runnable equivalent of Recipe 1 in docs/integrations/alpaca.md.
 *   1. AlgoVault MCP read on ETH at two timeframes (15m + 1h).
 *   2. Consensus check — both timeframes return the same non-HOLD direction.
 *   3. Place a tiny notional BTC/USD market order on the Alpaca paper venue.
 *
 * The Alpaca MCP Server (`alpaca-mcp-server@2.0.2`) defaults to paper trading
 * (ALPACA_PAPER_TRADE=true) and exposes place_crypto_order. This demo hits the
 * same paper REST host (paper-api.alpaca.markets) the MCP uses with keys.
 *
 * HARD GUARD: the order host must be paper-api.alpaca.markets — any other host
 * throws before a single byte crosses the wire. Keyless = paper path skipped.
 *
 * Run:  node examples/alpaca/demo.mjs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';

const ASSET = 'ETH';
const TIMEFRAMES = ['15m', '1h']; // free-tier compatible

console.log('=== DEMO MODE ===');

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

// ── 2. Paper crypto order path (runs only when keys are present) ──
if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_SECRET_KEY) {
  console.log('[alpaca | SKIPPED — set ALPACA_API_KEY/SECRET (free paper account) to run the paper order path]');
} else {
  const host = 'paper-api.alpaca.markets';
  if (!host.includes('paper-api.alpaca.markets')) {
    throw new Error('Refusing to run: order host must be paper-api.alpaca.markets.');
  }
  const r = await fetch(`https://${host}/v2/orders`, {
    method: 'POST',
    headers: {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      symbol: 'BTC/USD',
      notional: '1',
      side: 'buy',
      type: 'market',
      time_in_force: 'gtc',
    }),
  });
  const body = await r.json();
  console.log(`[alpaca | paper order id=${body.id} symbol=${body.symbol} status=${body.status} host=${host} ("paper")]`);
}

console.log('=== NO REAL ORDERS PLACED ===');
