import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('a repeated new-app command preserves the edited manifest', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'flisk-new-app-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL('../scripts/', import.meta.url), join(root, 'scripts'), { recursive: true });
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'junction');

  const run = () => spawnSync(process.execPath, ['scripts/new-app.mjs', 'orders-co', 'orders-platform'], {
    cwd: root,
    encoding: 'utf8',
  });
  const created = run();
  assert.equal(created.status, 0, created.stderr);

  const manifest = join(root, 'apps', 'or', 'orders-co', 'orders-platform', 'app.json');
  const edited = JSON.parse(await readFile(manifest, 'utf8'));
  assert.equal(edited.name, '@orders-co/orders-platform');
  edited.description = 'Custom ordering platform';
  const saved = `${JSON.stringify(edited, null, 2)}\n`;
  await writeFile(manifest, saved);

  const repeated = run();
  assert.equal(await readFile(manifest, 'utf8'), saved);
  assert.equal(repeated.status, 1);
  assert.match(repeated.stderr, /app\.json already exists/);
});
