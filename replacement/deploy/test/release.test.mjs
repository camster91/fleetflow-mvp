import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { productionCompose, validateReceipts, validateBackupProof, verifiedBackup, release } from '../coolify-release.mjs';

const sha = 'a'.repeat(40);
function fixture() {
  const env = { RELEASE_SHA: sha, CHECKED_RUN_ID: '123', CHECKED_RUN_ATTEMPT: '2', GITHUB_RUN_ID: '456', BACKUP_NONCE: 'b'.repeat(32), RELEASE_BRANCH: 'main', FLEETVERA_COOLIFY_RELEASE_ENABLED: 'true', COOLIFY_APP_UUID: 'target', COOLIFY_ENVIRONMENT_UUID: 'production', COOLIFY_SERVER_UUID: 'server', COOLIFY_DESTINATION_UUID: 'destination', COOLIFY_TOKEN: 'private-test-token', COOLIFY_URL: 'https://coolify.example', PUBLIC_ORIGIN: 'https://fleet.ashbi.ca' };
  const receipts = ['runtime', 'role-init'].map((kind, index) => ({ schema: 1, repository: 'camster91/fleetflow-mvp', kind, revision: sha, workflow_run_id: '123', workflow_run_attempt: '2', image_id: 'sha256:' + 'c'.repeat(64), archive_sha256: 'd'.repeat(64), registry_image: `ghcr.io/camster91/fleetvera${index ? '-role-init' : ''}@sha256:${String(index + 1).repeat(64)}` }));
  const app = { uuid: 'target', name: 'fleetvera-rebuild-production', build_pack: 'dockercompose', environment: { uuid: 'production' }, destination: { uuid: 'destination', server: { uuid: 'server' } }, git_repository: 'camster91/fleetflow-mvp', git_branch: 'main', git_commit_sha: 'e'.repeat(40), docker_compose_location: '/docker-compose.rebuild-production.json', settings: { is_auto_deploy_enabled: false, is_preview_deployments_enabled: false }, ports_mappings: '', fqdn: null, docker_compose_raw: JSON.stringify(productionCompose()), docker_compose_domains: JSON.stringify({ app: { domain: env.PUBLIC_ORIGIN } }) };
  const values = { APP_ORIGIN: env.PUBLIC_ORIGIN, POSTGRES_PASSWORD: 'f'.repeat(64), RUNTIME_DATABASE_PASSWORD: 'a'.repeat(64), SETUP_TOKEN: 'b'.repeat(64), DATABASE_URL: `postgres://fleetvera_runtime:${'a'.repeat(64)}@postgres:5432/fleetvera_rebuild_production`, DATABASE_OWNER_URL: `postgres://fleetvera_owner:${'f'.repeat(64)}@postgres:5432/fleetvera_rebuild_production`, FLEETVERA_RUNTIME_IMAGE: 'ghcr.io/camster91/fleetvera@sha256:' + 'e'.repeat(64), FLEETVERA_ROLE_IMAGE: 'ghcr.io/camster91/fleetvera-role-init@sha256:' + 'f'.repeat(64) };
  const proof = { status: 'ok', releaseSha: sha, workflowRunId: '456', nonce: env.BACKUP_NONCE, completedAt: new Date().toISOString(), database: 'fleetvera_rebuild_production', manifestVerified: true, contentRestoreVerified: true, runtimeRestoreVerified: true, offServerCopyVerified: true, archive: '/opt/fleetvera-rebuild-recovery/encrypted/fleetvera-production-full-20261001T060000Z.tar.gz.age', sha256: 'c'.repeat(64), bytes: 3 };
  const calls = []; let status = 'finished';
  const fetchImpl = async (url, options = {}) => {
    url = new URL(url); calls.push({ url: url.href, ...options });
    const reply = (data, code = 200) => new Response(JSON.stringify(data), { status: code, headers: { 'Content-Type': 'application/json' } });
    if (url.origin === env.PUBLIC_ORIGIN) {
      assert.equal(options.headers?.Authorization, undefined);
      if (url.pathname === '/api/me') return reply({}, 401);
      return reply({ status: 'ok', database: 'ok', revision: sha });
    }
    if (url.pathname.endsWith('/envs/bulk')) { for (const row of JSON.parse(options.body).data) values[row.key] = row.value; return reply({}); }
    if (url.pathname.endsWith('/envs')) return reply(Object.entries(values).map(([key, value]) => ({ key, value, is_preview: false })));
    if (url.pathname === '/api/v1/deploy') return reply({ deployments: [{ resource_uuid: 'target', deployment_uuid: 'handle' }] });
    if (url.pathname === '/api/v1/deployments/handle') return reply({ status });
    if (options.method === 'PATCH') Object.assign(app, JSON.parse(options.body));
    return reply(app);
  };
  return { env, receipts, app, values, proof, calls, fetchImpl, setStatus(value) { status = value; }, options: { receipts, fetchImpl, backup: async () => proof, sleep: async () => {}, log: () => {} } };
}
function mutations(f) { return f.calls.filter(call => ['PATCH', 'POST'].includes(call.method)); }

