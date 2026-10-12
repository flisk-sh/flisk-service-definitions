#!/usr/bin/env node
// Copies the source-of-truth schema from a tdk-cli-core checkout into schema/.
// Usage: node scripts/sync-schema.mjs [path/to/tdk-cli-core/engine/schemas/service-schema.json]
import { copyFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(REPO_ROOT, 'schema', 'service.schema.json');
const source = resolve(process.argv[2] ?? join(REPO_ROOT, '..', 'tdk-cli-core', 'engine', 'schemas', 'service-schema.json'));

const before = await readFile(target, 'utf8').catch(() => '');
await copyFile(source, target);
const after = await readFile(target, 'utf8');

console.log(before === after ? `schema already up to date with ${source}` : `schema updated from ${source}`);
