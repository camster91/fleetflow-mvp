/**
 * A post-login destination taken from the query string. Only same-site paths are allowed, so a
 * crafted link can never send a freshly signed-in user to another site or run a javascript: URL.
 */
export function safeCallbackPath(raw: unknown, fallback = '/dashboard'): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback
  try {
    const base = 'https://fleetvera.invalid'
    const url = new URL(raw, base)
    if (url.origin !== base) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