test('tracked production Compose matches the reviewed image-only isolated database contract', async () => {
  const compose = JSON.parse(await readFile(new URL('../../../docker-compose.rebuild-production.json', import.meta.url), 'utf8'));
  assert.deepEqual(compose, productionCompose());
  assert.deepEqual(Object.keys(compose.services).sort(), ['app', 'migrate', 'postgres', 'runtime-role']);
  assert.equal(compose.services.app.image, compose.services.migrate.image);
  assert.deepEqual(compose.services.app.expose, ['3001']);
  for (const service of Object.values(compose.services)) { assert.equal(service.build, undefined); assert.equal(service.ports, undefined); }
});

test('same-run paired receipts reject wrong registry, missing kind, revision and run', () => {
  const f = fixture(); assert.equal(validateReceipts(f.receipts, f.env).runtime, f.receipts[0].registry_image);
  for (const [field, value] of [['revision', 'e'.repeat(40)], ['repository', 'foreign/repo'], ['workflow_run_id', '99'], ['workflow_run_attempt', '1'], ['registry_image', 'ghcr.io/camster91/foreign@sha256:' + 'a'.repeat(64)], ['kind', 'runtime']]) {
    const receipts = structuredClone(f.receipts); receipts[1][field] = value; assert.throws(() => validateReceipts(receipts, f.env));
  }
  assert.throws(() => validateReceipts([f.receipts[0]], f.env));
});
test('disabled and untrusted branch/configuration never call Coolify', async () => {
  for (const [field, value] of [['FLEETVERA_COOLIFY_RELEASE_ENABLED', 'false'], ['RELEASE_BRANCH', 'master'], ['COOLIFY_URL', 'http://coolify.example'], ['PUBLIC_ORIGIN', 'https://foreign.example']]) {
    const f = fixture(); f.env[field] = value; await assert.rejects(release(f.env, f.options)); assert.equal(f.calls.length, 0);
  }
});
test('wrong production identity, competing trigger or altered compose cannot mutate', async () => {
  for (const mutate of [f => f.app.environment.uuid = 'staging', f => f.app.destination.server.uuid = 'foreign', f => f.app.settings.is_auto_deploy_enabled = true, f => f.app.git_branch = 'master', f => { const compose = productionCompose(); compose.services.app.ports = ['3001:3001']; f.app.docker_compose_raw = JSON.stringify(compose); }, f => f.app.docker_compose_domains = '{}']) {
    const f = fixture(); mutate(f); await assert.rejects(release(f.env, f.options)); assert.equal(mutations(f).length, 0);
  }
});
test('legacy database, shared owner password and insecure cookie override cannot mutate', async () => {
  for (const mutate of [f => f.values.DATABASE_URL = 'postgres://owner:password@fleetflow-postgres/fleetflow', f => f.values.RUNTIME_DATABASE_PASSWORD = f.values.POSTGRES_PASSWORD, f => f.values.LOCAL_QA = 'true']) {
    const f = fixture(); mutate(f); await assert.rejects(release(f.env, f.options)); assert.equal(mutations(f).length, 0);
  }
});
test('missing, stale, foreign or unverified backup cannot change release pins', async () => {
  for (const [field, value] of [['nonce', 'c'.repeat(32)], ['releaseSha', 'e'.repeat(40)], ['database', 'fleetvera_rebuild_staging'], ['workflowRunId', '999'], ['completedAt', new Date(Date.now() - 600000).toISOString()], ['manifestVerified', false], ['contentRestoreVerified', false], ['runtimeRestoreVerified', false], ['offServerCopyVerified', false]]) {
    const f = fixture(); f.proof[field] = value; await assert.rejects(release(f.env, f.options)); assert.equal(mutations(f).length, 0);
  }
});
test('backup verifier rereads encrypted bytes and rejects a changed copy', async () => {
  const f = fixture(), temporary = await mkdtemp(path.join(os.tmpdir(), 'fleetvera-copy-test-')); f.env.RUNNER_TEMP = temporary;
  try {
    const directory = path.join(temporary, 'fleetvera-release-backup'); await mkdir(directory);
    f.proof.sha256 = createHash('sha256').update('abc').digest('hex'); validateBackupProof(f.proof, f.env);
    await writeFile(path.join(directory, 'proof.json'), JSON.stringify(f.proof)); const file = path.join(directory, path.basename(f.proof.archive)); await writeFile(file, 'abc');
    assert.equal((await verifiedBackup(f.env)).sha256, f.proof.sha256); await writeFile(file, 'xyz'); await assert.rejects(verifiedBackup(f.env), /changed/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
test('successful consumer pins both images, preserves secrets and verifies same deployment/public revision', async () => {
  const f = fixture(), result = await release(f.env, f.options);
  assert.equal(result.deploymentUuid, 'handle'); assert.equal(result.revision, sha); assert.equal(f.values.FLEETVERA_RUNTIME_IMAGE, f.receipts[0].registry_image); assert.equal(f.values.FLEETVERA_ROLE_IMAGE, f.receipts[1].registry_image);
  const patch = mutations(f)[0]; assert.deepEqual(JSON.parse(patch.body).data.map(row => row.key), ['FLEETVERA_RUNTIME_IMAGE', 'FLEETVERA_ROLE_IMAGE']);
  assert.equal(f.calls.filter(call => call.url.endsWith('/api/v1/deploy')).length, 1);
});
test('unpersisted paired pins never queue a deployment', async () => {
  const f = fixture(), actual = f.fetchImpl; f.options.fetchImpl = (url, options) => String(url).endsWith('/envs/bulk') ? Promise.resolve(new Response('{}')) : actual(url, options);
  await assert.rejects(release(f.env, f.options), /persist/); assert.equal(f.calls.filter(call => call.url.endsWith('/api/v1/deploy')).length, 0);
});
test('terminal failure and timeout retain one handle and never queue a second deployment', async () => {
  for (const status of ['failed', 'in_progress']) {
    const f = fixture(); f.setStatus(status); await assert.rejects(release(f.env, { ...f.options, maxPolls: 2 }), status === 'failed' ? /terminal failure/ : /handle/);
    assert.equal(f.calls.filter(call => call.url.endsWith('/api/v1/deploy')).length, 1);
  }
});
test('wrong serving revision and anonymous access failures fail acceptance without credentials sent publicly', async () => {
  for (const target of ['revision', 'anonymous']) {
    const f = fixture(), actual = f.fetchImpl; f.options.fetchImpl = (url, options) => {
      if (String(url).startsWith(f.env.PUBLIC_ORIGIN) && (target === 'revision' || String(url).endsWith('/api/me'))) {
        assert.equal(options.headers?.Authorization, undefined); return Promise.resolve(new Response(JSON.stringify({ status: 'ok', database: 'ok', revision: 'e'.repeat(40) })));
      } return actual(url, options);
    };
    await assert.rejects(release(f.env, f.options)); assert.equal(f.calls.filter(call => call.url.endsWith('/api/v1/deploy')).length, 1);
  }
});
