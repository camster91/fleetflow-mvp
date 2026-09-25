#!/usr/bin/env node
/*
 * Runs only on a trusted operations host. It never restores into the source
 * database: a fresh, unported disposable PostgreSQL container is used.
 * The passphrase is consumed by OpenSSL from the environment and is never
 * logged, written to metadata, or placed on a command line.
 */
const { spawn, spawnSync } = require('child_process')
const {
  createReadStream,
  createWriteStream,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} = require('fs')
const { createHash, randomBytes } = require('crypto')
const path = require('path')
const {
  REQUIRED_RESTORE_TABLES,
  parseArgs,
  validateSecret,
  artifactNames,
  restoreContainerName,
  restoreReadinessArgs,
  validateRestoreSummary,
  validateRestoreParity,
} = require('./backup-restore-lib.cjs')

function fail(message) {
  throw new Error(message)
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.status !== 0)
    fail(`${command} failed: ${(result.stderr || result.stdout || '').trim() || 'unknown error'}`)
  return (result.stdout || '').trim()
}
function waitForPostgres(container) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync('docker', restoreReadinessArgs(container), { encoding: 'utf8' })
    if (result.status === 0 && result.stdout.trim() === '1') return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  }
  fail('Disposable restore database did not become queryable')
}
function pipeDumpToEncryptedBackup(sourceContainer, backupPath) {
  const dump = spawn('docker', [
    'exec',
    sourceContainer,
    'sh',
    '-ec',
    'pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"',
  ])
  const encrypt = spawn(
    'openssl',
    ['enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '210000', '-pass', 'env:FLEETVERA_BACKUP_ENCRYPTION_KEY'],
    { env: process.env }
  )
  const output = createWriteStream(backupPath, { mode: 0o600 })
  dump.stdout.pipe(encrypt.stdin)
  encrypt.stdout.pipe(output)
  let errors = ''
  dump.stderr.on('data', (chunk) => {
    errors += chunk
  })
  encrypt.stderr.on('data', (chunk) => {
    errors += chunk
  })
  return new Promise((resolve, reject) => {
    let completed = 0
    const done = () => {
      completed += 1
      if (completed === 3) errors ? reject(new Error(errors.trim())) : resolve()
    }
    dump.on('error', reject)
    encrypt.on('error', reject)
    output.on('error', reject)
    dump.on('close', (code) => {
      if (code) errors ||= 'pg_dump failed'
      done()
    })
    encrypt.on('close', (code) => {
      if (code) errors ||= 'backup encryption failed'
      done()
    })
    output.on('close', done)
  })
}
function restoreEncryptedBackup(container, backupPath) {
  const input = createReadStream(backupPath)
  const decrypt = spawn(
    'openssl',
    ['enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '210000', '-pass', 'env:FLEETVERA_BACKUP_ENCRYPTION_KEY'],
    { env: process.env }
  )
  const restore = spawn('docker', [
    'exec',
    '-i',
    container,
    'pg_restore',
    '-U',
    'restore',
    '-d',
    'restore',
    '--no-owner',
    '--no-privileges',
  ])
  input.pipe(decrypt.stdin)
  decrypt.stdout.pipe(restore.stdin)
  let errors = ''
  decrypt.stderr.on('data', (chunk) => {
    errors += chunk
  })
  restore.stderr.on('data', (chunk) => {
    errors += chunk
  })
  return new Promise((resolve, reject) => {
    let completed = 0
    const done = () => {
      completed += 1
      if (completed === 2) errors ? reject(new Error(errors.trim())) : resolve()
    }
    input.on('error', reject)
    decrypt.on('error', reject)
    restore.on('error', reject)
    decrypt.on('close', (code) => {
      if (code) errors ||= 'backup decryption failed'
      done()
    })
    restore.on('close', (code) => {
      if (code) errors ||= 'pg_restore failed'
      done()
    })
  })
}
function queryDatabase(container, sql, source) {
  return run('docker', [
    'exec',
    '-e',
    `FLEETVERA_VERIFY_SQL=${sql}`,
    container,
    'sh',
    '-ec',
    source
      ? 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -c "$FLEETVERA_VERIFY_SQL"'
      : 'psql -v ON_ERROR_STOP=1 -U restore -d restore -At -c "$FLEETVERA_VERIFY_SQL"',
  ])
}
function countDatabase(container, sql, source) {
  const value = Number(queryDatabase(container, sql, source))
  if (!Number.isInteger(value) || value < 0) fail('Database check returned an invalid count')
  return value
}
function databaseSummary(container, source) {
  const criticalRowCounts = {}
  for (const table of REQUIRED_RESTORE_TABLES) {
    criticalRowCounts[table] = countDatabase(container, `SELECT count(*) FROM "${table}"`, source)
  }
  const summary = {
    publicTableCount: countDatabase(
      container,
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'",
      source
    ),
    criticalRowCounts,
    migrations: {
      applied: countDatabase(
        container,
        'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
        source
      ),
      failed: countDatabase(
        container,
        'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL',
        source
      ),
    },
    integrity: {
      orphanedTeamOwners: countDatabase(
        container,
        'SELECT count(*) FROM "Team" t LEFT JOIN "User" u ON u.id = t."ownerId" WHERE u.id IS NULL',
        source
      ),
      orphanedTeamMembers: countDatabase(
        container,
        'SELECT count(*) FROM "TeamMember" m LEFT JOIN "Team" t ON t.id = m."teamId" WHERE t.id IS NULL',
        source
      ),
      orphanedMemberUsers: countDatabase(
        container,
        'SELECT count(*) FROM "TeamMember" m LEFT JOIN "User" u ON u.id = m."userId" WHERE m."userId" IS NOT NULL AND u.id IS NULL',
        source
      ),
      noncanonicalOwnerMemberships: countDatabase(
        container,
        `SELECT count(*) FROM "TeamMember" m JOIN "Team" t ON t.id = m."teamId" WHERE m.role = 'OWNER' AND (m."userId" IS NULL OR m."userId" <> t."ownerId")`,
        source
      ),
    },
  }
  const errors = validateRestoreSummary(summary, { requireApplicationUser: false })
  if (errors.length) fail(errors.join('; '))
  return summary
}
async function main() {
  const { sourceContainer, backupDir } = parseArgs(process.argv.slice(2))
  validateSecret(process.env.FLEETVERA_BACKUP_ENCRYPTION_KEY)
  run('docker', ['inspect', sourceContainer])
  mkdirSync(backupDir, { recursive: true, mode: 0o700 })
  const { baseName, metadataName } = artifactNames()
  const finalPath = path.join(backupDir, baseName)
  const partialPath = `${finalPath}.part`
  const restore = restoreContainerName()
  const restorePassword = randomBytes(32).toString('base64url')
  const startedAt = new Date().toISOString()
  try {
    const source = databaseSummary(sourceContainer, true)
    await pipeDumpToEncryptedBackup(sourceContainer, partialPath)
    const container = run('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      restore,
      '-e',
      'POSTGRES_USER=restore',
      '-e',
      `POSTGRES_PASSWORD=${restorePassword}`,
      '-e',
      'POSTGRES_DB=restore',
      'postgres:16-alpine',
    ])
    if (!container) fail('Could not create disposable restore database')
    waitForPostgres(restore)
    await restoreEncryptedBackup(restore, partialPath)
    const restored = databaseSummary(restore, false)
    const parityErrors = validateRestoreParity(source, restored)
    if (parityErrors.length) fail(parityErrors.join('; '))
    renameSync(partialPath, finalPath)
    const digest = createHash('sha256').update(require('fs').readFileSync(finalPath)).digest('hex')
    const metadata = {
      createdAt: startedAt,
      sourceContainer,
      artifact: baseName,
      encryption: 'AES-256-CBC PBKDF2-SHA256 210000 iterations',
      sha256: digest,
      bytes: statSync(finalPath).size,
      source,
      restore: restored,
    }
    writeFileSync(path.join(backupDir, metadataName), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 })
    process.stdout.write(
      `${JSON.stringify({ verified: true, artifact: baseName, sha256: digest, source, restore: restored })}\n`
    )
  } finally {
    spawnSync('docker', ['rm', '-f', restore], { stdio: 'ignore' })
    try {
      unlinkSync(partialPath)
    } catch {
      /* no partial artifact */
    }
  }
}
main().catch((error) => {
  process.stderr.write(
    `Backup/restore verification failed: ${error instanceof Error ? error.message : 'unknown error'}\n`
  )
  process.exitCode = 1
})
