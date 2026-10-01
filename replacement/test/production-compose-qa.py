"""Actual production Compose in an isolated, disposable project behind loopback TLS.

The up/restart/down phases support a browser on a separate computer over SSH.
The run phase orchestrates the same browser locally for GitHub Actions.
"""
import argparse
import json
import os
import pathlib
import re
import secrets
import shutil
import ssl
import subprocess
import tempfile
import time
import urllib.request

project = os.environ.get('FLEETVERA_QA_PROJECT', '')
if not re.fullmatch(r'fleetvera-tls-qa-[a-z0-9-]{8,50}', project):
    raise SystemExit('Unique disposable QA project required')
directory = pathlib.Path(tempfile.gettempdir()) / project
origin = 'https://127.0.0.1:19443'

def command(args, **kwargs):
    result = subprocess.run(args, capture_output=True, **kwargs)
    if result.returncode:
        raise RuntimeError('Disposable QA command failed: ' + args[0])
    return result.stdout

def compose(*args):
    return command(['docker', 'compose', '--project-name', project, '--env-file', str(directory / 'fixture.env'), '-f', str(directory / 'compose.json'), *args])

def readiness():
    # Certificate verification exception applies only to this disposable loopback URL.
    context = ssl._create_unverified_context()
    revision = (directory / 'revision').read_text()
    for _ in range(100):
        try:
            with urllib.request.urlopen(origin + '/api/health/ready', context=context, timeout=2) as response:
                proof = json.load(response)
                if proof['revision'] == revision and proof['status'] == 'ok':
                    return
        except Exception:
            pass
        time.sleep(.5)
    raise RuntimeError('Disposable TLS readiness failed')

def containers():
    ids = command(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]).decode().split()
    return json.loads(command(['docker', 'inspect', *ids])) if ids else []

