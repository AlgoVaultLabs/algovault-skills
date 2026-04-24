#!/usr/bin/env node
// For each manifest slug, fetch the UTM-tagged track-record URL and assert:
//   - HTTP 200
//   - Body contains "Track Record" (page rendered, UTM preserved through redirect/SSR)
//
// These are static page fetches against algovault.com (NOT api.algovault.com),
// so the free-tier 20/day MCP cap does NOT apply. Expect all 20 to pass.

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

test("smoke: utm-tagged track-record URL is live for every slug", async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, "skills", "manifest.json"), "utf8"));
  assert.equal(manifest.length, 20);

  let pass = 0, fail = 0;
  for (const { slug } of manifest) {
    const url = `https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=${slug}`;
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) {
        console.error(`HARD FAIL: ${slug} — HTTP ${r.status}`);
        fail += 1;
        continue;
      }
      const body = await r.text();
      if (!/track\s*record/i.test(body)) {
        console.error(`HARD FAIL: ${slug} — body did not contain "Track Record"`);
        fail += 1;
        continue;
      }
      console.log(`PASS: ${slug} — utm_campaign URL HTTP 200`);
      pass += 1;
    } catch (e) {
      console.error(`HARD FAIL: ${slug} — ${e.message}`);
      fail += 1;
    }
  }

  console.log(`\n[utm] summary: PASS=${pass}  HARD_FAIL=${fail}`);
  assert.equal(fail, 0, `expected 0 HARD FAIL, got ${fail}`);
  assert.equal(pass, 20, `expected 20 PASS, got ${pass}`);
});
