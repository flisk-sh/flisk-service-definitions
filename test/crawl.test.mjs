import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const crawler = fileURLToPath(new URL('../scripts/crawl.mjs', import.meta.url));

test('the crawler replaces a staged app only after validating the new import', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'flisk-crawl-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bin = join(dir, 'bin');
  const out = join(dir, 'staging');
  const importer = join(dir, 'importer.mjs');
  await mkdir(bin);
  const repo = (name) => ({
    name, owner: { login: 'sample-owner' }, full_name: `sample-owner/${name}`,
    clone_url: `https://example.test/sample-owner/${name}.git`,
    html_url: `https://example.test/sample-owner/${name}`,
    license: { spdx_id: 'MIT' }, size: 1,
  });
  await writeFile(join(bin, 'gh'),
    `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify({ items: [repo('valid'), repo('invalid')] })}'\n`,
    { mode: 0o755 });
  await writeFile(join(bin, 'git'), `#!/bin/sh
case "$1" in
  clone)
    for last; do previous="\${destination-}"; destination="$last"; done
    printf '%s\\n' "$previous" > "$destination/source"
    ;;
  -C) printf '%s\\n' '0123456789abcdef0123456789abcdef01234567' ;;
  *) exit 1 ;;
esac
`, { mode: 0o755 });
  await writeFile(importer, `
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = process.argv[2];
const source = await readFile(join(root, 'source'), 'utf8');
const service = join(root, 'services', 'backend', 'api');
await mkdir(service, { recursive: true });
await writeFile(join(service, 'service.json'), JSON.stringify({
  appName: 'api', stack: 'backend', port: source.trim().endsWith('/invalid.git') ? 0 : 4000,
}));
`);
  const schema = {
    type: 'object', required: ['port'], properties: {
      appName: { type: 'string' }, stack: { type: 'string' },
      port: { type: 'integer', minimum: 4000 },
    },
  };
  const paths = (name) => {
    const appDir = join(out, 'apps', 'sa', 'sample-owner', name);
    return { appDir, manifest: join(appDir, 'app.json'), service: join(appDir, 'services', 'api', 'service.json') };
  };
  const valid = paths('valid');
  const invalid = paths('invalid');
  const existingService = '{\n  "appName": "api",\n  "stack": "backend",\n  "port": 5000\n}\n';
  const existingManifest = (name) => `${JSON.stringify({ name: `@sample-owner/${name}`, license: 'MIT' }, null, 2)}\n`;
  for (const [name, target] of [['valid', valid], ['invalid', invalid]]) {
    await mkdir(join(target.appDir, 'services', 'api'), { recursive: true });
    await writeFile(target.manifest, existingManifest(name));
    await writeFile(target.service, existingService);
  }

  const { stdout } = await run(process.execPath, [crawler, '--limit', '2', '--out', out, '--import', importer], {
    env: {
      ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`,
      FLISK_SERVICE_SCHEMA_URL: `data:application/json,${encodeURIComponent(JSON.stringify(schema))}`,
    },
  });
  assert.match(stdout, /skip sample-owner\/invalid: invalid: .*port/);
  assert.match(stdout, /imported 1 apps \/ 1 services/);
  assert.equal(JSON.parse(await readFile(valid.service, 'utf8')).port, 4000);
  assert.equal(await readFile(invalid.manifest, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  }), existingManifest('invalid'), 'the rejected import must not remove the existing manifest');
  assert.equal(await readFile(invalid.service, 'utf8'), existingService);
  assert.deepEqual(await readdir(out), ['apps']);
});
