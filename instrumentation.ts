/**
 * Server start hook (Next.js). Loads Sentry for the Node.js server and keeps admin-entered platform
 * settings (/admin/settings) applied over the environment, refreshed every minute.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  await import('./sentry.server.config')
  const { refreshPlatformSettings, REFRESH_INTERVAL_MS } = await import('./lib/platformSettings')
  const refresh = () =>
    refreshPlatformSettings({ force: true }).catch(() =>
      console.warn('[platform-settings] Could not load admin settings; keeping current values')
    )
  await refresh()
  setInterval(refresh, REFRESH_INTERVAL_MS).unref()
}
