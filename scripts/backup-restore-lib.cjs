const crypto = require('crypto')
const path = require('path')

const MIN_SECRET_LENGTH = 32
const SAFE_CONTAINER = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/

function parseArgs(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`)
    const key = argument.slice(2)
    const value = argv[index + 1]
    if (!key || !value || value.startsWith('--') || values[key]) throw new Error(`Invalid argument: ${argument}`)
    values[key] = value
    index += 1
  }
  if (!values['source-container'] || !values['backup-dir']) {
    throw new Error('Usage: --source-container <postgres-container> --backup-dir <absolute-directory>')
  }
  if (!path.isAbsolute(values['backup-dir'])) throw new Error('--backup-dir must be an absolute directory')
  if (!SAFE_CONTAINER.test(values['source-container'])) throw new Error('--source-container contains unsupported characters')
  return { sourceContainer: values['source-container'], backupDir: path.resolve(values['backup-dir']) }
}

function validateSecret(value) {
  if (typeof value !== 'string' || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`FLEETVERA_BACKUP_ENCRYPTION_KEY must be at least ${MIN_SECRET_LENGTH} characters`)
  }
}

function artifactNames(now = new Date()) {
  const stamp = now.toISOString().replace(/[-:.]/g, '').replace('T', 'T').replace('Z', 'Z')
  const nonce = crypto.randomBytes(6).toString('hex')
  const baseName = `fleetvera-postgres-${stamp}-${nonce}.dump.enc`
  return { baseName, metadataName: `${baseName}.json` }
}

function restoreContainerName() {
  return `fleetvera-restore-${crypto.randomBytes(8).toString('hex')}`
}

function restoreReadinessArgs(container) {
  if (!SAFE_CONTAINER.test(container)) throw new Error('restore container contains unsupported characters')
  return ['exec', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'restore', '-d', 'restore', '-At', '-c', 'SELECT 1']
}

const REQUIRED_RESTORE_TABLES = ['_prisma_migrations', 'User', 'Team', 'TeamMember', 'AuditLog', 'Subscription', 'Vehicle']

function validateRestoreSummary(summary, options = {}) {
  const requireApplicationUser = options.requireApplicationUser !== false
  const errors = []
  if (!summary || !Number.isInteger(summary.publicTableCount) || summary.publicTableCount < 1) {
    errors.push('Restore contains no public tables')
  }
  const counts = summary && summary.criticalRowCounts
  for (const table of REQUIRED_RESTORE_TABLES) {
    if (!counts || !Number.isInteger(counts[table]) || counts[table] < 0) {
      errors.push(`Restore is missing required table evidence: ${table}`)
    }
  }
  if (requireApplicationUser && (!counts || !Number.isInteger(counts.User) || counts.User < 1)) {
    errors.push('Restore contains no application users')
  }
  if (!summary?.migrations || !Number.isInteger(summary.migrations.applied) || summary.migrations.applied < 1) {
    errors.push('Restore contains no completed Prisma migrations')
  }
  if (!summary?.migrations || summary.migrations.failed !== 0) {
    errors.push('Restore contains failed or unfinished Prisma migrations')
  }
  const integrity = summary && summary.integrity
  for (const check of ['orphanedTeamOwners', 'orphanedTeamMembers', 'orphanedMemberUsers', 'noncanonicalOwnerMemberships']) {
    if (!integrity || integrity[check] !== 0) errors.push(`Restore integrity check failed: ${check}`)
  }
  return errors
}

function validateRestoreParity(source, restored) {
  const errors = []
  if (source?.publicTableCount !== restored?.publicTableCount) errors.push('Restore public-table count differs from source')
  for (const table of REQUIRED_RESTORE_TABLES) {
    if (source?.criticalRowCounts?.[table] !== restored?.criticalRowCounts?.[table]) {
      errors.push(`Restore row count differs from source: ${table}`)
    }
  }
  if (source?.migrations?.applied !== restored?.migrations?.applied) errors.push('Restore applied-migration count differs from source')
  if (source?.migrations?.failed !== restored?.migrations?.failed) errors.push('Restore failed-migration count differs from source')
  return errors
}

module.exports = { MIN_SECRET_LENGTH, REQUIRED_RESTORE_TABLES, parseArgs, validateSecret, artifactNames, restoreContainerName, restoreReadinessArgs, validateRestoreSummary, validateRestoreParity }
