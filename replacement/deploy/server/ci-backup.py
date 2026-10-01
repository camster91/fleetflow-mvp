#!/usr/bin/env python3
"""Root-owned Fleetvera recovery producer; forced command exposes encrypted copies only."""
import datetime, fcntl, hashlib, json, os
from pathlib import Path
import re, secrets, shlex, subprocess, sys, tarfile, tempfile, time
from urllib.parse import urlparse

ROOT = Path('/opt/fleetvera-rebuild-recovery/encrypted')
CONFIG = Path('/etc/fleetvera-ci-backup.json')
IDENTITY = '/root/.config/ashbi-backup/identity.txt'
RECIPIENTS = '/etc/ashbi-backup/recipients.txt'
ARCHIVE = re.compile(r'/opt/fleetvera-rebuild-recovery/encrypted/fleetvera-production-full-\d{8}T\d{6}Z\.tar\.gz\.age')
FILES = {'database.dump', 'database-fingerprints.json', 'runtime-inspect.json', 'image-inspect.json', 'deployment-compose.yml', 'deployment.env', 'runtime-role.sql', 'images.tar', 'release.json'}

def parse_command(command):
    parts = shlex.split(command)
    if len(parts) == 4 and parts[0] == 'fleetvera-backup' and re.fullmatch('[a-f0-9]{40}', parts[1]) and re.fullmatch('[a-f0-9]{32}', parts[2]) and re.fullmatch('[0-9]+', parts[3]):
        return 'backup', parts[1:]
    if len(parts) == 3 and parts[:2] == ['scp', '-f'] and ARCHIVE.fullmatch(parts[2]):
        return 'download', parts[2:]
    raise ValueError('Command denied')

def sealed(path, directory=False):
    if path.is_symlink() or not path.exists() or path.resolve() != path:
        raise ValueError('Untrusted recovery path')
    metadata = path.stat()
    if metadata.st_uid != 0 or metadata.st_mode & 0o077 or (directory and not path.is_dir()) or (not directory and not path.is_file()):
        raise ValueError('Private root-owned recovery path required')

def digest(path):
    with path.open('rb') as source: return hashlib.file_digest(source, 'sha256').hexdigest()

def require(args, **options):
    result = subprocess.run(args, stdout=options.pop('stdout', subprocess.PIPE), stderr=subprocess.PIPE, timeout=900, **options)
    if result.returncode: raise RuntimeError('Private recovery operation failed')
    return result.stdout

def configuration(settings, rehearsal=False):
    expected = 'fleetvera_rebuild_staging' if rehearsal else 'fleetvera_rebuild_production'
    if set(settings) != {'resource_uuid', 'database'} or not re.fullmatch('[a-z0-9]{20,40}', settings.get('resource_uuid', '')) or settings.get('database') != expected:
        raise ValueError('Reviewed dedicated resource configuration required')
    return settings

def completed_setup(services):
    for name in ('migrate', 'runtime-role'):
        state = services.get(name, {}).get('State', {})
        if state.get('Running') is not False or state.get('Status') != 'exited' or state.get('ExitCode') != 0:
            raise ValueError('Setup tasks must have completed successfully')

SNAPSHOT = r"""
import pg from 'pg';const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:60000});await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
const snapshot=(await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
const tables=(await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename")).rows;
const fingerprints={};const quote=s=>'"'+s.replaceAll('"','""')+'"';
for(const table of tables){const name=table.schemaname+'.'+table.tablename;fingerprints[name]=(await client.query("SELECT count(*)::text AS count,md5(coalesce(string_agg(row_json,chr(10) ORDER BY row_json COLLATE \"C\"),'')) AS content_md5 FROM (SELECT row_to_json(t)::text AS row_json FROM "+quote(table.schemaname)+'.'+quote(table.tablename)+' t) rows')).rows[0];}
console.log(JSON.stringify({snapshot,fingerprints}));for await(const chunk of process.stdin){}await client.query('ROLLBACK');await client.end();
"""

