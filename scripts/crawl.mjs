#!/usr/bin/env node
// Imports service.json files from real public GitHub repos into a staging directory.
//
//   node scripts/crawl.mjs --query "topic:docker-compose" --limit 50 [--out .crawl/staging] [--import /path/to/tdk-import/dist/cli.js]
//
// Only public, non-fork, non-archived repos with an SPDX license are considered. Nothing is written to apps/;
// review the staging directory, then copy what you want in. Environment values are never imported (tdk-import
// records names only), and the source repo, license and commit go into app.json.
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  APP_PATTERN, OWNER_PATTERN, appPath, canonicalJson, createValidator, validateApp,
} from './lib/validate.mjs';

const run = promisify(execFile);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const query = arg('query', 'topic:docker-compose');
const limit = Number(arg('limit', '50'));
const out = resolve(arg('out', join(REPO_ROOT, '.crawl', 'staging')));
const importer = resolve(arg('import', join(REPO_ROOT, '..', 'tdk-import', 'dist', 'cli.js')));

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function discover() {
  const repos = [];
  for (let page = 1; repos.length < limit && page <= 10; page++) {
    const { stdout } = await run('gh', [
      'api', '-X', 'GET', 'search/repositories',
      '-f', `q=${query} fork:false archived:false is:public`,
      '-f', 'sort=stars', '-f', 'per_page=100', '-f', `page=${page}`,
    ], { maxBuffer: 64 * 1024 * 1024 });
    const items = JSON.parse(stdout).items ?? [];
    if (items.length === 0) break;
    for (const repo of items) {
      const license = repo.license?.spdx_id;
      if (!license || license === 'NOASSERTION') continue;
      if (repo.size > 200_000) continue; // KB
      repos.push(repo);
    }
    await sleep(2500); // search API allows 30 requests/minute
  }
  return repos.slice(0, limit);
}

async function importRepo(repo, validator, stats) {
  const owner = slug(repo.owner.login);
  const app = slug(repo.name);
  if (!OWNER_PATTERN.test(owner) || !APP_PATTERN.test(app)) return stats.skipped('bad slug', repo);

  const work = await mkdtemp(join(tmpdir(), 'tdk-crawl-'));
  try {
    await run('git', ['clone', '--depth', '1', '--quiet', '--filter=blob:limit=1m', repo.clone_url, work], { timeout: 120_000 });
    const { stdout: sha } = await run('git', ['-C', work, 'rev-parse', 'HEAD']);
    await run('node', [importer, work, '--yes'], { timeout: 60_000 }).catch((error) => {
      throw new Error(`tdk-import failed: ${String(error.stderr || error.message).split('\n')[0]}`);
    });

    const found = [];
    const servicesRoot = join(work, 'services');
    for (const stack of await readdir(servicesRoot).catch(() => [])) {
      for (const name of await readdir(join(servicesRoot, stack)).catch(() => [])) {
        const doc = JSON.parse(await readFile(join(servicesRoot, stack, name, 'service.json'), 'utf8').catch(() => 'null'));
        if (doc) found.push(doc);
      }
    }
    if (found.length === 0) return stats.skipped('no services', repo);

    const appRel = appPath(owner, app);
    const appDir = join(out, appRel);
    await rm(appDir, { recursive: true, force: true });
    for (const doc of found) {
      const dir = join(appDir, 'services', doc.appName);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'service.json'), canonicalJson({
        $schema: 'https://flisk.sh/schema.service.json', ...doc,
      }));
    }
    await writeFile(join(appDir, 'app.json'), canonicalJson({
      name: `@${owner}/${app}`,
      ...(repo.description ? { description: repo.description.slice(0, 280) } : {}),
      repository: repo.html_url,
      license: repo.license.spdx_id,
      sourceCommit: sha.trim(),
    }));

    const result = await validateApp(out, appRel, validator, { fix: true });
    if (result.errors.length > 0) {
      await rm(appDir, { recursive: true, force: true });
      return stats.skipped(`invalid: ${result.errors[0]}`, repo);
    }
    stats.imported += 1;
    stats.services += result.services;
  } catch (error) {
    stats.skipped(`error: ${String(error.message).split('\n')[0]}`, repo);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const validator = await createValidator();
const stats = {
  imported: 0, services: 0, reasons: {},
  skipped(reason, repo) {
    const key = reason.replace(/(invalid|error): .*/, '$1');
    this.reasons[key] = (this.reasons[key] ?? 0) + 1;
    console.log(`skip ${repo.full_name}: ${reason}`);
  },
};

const repos = await discover();
console.log(`discovered ${repos.length} candidate repos for "${query}"`);
for (const repo of repos) {
  await importRepo(repo, validator, stats);
}
console.log(`\nimported ${stats.imported} apps / ${stats.services} services into ${out}`);
console.log('skipped:', stats.reasons);
