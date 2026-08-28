import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/prisma', () => ({ prisma: {
  team: { findMany: jest.fn() },
  subscription: { findUnique: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
} }))
jest.mock('@/lib/stripe', () => ({ cancelSubscription: jest.fn() }))

import handler from '@/pages/api/subscription/cancel'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cancelSubscription } from '@/lib/stripe'

describe('POST /api/subscription/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner-1', name: 'Owner' } })
    ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', stripeSubscriptionId: 'sub_123', status: 'ACTIVE', cancelAtPeriodEnd: false,
    })
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ acquired: 1 }])
    ;(prisma.$transaction as jest.Mock).mockImplementation(async callback => callback(prisma))
    ;(cancelSubscription as jest.Mock).mockResolvedValue({ id: 'sub_123', cancel_at_period_end: true })
  })

  it('serializes, persists, and audits a scheduled cancellation', async () => {
    const { req, res } = request()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 5000, timeout: 30000 })
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(cancelSubscription).toHaveBeenCalledWith('sub_123', true)
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { userId: 'owner-1' }, data: { cancelAtPeriodEnd: true },
    })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'owner-1', action: 'updated', entityType: 'subscription', entityId: 'local-sub',
      description: 'Subscription cancellation scheduled for period end',
    }) })
    expect(res.getHeader('Cache-Control')).toBe('private, no-store')
  })

  it('treats a repeated cancellation as successful without a second provider mutation', async () => {
    ;(prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'local-sub', stripeSubscriptionId: 'sub_123', status: 'ACTIVE', cancelAtPeriodEnd: true,
    })
    const { req, res } = request()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual(expect.objectContaining({ alreadyScheduled: true }))
    expect(cancelSubscription).not.toHaveBeenCalled()
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('does not persist or audit when Stripe rejects cancellation', async () => {
    ;(cancelSubscription as jest.Mock).mockRejectedValue(new Error('provider secret'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { req, res } = request()
    await handler(req, res)

    expect(res._getStatusCode()).toBe(500)
    expect(res._getJSONData()).toEqual({ error: 'Failed to cancel subscription' })
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('Stripe subscription cancellation failed')
    errorSpy.mockRestore()
  })
})

function request() {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
  })
}