def unpack_verified(archive, work):
    require(['age', '--decrypt', '--identity', IDENTITY, '-o', str(work / 'bundle.tar.gz'), str(archive)])
    with tarfile.open(work / 'bundle.tar.gz') as bundle:
        members = bundle.getmembers()
        if len(members) != len(FILES) + 1 or {m.name for m in members} != FILES | {'manifest.json'} or any(not m.isfile() for m in members):
            raise ValueError('Unexpected or duplicate recovery entries')
        manifest = json.load(bundle.extractfile('manifest.json'))
        if set(manifest) != FILES: raise ValueError('Incomplete recovery manifest')
        for name, expected in manifest.items():
            if not re.fullmatch('[a-f0-9]{64}', expected): raise ValueError('Invalid manifest digest')
            checksum = hashlib.sha256()
            with (work / name).open('wb') as output:
                source = bundle.extractfile(name)
                for chunk in iter(lambda: source.read(1048576), b''): checksum.update(chunk); output.write(chunk)
            if checksum.hexdigest() != expected: raise ValueError('Recovery manifest mismatch')
    metadata = json.loads((work / 'release.json').read_text())
    if metadata.get('database') not in ('fleetvera_rebuild_production', 'fleetvera_rebuild_staging') or not re.fullmatch('[a-f0-9]{40}', metadata.get('revision', '')) or not re.fullmatch('[a-z0-9]{20,40}', metadata.get('resource_uuid', '')) or metadata.get('snapshotConsistent') is not True or type(metadata.get('rehearsal')) is not bool:
        raise ValueError('Unexpected recovery release')
    return metadata