def up():
    revision = os.environ.get('BROWSER_QA_REVISION', '')
    if not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise RuntimeError('Checked source revision required')
    images = {kind: os.environ.get('FLEETVERA_QA_' + kind.upper() + '_IMAGE', '') for kind in ['runtime', 'role']}
    for kind, image in images.items():
        inspected = json.loads(command(['docker', 'image', 'inspect', image]))[0]
        if inspected['Config']['Labels'].get('org.opencontainers.image.revision') != revision or inspected['Config']['User'] != ('node' if kind == 'runtime' else 'postgres'):
            raise RuntimeError('Checked image identity or user differs')
    if command(['docker', 'ps', '-aq', '--filter', 'label=com.docker.compose.project=' + project]).strip() or command(['docker', 'volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + project]).strip():
        raise RuntimeError('Disposable project already exists')
    directory.mkdir(mode=0o700)
    raw = json.loads(pathlib.Path(__file__).resolve().parents[2].joinpath('docker-compose.rebuild-production.json').read_text())
    if set(raw['services']) != {'postgres', 'migrate', 'runtime-role', 'app'} or any('ports' in service or 'build' in service for service in raw['services'].values()):
        raise RuntimeError('Production Compose topology differs')
    raw['networks'] = {'default': {'internal': True}, 'tls-loopback': {}}
    raw['services']['tls-proxy'] = {
        'image': 'nginx:1.27-alpine', 'ports': ['127.0.0.1:19443:443'],
        'networks': ['default', 'tls-loopback'],
        'volumes': [str(directory / 'nginx.conf') + ':/etc/nginx/conf.d/default.conf:ro', str(directory / 'certificate.pem') + ':/qa/certificate.pem:ro', str(directory / 'certificate.key') + ':/qa/certificate.key:ro'],
        'depends_on': {'app': {'condition': 'service_healthy'}},
    }
    owner, runtime = secrets.token_hex(32), secrets.token_hex(32)
    values = {'POSTGRES_PASSWORD': owner, 'RUNTIME_DATABASE_PASSWORD': runtime,
              'DATABASE_OWNER_URL': f'postgres://fleetvera_owner:{owner}@postgres:5432/fleetvera_rebuild_production',
              'DATABASE_URL': f'postgres://fleetvera_runtime:{runtime}@postgres:5432/fleetvera_rebuild_production',
              'APP_ORIGIN': origin, 'SETUP_TOKEN': 'browser-qa-disposable-only-token-20261001',
              'FLEETVERA_RUNTIME_IMAGE': images['runtime'], 'FLEETVERA_ROLE_IMAGE': images['role']}
    (directory / 'fixture.env').write_text(''.join(key + '=' + value + '\n' for key, value in values.items()))
    (directory / 'fixture.env').chmod(0o600)
    (directory / 'revision').write_text(revision)
    (directory / 'compose.json').write_text(json.dumps(raw))
    (directory / 'nginx.conf').write_text('server { listen 443 ssl; ssl_certificate /qa/certificate.pem; ssl_certificate_key /qa/certificate.key; location / { proxy_pass http://app:3001; proxy_set_header Host $http_host; proxy_set_header X-Forwarded-Proto https; } }\n')
    command(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(directory / 'certificate.key'), '-out', str(directory / 'certificate.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'])
    (directory / 'certificate.key').chmod(0o600)
    compose('up', '-d', '--wait', '--wait-timeout', '120')
    readiness()
    current = containers()
    app = next(item for item in current if item['Config']['Labels']['com.docker.compose.service'] == 'app')
    if any(entry.startswith('LOCAL_QA=') for entry in app['Config']['Env']) or app['Config']['User'] != 'node':
        raise RuntimeError('Production cookie/runtime contract differs')
    for item in current:
        service = item['Config']['Labels']['com.docker.compose.service']
        bindings = item['HostConfig']['PortBindings'] or {}
        if service != 'tls-proxy' and any(bindings.values()):
            raise RuntimeError('Unexpected exposed production-template port')
        if service == 'tls-proxy' and bindings != {'443/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '19443'}]}:
            raise RuntimeError('TLS proxy must publish only its reviewed loopback port')
    print(json.dumps({'status': 'ready', 'project': project, 'revision': revision, 'productionComposeServices': 4, 'localQaOverride': False, 'selfSignedLoopbackTls': True, 'productionMutated': False}), flush=True)

def restart():
    before = next(item for item in containers() if item['Config']['Labels']['com.docker.compose.service'] == 'app')
    compose('restart', 'postgres')
    readiness()
    after = next(item for item in containers() if item['Config']['Labels']['com.docker.compose.service'] == 'app')
    if after['State']['StartedAt'] != before['State']['StartedAt'] or after['RestartCount'] != before['RestartCount']:
        raise RuntimeError('Idle database disconnect unexpectedly restarted app')
    compose('restart', 'app')
    readiness()
    print(json.dumps({'status': 'restarted', 'databaseDisconnectRecoveredWithoutAppRestart': True, 'explicitAppRestartHealthy': True, 'productionMutated': False}), flush=True)

def down():
    if directory.exists():
        compose('down', '--volumes', '--remove-orphans')
        if containers() or command(['docker', 'volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + project]).strip() or command(['docker', 'network', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + project]).strip():
            raise RuntimeError('Disposable resources still exist')
        shutil.rmtree(directory)
    elif containers() or command(['docker', 'volume', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + project]).strip() or command(['docker', 'network', 'ls', '-q', '--filter', 'label=com.docker.compose.project=' + project]).strip():
        raise RuntimeError('Disposable state directory missing while resources remain')
    print(json.dumps({'status': 'cleaned', 'project': project, 'productionMutated': False}), flush=True)

def run():
    if directory.exists() or containers():
        raise RuntimeError('Disposable project already exists; refusing to adopt or clean it')
    browser = None
    try:
        up()
        with tempfile.TemporaryDirectory(prefix=project + '-control-') as control:
            env = {**os.environ, 'BROWSER_QA_MODE': 'production-tls', 'BROWSER_QA_BASE': origin, 'BROWSER_QA_CONTROL_DIRECTORY': control}
            browser = subprocess.Popen(['node', str(pathlib.Path(__file__).with_name('browser-qa.cjs'))], env=env)
            marker = pathlib.Path(control) / 'browser-ready'
            for _ in range(360):
                if marker.exists():
                    break
                if browser.poll() is not None:
                    raise RuntimeError('TLS browser exited before restart handshake')
                time.sleep(.5)
            else:
                raise RuntimeError('TLS browser handshake timed out')
            restart()
            pathlib.Path(control).joinpath('restart-complete').write_text('ready')
            if browser.wait(timeout=120):
                raise RuntimeError('Production TLS browser failed')
    finally:
        if browser is not None and browser.poll() is None:
            browser.terminate()
            browser.wait(timeout=10)
        down()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('phase', choices=['up', 'restart', 'down', 'run'])
    args = parser.parse_args()
    try:
        globals()[args.phase]()
    except Exception as error:
        # Avoid echoing subprocess argv, environment, cookies or credential values.
        print(json.dumps({'status': 'failed', 'phase': args.phase, 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__}), flush=True)
        raise SystemExit(1)
