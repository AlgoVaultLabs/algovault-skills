/**
 * Which tool calls are opening perpetual or futures orders, and which {coin, side} legs
 * each one opens. Data first: ORDER_TOOLS names the built-in order tools and the reader
 * for each; the `order_tools` option replaces that list with a regex over the full tool
 * name. Everything else passes: closes (reduce-only, a hedge-mode close), spot, options,
 * cancels, amends, every AlgoVault tool.
 *
 * Sources of the built-in rows (tool names and argument keys):
 *   OKX   okx/agent-trade-kit packages/core/src/tools/{contract-trade,swap-trade,futures-trade,algo-trade}.ts
 *         instId, side ("buy=long, sell=short"), posSide, sz, reduceOnly; swap_batch_orders action;
 *         algo orders (trigger, chase, iceberg, twap, trailing) can open a position too, and
 *         closeFraction marks a full close
 *   Bybit bybit-exchange/trading-mcp src/tools/trade/{createOrder,batchCreateOrders}.ts
 *         category, symbol, side Buy|Sell, qty, reduceOnly, closeOnTrigger, positionIdx
 *
 * A reader that cannot read an order throws OrderReadError: the caller blocks the order.
 */
import { normalizeCoin, normalizeSide, normalizePositionSide, isTrue } from './normalize.mjs';

/** AlgoVault's own tools (its live tools/list). The gate never gates or blocks one. */
export const ALGOVAULT_TOOLS = Object.freeze([
  'get_trade_call',
  'get_trade_signal',
  'get_market_regime',
  'scan_funding_arb',
  'scan_trade_calls',
  'scan_market_regimes',
  'pre_trade_check',
  'chat_knowledge',
  'search_knowledge',
  'get_track_record',
]);

/**
 * The PreToolUse matcher in hooks/hooks.json: every MCP tool except AlgoVault's. It is
 * broad so that `order_tools` can name any tool; the classifier below decides what an
 * order is. A unit test pins hooks.json to this function's output.
 */
export function preToolUseMatcher(names = ALGOVAULT_TOOLS) {
  return `^mcp__(?!.*__(?:${names.join('|')})$)`;
}

/** reader: how to read the arguments · shape: one order, a batch, or a batch with an action */
export const ORDER_TOOLS = new Map([
  ['swap_place_order', { reader: 'okx', shape: 'single' }],
  ['futures_place_order', { reader: 'okx', shape: 'single' }],
  ['swap_batch_orders', { reader: 'okx', shape: 'batch-action' }],
  ['futures_batch_orders', { reader: 'okx', shape: 'batch' }],
  ['swap_place_algo_order', { reader: 'okx', shape: 'single' }],
  ['swap_place_move_stop_order', { reader: 'okx', shape: 'single' }],
  ['createOrder', { reader: 'bybit', shape: 'single' }],
  ['batchCreateOrders', { reader: 'bybit', shape: 'batch' }],
  // A generic {coin, side} order tool, as Hyperliquid-style servers name it.
  ['place_order', { reader: 'generic', shape: 'single' }],
  ['create_order', { reader: 'generic', shape: 'single' }],
  ['open_position', { reader: 'generic', shape: 'single' }],
]);

export class OrderReadError extends Error {}

const unreadable = (what) => new OrderReadError(`could not read ${what}`);

/** The tool's own name: what follows the last `__` of `mcp__<server>__<tool>`. */
export function toolSegment(toolName) {
  const m = /^mcp__.+__(.+)$/.exec(toolName);
  return m ? m[1] : toolName;
}

export function isAlgoVaultTool(toolName) {
  return typeof toolName === 'string' && ALGOVAULT_TOOLS.includes(toolSegment(toolName));
}

function asOrderObject(o, where) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw unreadable(where);
  return o;
}

function legsOf(arr, where) {
  if (!Array.isArray(arr) || arr.length === 0) throw unreadable(`${where} (a non-empty list)`);
  return arr;
}

/** A leg that opens; null for a close. */
function openingLeg({ side, positionSide, coin }, where) {
  if (!side) throw unreadable(`${where}: side`);
  if (positionSide === undefined) throw unreadable(`${where}: position side`);
  // Hedge mode: the order opens only when its side and the position side agree.
  if (positionSide && positionSide !== side) return null;
  if (!coin) throw unreadable(`${where}: coin`);
  return { coin, side };
}

function readOkxLeg(raw, where) {
  const o = asOrderObject(raw, where);
  if (isTrue(o.reduceOnly)) return null;
  if (o.closeFraction !== undefined && o.closeFraction !== null && o.closeFraction !== '') return null;
  return openingLeg(
    { side: normalizeSide(o.side), positionSide: normalizePositionSide(o.posSide), coin: normalizeCoin(o.instId) },
    where,
  );
}

function bybitPositionSide(idx) {
  if (idx === undefined || idx === null || idx === '') return null;
  const s = String(idx).trim();
  if (s === '0') return null;
  if (s === '1') return 'long';
  if (s === '2') return 'short';
  return undefined;
}

function readBybitLeg(raw, where) {
  const o = asOrderObject(raw, where);
  if (isTrue(o.reduceOnly) || isTrue(o.closeOnTrigger)) return null;
  return openingLeg(
    { side: normalizeSide(o.side), positionSide: bybitPositionSide(o.positionIdx), coin: normalizeCoin(o.symbol) },
    where,
  );
}