def restore(work, metadata):
    suffix = secrets.token_hex(8); prefix = 'fleetvera-recovery-' + suffix
    network, database, api = prefix + '-net', prefix + '-db', prefix + '-app'
    dbname = 'fleetvera_rebuild_restore_' + suffix
    images = json.loads((work / 'image-inspect.json').read_text())
    if set(images) != {'app', 'migrate', 'runtime-role', 'postgres'} or images['app']['Config'].get('Labels', {}).get('org.opencontainers.image.revision') != metadata['revision'] or 'RELEASE_SHA=' + metadata['revision'] not in images['app']['Config'].get('Env', []): raise ValueError('Archived runtime revision differs')
    require(['docker', 'image', 'load', '--input', str(work / 'images.tar')])
    for name, stored in images.items():
        actual = json.loads(require(['docker', 'image', 'inspect', stored['Id']]))[0]
        if actual['Config'] != stored['Config'] or actual['RootFS'] != stored['RootFS'] or actual['Architecture'] != stored['Architecture'] or actual['Os'] != stored['Os']:
            raise ValueError('Archived image differs after import')
    if images['app']['Config']['User'] != 'node': raise ValueError('Unprivileged restored runtime required')
    # Restore only application essentials; never provider variables, schedulers or URLs.
    owner, runtime = secrets.token_hex(32), secrets.token_hex(32)
    env = {'DATABASE_URL': f'postgres://fleetvera_runtime:{runtime}@{database}:5432/{dbname}', 'REBUILD_DATABASE_NAME': dbname, 'APP_ORIGIN': 'https://fleetvera-recovery.invalid', 'SETUP_TOKEN': secrets.token_hex(32), 'RELEASE_SHA': metadata['revision'], 'PORT': '3001'}
    (work / 'runtime.env').write_text('\n'.join(k + '=' + v for k, v in env.items()) + '\n')
    (work / 'postgres.env').write_text(f'POSTGRES_USER=fleetvera_owner\nPOSTGRES_DB={dbname}\nPOSTGRES_PASSWORD={owner}\n')
    created = []; connected = False
    def query(sql): return require(['docker', 'exec', '-i', database, 'psql', '-U', 'fleetvera_owner', '-d', dbname, '-At', '-v', 'ON_ERROR_STOP=1'], input=(sql + ';\n').encode()).decode().splitlines()
    def fingerprints():
        result = {}
        for row in query("SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1"):
            schema, table = row.split('.', 1); quote = lambda value: '"' + value.replace('"', '""') + '"'
            count, content = query("SELECT count(*),md5(coalesce(string_agg(row_json,chr(10) ORDER BY row_json COLLATE \"C\"),'')) FROM (SELECT row_to_json(t)::text AS row_json FROM " + quote(schema) + '.' + quote(table) + ' t) rows')[0].split('|')
            result[row] = {'count': count, 'content_md5': content}
        return result
    try:
        require(['docker', 'network', 'create', '--internal', network]); connected = True
        require(['docker', 'run', '-d', '--name', database, '--network', network, '--memory', '512m', '--tmpfs', '/var/lib/postgresql/data:rw,size=512m', '--env-file', str(work / 'postgres.env'), images['postgres']['Id']]); created.append(database)
        for _ in range(60):
            logs = subprocess.run(['docker', 'logs', database], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            ready = subprocess.run(['docker', 'exec', database, 'pg_isready', '-U', 'fleetvera_owner', '-d', dbname], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if b'PostgreSQL init process complete' in logs.stdout + logs.stderr and ready.returncode == 0: break
            time.sleep(.5)
        else: raise ValueError('Recovery database did not start')
        with (work / 'database.dump').open('rb') as dump: require(['docker', 'exec', '-i', database, 'pg_restore', '-U', 'fleetvera_owner', '-d', dbname, '--no-owner', '--no-acl', '--exit-on-error'], stdin=dump)
        expected = json.loads((work / 'database-fingerprints.json').read_text())
        if not expected or fingerprints() != expected: raise ValueError('Restored table content differs')
        sql = (work / 'runtime-role.sql').read_text()
        # Previous verified staging image used a literal dedicated staging name.
        if metadata['database'] == 'fleetvera_rebuild_staging': sql = sql.replace('fleetvera_rebuild_staging', dbname)
        require(['docker', 'exec', '-i', database, 'psql', '-U', 'fleetvera_owner', '-d', dbname, '-v', 'ON_ERROR_STOP=1', '-v', 'database_name=' + dbname, '-v', 'runtime_password=' + runtime], input=sql.encode())
        require(['docker', 'run', '-d', '--name', api, '--network', network, '--memory', '256m', '--env-file', str(work / 'runtime.env'), images['app']['Id']]); created.append(api)
        probe = r"""
import pg from 'pg';import assert from 'node:assert/strict';const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const role=(await pool.query('SELECT current_user,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.current_user,'fleetvera_runtime');for(const field of ['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls'])assert.equal(role[field],false);
for(const sql of ['CREATE TABLE public.qa_denied(id integer)','DELETE FROM public.fleetvera_rebuild_migrations','DELETE FROM fleetvera_rebuild.audit_events','UPDATE fleetvera_rebuild.audit_events SET action=action'])await assert.rejects(pool.query(sql),e=>e.code==='42501');
let response;for(let i=0;i<60;i++){try{response=await fetch('http://127.0.0.1:3001/api/health/ready');if(response.ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}assert.equal(response.status,200);const health=await response.json();assert.equal(health.database,'ok');assert.equal(health.revision,process.env.RELEASE_SHA);assert.equal((await fetch('http://127.0.0.1:3001/api/me')).status,401);await pool.end();console.log('verified');
"""
        require(['docker', 'exec', api, 'node', '--input-type=module', '-e', probe])
        if fingerprints() != expected: raise ValueError('Runtime recovery probe changed data')
        return {'tables': len(expected), 'nonemptyTables': sum(int(row['count']) > 0 for row in expected.values()), 'contentRestoreVerified': True, 'runtimeRestoreVerified': True}
    finally:
        failed = False
        for name in reversed(created):
            result = subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.PIPE, stderr=subprocess.PIPE); failed |= result.returncode != 0
        if connected:
            result = subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.PIPE, stderr=subprocess.PIPE); failed |= result.returncode != 0
        if failed: raise RuntimeError('Recovery cleanup incomplete')

