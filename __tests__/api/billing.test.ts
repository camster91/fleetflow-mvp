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
}));

import handler from '@/pages/api/stripe/checkout-session';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

describe('POST /api/stripe/checkout-session', () => {
  beforeEach(() => jest.clearAllMocks())
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
