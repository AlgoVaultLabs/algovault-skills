#!/usr/bin/env node
/**
 * AlgoVault × Kraken CLI — Multi-timeframe consensus + paper entry demo.
 *
 * Runnable equivalent of Recipe 1 in docs/integrations/kraken.md.
 *   1. AlgoVault MCP read on BTC at multiple timeframes (15m + 1h).
 *   2. Consensus check — both timeframes return the same non-HOLD direction.
 *   3. Drive the Kraken paper engine if the `kraken` binary is present;
 *      otherwise fall back to the keyless public REST ticker.
 *
 * The Kraken CLI is a single Rust binary (MIT, 151 commands). Its paper
 * engine (`kraken paper`) simulates fills against live public prices with
 * a 0.26% taker fee and needs NO API keys and NO account. This author env
 * has no kraken binary, so the absent branch + REST fallback runs and the
 * script exits 0 keyless.
 *
 * Run:
 *   node examples/kraken/demo.mjs
 */

import { getAlgoVaultVerdict } from '../_shared/algovault-helper.mjs';
import { execFileSync, execSync } from 'node:child_process';

const ASSET = 'BTC';
const PAIR = 'BTCUSD';            // Kraken CLI pair
const REST_PAIR = 'XBTUSD';       // Kraken public REST pair
const TIMEFRAMES = ['15m', '1h']; // free-tier compatible (5m needs Starter+)
const INSTALL = "curl --proto '=https' --tlsv1.2 -LsSf https://github.com/krakenfx/kraken-cli/releases/latest/download/kraken-cli-installer.sh | sh";

const kr = (args) => execFileSync('kraken', args, { encoding: 'utf8' });

console.log('=== DEMO MODE ===');

// ── 1. Multi-timeframe AlgoVault read on BTC ──
const verdicts = [];
for (const tf of TIMEFRAMES) {
  try {
    const v = await getAlgoVaultVerdict({ coin: ASSET, timeframe: tf });
    verdicts.push({ tf, ...v });
  } catch (err) {
    console.log(`[verdict | ${tf} unavailable: ${err.message}]`);
    verdicts.push({ tf, signal: null });
  }
}
const summary = verdicts.map((v) => `${v.tf}=${v.signal ?? 'unavail'}@${v.confidence ?? '-'}`).join(' ');
const directions = new Set(verdicts.map((v) => v.signal).filter(Boolean));
const consensus = directions.size === 1 && !directions.has('HOLD') && verdicts.every((v) => v.signal);
const direction = consensus ? [...directions][0] : null;
console.log(`[verdicts | ${summary} | consensus=${consensus} direction=${direction ?? '-'}]`);

// ── 2. Preflight: is the kraken binary installed? ──
let installed = true;
try { execSync('command -v kraken', { stdio: 'ignore' }); }
catch { installed = false; }

// ── 3a. Present → Kraken paper engine (PAPER ONLY — zero keys) ──
if (installed) {
  kr(['paper', 'init', '--balance', '10000', '-o', 'json']);
  let last = 'init-only';
  if (consensus) {
    const fill = JSON.parse(kr(['paper', 'buy', PAIR, '0.01', '-o', 'json']));
    last = `${direction} ${PAIR} 0.01 → ${fill.status ?? 'submitted'}`;
  }
  const status = JSON.parse(kr(['paper', 'status', '-o', 'json']));
  console.log(`[kraken paper | mode=${status.mode} | ${last}]`);

// ── 3b. Absent → keyless public REST ticker fallback ──
} else {
  console.log(`[kraken-cli not installed — install one-liner: ${INSTALL}]`);
  const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${REST_PAIR}`);
  const body = await r.json();
  const last = body.result?.XXBTZUSD?.c?.[0];
  console.log(`[kraken ticker (REST) | ${REST_PAIR} last=${last} | keyless]`);
}

console.log('=== NO REAL ORDERS PLACED ===');
