import { createMocks } from 'node-mocks-http'
import type { NextApiRequest, NextApiResponse } from 'next'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findFirst: jest.fn() },
    delivery: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/fleet', () => ({
  dbToDelivery: jest.fn((d: any) => d),
  deliveryToDb: jest.fn((d: any) => ({ customer: d.customer, driver: d.driver })),
  logActivity: jest.fn(),
}))

jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn() }))
jest.mock('@/lib/email.server', () => ({ notifyDeliveryAssigned: jest.fn().mockResolvedValue(undefined) }))

import handler from '@/pages/api/deliveries/index'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

const tenant = { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere: { ownerId: 'owner-1', teamId: null } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireTenantContext as jest.Mock).mockResolvedValue({ session: { user: { id: 'owner-1', name: 'Owner' } }, tenant })
})

describe('POST /api/deliveries notifications', () => {
  it('still returns 201 with exactly one delivery when the driver notification fails', async () => {
    const tx = { delivery: { create: jest.fn(async ({ data }: any) => ({ id: 'delivery-1', ...data })) } }
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'owner-1', name: 'Owner', email: null })
    ;(createNotification as jest.Mock).mockRejectedValue(new Error('notification store down'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      body: { customer: 'Acme', assignedDriverId: 'owner-1' },
    })
    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    expect(res._getJSONData()).toMatchObject({ id: 'delivery-1', assignedDriverId: 'owner-1' })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.delivery.create).toHaveBeenCalledTimes(1)
    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('GET /api/deliveries ordering', () => {
  it('uses a unique id tie-breaker so offset paging is stable', async () => {
    ;(prisma.delivery.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.delivery.count as jest.Mock).mockResolvedValue(0)
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'GET', query: { page: '2', limit: '200' } })
    await handler(req, res)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.delivery.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 200,
      take: 200,
    }))
  })
})