def create_backup(settings, sha, nonce, workflow, rehearsal=False):
    os.umask(0o077); configuration(settings, rehearsal)
    if os.geteuid() != 0 or not re.fullmatch('[a-f0-9]{40}', sha) or not re.fullmatch('[a-f0-9]{32}', nonce) or not re.fullmatch('[0-9]+', workflow): raise ValueError('Invalid root-owned recovery request')
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700); sealed(ROOT, True)
    uuid, dbname = settings['resource_uuid'], settings['database']
    ids = require(['docker', 'ps', '-aq', '--filter', 'name=' + uuid]).decode().split()
    if not ids: raise ValueError('Reviewed runtime absent')
    containers = json.loads(require(['docker', 'inspect', *ids])); services = {}
    for container in containers:
        service = container['Config']['Labels'].get('com.docker.compose.service')
        if service in services or service not in ('app', 'migrate', 'runtime-role', 'postgres') or container['Config']['Labels'].get('com.docker.compose.project') != uuid: raise ValueError('Ambiguous runtime')
        services[service] = container
        if any(container['HostConfig'].get('PortBindings', {}).values()): raise ValueError('Unexpected public host listener')
    if set(services) != {'app', 'migrate', 'runtime-role', 'postgres'}: raise ValueError('Incomplete runtime')
    app, db = services['app'], services['postgres']; env = dict(v.split('=', 1) for v in app['Config']['Env'])
    revision = env.get('RELEASE_SHA', '')
    if not re.fullmatch('[a-f0-9]{40}', revision) or env.get('REBUILD_DATABASE_NAME') != dbname or env.get('LOCAL_QA') or app['Mounts'] or app['State'].get('Health', {}).get('Status') != 'healthy' or db['State'].get('Health', {}).get('Status') != 'healthy': raise ValueError('Unsafe or unhealthy recovery source')
    completed_setup(services)
    url = urlparse(env.get('DATABASE_URL', '')); db_env = dict(v.split('=', 1) for v in db['Config']['Env'])
    if url.hostname != 'postgres' or url.username != 'fleetvera_runtime' or url.path != '/' + dbname or not re.fullmatch('[a-f0-9]{64}', url.password or '') or db_env.get('POSTGRES_DB') != dbname or db_env.get('POSTGRES_USER') != 'fleetvera_owner': raise ValueError('Dedicated database connection required')
    volumes = [mount for mount in db['Mounts'] if mount['Destination'] == '/var/lib/postgresql/data' and mount['Type'] == 'volume']
    if len(volumes) != 1: raise ValueError('Dedicated persistent database volume required')
    all_ids = require(['docker', 'ps', '-aq']).decode().split()
    others = json.loads(require(['docker', 'inspect', *all_ids]))
    if any(other['Id'] != db['Id'] and any(mount.get('Name') == volumes[0]['Name'] for mount in other['Mounts']) for other in others): raise ValueError('Shared database volume rejected')
    images = {name: json.loads(require(['docker', 'image', 'inspect', services[name]['Image']]))[0] for name in ('app', 'migrate', 'runtime-role', 'postgres')}
    if any(images[name]['Config'].get('Labels', {}).get('org.opencontainers.image.revision') != revision or images[name]['Config']['User'] != 'node' for name in ('app', 'migrate')): raise ValueError('Release image mismatch')
    if not rehearsal and services['migrate']['Image'] != app['Image']: raise ValueError('Migration image differs from checked runtime')
    if not rehearsal and images['runtime-role']['Config'].get('Labels', {}).get('org.opencontainers.image.revision') != revision: raise ValueError('Role-init release differs')
    with (ROOT / '.fleetvera-backup.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        archive = ROOT / f'fleetvera-{"staging" if rehearsal else "production"}-full-{stamp}.tar.gz.age'
        if archive.exists(): raise ValueError('Archive collision; refusing overwrite')
        with tempfile.TemporaryDirectory(prefix='.fleetvera-ci-', dir=ROOT) as directory:
            work = Path(directory)
            snapshot = subprocess.Popen(['docker', 'exec', '-i', app['Id'], 'node', '--input-type=module', '-e', SNAPSHOT], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                proof = json.loads(snapshot.stdout.readline()); fingerprints = proof['fingerprints']
                if not fingerprints or not re.fullmatch('[0-9A-Fa-f-]+', proof['snapshot']): raise ValueError('Snapshot unavailable')
                with (work / 'database.dump').open('wb') as dump: require(['docker', 'exec', db['Id'], 'pg_dump', '-U', 'fleetvera_owner', '-d', dbname, '--snapshot=' + proof['snapshot'], '--format=custom', '--no-owner', '--no-acl'], stdout=dump)
                (work / 'database-fingerprints.json').write_text(json.dumps(fingerprints, sort_keys=True))
            finally:
                snapshot.stdin.close()
                try: code = snapshot.wait(timeout=30)
                except subprocess.TimeoutExpired: snapshot.kill(); snapshot.wait(); raise RuntimeError('Snapshot cleanup failed')
                if code != 0: raise RuntimeError('Snapshot export failed')
            (work / 'runtime-inspect.json').write_text(json.dumps(containers)); (work / 'image-inspect.json').write_text(json.dumps(images))
            deployment = Path('/data/coolify/applications') / uuid
            for original, destination in [('docker-compose.yaml', 'deployment-compose.yml'), ('.env', 'deployment.env')]:
                source = deployment / original
                if source.is_symlink() or not source.is_file(): raise ValueError('Unreviewed deployment path')
                (work / destination).write_bytes(source.read_bytes())
            require(['docker', 'cp', services['runtime-role']['Id'] + ':/runtime-role.sql', str(work / 'runtime-role.sql')])
            require(['docker', 'image', 'save', '--output', str(work / 'images.tar'), *dict.fromkeys(image['Id'] for image in images.values())])
            (work / 'release.json').write_text(json.dumps({'resource_uuid': uuid, 'database': dbname, 'revision': revision, 'snapshotConsistent': True, 'rehearsal': rehearsal}))
            manifest = {name: digest(work / name) for name in FILES}; (work / 'manifest.json').write_text(json.dumps(manifest))
            with tarfile.open(work / 'capture.tar.gz', 'w:gz', compresslevel=6) as bundle:
                for name in sorted(FILES | {'manifest.json'}): bundle.add(work / name, arcname=name)
            require(['age', '--encrypt', '--recipients-file', RECIPIENTS, '-o', str(archive), str(work / 'capture.tar.gz')])
            verified = work / 'verification'; verified.mkdir()
            metadata = unpack_verified(archive, verified)
            if metadata['database'] != dbname or metadata['revision'] != revision or metadata['resource_uuid'] != uuid: raise ValueError('Recovery source binding differs')
            recovered = restore(verified, metadata)
        result = {'status': 'ok', 'releaseSha': sha, 'nonce': nonce, 'workflowRunId': workflow, 'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'database': dbname, 'sourceRevision': revision, 'archive': str(archive), 'sha256': digest(archive), 'bytes': archive.stat().st_size, 'manifestVerified': True, **recovered, 'rehearsal': rehearsal}
        (archive.with_suffix(archive.suffix + '.proof.json')).write_text(json.dumps(result))
        return result

def main():
    os.umask(0o077)
    if os.geteuid() != 0: raise ValueError('Root-owned forced command required')
    action, args = parse_command(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    if action == 'backup':
        sealed(CONFIG); settings = configuration(json.loads(CONFIG.read_text()))
        print(json.dumps(create_backup(settings, *args)))
    else:
        archive = Path(args[0]); sealed(ROOT, True); sealed(archive)
        proof_file = archive.with_suffix(archive.suffix + '.proof.json'); sealed(proof_file); proof = json.loads(proof_file.read_text())
        if proof.get('database') != 'fleetvera_rebuild_production' or proof.get('rehearsal') is not False or proof.get('archive') != str(archive) or proof.get('manifestVerified') is not True or proof.get('contentRestoreVerified') is not True or proof.get('runtimeRestoreVerified') is not True or proof.get('sha256') != digest(archive) or proof.get('bytes') != archive.stat().st_size: raise ValueError('Unverified encrypted copy')
        os.execv('/usr/bin/scp', ['scp', '-f', str(archive)])

if __name__ == '__main__':
    try: main()
    except Exception: print('Fleetvera restricted recovery failed', file=sys.stderr); sys.exit(1)
