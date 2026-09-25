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
jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn() }))
jest.mock('@/lib/email.server', () => ({ notifyDeliveryAssigned: jest.fn().mockResolvedValue(undefined) }))

import handler from '@/pages/api/deliveries/index'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { deliveryCreateSchema, deliveryUpdateSchema, DELIVERY_STATUSES } from '@/lib/deliveryTransitions'

const tenant = { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere: { ownerId: 'owner-1', teamId: null } }
const tx: { delivery: { create: jest.Mock } } = { delivery: { create: jest.fn(async ({ data }: any) => ({ id: 'd-new', createdAt: new Date(), updatedAt: new Date(), ...data })) } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireTenantContext as jest.Mock).mockResolvedValue({ session: { user: { id: 'owner-1', name: 'Owner' } }, tenant })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn({ ...tx, activityLog: { create: jest.fn() } }))
  ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'owner-1', name: 'Owner', email: null })
})

async function post(body: unknown) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: 'POST', body: body as never })
  await handler(req, res)
  return res
}

// Mirrors the payload DeliveryFormModal sends for a new delivery.
const formPayload = {
  customer: 'Acme', address: '1 Main St', status: 'pending', driver: '', assignedDriverId: null,
  items: 3, progress: 0, notes: '', scheduledTime: '2026-09-26T09:00', estimatedArrival: '',
  contactPerson: { name: 'Jo', phone: '', email: '' },
  parkingInstructions: '', dropoffInstructions: '', accessCodes: ['1234'], securityNotes: '', businessHours: '',
}

describe('POST /api/deliveries validation', () => {
  it('accepts the payload sent by the new-delivery form', async () => {
    const res = await post(formPayload)
    expect(res._getStatusCode()).toBe(201)
    expect(tx.delivery.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      customer: 'Acme', address: '1 Main St', items: 3, ownerId: 'owner-1', teamId: null, assignedDriverId: null,
    }) })
  })

  it.each([
    ['missing customer', { address: '1 Main St' }],
    ['blank address', { customer: 'Acme', address: '   ' }],
    ['unknown status', { ...formPayload, status: 'lost' }],
    ['unknown field', { ...formPayload, ownerId: 'someone-else' }],
    ['client-supplied id', { ...formPayload, id: 'forced-id' }],
    ['string item count', { ...formPayload, items: '3' }],
    ['invalid date', { ...formPayload, scheduledTime: 'tomorrow-ish' }],
    ['oversized notes', { ...formPayload, notes: 'x'.repeat(2001) }],
    ['non-object body', 'customer=Acme'],
  ])('returns 400 for %s without writing', async (_label, body) => {
    const res = await post(body)
    expect(res._getStatusCode()).toBe(400)
    expect((res._getJSONData() as { error: string }).error).toBe('Invalid delivery')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('names the offending fields', async () => {
    const res = await post({ ...formPayload, status: 'bogus', teamId: 't-other' })
    expect((res._getJSONData() as { fields: string[] }).fields).toEqual(expect.arrayContaining(['status', 'teamId']))
  })

  it('never lets a client set the stored driver name directly', async () => {
    const res = await post({ ...formPayload, driver: 'Spoofed Name' })
    expect(res._getStatusCode()).toBe(201)
    expect(tx.delivery.create.mock.calls[0][0].data.driver).toBeNull()
  })
})

describe('delivery status list is shared by create and update', () => {
  it('accepts every stored status, including delayed, on create and update', () => {
    for (const status of DELIVERY_STATUSES) {
      expect(deliveryCreateSchema.safeParse({ customer: 'A', address: 'B', status }).success).toBe(true)
      expect(deliveryUpdateSchema.safeParse({ status }).success).toBe(true)
    }
    expect(DELIVERY_STATUSES).toContain('delayed')
  })
})
