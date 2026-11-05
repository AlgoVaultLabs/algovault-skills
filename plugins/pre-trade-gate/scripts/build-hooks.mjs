#!/usr/bin/env node
/**
 * Writes hooks/codex.json, the Codex plugin's hooks file, from the harness table
 * (lib/harnesses.mjs). Run it after changing the table; a unit test fails while the
 * committed file differs from what this writes.
 *
 *   node plugins/pre-trade-gate/scripts/build-hooks.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexPluginHooks } from './lib/harnesses.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(ROOT, 'hooks', 'codex.json');
writeFileSync(file, `${JSON.stringify(codexPluginHooks(), null, 2)}\n`);
process.stdout.write(`wrote ${file}\n`);
