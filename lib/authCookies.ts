import { serialize } from 'cookie'

export const SESSION_COOKIE_NAME = 'token'
export const TWO_FACTOR_COOKIE_NAME = 'two_factor_challenge'
export const TEAM_COOKIE_NAME = 'fleetflow_team'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Cookies are Secure in production, except when the app itself is configured to run on a plain-http
 * loopback origin (the local production build the E2E suite drives). Browsers such as WebKit drop Secure
 * cookies on http://localhost. A real deployment always has a canonical https NEXTAUTH_URL (enforced by
 * the readiness preflight), so this never relaxes it.
 */
export function secureCookiesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== 'production') return false
  try {
    const url = new URL(env.NEXTAUTH_URL?.trim() || '')
    return !(url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  } catch {
    return true
  }
}

const baseOptions = () => ({
  httpOnly: true,
  secure: secureCookiesEnabled(),
  sameSite: 'lax' as const,
  path: '/',
})

export function sessionCookie(token: string) {
  return serialize(SESSION_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: 7 * 24 * 60 * 60,
  })
}

export function twoFactorChallengeCookie(token: string) {
  return serialize(TWO_FACTOR_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: 5 * 60,
  })
}

export function expiredCookie(name: string) {
  return serialize(name, '', { ...baseOptions(), maxAge: 0 })
}

export function clearAuthenticationCookies() {
  return [expiredCookie(SESSION_COOKIE_NAME), expiredCookie(TWO_FACTOR_COOKIE_NAME), expiredCookie(TEAM_COOKIE_NAME)]
}

export function beginTwoFactorCookies(challenge: string) {
  return [twoFactorChallengeCookie(challenge), expiredCookie(SESSION_COOKIE_NAME), expiredCookie(TEAM_COOKIE_NAME)]
}

export function establishSessionCookies(token: string) {
  return [sessionCookie(token), expiredCookie(TWO_FACTOR_COOKIE_NAME), expiredCookie(TEAM_COOKIE_NAME)]
}

/** Selects the active team workspace (see /api/team/workspaces). */
export function teamCookie(teamId: string) {
  return serialize(TEAM_COOKIE_NAME, teamId, { ...baseOptions(), maxAge: 365 * 24 * 60 * 60 })
}
