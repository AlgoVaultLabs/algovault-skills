// Unit tests for examples/_shared/algovault-helper.mjs
//
// These run OFFLINE — they verify the helper's exported surface, argument
// validation, and JSON-RPC payload shape via fetch interception. We do NOT
// hit the live api.algovault.com server here; that's the smoke-test layer
// (tests/smoke/) and the per-exchange demo smoke gates (C2-C5).
//
// Run: `node --test tests/unit/algovault-helper.test.mjs`

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getAlgoVaultVerdict,
  _resetAlgoVaultHelper,
} from '../../examples/_shared/algovault-helper.mjs';

const realFetch = globalThis.fetch;

function makeMockResponse({ status = 200, headers = {}, jsonBody, textBody }) {
  const hdrs = new Headers({ 'content-type': 'application/json', ...headers });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: hdrs,
    async json() {
      if (jsonBody !== undefined) return jsonBody;
      throw new Error('no json body');
    },
    async text() {
      if (textBody !== undefined) return textBody;
      return JSON.stringify(jsonBody);
    },
  };
}

test('exported surface: getAlgoVaultVerdict + _resetAlgoVaultHelper present', () => {
  assert.equal(typeof getAlgoVaultVerdict, 'function');
  assert.equal(typeof _resetAlgoVaultHelper, 'function');
});

test('rejects when coin missing', async () => {
  _resetAlgoVaultHelper();
  await assert.rejects(
    () => getAlgoVaultVerdict({}),
    /coin \(string\) required/,
  );
});

test('rejects when coin is not a string', async () => {
  _resetAlgoVaultHelper();
  await assert.rejects(
    () => getAlgoVaultVerdict({ coin: 123 }),
    /coin \(string\) required/,
  );
});

test('happy path: initialize + tools/call returns parsed verdict', async () => {
  _resetAlgoVaultHelper();
  let callCount = 0;
  globalThis.fetch = async (url, opts) => {
    callCount++;
    const body = JSON.parse(opts.body);
    if (body.method === 'initialize') {
      return makeMockResponse({
        status: 200,
        headers: { 'mcp-session-id': 'sess-test-123' },
        jsonBody: { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-11-05' } },
      });
    }
    if (body.method === 'tools/call' && body.params?.name === 'get_trade_signal') {
      assert.equal(opts.headers['mcp-session-id'], 'sess-test-123');
      assert.equal(body.params.arguments.coin, 'BTC');
      assert.equal(body.params.arguments.timeframe, '15m');
      return makeMockResponse({
        status: 200,
        jsonBody: {
          jsonrpc: '2.0',
          id: 2,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  signal: 'BUY',
                  confidence: 75,
                  regime: 'TRENDING_UP',
                  factors: { rsi: 'neutral', ema: 'bullish' },
                  _algovault: { tool: 'get_trade_signal', version: '1.9.0' },
                }),
              },
            ],
          },
        },
      });
    }
    throw new Error(`unexpected fetch: ${body.method}`);
  };

  try {
    const verdict = await getAlgoVaultVerdict({ coin: 'BTC' });
    assert.equal(verdict.signal, 'BUY');
    assert.equal(verdict.confidence, 75);
    assert.equal(verdict.regime, 'TRENDING_UP');
    assert.deepEqual(verdict.factors, { rsi: 'neutral', ema: 'bullish' });
    assert.equal(verdict._algovault.tool, 'get_trade_signal');
    assert.equal(callCount, 2, 'expected initialize + tools/call');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('429 free-tier rate limit surfaces as descriptive error', async () => {
  _resetAlgoVaultHelper();
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === 'initialize') {
      return makeMockResponse({
        status: 200,
        headers: { 'mcp-session-id': 'sess-rl' },
        jsonBody: { jsonrpc: '2.0', id: 1, result: {} },
      });
    }
    return makeMockResponse({ status: 429, jsonBody: { error: 'too many' } });
  };

  try {
    await assert.rejects(
      () => getAlgoVaultVerdict({ coin: 'ETH' }),
      /AlgoVault MCP rate limit \(HTTP 429\)/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('upstream HL throttle (isError:true) surfaces as descriptive error', async () => {
  _resetAlgoVaultHelper();
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === 'initialize') {
      return makeMockResponse({
        status: 200,
        headers: { 'mcp-session-id': 'sess-hl' },
        jsonBody: { jsonrpc: '2.0', id: 1, result: {} },
      });
    }
    return makeMockResponse({
      status: 200,
      jsonBody: {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ error: 'HL API 429: Too Many Requests' }) }],
          isError: true,
        },
      },
    });
  };

  try {
    await assert.rejects(
      () => getAlgoVaultVerdict({ coin: 'SOL' }),
      /AlgoVault upstream error: HL API 429/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('SSE response (text/event-stream) is parsed correctly', async () => {
  _resetAlgoVaultHelper();
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.method === 'initialize') {
      return makeMockResponse({
        status: 200,
        headers: { 'mcp-session-id': 'sess-sse' },
        jsonBody: { jsonrpc: '2.0', id: 1, result: {} },
      });
    }
    return makeMockResponse({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      textBody: `data: ${JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                signal: 'SELL',
                confidence: 62,
                regime: 'RANGING',
                factors: {},
                _algovault: { tool: 'get_trade_signal', version: '1.9.0' },
              }),
            },
          ],
        },
      })}\n\n`,
    });
  };

  try {
    const verdict = await getAlgoVaultVerdict({ coin: 'AVAX', timeframe: '1h' });
    assert.equal(verdict.signal, 'SELL');
    assert.equal(verdict.regime, 'RANGING');
  } finally {
    globalThis.fetch = realFetch;
  }
});
