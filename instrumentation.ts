/**
 * Server start hook (Next.js). Loads Sentry for the Node.js server and keeps admin-entered platform
 * settings (/admin/settings) applied over the environment, refreshed every minute, and emails
 * request errors to the operations alert address.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.FLEETVERA_DEMO_MODE === 'true') {
    const { assertDemoEnvironment } = await import('./lib/demo/policy')
    assertDemoEnvironment()
    return
  }
  await import('./sentry.server.config')
  const { refreshPlatformSettings, REFRESH_INTERVAL_MS } = await import('./lib/platformSettings')
  const refresh = () =>
    refreshPlatformSettings({ force: true }).catch(() =>
      console.warn('[platform-settings] Could not load admin settings; keeping current values')
    )
  await refresh()
  setInterval(refresh, REFRESH_INTERVAL_MS).unref()
}

/** Emails the operations alert address (OPS_ALERT_EMAIL) when a server request throws; see lib/opsAlerts.ts. */
export async function onRequestError(
  error: unknown,
  request: { method?: string },
  context: { routePath?: string; routeType?: string }
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { reportRequestError } = await import('./lib/opsAlerts')
  await reportRequestError(error, request, context).catch(() => undefined)
}
