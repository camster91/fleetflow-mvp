import { createMocks } from 'node-mocks-http'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'

const secret = 'c'.repeat(32)

describe('isAuthorizedCronRequest', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = secret
  })

  afterAll(() => {
    delete process.env.CRON_SECRET
  })

  it.each([
    { 'x-cron-secret': secret },
    { authorization: `Bearer ${secret}` },
    { authorization: `bearer ${secret}` },
  ])('accepts a supported authenticated scheduler header', (headers) => {
    const { req } = createMocks({ headers })
    expect(isAuthorizedCronRequest(req as never)).toBe(true)
  })

  it.each([
    {},
    { authorization: secret },
    { authorization: `Basic ${secret}` },
    { authorization: `Bearer ${secret} trailing` },
    { 'x-cron-secret': 'wrong' },
  ])('rejects missing, malformed, or incorrect credentials', (headers) => {
    const { req } = createMocks({ headers })
    expect(isAuthorizedCronRequest(req as never)).toBe(false)
  })

  it('fails closed when the configured secret is shorter than 32 characters', () => {
    process.env.CRON_SECRET = 'short'
    const { req } = createMocks({ headers: { 'x-cron-secret': 'short' } })
    expect(isAuthorizedCronRequest(req as never)).toBe(false)
  })
})
