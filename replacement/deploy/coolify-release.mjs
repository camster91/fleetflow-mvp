import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repository = 'camster91/fleetflow-mvp';
const database = 'fleetvera_rebuild_production';
const registries = { runtime: 'ghcr.io/camster91/fleetvera', 'role-init': 'ghcr.io/camster91/fleetvera-role-init' };
export function validateReceipts(receipts, env) {
  if (!/^[a-f0-9]{40}$/.test(env.RELEASE_SHA || '') || !/^\d+$/.test(env.CHECKED_RUN_ID || '') || !/^\d+$/.test(env.CHECKED_RUN_ATTEMPT || '')) throw new Error('Missing checked build identity');
  if (receipts.length !== 2) throw new Error('Both checked images are required');
  const images = {};
  for (const receipt of receipts) {
    const registry = registries[receipt?.kind];
    if (!registry || images[receipt.kind] || receipt.schema !== 1 || receipt.repository !== repository || receipt.revision !== env.RELEASE_SHA
      || receipt.workflow_run_id !== env.CHECKED_RUN_ID || receipt.workflow_run_attempt !== env.CHECKED_RUN_ATTEMPT
      || !/^sha256:[a-f0-9]{64}$/.test(receipt.image_id || '') || !/^[a-f0-9]{64}$/.test(receipt.archive_sha256 || '')
      || !new RegExp('^' + registry.replaceAll('.', '\\.') + '@sha256:[a-f0-9]{64}$').test(receipt.registry_image || '')) throw new Error('Images differ from the same checked main build');
    images[receipt.kind] = receipt.registry_image;
  }
  return images;
}

export function productionCompose() {
  return {
    services: {
      postgres: { image: 'postgres:16-alpine', environment: { POSTGRES_DB: database, POSTGRES_USER: 'fleetvera_owner', POSTGRES_PASSWORD: '${POSTGRES_PASSWORD:?required}' }, volumes: ['fleetvera_rebuild_production_database_v1:/var/lib/postgresql/data'], healthcheck: { test: ['CMD-SHELL', `pg_isready -U fleetvera_owner -d ${database}`], interval: '5s', timeout: '3s', retries: 20 }, restart: 'unless-stopped' },
      migrate: { image: '${FLEETVERA_RUNTIME_IMAGE:?required}', environment: { DATABASE_URL: '${DATABASE_OWNER_URL:?required}', REBUILD_DATABASE_NAME: database }, command: ['node', 'src/migrate.mjs'], depends_on: { postgres: { condition: 'service_healthy' } }, restart: 'no' },
      'runtime-role': { image: '${FLEETVERA_ROLE_IMAGE:?required}', environment: { PGHOST: 'postgres', PGDATABASE: database, PGUSER: 'fleetvera_owner', PGPASSWORD: '${POSTGRES_PASSWORD:?required}', RUNTIME_PASSWORD: '${RUNTIME_DATABASE_PASSWORD:?required}' }, tmpfs: ['/var/lib/postgresql/data'], depends_on: { migrate: { condition: 'service_completed_successfully' } }, restart: 'no' },
      app: { image: '${FLEETVERA_RUNTIME_IMAGE:?required}', expose: ['3001'], environment: { DATABASE_URL: '${DATABASE_URL:?required}', REBUILD_DATABASE_NAME: database, APP_ORIGIN: '${APP_ORIGIN:?required}', SETUP_TOKEN: '${SETUP_TOKEN:?required}' }, depends_on: { 'runtime-role': { condition: 'service_completed_successfully' } }, healthcheck: { test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3001/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval: '10s', timeout: '5s', retries: 12 }, restart: 'unless-stopped' }
    }, volumes: { fleetvera_rebuild_production_database_v1: {} }
  };
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }

