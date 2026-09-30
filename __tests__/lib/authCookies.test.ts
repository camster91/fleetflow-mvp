import { secureCookiesEnabled, sessionCookie } from '@/lib/authCookies'

describe('secureCookiesEnabled', () => {
  it.each([
    [{ NODE_ENV: 'production', NEXTAUTH_URL: 'https://fleet.example.com' }, true],
    [{ NODE_ENV: 'production', NEXTAUTH_URL: 'http://fleet.example.com' }, true],
    [{ NODE_ENV: 'production', NEXTAUTH_URL: undefined }, true],
    [{ NODE_ENV: 'production', NEXTAUTH_URL: 'not a url' }, true],
    [{ NODE_ENV: 'production', NEXTAUTH_URL: 'https://localhost:3000' }, true],
    [{ NODE_ENV: 'production', NEXTAUTH_URL: 'http://localhost:3000' }, false],
    [{ NODE_ENV: 'production', NEXTAUTH_URL: 'http://127.0.0.1:3116' }, false],
    [{ NODE_ENV: 'development', NEXTAUTH_URL: 'https://fleet.example.com' }, false],
  ])('%j → %s', (env, expected) => {
    expect(secureCookiesEnabled(env)).toBe(expected)
  })

  it('marks the session cookie Secure on an https production deployment', () => {
    const env = process.env as Record<string, string | undefined>
    const original = { NODE_ENV: env.NODE_ENV, NEXTAUTH_URL: env.NEXTAUTH_URL }
    try {
      Object.assign(env, { NODE_ENV: 'production', NEXTAUTH_URL: 'https://fleet.example.com' })
      expect(sessionCookie('t')).toMatch(/; Secure/)
      env.NEXTAUTH_URL = 'http://localhost:3000'
      expect(sessionCookie('t')).not.toMatch(/; Secure/)
    } finally {
      Object.assign(env, original)
    }
  })
})
