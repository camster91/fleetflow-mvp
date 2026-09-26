/*
 * Read-only deployment preflight. It never prints values or changes state.
 * Run it in the exact production environment, not with .env.example.
 */
const REQUIRED_CORE = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NEXTAUTH_URL',
  'API_CURSOR_SECRET',
  'ACTION_PREVIEW_KEYS',
  'ACTION_PREVIEW_CURRENT_KID',
  'CRON_SECRET',
]
const REQUIRED_EMAIL = ['EMAIL_CONFIG_ENCRYPTION_KEY']
// Encrypts TOTP 2FA seeds. Must be explicit so rotating JWT_SECRET cannot strand them.
const REQUIRED_ENCRYPTION = ['TOKEN_ENCRYPTION_KEY']
const REQUIRED_BILLING = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_YEARLY',
  'STRIPE_PRICE_MONTHLY_AMOUNT',
  'STRIPE_PRICE_YEARLY_AMOUNT',
  'STRIPE_PRICE_CURRENCY',
]
const REQUIRED_MONITORING = ['NEXT_PUBLIC_SENTRY_DSN']

function present(env, name) {
  return typeof env[name] === 'string' && env[name].trim().length > 0
}
function secretAtLeast(env, name, size = 32) {
  return present(env, name) && env[name].trim().length >= size
}
function validHttpsUrl(env, name) {
  if (!present(env, name)) return false
  try {
    return new URL(env[name]).protocol === 'https:'
  } catch {
    return false
  }
}
function canonicalAppUrlIsValid(env) {
  if (!present(env, 'NEXTAUTH_URL')) return false
  try {
    const url = new URL(env.NEXTAUTH_URL)
    return (
      url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash
    )
  } catch {
    return false
  }
}

function keyRingIsValid(env) {
  if (!present(env, 'ACTION_PREVIEW_KEYS') || !present(env, 'ACTION_PREVIEW_CURRENT_KID')) return false
  try {
    const keys = JSON.parse(env.ACTION_PREVIEW_KEYS)
    const ids = Object.keys(keys)
    return (
      ids.length >= 1 &&
      ids.length <= 3 &&
      ids.includes(env.ACTION_PREVIEW_CURRENT_KID) &&
      ids.every((id) => typeof keys[id] === 'string' && keys[id].length >= 32)
    )
  } catch {
    return false
  }
}

function billingConfigIsValid(env) {
  if (REQUIRED_BILLING.some((name) => !present(env, name))) return false
  const monthly = Number(env.STRIPE_PRICE_MONTHLY_AMOUNT)
  const yearly = Number(env.STRIPE_PRICE_YEARLY_AMOUNT)
  const currency = env.STRIPE_PRICE_CURRENCY.trim().toUpperCase()
  const currencies = new Set(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'])
  return (
    env.STRIPE_PRICE_MONTHLY.trim() !== env.STRIPE_PRICE_YEARLY.trim() &&
    Number.isSafeInteger(monthly) &&
    monthly >= 0 &&
    Number.isSafeInteger(yearly) &&
    yearly >= 0 &&
    currencies.has(currency)
  )
}

function integrationRingIsValid(env) {
  if (!present(env, 'INTEGRATION_ENCRYPTION_KEYS')) return false
  return env.INTEGRATION_ENCRYPTION_KEYS.split(',').every((entry) => {
    const [id, base64] = entry.trim().split(':')
    try {
      return Boolean(id) && Buffer.from(base64 || '', 'base64').length === 32
    } catch {
      return false
    }
  })
}

function evaluateEnvironment(env, mode = 'pilot') {
  const missing = []
  for (const name of REQUIRED_CORE) if (!present(env, name)) missing.push(name)
  if (!canonicalAppUrlIsValid(env)) missing.push('NEXTAUTH_URL must be a canonical https origin')
  for (const name of ['JWT_SECRET', 'API_CURSOR_SECRET', 'CRON_SECRET'])
    if (present(env, name) && !secretAtLeast(env, name)) missing.push(`${name} must be at least 32 characters`)
  if (!keyRingIsValid(env)) missing.push('ACTION_PREVIEW_KEYS/ACTION_PREVIEW_CURRENT_KID must be a valid 1-3 key ring')
  for (const name of REQUIRED_EMAIL)
    if (!secretAtLeast(env, name)) missing.push(`${name} must be at least 32 characters`)
  for (const name of REQUIRED_ENCRYPTION)
    if (!secretAtLeast(env, name))
      missing.push(
        `${name} must be at least 32 characters (set it to the current JWT_SECRET value first if 2FA users exist)`
      )
  for (const name of REQUIRED_MONITORING)
    if (!validHttpsUrl(env, name)) missing.push(`${name} must be a valid https URL`)

  if (mode === 'public') {
    for (const name of REQUIRED_BILLING) if (!present(env, name)) missing.push(name)
    if (REQUIRED_BILLING.every((name) => present(env, name)) && !billingConfigIsValid(env)) {
      missing.push('Stripe price IDs, integer minor-unit amounts, and currency must be valid')
    }
  }
  // Test-only mail capture (lib/emailCapture.ts) must never be configured on a deployment.
  if (present(env, 'E2E_EMAIL_CAPTURE_DIR'))
    missing.push('E2E_EMAIL_CAPTURE_DIR must not be set outside local end-to-end tests')
  if (!['pilot', 'public'].includes(mode)) missing.push('FLEETVERA_RELEASE_MODE must be pilot or public')
  // Plan enforcement (lib/entitlements.ts): beta workspaces keep full access until this date.
  if (present(env, 'FLEETVERA_BETA_ENDS_AT') && Number.isNaN(new Date(env.FLEETVERA_BETA_ENDS_AT).getTime()))
    missing.push('FLEETVERA_BETA_ENDS_AT must be an ISO 8601 date')

  const warnings = []
  if (env.AI_PROVIDER && env.AI_PROVIDER !== 'disabled' && !secretAtLeast(env, 'OPENAI_API_KEY'))
    warnings.push('AI is enabled without a configured provider key')
  if (
    env.DOCUMENT_SCANNER_PROVIDER &&
    env.DOCUMENT_SCANNER_PROVIDER !== 'disabled' &&
    !secretAtLeast(env, 'DOCUMENT_STORAGE_SECRET')
  )
    warnings.push('Document scanner is enabled without durable private storage encryption')
  if (env.GOOGLE_MAPS_SERVER_API_KEY || env.QUICKBOOKS_CLIENT_ID) {
    if (!integrationRingIsValid(env)) missing.push('INTEGRATION_ENCRYPTION_KEYS must contain AES-256-GCM keys')
  }
  if (mode === 'public' && !present(env, 'FLEETVERA_BETA_ENDS_AT'))
    warnings.push(
      'FLEETVERA_BETA_ENDS_AT is unset: workspaces older than the 14-day trial become read-only as soon as public mode starts'
    )
  return { mode, ready: missing.length === 0, missing, warnings }
}

if (require.main === module) {
  const mode = process.env.FLEETVERA_RELEASE_MODE || 'pilot'
  const result = evaluateEnvironment(process.env, mode)
  console.log(
    JSON.stringify(
      { mode: result.mode, ready: result.ready, missing: result.missing, warnings: result.warnings },
      null,
      2
    )
  )
  process.exitCode = result.ready ? 0 : 1
}

module.exports = { evaluateEnvironment }