export function validateBackupProof(proof, env, now = Date.now()) {
  const age = now - Date.parse(proof?.completedAt);
  if (proof?.status !== 'ok' || proof.releaseSha !== env.RELEASE_SHA || proof.workflowRunId !== env.GITHUB_RUN_ID
    || !/^[a-f0-9]{32}$/.test(env.BACKUP_NONCE || '') || proof.nonce !== env.BACKUP_NONCE || proof.database !== database
    || proof.manifestVerified !== true || proof.contentRestoreVerified !== true || proof.runtimeRestoreVerified !== true || proof.offServerCopyVerified !== true
    || !/^\/opt\/fleetvera-rebuild-recovery\/encrypted\/fleetvera-production-full-\d{8}T\d{6}Z\.tar\.gz\.age$/.test(proof.archive || '')
    || !/^[a-f0-9]{64}$/.test(proof.sha256 || '') || !Number.isSafeInteger(proof.bytes) || proof.bytes <= 0
    || !Number.isFinite(age) || age < -60000 || age > 300000) throw new Error('Fresh verified production recovery copy required');
  return proof;
}
export async function verifiedBackup(env) {
  if (!env.RUNNER_TEMP || !/^\d+$/.test(env.GITHUB_RUN_ID || '')) throw new Error('Missing backup workflow identity');
  const directory = path.join(env.RUNNER_TEMP, 'fleetvera-release-backup');
  const proof = validateBackupProof(JSON.parse(await readFile(path.join(directory, 'proof.json'), 'utf8')), env);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path.join(directory, path.basename(proof.archive)))) { bytes += chunk.length; hash.update(chunk); }
  if (bytes !== proof.bytes || hash.digest('hex') !== proof.sha256) throw new Error('Off-server encrypted recovery copy changed');
  return proof;
}

