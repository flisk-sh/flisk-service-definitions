import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRepo, canonicalJson, shardFor } from '../scripts/lib/validate.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCHEMA_URL = 'https://flisk.sh/schema.service.json';
const service = (appName, extra = {}) => ({
  $schema: SCHEMA_URL,
  schemaVersion: 1,
  appName,
  appType: 'backend',
  stack: 'shop',
  port: 4000,
  healthCheckPath: '/health',
  dependsOn: [],
  ...extra,
});
const appJson = (owner, app) => ({
  name: `@${owner}/${app}`,
});

/** Writes an app tree under a temp root. files: { "services/x/service.json": obj | string } */
async function makeRoot(apps) {
  const root = await mkdtemp(join(tmpdir(), 'flisk-registry-'));
  for (const [appRel, files] of Object.entries(apps)) {
    for (const [file, body] of Object.entries(files)) {
      const path = join(root, appRel, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, typeof body === 'string' ? body : canonicalJson(body));
    }
  }
  return root;
}

const APP = 'apps/or/orders-co/orders-platform';
const withApp = (services, owner = 'orders-co', app = 'orders-platform') => ({
  [`apps/${shardFor(owner)}/${owner}/${app}`]: {
    'app.json': appJson(owner, app),
    ...Object.fromEntries(Object.entries(services).map(([name, doc]) => [`services/${name}/service.json`, doc])),
  },
});

async function run(apps) {
  const root = await makeRoot(apps);
  try {
    return await validateRepo(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('a valid app passes', async () => {
  const result = await run(withApp({
    'orders-api': service('orders-api'),
    'orders-app': service('orders-app', { appType: 'frontend', port: 3000, dependsOn: ['orders-api'] }),
    'orders-worker': service('orders-worker', { appType: 'worker', port: 4001, featuresEnabled: ['nats'], dependsOn: ['orders-api'] }),
  }));
  assert.equal(result.apps, 1);
  assert.equal(result.services, 3);
  assert.deepEqual(result.errors, []);
});

test('every app in this repository is valid', async () => {
  const result = await validateRepo(repoRoot);
  assert.deepEqual(result.errors, []);
  assert.ok(result.apps >= 1);
});

const cases = {
  'bad json': [withApp({ 'orders-api': '{ "appName": ' }), /invalid JSON/],
  'dir name mismatch': [withApp({ 'wrong-dir': service('orders-api') }), /must match directory name "wrong-dir"/],
  'backend port out of range': [withApp({ 'orders-api': service('orders-api', { port: 9000 }) }), /\/port must be <= 5999/],
  'missing appType': [withApp({ 'orders-api': (({ appType, ...rest }) => rest)(service('orders-api')) }), /must have required property 'appType'/],
  'secret key in params': [withApp({ 'orders-api': service('orders-api', { params: { DB_PASSWORD: 'x' } }) }), /params\.DB_PASSWORD looks like a secret/],
  'credential value in params': [withApp({ 'orders-api': service('orders-api', { params: { NATS_URL: 'nats://user:pw@host:4222' } }) }), /contains a credential/],
  'duplicate port in app': [withApp({
    'orders-api': service('orders-api'),
    'billing-api': service('billing-api', { stack: 'billing' }),
  }), /port 4000 is already used by/],
  'self dependency': [withApp({ 'orders-api': service('orders-api', { dependsOn: ['orders-api'] }) }), /must not reference the service itself/],
  'unknown dependsOn': [withApp({ 'orders-api': service('orders-api', { dependsOn: ['ghost-api'] }) }), /dependsOn "ghost-api" is not a service or stack/],
  'worker without nats': [withApp({ 'orders-worker': service('orders-worker', { appType: 'worker', port: 4001, featuresEnabled: [] }) }), /\/featuresEnabled must contain at least 1 valid item/],
  'app name mismatch': [{ [APP]: { 'app.json': appJson('other-co', 'orders-platform'), 'services/orders-api/service.json': service('orders-api') } }, /name "@other-co\/orders-platform" must be "@orders-co\/orders-platform"/],
  'wrong shard': [{ 'apps/zz/orders-co/orders-platform': { 'app.json': appJson('orders-co', 'orders-platform'), 'services/orders-api/service.json': service('orders-api') } }, /belongs in apps\/or\//],
  'no services': [{ [APP]: { 'app.json': appJson('orders-co', 'orders-platform') } }, /needs at least one services/],
  'not canonical': [withApp({ 'orders-api': '{"schemaVersion":1,"appName":"orders-api","appType":"backend","stack":"shop","port":4000,"healthCheckPath":"/health","dependsOn":[]}\n' }), /not canonically formatted/],
};

for (const [name, [apps, expected]] of Object.entries(cases)) {
  test(`rejects ${name}`, async () => {
    const result = await run(apps);
    assert.ok(
      result.errors.some((error) => expected.test(error)),
      `expected an error matching ${expected}, got:\n${result.errors.join('\n')}`,
    );
  });
}

test('unknown service keys are warnings, not errors', async () => {
  const result = await run(withApp({ 'orders-api': service('orders-api', { bogusKey: 'x' }) }));
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((w) => /"bogusKey" is not in the service schema/.test(w)));
});
