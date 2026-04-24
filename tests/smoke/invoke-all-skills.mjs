#!/usr/bin/env node
// Live smoke test: for each Skill in skills/manifest.json, derive its primary
// tool (tools[0]) and a payload from tests/fixtures/payloads.json, invoke
// the live AlgoVault MCP server, assert the response shape.
//
// Assertions per call:
//   - HTTP 200 (or 429 -> SKIP_RATE_LIMITED, NOT a HARD FAIL)
//   - JSON-RPC response has .result (no .error)
//   - .result.content[0].text parses as JSON
//   - parsed._algovault.version === "1.9.0"
//   - parsed._algovault.tool === <expected tool name>
//
// NOTE on assertion drift from spec AC4.2:
//   Spec said `response has _algovault.signal_merkle_root present`. Probing
//   the live server (2026-04-24) shows tool responses include only
//   `_algovault: { compatible_with, session_id, tool, version }` —
//   merkle_root lives on the signal-performance RESOURCE, not on tool
//   call responses. Substituted `_algovault.tool` match (which IS present
//   on every response and proves provenance via tool name echo). This is a
//   factual adjustment, not a weakening of the gate.
//
// Per Free-tier policy: 20 free calls/day per IP. Skills past the cap return
// 429 and we mark them SKIP_RATE_LIMITED (not a failure).
//
// Upstream rate-limit reality (verified live 2026-04-24): Hyperliquid's API
// rate-limits the MCP server's outbound calls during bursts. When that
// happens, our MCP returns HTTP 200 with body
//   {"result":{"content":[{"text":"{\"error\":\"HL API 429: Too Many Requests\"}"}],"isError":true},...}
// This is treated as SKIP_RATE_LIMITED (upstream provider constraint, not a
// Skill defect). We pace inter-call delay at 2s to minimize burst-induced
// upstream throttling.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const MCP_URL = "https://api.algovault.com/mcp";
const ACCEPT = "application/json, text/event-stream";

let manifest, payloads, sessionId;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function initMcp() {
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: ACCEPT },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: {
        protocolVersion: "2025-11-05",
        capabilities: {},
        clientInfo: { name: "algovault-skills-smoke", version: "0.1.0" },
      },
    }),
  });
  if (!r.ok) throw new Error(`initialize HTTP ${r.status}`);
  const sid = r.headers.get("mcp-session-id");
  if (!sid) throw new Error("initialize did not return mcp-session-id header");
  // Drain body so the connection closes cleanly
  await r.text();

  // Send notifications/initialized (required by spec)
  await fetch(MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: ACCEPT, "mcp-session-id": sid },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  return sid;
}

function parseSse(text) {
  for (const line of text.split("\n")) {
    if (line.startsWith("data: ")) return JSON.parse(line.slice(6));
  }
  throw new Error(`no SSE data line in: ${text.slice(0, 200)}`);
}

async function callTool(sid, slug, tool, args) {
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: ACCEPT,
      "mcp-session-id": sid,
      "X-AlgoVault-Skill-Slug": slug,
    },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 100,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  if (r.status === 429) return { rateLimited: true };
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`);
  }
  return { rateLimited: false, body: parseSse(await r.text()) };
}

test("smoke: invoke all 20 skills against live api.algovault.com", async (t) => {
  manifest = await readJson(join(ROOT, "skills", "manifest.json"));
  payloads = await readJson(join(ROOT, "tests", "fixtures", "payloads.json"));
  assert.equal(manifest.length, 20, "manifest must have 20 entries");

  sessionId = await initMcp();
  console.log(`[smoke] initialized, sid=${sessionId.slice(0, 8)}...`);

  const results = { pass: 0, skip: 0, hardFail: 0 };

  for (const entry of manifest) {
    const slug = entry.slug;
    const expectedTool = entry.tools[0];
    const payload = payloads[slug];
    if (!payload) {
      console.error(`HARD FAIL: ${slug} — no payload fixture`);
      results.hardFail += 1;
      continue;
    }
    if (payload.tool !== expectedTool) {
      console.error(`HARD FAIL: ${slug} — payload.tool=${payload.tool} != manifest.tools[0]=${expectedTool}`);
      results.hardFail += 1;
      continue;
    }

    try {
      const { rateLimited, body } = await callTool(sessionId, slug, expectedTool, payload.args);
      if (rateLimited) {
        console.log(`SKIP_RATE_LIMITED: ${slug} — tool=${expectedTool} (free-tier 20/day cap hit)`);
        results.skip += 1;
        continue;
      }
      if (body.error) {
        console.error(`HARD FAIL: ${slug} — JSON-RPC error: ${JSON.stringify(body.error).slice(0, 200)}`);
        results.hardFail += 1;
        continue;
      }
      const text = body?.result?.content?.[0]?.text;
      if (!text) {
        console.error(`HARD FAIL: ${slug} — no result.content[0].text`);
        results.hardFail += 1;
        continue;
      }
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) {
        console.error(`HARD FAIL: ${slug} — non-JSON response text`);
        results.hardFail += 1;
        continue;
      }
      // Upstream rate-limit detection: MCP returns isError=true with an
      // upstream-429 wrapper. Skip, don't fail.
      if (body?.result?.isError === true) {
        const errMsg = parsed.error || JSON.stringify(parsed).slice(0, 100);
        if (/429|Too Many Requests|rate.?limit/i.test(errMsg)) {
          console.log(`SKIP_RATE_LIMITED: ${slug} — upstream throttle: ${errMsg}`);
          results.skip += 1;
          continue;
        }
        console.error(`HARD FAIL: ${slug} — isError=true (non-rate-limit): ${errMsg}`);
        results.hardFail += 1;
        continue;
      }
      const av = parsed._algovault;
      if (!av) {
        console.error(`HARD FAIL: ${slug} — missing _algovault envelope`);
        results.hardFail += 1;
        continue;
      }
      if (av.version !== "1.9.0") {
        console.error(`HARD FAIL: ${slug} — _algovault.version=${av.version} (expected 1.9.0)`);
        results.hardFail += 1;
        continue;
      }
      if (av.tool !== expectedTool) {
        console.error(`HARD FAIL: ${slug} — _algovault.tool=${av.tool} (expected ${expectedTool})`);
        results.hardFail += 1;
        continue;
      }
      const provenance = av.session_id ? av.session_id.slice(0, 8) : "no-sid";
      console.log(`PASS: ${slug} — tool=${expectedTool} — sid=${provenance}... — version=${av.version}`);
      results.pass += 1;
    } catch (e) {
      console.error(`HARD FAIL: ${slug} — ${e.message}`);
      results.hardFail += 1;
    }

    // Pace at 2s to avoid bursting the upstream provider (Hyperliquid) rate limit
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log(`\n[smoke] summary: PASS=${results.pass}  SKIP_RATE_LIMITED=${results.skip}  HARD_FAIL=${results.hardFail}`);
  assert.equal(results.hardFail, 0, `expected 0 HARD FAIL, got ${results.hardFail}`);
  assert.ok(results.pass >= 15, `expected >=15 PASS, got ${results.pass}`);
});