export async function release(env, { receipts, fetchImpl = fetch, backup = verifiedBackup, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log, maxPolls = 120 } = {}) {
  if (env.FLEETVERA_COOLIFY_RELEASE_ENABLED !== 'true' || env.RELEASE_BRANCH !== 'main') throw new Error('Production release disabled');
  for (const field of ['COOLIFY_APP_UUID', 'COOLIFY_ENVIRONMENT_UUID', 'COOLIFY_SERVER_UUID', 'COOLIFY_DESTINATION_UUID']) if (!/^[a-zA-Z0-9]+$/.test(env[field] || '')) throw new Error('Missing reviewed production identity');
  if (!env.COOLIFY_TOKEN) throw new Error('Missing release credential');
  const origin = new URL(env.COOLIFY_URL);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || !['', '/'].includes(origin.pathname)) throw new Error('Trusted Coolify HTTPS origin required');
  if (!['https://fleet.ashbi.ca', 'https://fleetflow.ashbi.ca'].includes(env.PUBLIC_ORIGIN)) throw new Error('Reviewed Fleetvera public origin required');
  receipts ??= await Promise.all(['runtime', 'role-init'].map(async kind => JSON.parse(await readFile(`checked-receipts/${kind}/release-receipt.json`, 'utf8'))));
  const images = validateReceipts(receipts, env), uuid = env.COOLIFY_APP_UUID;
  async function api(endpoint, method = 'GET', body) {
    const response = await fetchImpl(new URL('/api/v1' + endpoint, origin), { method, redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: 'Bearer ' + env.COOLIFY_TOKEN, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error('Coolify request failed: HTTP ' + response.status);
    return response.json();
  }
  function resource(app) {
    if (app.uuid !== uuid || app.name !== 'fleetvera-rebuild-production' || app.build_pack !== 'dockercompose'
      || app.environment?.uuid !== env.COOLIFY_ENVIRONMENT_UUID || app.destination?.uuid !== env.COOLIFY_DESTINATION_UUID || app.destination?.server?.uuid !== env.COOLIFY_SERVER_UUID
      || ![repository, 'https://github.com/' + repository].includes(app.git_repository) || app.git_branch !== 'main'
      || app.docker_compose_location !== '/docker-compose.rebuild-production.json'
      || (app.is_auto_deploy_enabled ?? app.settings?.is_auto_deploy_enabled) !== false
      || (app.is_preview_deployments_enabled ?? app.settings?.is_preview_deployments_enabled) !== false || app.ports_mappings || app.fqdn
      || ['docker_compose_custom_start_command', 'docker_compose_custom_build_command', 'pre_deployment_command', 'post_deployment_command', 'custom_labels'].some(key => app[key])
      || Number(app.additional_servers_count || 0) !== 0 || Number(app.additional_networks_count || 0) !== 0) throw new Error('Production resource identity or release ownership differs');
    let compose, domains;
    try { compose = JSON.parse(app.docker_compose_raw); domains = typeof app.docker_compose_domains === 'string' ? JSON.parse(app.docker_compose_domains) : app.docker_compose_domains; } catch { throw new Error('Reviewed JSON Compose required'); }
    if (!same(compose, productionCompose()) || !same(domains, { app: { domain: env.PUBLIC_ORIGIN } })) throw new Error('Production Compose or public route differs');
  }
  const original = await api('/applications/' + uuid); resource(original);
  const variables = await api('/applications/' + uuid + '/envs');
  function settings(rows) {
    if (!Array.isArray(rows)) throw new Error('Unexpected environment response');
    const entries = rows.filter(row => row.is_preview === false);
    const result = new Map();
    for (const row of entries) { if (result.has(row.key)) throw new Error('Ambiguous production environment'); result.set(row.key, row.value); }
    if (result.get('APP_ORIGIN') !== env.PUBLIC_ORIGIN || result.has('LOCAL_QA')) throw new Error('Production origin or cookie policy differs');
    for (const key of ['POSTGRES_PASSWORD', 'RUNTIME_DATABASE_PASSWORD', 'SETUP_TOKEN']) if (!/^[a-f0-9]{64}$/.test(result.get(key) || '')) throw new Error('Dedicated production credentials required');
    if (result.get('POSTGRES_PASSWORD') === result.get('RUNTIME_DATABASE_PASSWORD')) throw new Error('Runtime must not use owner credentials');
    if (result.get('DATABASE_URL') !== `postgres://fleetvera_runtime:${result.get('RUNTIME_DATABASE_PASSWORD')}@postgres:5432/${database}`
      || result.get('DATABASE_OWNER_URL') !== `postgres://fleetvera_owner:${result.get('POSTGRES_PASSWORD')}@postgres:5432/${database}`) throw new Error('Dedicated production database ownership differs');
    return result;
  }
  const previous = settings(variables);
  const proof = validateBackupProof(await backup(env), env);
  if (proof.offServerCopyVerified !== true) throw new Error('Off-server backup missing');
  await api('/applications/' + uuid + '/envs/bulk', 'PATCH', { data: [ ['FLEETVERA_RUNTIME_IMAGE', images.runtime], ['FLEETVERA_ROLE_IMAGE', images['role-init']] ].map(([key, value]) => ({ key, value, is_preview: false, is_literal: true, is_runtime: true, is_buildtime: false })) });
  await api('/applications/' + uuid, 'PATCH', { git_commit_sha: env.RELEASE_SHA });
  const pinned = await api('/applications/' + uuid); resource(pinned);
  const finalSettings = settings(await api('/applications/' + uuid + '/envs'));
  if (pinned.git_commit_sha !== env.RELEASE_SHA || finalSettings.get('FLEETVERA_RUNTIME_IMAGE') !== images.runtime || finalSettings.get('FLEETVERA_ROLE_IMAGE') !== images['role-init']) throw new Error('Checked release pins did not persist');
  for (const [key, value] of previous) if (!['FLEETVERA_RUNTIME_IMAGE', 'FLEETVERA_ROLE_IMAGE'].includes(key) && finalSettings.get(key) !== value) throw new Error('Unrelated production setting drifted');
  const queued = await api('/deploy', 'POST', { uuid });
  const deployment = queued.deployments?.find(item => item.resource_uuid === uuid);
  if (!/^[a-zA-Z0-9]+$/.test(deployment?.deployment_uuid || '')) throw new Error('Matching deployment handle missing');
  log('Fleetvera checked release deployment ' + deployment.deployment_uuid);
  for (let poll = 0; poll < maxPolls; poll++) {
    const state = await api('/deployments/' + deployment.deployment_uuid);
    if (state.status === 'finished') {
      const final = await api('/applications/' + uuid); resource(final);
      const values = settings(await api('/applications/' + uuid + '/envs'));
      if (final.git_commit_sha !== env.RELEASE_SHA || values.get('FLEETVERA_RUNTIME_IMAGE') !== images.runtime || values.get('FLEETVERA_ROLE_IMAGE') !== images['role-init']) throw new Error('Deployed release pins drifted');
      const response = await fetchImpl(env.PUBLIC_ORIGIN + '/api/health/ready', { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error('Public readiness failed');
      const health = await response.json();
      if (health.status !== 'ok' || health.database !== 'ok' || health.revision !== env.RELEASE_SHA) throw new Error('Serving revision differs from checked release');
      const anonymous = await fetchImpl(env.PUBLIC_ORIGIN + '/api/me', { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
      if (anonymous.status !== 401) throw new Error('Anonymous private API restriction failed');
      return { revision: env.RELEASE_SHA, images, deploymentUuid: deployment.deployment_uuid, previousRevision: original.git_commit_sha, previousImages: { runtime: previous.get('FLEETVERA_RUNTIME_IMAGE'), 'role-init': previous.get('FLEETVERA_ROLE_IMAGE') } };
    }
    if (!['queued', 'in_progress', 'pending'].includes(state.status)) throw new Error('Deployment terminal failure or unknown status');
    await sleep(10000);
  }
  throw new Error('Observation timed out; inspect deployment ' + deployment.deployment_uuid + ' before retrying');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) release(process.env).then(result => console.log(JSON.stringify(result))).catch(() => { console.error('Fleetvera release verification failed; retain the logged deployment handle and inspect it before retrying'); process.exitCode = 1; });
