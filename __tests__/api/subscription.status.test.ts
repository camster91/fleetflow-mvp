import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    subscription: { findUnique: jest.fn() },
  },
}))

import handler from '@/pages/api/subscription/status'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const call = async (method = 'GET') => {
  const { req, res } = createMocks({ method: method as 'GET' })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/subscription/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
  })

  it('rejects non-GET methods', async () => {
    const res = await call('POST')
    expect(res._getStatusCode()).toBe(405)
  })

  it('returns 401 without a session', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await call()
    expect(res._getStatusCode()).toBe(401)
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled()
  })

  it('forbids members who cannot view billing', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-2', members: [{ role: 'DRIVER' }] },
    ])
    const res = await call()
    expect(res._getStatusCode()).toBe(403)
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled()
  })

  it('returns null when the workspace owner has no subscription', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await call()
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual({ subscription: null })
  })

  it('reads the workspace owner subscription and omits Stripe identifiers', async () => {
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: 'team-1', ownerId: 'owner-2', members: [{ role: 'MANAGER' }] },
    ])
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      plan: 'PRO', status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false,
      stripeCustomerId: 'cus_secret', stripeSubscriptionId: 'sub_secret',
    })
    const res = await call()
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({ where: { userId: 'owner-2' } })
    const body = res._getJSONData()
    expect(body.subscription).toMatchObject({ plan: 'PRO', status: 'ACTIVE', cancelAtPeriodEnd: false })
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })
})
