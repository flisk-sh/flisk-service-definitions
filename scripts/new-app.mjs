#!/usr/bin/env node
// Scaffolds a new app directory with app.json and an empty services/ folder.
// Usage: node scripts/new-app.mjs <owner> <app>
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_PATTERN, OWNER_PATTERN, appPath, canonicalJson } from './lib/validate.mjs';

const [owner, app] = process.argv.slice(2);
if (!owner || !app || !OWNER_PATTERN.test(owner) || !APP_PATTERN.test(app)) {
  console.error('usage: node scripts/new-app.mjs <owner> <app>  (lowercase, a-z0-9-)');
  process.exit(1);
}

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(REPO_ROOT, appPath(owner, app));
await mkdir(join(dir, 'services'), { recursive: true });
await writeFile(join(dir, 'app.json'), canonicalJson({
  $schema: 'https://tdk-landscape.github.io/schema.app.json',
  name: `@${owner}/${app}`,
  schemaVersion: 1,
  description: 'TODO: one line about the app.',
  license: 'MIT',
}));
console.log(`created ${appPath(owner, app)}/app.json; add services/<appName>/service.json next`);
