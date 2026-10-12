import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// The service schema is read from the published copy, which is synced from tdk-cli-core.
// Override with TDK_SERVICE_SCHEMA_URL to test against another build.
export const SERVICE_SCHEMA_URL = process.env.TDK_SERVICE_SCHEMA_URL ?? 'https://tdk-landscape.github.io/schema.service.json';

// Secrets belong in the project .env, never in service.json (see schema "secrets" description).
export const SECRET_KEY_PATTERN = /(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_KEY)/i;
// Well-known credential shapes, caught even under an innocent-looking key.
export const SECRET_VALUE_PATTERN =
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bsk-[A-Za-z0-9_-]{20,}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}\b|:\/\/[^/\s:@]+:[^/\s@]+@)/;

export const OWNER_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}$/;
export const APP_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

/** apps/<shard>/<owner>/<app>: the shard keeps every directory listing small at millions of apps. */
export function shardFor(owner) {
  return owner.slice(0, 2);
}

export function appPath(owner, app) {
  return join('apps', shardFor(owner), owner, app);
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function listDirs(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
}

/** Every app directory under rootDir/apps, as paths relative to rootDir. */
export async function listApps(rootDir) {
  const apps = [];
  for (const shard of await listDirs(join(rootDir, 'apps'))) {
    for (const owner of await listDirs(join(rootDir, 'apps', shard))) {
      for (const app of await listDirs(join(rootDir, 'apps', shard, owner))) {
        apps.push(join('apps', shard, owner, app));
      }
    }
  }
  return apps;
}

/** Maps changed file paths (e.g. from git diff) to the app directories that contain them. */
export function appsForPaths(paths) {
  const apps = new Set();
  for (const path of paths) {
    const parts = path.split(/[\\/]/);
    if (parts[0] === 'apps' && parts.length >= 5) {
      apps.add(parts.slice(0, 4).join(sep));
    }
  }
  return [...apps].sort();
}

export async function createValidator() {
  const response = await fetch(SERVICE_SCHEMA_URL);
  if (!response.ok) throw new Error(`cannot load service schema from ${SERVICE_SCHEMA_URL}: HTTP ${response.status}`);
  const schema = await response.json();
  return {
    service: new Ajv({ allErrors: true, strict: false }).compile(schema),
    knownServiceKeys: new Set(Object.keys(schema.properties)),
  };
}

async function readJson(file, rel, errors) {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) {
    errors.push(`${rel}: missing`);
    return {};
  }
  try {
    return { raw, doc: JSON.parse(raw) };
  } catch (error) {
    errors.push(`${rel}: invalid JSON (${error.message})`);
    return { raw };
  }
}

async function checkCanonical(file, rel, raw, doc, { fix, errors, fixed }) {
  if (raw === canonicalJson(doc)) return;
  if (fix) {
    await writeFile(file, canonicalJson(doc));
    fixed.push(rel);
  } else {
    errors.push(`${rel}: not canonically formatted; run "npm run format"`);
  }
}

function schemaErrors(validate, rel, errors) {
  for (const err of validate.errors ?? []) {
    errors.push(`${rel}: ${err.instancePath || '/'} ${err.message}`);
  }
}

/**
 * Validates one app (apps/<shard>/<owner>/<app>): its app.json and every services/<appName>/service.json.
 * Ports and dependsOn are checked within the app, because each app is its own TDK landscape.
 */