const COIN_KEYS = ['coin', 'symbol', 'instId', 'asset'];
const SIDE_KEYS = ['side', 'direction'];
const BUY_FLAG_KEYS = ['is_buy', 'isBuy'];
const MARKET_KEYS = ['category', 'instType', 'inst_type', 'market_type', 'marketType', 'product_type', 'productType'];
const NOT_A_CONTRACT = new Set(['spot', 'option', 'options']);
const POSITION_SIDE_KEYS = ['posSide', 'positionSide', 'position_side'];

const firstPresent = (o, keys) => keys.find((k) => o[k] !== undefined && o[k] !== null);

/** A market type that says spot or options; an unknown value is treated as a contract. */
function genericNotAContract(o) {
  return MARKET_KEYS.some((k) => typeof o[k] === 'string' && NOT_A_CONTRACT.has(o[k].trim().toLowerCase()));
}

function genericSide(o) {
  const k = firstPresent(o, SIDE_KEYS);
  if (k) return normalizeSide(o[k]);
  const b = firstPresent(o, BUY_FLAG_KEYS);
  if (b && typeof o[b] === 'boolean') return o[b] ? 'long' : 'short';
  return null;
}

function readGenericLeg(raw, where) {
  const o = asOrderObject(raw, where);
  if (isTrue(o.reduceOnly) || isTrue(o.reduce_only)) return null;
  const ps = firstPresent(o, POSITION_SIDE_KEYS);
  const coinKey = firstPresent(o, COIN_KEYS);
  return openingLeg(
    {
      side: genericSide(o),
      positionSide: ps ? normalizePositionSide(o[ps]) : null,
      coin: coinKey ? normalizeCoin(o[coinKey]) : null,
    },
    where,
  );
}

/** A built-in generic name on a call with no coin and no side is not a trading order. */
function looksLikeTradingOrder(o) {
  return Boolean(firstPresent(o, COIN_KEYS) || firstPresent(o, SIDE_KEYS) || firstPresent(o, BUY_FLAG_KEYS));
}

function readOkx(input, shape) {
  if (shape === 'single') return [readOkxLeg(input, 'the order')];
  if (shape === 'batch-action') {
    const action = typeof input.action === 'string' ? input.action.trim().toLowerCase() : '';
    if (action === 'cancel' || action === 'amend') return { pass: `a batch ${action}` };
    if (action !== 'place') throw unreadable('the batch action');
  }
  return legsOf(input.orders, 'orders').map((o, i) => readOkxLeg(o, `orders[${i}]`));
}

function readBybit(input, shape) {
  const category = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
  if (category === 'spot' || category === 'option') return { pass: `a ${category} order` };
  if (category !== 'linear' && category !== 'inverse') throw unreadable('the category');
  if (shape === 'single') return [readBybitLeg(input, 'the order')];
  return legsOf(input.request, 'request').map((o, i) => readBybitLeg(o, `request[${i}]`));
}

function readGeneric(input, declared) {
  if (genericNotAContract(input)) return { pass: 'not a perpetual or futures order' };
  if (Array.isArray(input.orders)) {
    const orders = legsOf(input.orders, 'orders');
    if (!declared && !orders.some((o) => o && typeof o === 'object' && looksLikeTradingOrder(o))) {
      return { pass: 'no coin or side: not a trading order' };
    }
    return orders.map((o, i) =>
      genericNotAContract(asOrderObject(o, `orders[${i}]`)) ? null : readGenericLeg(o, `orders[${i}]`),
    );
  }
  if (!declared && !looksLikeTradingOrder(input)) return { pass: 'no coin or side: not a trading order' };
  return [readGenericLeg(input, 'the order')];
}

/**
 * Classify one tool call.
 * @param {string} toolName  the harness's tool name, e.g. `mcp__okx__swap_place_order`
 * @param {object} toolInput the call's arguments
 * @param {{orderTools?: RegExp|null}} options `order_tools`, compiled; null keeps the built-in list
 * @returns {{pass: string} | {legs: Array<{coin: string, side: 'long'|'short'}>}}
 * @throws {OrderReadError} an order tool whose input cannot be read
 */
export function classifyToolCall(toolName, toolInput, { orderTools = null } = {}) {
  if (typeof toolName !== 'string' || toolName === '') throw unreadable('the tool name');
  if (isAlgoVaultTool(toolName)) return { pass: 'an AlgoVault tool' };
  const row = ORDER_TOOLS.get(toolSegment(toolName));
  const isOrderTool = orderTools ? orderTools.test(toolName) : Boolean(row);
  if (!isOrderTool) return { pass: 'not an order tool' };
  const input = asOrderObject(toolInput, 'the tool input');

  let read;
  if (row && row.reader === 'okx') read = readOkx(input, row.shape);
  else if (row && row.reader === 'bybit') read = readBybit(input, row.shape);
  else read = readGeneric(input, Boolean(orderTools));
  if (!Array.isArray(read)) return read;

  const legs = [];
  const seen = new Set();
  for (const leg of read) {
    if (!leg) continue; // a close
    const key = `${leg.coin}|${leg.side}`;
    if (!seen.has(key)) {
      seen.add(key);
      legs.push(leg);
    }
  }
  if (legs.length === 0) return { pass: 'closes only' };
  return { legs };
}
