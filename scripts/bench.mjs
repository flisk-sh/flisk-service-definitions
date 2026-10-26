// Synthetic scale check: builds N apps in a temp dir and times a full validation sweep.
// Usage: node scripts/bench.mjs [count]
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRepo, shardFor, canonicalJson } from './lib/validate.mjs';

const count = Number(process.argv[2] ?? 5000);
const root = await mkdtemp(join(tmpdir(), 'flisk-bench-'));
const SCHEMA = 'https://flisk.sh/schema.service.json';

for (let i = 0; i < count; i++) {
  const owner = `owner-${i % 997}`;
  const app = `app-${i}`;
  const base = join(root, 'apps', shardFor(owner), owner, app);
  await mkdir(join(base, 'services', `${app}-api`), { recursive: true });
  await writeFile(join(base, 'app.json'), canonicalJson({ name: `@${owner}/${app}` }));
  await writeFile(join(base, 'services', `${app}-api`, 'service.json'), canonicalJson({
    $schema: SCHEMA, schemaVersion: 1, appName: `${app}-api`, appType: 'backend', stack: 'bench', port: 4000, healthCheckPath: '/health', dependsOn: [],
  }));
}

const started = performance.now();
const result = await validateRepo(root);
const seconds = (performance.now() - started) / 1000;
console.log(`${result.apps} apps, ${result.services} services, ${result.errors.length} errors in ${seconds.toFixed(1)}s (${Math.round(result.apps / seconds)} apps/s)`);
await rm(root, { recursive: true, force: true });
