/**
 * Operations alerts: emails the address set in /admin/settings (OPS_ALERT_EMAIL) when a scheduled job
 * fails or a server request throws. Alerts carry only route templates, job names and error class
 * names — never request bodies, error messages, customer data or secrets — and each distinct problem
 * is emailed at most once every 30 minutes per server process.
 */
import type { NextApiHandler } from 'next'

export const ALERT_THROTTLE_MS = 30 * 60_000
const MAX_TRACKED_KEYS = 500

export type AlertResult = 'sent' | 'throttled' | 'unconfigured' | 'failed'

// Shared through globalThis: Next bundles instrumentation and each API route separately.
const globalState = globalThis as typeof globalThis & { __fleetveraOpsAlerts?: Map<string, number> }

function lastSent(): Map<string, number> {
  globalState.__fleetveraOpsAlerts ??= new Map()
  return globalState.__fleetveraOpsAlerts
}

export function resetOpsAlertThrottle(): void {
  lastSent().clear()
}

/** A class name or Prisma error code, never the message (it can contain customer data). */
export function errorLabel(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined
  if (typeof code === 'string' && /^P\d{4}$/.test(code)) return `Prisma ${code}`
  const name = error instanceof Error ? error.name : ''
  return /^[A-Za-z][A-Za-z0-9_]{0,59}$/.test(name) ? name : 'Error'
}

export async function notifyOps(
  key: string,
  title: string,
  facts: Array<[string, string]>,
  { force = false, now = Date.now() }: { force?: boolean; now?: number } = {}
): Promise<AlertResult> {
  const to = process.env.OPS_ALERT_EMAIL?.trim()
  if (!to) return 'unconfigured'
  const sent = lastSent()
  const previous = sent.get(key)
  if (!force && previous !== undefined && now - previous < ALERT_THROTTLE_MS) return 'throttled'
  // Reserve the slot before sending so concurrent failures produce one email.
  sent.delete(key)
  sent.set(key, now)
  while (sent.size > MAX_TRACKED_KEYS) sent.delete(sent.keys().next().value as string)
  try {
    const [{ sendOpsAlertEmail }, { awaitEmailDeliveryWithinTimeout }] = await Promise.all([
      import('@/lib/email'),
      import('@/lib/authResponseTiming'),
    ])
    const delivery = await awaitEmailDeliveryWithinTimeout(
      sendOpsAlertEmail(to, title, [...facts, ['Time (UTC)', new Date(now).toISOString()]]),
      // An unref'd timer: a pending timeout must not keep the process (or a test worker) alive.
      { timeoutMs: 10_000, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref()) }
    )
    return delivery.status === 'delivered' && delivery.value.success ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Wrap a cron handler so a thrown error or a 5xx response emails the alert address. */
export function withCronAlerts(job: string, handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      await notifyOps(`cron:${job}`, `Scheduled job ${job} failed`, [
        ['Job', job],
        ['Error', errorLabel(error)],
      ])
      throw error
    }
    if (res.statusCode >= 500)
      await notifyOps(`cron:${job}`, `Scheduled job ${job} failed`, [
        ['Job', job],
        ['HTTP status', String(res.statusCode)],
      ])
  }
}

/** Next.js onRequestError context (instrumentation.ts); only the route template is used, never the URL. */
export interface RequestErrorContext {
  routePath?: string
  routeType?: string
}

export async function reportRequestError(
  error: unknown,
  request: { method?: string },
  context: RequestErrorContext
): Promise<AlertResult> {
  const route = typeof context.routePath === 'string' ? context.routePath.slice(0, 200) : 'unknown route'
  const method = /^[A-Z]{3,7}$/.test(request.method ?? '') ? (request.method as string) : 'unknown'
  const label = errorLabel(error)
  return notifyOps(`request:${method}:${route}:${label}`, `Server error on ${route}`, [
    ['Route', route],
    ['Method', method],
    ['Kind', typeof context.routeType === 'string' ? context.routeType.slice(0, 40) : 'unknown'],
    ['Error', label],
  ])
}
