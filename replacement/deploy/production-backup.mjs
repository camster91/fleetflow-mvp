import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateBackupProof } from './coolify-release.mjs';

export function validateServerProof(proof, env, now = Date.now()) {
  if (proof?.rehearsal !== false || !/^[a-f0-9]{40}$/.test(proof?.sourceRevision || '')) throw new Error('Production recovery required');
  // The server proves recovery; only this client can prove the off-server copy.
  validateBackupProof({ ...proof, offServerCopyVerified: true }, env, now);
}
function command(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', value => { output += value; if (output.length > 65536) child.kill('SIGKILL'); });
    child.stderr.on('data', () => {});
    const timer = setTimeout(() => child.kill('SIGKILL'), 900000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('Recovery transport failed')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error('Recovery transport or remote verification failed')); });
  });
}
export async function verifyCopy(file, proof) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  if (bytes !== proof.bytes || hash.digest('hex') !== proof.sha256) throw new Error('Encrypted off-server copy differs');
}
export async function createBackup(env) {
  if (!/^[a-f0-9]{40}$/.test(env.RELEASE_SHA || '') || !/^\d+$/.test(env.GITHUB_RUN_ID || '') || !env.RUNNER_TEMP || !env.GITHUB_ENV || !env.FLEETVERA_BACKUP_SSH_KEY || !env.FLEETVERA_VPS_KNOWN_HOSTS) throw new Error('Missing restricted recovery configuration');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'fleetvera-backup-key-'));
  try {
    const key = path.join(temporary, 'key'), hosts = path.join(temporary, 'known_hosts');
    await fs.writeFile(key, env.FLEETVERA_BACKUP_SSH_KEY.replace(/\r\n/g, '\n').trim() + '\n', { mode: 0o600 });
    await fs.writeFile(hosts, env.FLEETVERA_VPS_KNOWN_HOSTS + '\n', { mode: 0o600 });
    const options = ['-i', key, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + hosts, '-o', 'ConnectTimeout=15'];
    const nonce = randomBytes(16).toString('hex'), request = { ...env, BACKUP_NONCE: nonce };
    const proof = JSON.parse(await command('ssh', [...options, 'root@187.77.26.99', `fleetvera-backup ${env.RELEASE_SHA} ${nonce} ${env.GITHUB_RUN_ID}`]));
    validateServerProof(proof, request);
    const directory = path.join(env.RUNNER_TEMP, 'fleetvera-release-backup');
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const copy = path.join(directory, path.basename(proof.archive));
    await command('scp', ['-O', ...options, 'root@187.77.26.99:' + proof.archive, copy]);
    await verifyCopy(copy, proof);
    await fs.writeFile(path.join(directory, 'proof.json'), JSON.stringify({ ...proof, offServerCopyVerified: true }), { mode: 0o600 });
    await fs.appendFile(env.GITHUB_ENV, 'BACKUP_NONCE=' + nonce + '\n');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) createBackup(process.env).then(() => console.log('Encrypted Fleetvera recovery copied and verified off-server')).catch(() => { console.error('Restricted Fleetvera recovery failed'); process.exitCode = 1; });
