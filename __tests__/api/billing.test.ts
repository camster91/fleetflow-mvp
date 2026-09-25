import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    subscription: { upsert: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/stripe', () => ({
  createCheckoutSession: jest.fn(),
  createStripeCustomer: jest.fn(),
  expireCheckoutSession: jest.fn(),
  findOpenCheckoutSessions: jest.fn(),
  getBillingAvailability: jest.fn(),
  getConfiguredPrice: jest.fn(),
  getCanonicalAppUrl: jest.fn(),
}))

import handler from '@/pages/api/stripe/checkout-session'
import availabilityHandler from '@/pages/api/stripe/availability'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const stripe = jest.requireMock('@/lib/stripe')

function request(interval = 'monthly', headers: Record<string, string> = {}) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST',
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', ...headers },
    body: { interval },
  })
}

describe('POST /api/stripe/checkout-session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma))
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ acquired: 1 }])
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      name: 'Owner',
      subscription: { stripeCustomerId: 'cus_1', stripeSubscriptionId: null, status: 'TRIAL' },
    })
    stripe.getBillingAvailability.mockReturnValue({ available: true, missing: [] })
    stripe.getConfiguredPrice.mockImplementation((interval: string) =>
      interval === 'yearly' ? 'price_yearly' : 'price_monthly'
    )
    stripe.getCanonicalAppUrl.mockReturnValue('https://fleetvera.example')
    stripe.findOpenCheckoutSessions.mockResolvedValue([])
    stripe.createCheckoutSession.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.test/session' })
  })

  it('serializes checkout and uses only the approved HTTPS callback origin', async () => {
    const { req, res } = request('monthly', { host: 'evil.example', origin: 'https://evil.example' })
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 30000 })
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        successUrl: 'https://fleetvera.example/dashboard?subscribed=true',
        cancelUrl: 'https://fleetvera.example/billing',
        idempotencyKey: expect.stringMatching(/^fleetvera-checkout-owner-1-/),
      })
    )
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })

  it('creates a missing Stripe customer with a deterministic idempotency key', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      name: 'Owner',
      subscription: null,
    })
    stripe.createStripeCustomer.mockResolvedValue({ id: 'cus_new' })
    const { req, res } = request()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(stripe.createStripeCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        idempotencyKey: 'fleetvera-customer-owner-1',
      })
    )
    expect(prisma.subscription.upsert).toHaveBeenCalled()
  })

  it('reuses an open session for the selected price', async () => {
    stripe.findOpenCheckoutSessions.mockResolvedValue([
      { id: 'cs_open', url: 'https://checkout.stripe.test/open', metadata: { priceId: 'price_monthly' } },
    ])
    const { req, res } = request()
    await handler(req, res)

    expect(res._getJSONData()).toEqual({ url: 'https://checkout.stripe.test/open', reused: true })
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled()
    expect(stripe.expireCheckoutSession).not.toHaveBeenCalled()
  })

  it('expires stale open sessions before creating a replacement', async () => {
    stripe.findOpenCheckoutSessions.mockResolvedValue([
      { id: 'cs_old', url: 'https://checkout.stripe.test/old', metadata: { priceId: 'price_yearly' } },
    ])
    const { req, res } = request()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(stripe.expireCheckoutSession).toHaveBeenCalledWith('cs_old')
    expect(stripe.createCheckoutSession).toHaveBeenCalled()
  })

  it('rejects a second non-cancelled subscription', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.com',
      subscription: { stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', status: 'ACTIVE' },
    })
    const { req, res } = request()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(409)
    expect(stripe.findOpenCheckoutSessions).not.toHaveBeenCalled()
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns a safe unavailable response when Stripe configuration is missing', async () => {
    stripe.getBillingAvailability.mockReturnValue({ available: false, missing: ['STRIPE_SECRET_KEY'] })
    const { req, res } = request()
    await handler(req, res)
    expect(res._getStatusCode()).toBe(503)
    expect(JSON.stringify(res._getJSONData())).not.toContain('STRIPE_SECRET_KEY')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects unsupported intervals, unauthenticated requests, and GET', async () => {
    let mocks = request('weekly')
    await handler(mocks.req, mocks.res)
    expect(mocks.res._getStatusCode()).toBe(400)

    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    mocks = request()
    await handler(mocks.req, mocks.res)
    expect(mocks.res._getStatusCode()).toBe(401)

    mocks = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    await handler(mocks.req, mocks.res)
    expect(mocks.res._getStatusCode()).toBe(405)
  })

  it('bills the team owner and denies viewers', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'ADMIN' }] },
    ])
    let mocks = request('monthly', { 'x-team-id': 'team-1' })
    await handler(mocks.req, mocks.res)
    expect(mocks.res._getStatusCode()).toBe(200)
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'owner-1' } }))

    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'viewer-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-1', members: [{ role: 'VIEWER' }] },
    ])
    mocks = request('monthly', { 'x-team-id': 'team-1' })
    await handler(mocks.req, mocks.res)
    expect(mocks.res._getStatusCode()).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('GET /api/stripe/availability', () => {
  beforeEach(() => jest.resetAllMocks())

  it('reports configured billing without returning configuration details', () => {
    const pricing = { monthly: { amount: 4900, currency: 'CAD' }, yearly: { amount: 49000, currency: 'CAD' } }
    stripe.getBillingAvailability.mockReturnValue({ available: true, missing: [], pricing })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    availabilityHandler(req, res)
    expect(res._getJSONData()).toEqual({ available: true, pricing, message: null })
  })

  it('does not expose missing keys or secrets', () => {
    stripe.getBillingAvailability.mockReturnValue({
      available: false,
      missing: ['STRIPE_SECRET_KEY'],
      secret: 'sk_test_secret',
    })
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET' })
    availabilityHandler(req, res)
    expect(res._getStatusCode()).toBe(200)
    expect(JSON.stringify(res._getJSONData())).not.toMatch(/STRIPE_SECRET_KEY|sk_test_secret/)
  })
})
