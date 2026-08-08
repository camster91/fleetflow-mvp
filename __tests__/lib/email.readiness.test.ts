import { validateEmailReadiness } from '@/lib/email'

const readyEnv = {
  NODE_ENV: 'production',
  MAILGUN_API_KEY: 'key',
  MAILGUN_DOMAIN: 'mg.example.com',
  MAILGUN_VERIFIED_DOMAIN: 'mg.example.com',
  FROM_EMAIL: 'Fleetvera <notify@mg.example.com>',
  NEXTAUTH_URL: 'https://fleet.example.com',
} as NodeJS.ProcessEnv

it('accepts a complete acknowledged production configuration', () => {
  expect(validateEmailReadiness(readyEnv)).toEqual({ ready: true, errors: [] })
})

it('requires HTTPS and a sender on the acknowledged sending domain', () => {
  const result = validateEmailReadiness({
    ...readyEnv,
    FROM_EMAIL: 'Fleetvera <notify@example.net>',
    NEXTAUTH_URL: 'http://fleet.example.com',
  })
  expect(result.ready).toBe(false)
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.stringContaining('sending domain'), expect.stringContaining('HTTPS'),
  ]))
})

it('reports every missing readiness input without throwing', () => {
  const result = validateEmailReadiness({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)
  expect(result.ready).toBe(false)
  expect(result.errors).toHaveLength(5)
})