export async function validateApp(rootDir, appRel, validator, { fix = false } = {}) {
  const errors = [];
  const warnings = [];
  const fixed = [];
  const ctx = { fix, errors, fixed };
  const appDir = join(rootDir, appRel);
  const [, shard, owner, app] = appRel.split(/[\\/]/);

  if (!OWNER_PATTERN.test(owner)) errors.push(`${appRel}: owner "${owner}" must match ${OWNER_PATTERN}`);
  if (!APP_PATTERN.test(app)) errors.push(`${appRel}: app "${app}" must match ${APP_PATTERN}`);
  if (shard !== shardFor(owner)) errors.push(`${appRel}: owner "${owner}" belongs in apps/${shardFor(owner)}/`);

  const appFile = join(appDir, 'app.json');
  const appJsonRel = join(appRel, 'app.json');
  const { raw: appRaw, doc: appDoc } = await readJson(appFile, appJsonRel, errors);
  if (appDoc) {
    if (appDoc.name !== `@${owner}/${app}`) {
      errors.push(`${appJsonRel}: name "${appDoc.name}" must be "@${owner}/${app}"`);
    }
    await checkCanonical(appFile, appJsonRel, appRaw, appDoc, ctx);
  }

  const serviceDirs = await listDirs(join(appDir, 'services'));
  if (serviceDirs.length === 0) errors.push(`${appRel}: needs at least one services/<appName>/service.json`);

  const services = [];
  for (const dirName of serviceDirs) {
    const file = join(appDir, 'services', dirName, 'service.json');
    const rel = join(appRel, 'services', dirName, 'service.json');
    const { raw, doc } = await readJson(file, rel, errors);
    if (!doc) continue;

    if (!validator.service(doc)) schemaErrors(validator.service, rel, errors);
    if (doc.appName !== dirName) {
      errors.push(`${rel}: appName "${doc.appName}" must match directory name "${dirName}"`);
    }
    for (const [key, value] of Object.entries(doc.params ?? {})) {
      if (SECRET_KEY_PATTERN.test(key)) {
        errors.push(`${rel}: params.${key} looks like a secret; move it to the project .env`);
      } else if (typeof value === 'string' && SECRET_VALUE_PATTERN.test(value)) {
        errors.push(`${rel}: params.${key} contains a credential; move it to the project .env`);
      }
    }
    for (const key of Object.keys(doc)) {
      if (!validator.knownServiceKeys.has(key)) warnings.push(`${rel}: "${key}" is not in the service schema`);
    }
    await checkCanonical(file, rel, raw, doc, ctx);
    services.push({ rel, doc });
  }

  const names = new Set(services.map(({ doc }) => doc.appName));
  const stacks = new Set(services.map(({ doc }) => doc.stack));
  const portOwners = new Map();
  for (const { rel, doc } of services) {
    for (const dep of doc.dependsOn ?? []) {
      if (dep === doc.appName) {
        errors.push(`${rel}: dependsOn must not reference the service itself`);
      } else if (!names.has(dep) && !stacks.has(dep)) {
        errors.push(`${rel}: dependsOn "${dep}" is not a service or stack in ${appRel}`);
      }
    }
    if (Number.isInteger(doc.port)) {
      const owner = portOwners.get(doc.port);
      if (owner) errors.push(`${rel}: port ${doc.port} is already used by ${owner}`);
      else portOwners.set(doc.port, doc.appName);
    }
  }

  return { services: services.length, errors, warnings, fixed };
}

/**
 * Validates the given apps (default: every app under rootDir) with bounded concurrency,
 * so a full sweep over millions of apps does not open millions of files at once.
 */
export async function validateRepo(rootDir, { apps, fix = false, concurrency = 64 } = {}) {
  const validator = await createValidator();
  const targets = apps ?? (await listApps(rootDir));
  const result = { apps: targets.length, services: 0, errors: [], warnings: [], fixed: [] };

  let next = 0;
  async function worker() {
    while (next < targets.length) {
      const appRel = targets[next++];
      const one = await validateApp(rootDir, appRel, validator, { fix });
      result.services += one.services;
      result.errors.push(...one.errors);
      result.warnings.push(...one.warnings);
      result.fixed.push(...one.fixed);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));

  result.errors.sort();
  result.warnings.sort();
  return result;
}

export function relativeTo(rootDir, path) {
  return relative(rootDir, path);
}
