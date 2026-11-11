// Read-only, fail-closed preflight, run BEFORE demo migrations.
function evaluateDemoEnvironment(env) {
  const errors = []
  if (env.FLEETVERA_DEMO_MODE !== 'true') errors.push('FLEETVERA_DEMO_MODE must be true')
  if (env.FLEETVERA_RELEASE_MODE !== 'pilot') errors.push('FLEETVERA_RELEASE_MODE must be pilot')
  try {
    const db = new URL(env.DATABASE_URL)
    if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.pathname !== '/fleetvera_demo')
      errors.push('Dedicated fleetvera_demo database required')
  } catch {
    errors.push('Valid dedicated DATABASE_URL required')
  }
  try {
    const origin = new URL(env.NEXTAUTH_URL)
    if (
      origin.protocol !== 'https:' ||
      origin.pathname !== '/' ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash
    )
      errors.push('Canonical HTTPS demo origin required')
  } catch {
    errors.push('Canonical HTTPS demo origin required')
  }
  for (const key of ['JWT_SECRET', 'API_CURSOR_SECRET', 'EMAIL_CONFIG_ENCRYPTION_KEY', 'TOKEN_ENCRYPTION_KEY']) {
    if (!env[key] || env[key].trim().length < 32)
      errors.push(`${key} requires a fresh secret of at least 32 characters`)
  }
  try {
    const ring = JSON.parse(env.ACTION_PREVIEW_KEYS || '{}')
    if (
      !env.ACTION_PREVIEW_CURRENT_KID ||
      typeof ring[env.ACTION_PREVIEW_CURRENT_KID] !== 'string' ||
      ring[env.ACTION_PREVIEW_CURRENT_KID].length < 32
    )
      errors.push('Valid action preview key ring required')
  } catch {
    errors.push('Valid action preview key ring required')
  }
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'MAILGUN_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_MAPS_SERVER_API_KEY',
    'QUICKBOOKS_CLIENT_SECRET',
    'COOLIFY_REDEPLOY_WEBHOOK',
    'OPS_ALERT_EMAIL',
    'NEXT_PUBLIC_SENTRY_DSN',
  ]) {
    if (env[key]?.trim()) errors.push(`${key} must be absent from the demo`)
  }
  return { ready: errors.length === 0, errors }
}
if (require.main === module) {
  const result = evaluateDemoEnvironment(process.env)
  console.log(JSON.stringify(result))
  process.exitCode = result.ready ? 0 : 1
}
module.exports = { evaluateDemoEnvironment }
