import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn().mockResolvedValue(null),
  authOptions: {},
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    subscription: { upsert: jest.fn() },
  },
}));

jest.mock('@/lib/stripe', () => ({
  createCheckoutSession: jest.fn(),
  createStripeCustomer: jest.fn(),
  getBillingAvailability: jest.fn(() => ({ available: true, missing: [] })),
  getConfiguredPrice: jest.fn((interval: string) => interval === 'yearly' ? 'price_yearly' : 'price_monthly'),
  getCanonicalAppUrl: jest.fn(() => 'https://fleetvera.example'),
}));

import handler from '@/pages/api/stripe/checkout-session';
import availabilityHandler from '@/pages/api/stripe/availability';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

describe('POST /api/stripe/checkout-session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const stripe = jest.requireMock('@/lib/stripe')
    stripe.getBillingAvailability.mockReturnValue({ available: true, missing: [] })
    stripe.getConfiguredPrice.mockImplementation((interval: string) => interval === 'yearly' ? 'price_yearly' : 'price_monthly')
    stripe.getCanonicalAppUrl.mockReturnValue('https://fleetvera.example')
  })

  it('returns a safe unavailable response when Stripe configuration is missing', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    const stripe = jest.requireMock('@/lib/stripe')
    stripe.getBillingAvailability.mockReturnValueOnce({ available: false, missing: ['STRIPE_SECRET_KEY'] })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, body: { interval: 'monthly' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(503)
    expect(res._getJSONData()).toEqual({ error: 'Billing is temporarily unavailable' })
    expect(JSON.stringify(res._getJSONData())).not.toContain('STRIPE_SECRET_KEY')
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejects an unsupported billing interval', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, body: { interval: 'weekly' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(400)
  })

  it('uses only the approved HTTPS app origin and ignores a malicious Host', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', subscription: { stripeCustomerId: 'cus_1' } })
    const stripe = jest.requireMock('@/lib/stripe')
    stripe.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { host: 'evil.example', origin: 'https://evil.example' }, body: { interval: 'monthly' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      successUrl: 'https://fleetvera.example/dashboard?subscribed=true', cancelUrl: 'https://fleetvera.example/billing',
    }))
  })

  it('refuses checkout when the canonical app URL is missing or invalid', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', subscription: { stripeCustomerId: 'cus_1' } })
    const stripe = jest.requireMock('@/lib/stripe')
    stripe.getCanonicalAppUrl.mockReturnValue(null)
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { host: 'evil.example', origin: 'http://evil.example' }, body: { interval: 'monthly' },
    })
    await handler(req, res)
    expect(res._getStatusCode()).toBe(503)
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled()
  })
  it('returns 401 without a valid session', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { interval: 'monthly' },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
    expect(res._getJSONData()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 405 for GET requests', async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it('bills the team owner when an admin manages a team workspace', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'ADMIN' }] },
    ])
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner-1', email: 'owner@example.com', name: 'Owner',
      subscription: { stripeCustomerId: 'cus_1' },
    })
    process.env.STRIPE_PRICE_MONTHLY = 'price_monthly'
    const { createCheckoutSession } = jest.requireMock('@/lib/stripe')
    createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session' })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { 'x-team-id': 'team-1', host: 'localhost:3000', origin: 'http://localhost:3000' }, body: { interval: 'monthly' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'owner-1' } }))
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner-1' }))
  })

  it('denies a viewer from starting checkout', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'viewer-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'VIEWER' }] },
    ])
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST', headers: { 'x-team-id': 'team-1', host: 'localhost:3000', origin: 'http://localhost:3000' }, body: { interval: 'monthly' },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(403)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })
});

describe('GET /api/stripe/availability', () => {
  beforeEach(() => jest.resetAllMocks())

  it('reports configured billing without returning configuration details', () => {
    const stripe = jest.requireMock('@/lib/stripe')
    const pricing = { monthly: { amount: 4900, currency: 'CAD' }, yearly: { amount: 49000, currency: 'CAD' } }
    stripe.getBillingAvailability.mockReturnValue({ available: true, missing: [], pricing })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    availabilityHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ available: true, pricing, message: null })
  })

  it('reports unavailable billing without exposing missing keys or secrets', () => {
    const stripe = jest.requireMock('@/lib/stripe')
    stripe.getBillingAvailability.mockReturnValue({ available: false, missing: ['STRIPE_SECRET_KEY'], secret: 'sk_test_secret' })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    availabilityHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    const body = res._getJSONData() as { available: boolean; message: string }
    expect(body.available).toBe(false)
    expect((body as unknown as { pricing: null }).pricing).toBeNull()
    expect(body.message).toContain('temporarily unavailable')
    expect(JSON.stringify(body)).not.toMatch(/STRIPE_SECRET_KEY|sk_test_secret/)
  })
})
