#!/usr/bin/env node
/**
 * A stub order server for the pre-trade gate's two-run proof. It speaks MCP over stdio
 * (newline-delimited JSON-RPC) and offers one tool, `swap_place_order`, with OKX
 * agent-trade-kit's argument names. A call is appended to the log file named by the first
 * argument and answered with a stub order id. It places nothing: there is no exchange
 * client, no network and no key in this file.
 *
 *   node stub-order-server.mjs <calls.jsonl>
 */
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const LOG = process.argv[2];
if (!LOG) {
  process.stderr.write('usage: stub-order-server.mjs <calls.jsonl>\n');
  process.exit(64);
}

const TOOLS = [
  {
    name: 'swap_place_order',
    description:
      'Place an order on a perpetual swap. Stub: records the call and places nothing. side buy=long, sell=short.',
    inputSchema: {
      type: 'object',
      properties: {
        instId: { type: 'string', description: 'Instrument, e.g. BTC-USDT-SWAP' },
        tdMode: { type: 'string', enum: ['cross', 'isolated'] },
        side: { type: 'string', enum: ['buy', 'sell'] },
        ordType: { type: 'string', enum: ['market', 'limit'] },
        sz: { type: 'string', description: 'Size in contracts' },
        posSide: { type: 'string', enum: ['net', 'long', 'short'] },
        reduceOnly: { type: 'boolean' },
      },
      required: ['instId', 'tdMode', 'side', 'ordType', 'sz'],
    },
  },
];

let calls = 0;
const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);

function handle(req) {
  const { id, method, params } = req;
  if (method === 'initialize') {
    return send({
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'stub-order-server', version: '0.0.0' },
      },
    });
  }
  if (method === 'tools/list') return send({ id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    calls += 1;
    const ordId = `stub-${String(calls).padStart(4, '0')}`;
    appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), ordId, name: params?.name, arguments: params?.arguments ?? null })}\n`);
    return send({
      id,
      result: { content: [{ type: 'text', text: JSON.stringify({ ordId, placed: false, note: 'stub: nothing was placed' }) }] },
    });
  }
  if (method === 'ping') return send({ id, result: {} });
  if (id !== undefined && id !== null) send({ id, error: { code: -32601, message: `method not found: ${method}` } });
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  handle(req);
});
