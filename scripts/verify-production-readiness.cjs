/*
 * Read-only deployment preflight. It never prints values or changes state.
 * Run it in the exact production environment, not with .env.example.
 */
const REQUIRED_CORE = ['DATABASE_URL', 'JWT_SECRET', 'NEXTAUTH_URL', 'API_CURSOR_SECRET', 'ACTION_PREVIEW_KEYS', 'ACTION_PREVIEW_CURRENT_KID', 'CRON_SECRET']
const REQUIRED_EMAIL = ['EMAIL_CONFIG_ENCRYPTION_KEY']
const REQUIRED_BILLING = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET']

function present(env, name) { return typeof env[name] === 'string' && env[name].trim().length > 0 }
function secretAtLeast(env, name, size = 32) { return present(env, name) && env[name].trim().length >= size }

function keyRingIsValid(env) {
  if (!present(env, 'ACTION_PREVIEW_KEYS') || !present(env, 'ACTION_PREVIEW_CURRENT_KID')) return false
  try {
    const keys = JSON.parse(env.ACTION_PREVIEW_KEYS)
    const ids = Object.keys(keys)
    return ids.length >= 1 && ids.length <= 3 && ids.includes(env.ACTION_PREVIEW_CURRENT_KID) && ids.every(id => typeof keys[id] === 'string' && keys[id].length >= 32)
  } catch { return false }
}

function integrationRingIsValid(env) {
  if (!present(env, 'INTEGRATION_ENCRYPTION_KEYS')) return false
  return env.INTEGRATION_ENCRYPTION_KEYS.split(',').every(entry => {
    const [id, base64] = entry.trim().split(':')
    try { return Boolean(id) && Buffer.from(base64 || '', 'base64').length === 32 } catch { return false }
  })
}

function evaluateEnvironment(env, mode = 'pilot') {
  const missing = []
  for (const name of REQUIRED_CORE) if (!present(env, name)) missing.push(name)
  if (!/^https:\/\//.test(env.NEXTAUTH_URL || '')) missing.push('NEXTAUTH_URL must use https')
  for (const name of ['JWT_SECRET', 'API_CURSOR_SECRET', 'CRON_SECRET']) if (present(env, name) && !secretAtLeast(env, name)) missing.push(`${name} must be at least 32 characters`)
  if (!keyRingIsValid(env)) missing.push('ACTION_PREVIEW_KEYS/ACTION_PREVIEW_CURRENT_KID must be a valid 1-3 key ring')
  for (const name of REQUIRED_EMAIL) if (!secretAtLeast(env, name)) missing.push(`${name} must be at least 32 characters`)

  if (mode === 'public') for (const name of REQUIRED_BILLING) if (!present(env, name)) missing.push(name)
  if (!['pilot', 'public'].includes(mode)) missing.push('FLEETVERA_RELEASE_MODE must be pilot or public')

  const warnings = []
  if (env.AI_PROVIDER && env.AI_PROVIDER !== 'disabled' && !secretAtLeast(env, 'OPENAI_API_KEY')) warnings.push('AI is enabled without a configured provider key')
  if (env.DOCUMENT_SCANNER_PROVIDER && env.DOCUMENT_SCANNER_PROVIDER !== 'disabled' && !secretAtLeast(env, 'DOCUMENT_STORAGE_SECRET')) warnings.push('Document scanner is enabled without durable private storage encryption')
  if (env.GOOGLE_MAPS_SERVER_API_KEY || env.QUICKBOOKS_CLIENT_ID) {
    if (!integrationRingIsValid(env)) missing.push('INTEGRATION_ENCRYPTION_KEYS must contain AES-256-GCM keys')
  }
  return { mode, ready: missing.length === 0, missing, warnings }
}

if (require.main === module) {
  const mode = process.env.FLEETVERA_RELEASE_MODE || 'pilot'
  const result = evaluateEnvironment(process.env, mode)
  console.log(JSON.stringify({ mode: result.mode, ready: result.ready, missing: result.missing, warnings: result.warnings }, null, 2))
  process.exitCode = result.ready ? 0 : 1
}

module.exports = { evaluateEnvironment }
