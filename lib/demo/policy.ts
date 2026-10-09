export const DEMO_ROLES = ['OWNER', 'DISPATCHER', 'DRIVER', 'TECHNICIAN'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]
export const DEMO_DURATION_SECONDS = 4 * 60 * 60
export const DEMO_DISABLED_MESSAGE =
  'This action is protected in the demo. Explore with sample records; no real emails, payments or provider connections are sent.'

export function demoEnabled(env: Record<string, string | undefined> = process.env) {
  return env.FLEETVERA_DEMO_MODE === 'true'
}

/** Fail closed before login, startup migrations, or demo data creation. */
export function assertDemoEnvironment(env: Record<string, string | undefined> = process.env) {
  if (!demoEnabled(env)) throw new Error('Demo mode is disabled')
  const url = new URL(env.DATABASE_URL || '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/fleetvera_demo')
    throw new Error('Demo requires its dedicated fleetvera_demo database')
  if (env.FLEETVERA_RELEASE_MODE !== 'pilot') throw new Error('Demo requires pilot release mode')
  for (const key of [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'MAILGUN_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_MAPS_SERVER_API_KEY',
    'QUICKBOOKS_CLIENT_SECRET',
    'COOLIFY_REDEPLOY_WEBHOOK',
    'OPS_ALERT_EMAIL',
  ]) {
    if (env[key]?.trim()) throw new Error(`Demo cannot configure ${key}`)
  }
}

const READ_ROUTES = [
  /^\/api\/(health(?:\/ready)?|auth\/me|demo\/status|drivers|search|docs)$/,
  /^\/api\/(vehicles|deliveries|maintenance|clients|sop|vending-machines|announcements)(?:\/[^/]+)?(?:\/(details|events))?$/,
  /^\/api\/(activity\/index|activity|dashboard\/context|analytics\/(dashboard|reports)|reports\/(fleet|deliveries|maintenance|export))$/,
  /^\/api\/(intelligence\/(brief|findings|data-quality)|assistant\/(entities|sources\/maintenance-cost))$/,
  /^\/api\/(team|team\/workspaces|settings\/(workspace|profile|notifications)|notifications|subscription\/(status|invoices|entitlement)|stripe\/availability)$/,
  /^\/api\/integrations(?:\/records)?$/,
  /^\/api\/documents\/(upload|[^/]+\/extract)$/,
  /^\/api\/task\/[^/]+$/,
]
const WRITE_ROUTES = [
  /^\/api\/demo\/(start|reset|role)$/,
  /^\/api\/auth\/(logout|refresh)$/,
  /^\/api\/(vehicles|deliveries|maintenance|clients|sop|vending-machines|announcements)(?:\/[^/]+)?(?:\/(status|events|share))?$/,
  /^\/api\/(team\/workspaces|settings\/(workspace|profile|notifications)|notifications)$/,
  /^\/api\/(assistant\/(query|actions\/execute)|intelligence\/(brief|findings|maintenance-risk-feedback)|pilot\/events)$/,
  /^\/api\/task\/[^/]+$/,
]

/** New API endpoints are denied in the public demo until explicitly reviewed. */
export function demoRouteAllowed(path: string, method: string) {
  const clean = path.replace(/\/$/, '')
  if (method === 'GET' || method === 'HEAD') return READ_ROUTES.some((rule) => rule.test(clean))
  return ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && WRITE_ROUTES.some((rule) => rule.test(clean))
}
