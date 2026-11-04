/**
 * Coin and side normalisation, applied to BOTH sides of every comparison: the coin a
 * pre_trade_check named and the coin an order names. Two spellings of one market must
 * compare equal (`BTC-USDT-SWAP`, `BTCUSDT`, `BTC/USDT:USDT` and `BTC` are all BTC), and
 * a spelling this cannot read returns null, which the caller treats as unreadable.
 *
 * Multiplier prefixes are the ones AlgoVault's venue adapters map: Binance-family
 * `1000PEPE` and Hyperliquid's lower-case `kPEPE` both name PEPE.
 */

/** Quote suffixes on a concatenated symbol, longest first (`USDTM` before `USDT`). */
const QUOTE_SUFFIXES = ['USDTM', 'FDUSD', 'BUSD', 'USDT', 'USDC', 'PERP', 'USD'];

/** Inverse futures with a month code and year, e.g. Bybit `BTCUSDH26`. */
const INVERSE_FUTURES_SUFFIX = /USD[FGHJKMNQUVXZ]\d{2}$/;

const MULTIPLIER_PREFIX = /^(?:1000000|100000|10000|1000)(?=[A-Z])/;

/** Hyperliquid's `k` (×1000) prefix is lower case; read it before upper-casing. */
const K_PREFIX = /^k(?=[A-Z])/;

/** @returns {string|null} the bare upper-case coin, or null when unreadable */
export function normalizeCoin(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  // `BTC/USDT:USDT` (settle), `BTC/USDT`, `BTC-USDT-SWAP`, `BTC-USDT-261225`, `BTC_USDT`:
  // the base is the first segment.
  s = s.split(':')[0].split('/')[0].split('-')[0].split('_')[0];
  s = s.replace(K_PREFIX, '').toUpperCase();
  if (!/^[A-Z0-9]+$/.test(s)) return null;
  if (INVERSE_FUTURES_SUFFIX.test(s) && s.length > 6) {
    s = s.replace(INVERSE_FUTURES_SUFFIX, '');
  } else {
    for (const q of QUOTE_SUFFIXES) {
      if (s.length > q.length && s.endsWith(q)) {
        s = s.slice(0, -q.length);
        break;
      }
    }
  }
  s = s.replace(MULTIPLIER_PREFIX, '');
  return s || null;
}

/** buy or long → long, sell or short → short; anything else is unreadable (null). */
export function normalizeSide(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (s === 'buy' || s === 'long') return 'long';
  if (s === 'sell' || s === 'short') return 'short';
  return null;
}

/**
 * A hedge-mode position side. 'long' or 'short' names the position the order acts on;
 * 'net' (one-way mode) and an absent value return null; anything else is unreadable
 * (undefined), so the caller can refuse it rather than guess.
 */
export function normalizePositionSide(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'long') return 'long';
  if (s === 'short') return 'short';
  if (s === 'net' || s === 'both') return null;
  return undefined;
}

/** `true` or `"true"`: the flag is set. Anything else is not. */
export function isTrue(v) {
  return v === true || (typeof v === 'string' && v.trim().toLowerCase() === 'true');
}
