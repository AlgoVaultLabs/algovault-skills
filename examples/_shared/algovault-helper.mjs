/**
 * AlgoVault MCP helper — shared by every per-exchange demo in
 * examples/<exchange>/demo.mjs.
 *
 * Wraps a single call to the live AlgoVault MCP server's `get_trade_signal`
 * tool and returns the parsed verdict (signal/confidence/regime/factors).
 *
 * Why raw fetch + JSON-RPC instead of @modelcontextprotocol/sdk Client?
 *   - Tutorial transparency: readers can copy this file as-is and inspect
 *     every byte that crosses the wire — no SDK abstractions in the way.
 *   - Parity with the existing tests/smoke/invoke-all-skills.mjs pattern
 *     that has been live since the SKILLS-W1 wave.
 *   - The SDK is still a declared dependency (added in INTEGRATIONS-W1 C1)
 *     so demos that prefer it can `import { Client } from
 *     '@modelcontextprotocol/sdk/client/index.js'`.
 *
 * Public surface (single export):
 *   getAlgoVaultVerdict({ coin, timeframe, exchange?, signal?, includeReasoning? })
 *     -> { signal, confidence, regime, factors, _algovault, _raw }
 *
 * Free tier: 20 calls/day per IP (HTTP 429 after that). The helper surfaces
 * the upstream HL-rate-limit signature (`{result.isError: true, ... 'HL API
 * 429'}`) verbatim so demos can decide whether to retry or skip gracefully.
 */

const MCP_URL = 'https://api.algovault.com/mcp';
const ACCEPT = 'application/json, text/event-stream';
const CLIENT_INFO = { name: 'algovault-integrations-demo', version: '0.1.0' };
const PROTOCOL_VERSION = '2025-11-05';

let _sessionId = null;
let _initPromise = null;

/**
 * One-shot MCP `initialize` against the live server. Coalesces concurrent
 * callers onto a single in-flight handshake so demos that call
 * getAlgoVaultVerdict() in parallel don't fan out to N parallel inits.
 */
async function ensureInitialized() {
  if (_sessionId !== null) return _sessionId;
  if (_initPromise !== null) return _initPromise;

  _initPromise = (async () => {
    const r = await fetch(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: ACCEPT },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        },
      }),
    });
    if (!r.ok) {
      throw new Error(`AlgoVault MCP initialize failed: HTTP ${r.status}`);
    }
    const sid = r.headers.get('mcp-session-id');
    if (!sid) {
      throw new Error('AlgoVault MCP initialize: no mcp-session-id header');
    }
    _sessionId = sid;
    _initPromise = null;
    return sid;
  })().catch((err) => {
    _initPromise = null;
    throw err;
  });
  return _initPromise;
}

/**
 * Parse a JSON-RPC response from MCP, supporting both `application/json` and
 * `text/event-stream` content types (the server may return either).
 */
async function parseMcpResponse(r) {
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const text = await r.text();
    // SSE: lines like "data: {...}". Extract the first JSON-RPC payload.
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== '[DONE]') return JSON.parse(payload);
      }
    }
    throw new Error('AlgoVault MCP SSE response had no JSON payload');
  }
  return r.json();
}

/**
 * Invoke `get_trade_signal` and return the parsed verdict.
 *
 * @param {object} args
 * @param {string} args.coin - e.g. 'BTC', 'ETH', 'SOL'
 * @param {string} [args.timeframe='15m'] - One of: '1m','3m','5m','15m','30m','1h','2h','4h','8h','12h','1d'.
 *                                           Free tier: '15m' or '1h' only.
 * @param {('HL'|'BINANCE'|'BYBIT'|'OKX'|'BITGET')} [args.exchange='HL']
 * @param {boolean} [args.includeReasoning=true]
 * @returns {Promise<{signal:'BUY'|'SELL'|'HOLD', confidence:number, regime:string, factors:object, _algovault:object, _raw:object}>}
 *
 * Throws on:
 *   - Network / HTTP error
 *   - JSON-RPC error (`error.message`)
 *   - Free-tier quota exceeded (HTTP 429 → `Error('AlgoVault MCP rate limit (HTTP 429)')`)
 *   - Upstream HL throttle (`isError: true` with 'HL API 429' in body) — re-thrown
 *     so the caller can decide retry vs skip
 */
export async function getAlgoVaultVerdict({
  coin,
  timeframe = '15m',
  exchange = 'HL',
  includeReasoning = true,
} = {}) {
  if (!coin || typeof coin !== 'string') {
    throw new TypeError('getAlgoVaultVerdict: coin (string) required');
  }
  const sid = await ensureInitialized();
  const r = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: ACCEPT,
      'mcp-session-id': sid,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_trade_signal',
        arguments: { coin, timeframe, exchange, includeReasoning },
      },
    }),
  });
  if (r.status === 429) {
    throw new Error('AlgoVault MCP rate limit (HTTP 429) — free tier allows 20 calls/day per IP');
  }
  if (!r.ok) {
    throw new Error(`AlgoVault MCP tools/call failed: HTTP ${r.status}`);
  }
  const body = await parseMcpResponse(r);
  if (body.error) {
    throw new Error(`AlgoVault MCP error: ${body.error.message ?? JSON.stringify(body.error)}`);
  }
  if (!body.result || !Array.isArray(body.result.content) || body.result.content.length === 0) {
    throw new Error('AlgoVault MCP response missing result.content');
  }
  const text = body.result.content[0].text;
  if (typeof text !== 'string') {
    throw new Error('AlgoVault MCP result.content[0].text was not a string');
  }
  const parsed = JSON.parse(text);
  if (body.result.isError) {
    // Upstream HL throttle (or other transient): preserve verbatim so the
    // caller's retry/skip logic can read .error.
    throw new Error(`AlgoVault upstream error: ${parsed.error ?? text}`);
  }
  return {
    signal: parsed.signal,
    confidence: parsed.confidence,
    regime: parsed.regime,
    factors: parsed.factors,
    _algovault: parsed._algovault,
    _raw: parsed,
  };
}

/**
 * Internal: reset module state. Test-only helper — do not call in production.
 * Used by tests/unit/algovault-helper.test.mjs to isolate state across cases.
 */
export function _resetAlgoVaultHelper() {
  _sessionId = null;
  _initPromise = null;
}
