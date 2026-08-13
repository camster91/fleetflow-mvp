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

module.exports = { MIN_SECRET_LENGTH, parseArgs, validateSecret, artifactNames, restoreContainerName }
