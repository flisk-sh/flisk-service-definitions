#!/usr/bin/env node
// Usage:
//   node scripts/validate.mjs                 validate every app
//   node scripts/validate.mjs --fix           also rewrite files into canonical formatting
//   node scripts/validate.mjs apps/or/x/y    validate only the listed app directories (CI uses this for PRs)
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRepo } from './lib/validate.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fix = args.includes('--fix');
const apps = args.filter((arg) => !arg.startsWith('--'));

const result = await validateRepo(REPO_ROOT, { fix, apps: apps.length ? apps : undefined });

for (const rel of result.fixed) console.log(`formatted ${rel}`);
for (const warning of result.warnings) console.warn(`warning: ${warning}`);

if (result.errors.length > 0) {
  console.error(`\n${result.errors.length} problem(s) in ${result.apps} app(s) (${result.services} service(s)):`);
  for (const error of result.errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`All ${result.apps} app(s) and ${result.services} service(s) are valid.`);
