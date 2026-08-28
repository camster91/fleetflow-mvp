import { serialize } from 'cookie'

export const SESSION_COOKIE_NAME = 'token'
export const TWO_FACTOR_COOKIE_NAME = 'two_factor_challenge'
export const TEAM_COOKIE_NAME = 'fleetflow_team'

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function sessionCookie(token: string) {
  return serialize(SESSION_COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60,
  })
}

export function twoFactorChallengeCookie(token: string) {
  return serialize(TWO_FACTOR_COOKIE_NAME, token, {
    ...BASE_OPTIONS,
    maxAge: 5 * 60,
  })
}

export function expiredCookie(name: string) {
  return serialize(name, '', { ...BASE_OPTIONS, maxAge: 0 })
}

export function clearAuthenticationCookies() {
  return [
    expiredCookie(SESSION_COOKIE_NAME),
    expiredCookie(TWO_FACTOR_COOKIE_NAME),
    expiredCookie(TEAM_COOKIE_NAME),
  ]
}

export function beginTwoFactorCookies(challenge: string) {
  return [
    twoFactorChallengeCookie(challenge),
    expiredCookie(SESSION_COOKIE_NAME),
    expiredCookie(TEAM_COOKIE_NAME),
  ]
}

export function establishSessionCookies(token: string) {
  return [
    sessionCookie(token),
    expiredCookie(TWO_FACTOR_COOKIE_NAME),
    expiredCookie(TEAM_COOKIE_NAME),
  ]
}
