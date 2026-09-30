import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  ...jest.requireActual('@/lib/apiAuth'),
  requireTenantContext: jest.fn(),
}))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({ prisma: { subscription: { findUnique: jest.fn() } } }))
jest.mock('@/lib/stripe', () => ({
  getBillingAvailability: jest.fn(),
  createCustomerPortalSession: jest.fn(),
}))

import handler from '@/pages/api/stripe/portal-session'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { createCustomerPortalSession, getBillingAvailability } from '@/lib/stripe'

const SAME_ORIGIN = { host: 'app.test', origin: 'http://app.test' }

function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'u1' } },
    tenant: { ownerId: 'owner', teamId: 'team-1', role },
  })
}

async function post(headers: Record<string, string> = SAME_ORIGIN, method = 'POST') {
  const { req, res } = createMocks({ method: method as never, headers })
  await handler(req as never, res as never)
  return res
}

describe('POST /api/stripe/portal-session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getBillingAvailability as jest.Mock).mockReturnValue({ available: true, canonicalUrl: 'https://fleet.test' })
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ stripeCustomerId: 'cus_1' })
    ;(createCustomerPortalSession as jest.Mock).mockResolvedValue({ url: 'https://billing.stripe.test/s' })
  })

  it('rejects other methods and cross-site requests', async () => {
    expect((await post(SAME_ORIGIN, 'GET'))._getStatusCode()).toBe(405)
    expect((await post({ host: 'app.test', origin: 'https://evil.test' }))._getStatusCode()).toBe(403)
    expect(createCustomerPortalSession).not.toHaveBeenCalled()
  })

  it.each(['MANAGER', 'DRIVER', 'VIEWER'])('forbids %s', async (role) => {
    asRole(role)
    expect((await post())._getStatusCode()).toBe(403)
    expect(createCustomerPortalSession).not.toHaveBeenCalled()
  })

  it("opens the owner's Stripe portal and returns to billing", async () => {
    asRole('ADMIN')
    const res = await post()
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ url: 'https://billing.stripe.test/s' })
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: 'owner' },
      select: { stripeCustomerId: true },
    })
    expect(createCustomerPortalSession).toHaveBeenCalledWith({
      customerId: 'cus_1',
      returnUrl: 'https://fleet.test/billing',
    })
  })

  it('returns 409 without a billing account and 503 while billing is unavailable', async () => {
    asRole('OWNER')
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await post())._getStatusCode()).toBe(409)
    ;(getBillingAvailability as jest.Mock).mockReturnValue({ available: false, canonicalUrl: null })
    expect((await post())._getStatusCode()).toBe(503)
  })

  it('hides Stripe errors', async () => {
    asRole('OWNER')
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(createCustomerPortalSession as jest.Mock).mockRejectedValue(new Error('sk_live_secret'))
    const res = await post()
    expect(res._getStatusCode()).toBe(503)
    expect(JSON.stringify(res._getJSONData())).not.toContain('sk_live')
  })
})
