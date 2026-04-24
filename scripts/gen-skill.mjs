#!/usr/bin/env node
// Generator: read skills/manifest.json, emit skills/<slug>/SKILL.md per entry.
//
// Idempotent — re-run with unchanged manifest produces zero diffs.
// Fails loud if a manifest entry is missing a required field.
//
// Usage:
//   node scripts/gen-skill.mjs            # write files
//   node scripts/gen-skill.mjs --dry-run  # validate + report counts, no writes
//
// Per template contract (C2): 7 placeholders are substituted —
//   {{name}} {{description}} {{difficulty}} {{tool_sequence}}
//   {{example_prompt}} {{utm_url}} {{algovault_footer}}
// Plus internal-only helpers: {{slug}}, {{pattern}}, {{tool_call_block}}
// (these are derived from the 7 manifest fields, not separate manifest fields).

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const MANIFEST_PATH = join(SKILLS_DIR, "manifest.json");
const TEMPLATE_PATH = join(SKILLS_DIR, "_template", "SKILL.md.tmpl");

const REQUIRED = ["slug", "name", "description", "difficulty", "tools", "prompt", "pattern"];
const FOOTER = "_Built by [AlgoVault Labs](https://algovault.com) · MIT licensed · part of the [algovault-skills](https://github.com/AlgoVaultLabs/algovault-skills) plugin._";

const isDryRun = process.argv.includes("--dry-run");

function fail(msg, ctx = {}) {
  const ctxStr = Object.entries(ctx).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join("\n");
  console.error(`GEN_FAIL: ${msg}${ctxStr ? "\n" + ctxStr : ""}`);
  process.exit(1);
}

function validate(entry, idx) {
  for (const k of REQUIRED) {
    if (!(k in entry)) fail(`manifest[${idx}] missing required field "${k}"`, { entry });
  }
  if (!Array.isArray(entry.tools) || entry.tools.length === 0) {
    fail(`manifest[${idx}] tools must be non-empty array`, { entry });
  }
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(entry.slug)) {
    fail(`manifest[${idx}] slug "${entry.slug}" must be kebab-case`, { entry });
  }
}

function utmUrl(slug) {
  return `https://algovault.com/track-record?utm_source=skill&utm_medium=claude&utm_campaign=${slug}`;
}

function toolSequence(tools) {
  return tools.join(" → ");
}

function toolCallBlock(tools, slug) {
  const lines = tools.map((t, i) => {
    return `${i + 1}. **\`${t}\`** — invoke with appropriate parameters; pass header \`X-AlgoVault-Skill-Slug: ${slug}\`.`;
  });
  return lines.join("\n");
}

function render(template, entry) {
  const subs = {
    "{{name}}": entry.name,
    "{{description}}": entry.description,
    "{{difficulty}}": entry.difficulty,
    "{{tool_sequence}}": toolSequence(entry.tools),
    "{{example_prompt}}": entry.prompt,
    "{{utm_url}}": utmUrl(entry.slug),
    "{{algovault_footer}}": FOOTER,
    "{{slug}}": entry.slug,
    "{{pattern}}": entry.pattern,
    "{{tool_call_block}}": toolCallBlock(entry.tools, entry.slug),
  };
  let out = template;
  for (const [k, v] of Object.entries(subs)) {
    out = out.split(k).join(v);
  }
  // Leftover placeholder check
  const leftovers = out.match(/{{[a-z_]+}}/gi);
  if (leftovers) {
    fail(`unsubstituted placeholders for slug=${entry.slug}: ${leftovers.join(", ")}`);
  }
  return out;
}

async function readManifest() {
  if (!existsSync(MANIFEST_PATH)) fail(`manifest not found at ${MANIFEST_PATH}`);
  let raw;
  try { raw = await readFile(MANIFEST_PATH, "utf8"); }
  catch (e) { fail(`cannot read manifest: ${e.message}`); }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { fail(`manifest JSON parse error: ${e.message}`); }
  if (!Array.isArray(parsed)) fail(`manifest must be a JSON array, got ${typeof parsed}`);
  return parsed;
}

async function readTemplate() {
  if (!existsSync(TEMPLATE_PATH)) fail(`template not found at ${TEMPLATE_PATH}`);
  return await readFile(TEMPLATE_PATH, "utf8");
}

async function main() {
  const manifest = await readManifest();
  const template = await readTemplate();

  for (const [i, e] of manifest.entries()) validate(e, i);

  // Detect duplicate slugs
  const seen = new Set();
  for (const e of manifest) {
    if (seen.has(e.slug)) fail(`duplicate slug "${e.slug}"`);
    seen.add(e.slug);
  }

  let written = 0;
  for (const entry of manifest) {
    const dir = join(SKILLS_DIR, entry.slug);
    const filepath = join(dir, "SKILL.md");
    const content = render(template, entry);

    if (isDryRun) { written += 1; continue; }

    await mkdir(dir, { recursive: true });
    // Idempotency check: only write if content differs
    let prior = "";
    if (existsSync(filepath)) prior = await readFile(filepath, "utf8");
    if (prior !== content) await writeFile(filepath, content, "utf8");
    written += 1;
  }

  console.log(`GEN: ${written}/${manifest.length} skills emitted${isDryRun ? " (dry-run)" : ""}`);
}

main().catch(e => fail(`uncaught: ${e.message}`));
