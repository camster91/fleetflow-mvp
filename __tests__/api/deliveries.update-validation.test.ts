import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({
  requireTenantContext: jest.fn(),
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    delivery: { findFirst: jest.fn() },
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/notifications', () => ({ createNotification: jest.fn() }))
jest.mock('@/lib/email.server', () => ({
  notifyDeliveryAssigned: jest.fn(() => Promise.resolve()),
  notifyDeliveryStatus: jest.fn(() => Promise.resolve()),
}))

import handler from '@/pages/api/deliveries/[id]/index'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const tenantContext = {
  session: { user: { id: 'owner-1', name: 'Owner' } },
  tenant: { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere: { ownerId: 'owner-1' } },
}

const existing = {
  id: 'd1',
  ownerId: 'owner-1',
  teamId: null,
  address: '1 Main St',
  customer: 'Acme',
  status: 'in-transit',
  driver: null,
  assignedDriverId: null,
  items: 3,
  progress: 50,
  notes: null,
  scheduledTime: null,
  estimatedArrival: null,
  completedTime: null,
  parkingLocation: null,
  dropoffLocation: null,
  parkingInstructions: null,
  dropoffInstructions: null,
  contactPerson: null,
  photos: null,
  accessCodes: null,
  securityNotes: null,
  businessHours: null,
  specialRequirements: null,
}

async function put(body: unknown) {
  const { req, res } = createMocks({ method: 'PUT', query: { id: 'd1' }, body: body as never })
  await handler(req as never, res as never)
  return res
}

describe('PUT /api/deliveries/[id] validation', () => {
  const tx = {
    delivery: { update: jest.fn(async ({ data }) => ({ ...existing, ...data })) },
    deliveryEvent: { create: jest.fn() },
    activityLog: { create: jest.fn() },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(tenantContext)
    ;(prisma.delivery.findFirst as jest.Mock).mockResolvedValue(existing)
    ;(prisma.$transaction as jest.Mock).mockImplementation((fn) => fn(tx))
  })

  it.each([
    ['unknown status', { status: '<script>' }],
    ['unknown key', { status: 'delivered', ownerId: 'someone-else' }],
    ['oversized customer', { customer: 'x'.repeat(201) }],
    ['oversized notes', { notes: 'x'.repeat(2001) }],
    ['non-numeric progress', { progress: '50' }],
    ['out-of-range progress', { progress: 101 }],
    ['invalid date', { completedTime: 'not-a-date' }],
    ['non-object body', 'status=delivered'],
  ])('returns 400 for %s without writing', async (_label, body) => {
    const res = await put(body)
    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData().error).toBe('Invalid delivery update')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('names the offending fields', async () => {
    const res = await put({ status: 'bogus', extra: true })
    expect(res._getJSONData().fields).toEqual(expect.arrayContaining(['status', 'extra']))
  })

  it('accepts the payload sent by the deliveries page', async () => {
    const res = await put({ status: 'delivered', progress: 100, completedTime: new Date().toISOString() })
    expect(res._getStatusCode()).toBe(200)
    expect(tx.delivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1' },
        data: expect.objectContaining({ status: 'delivered', progress: 100, items: 3, customer: 'Acme' }),
      })
    )
    expect(tx.deliveryEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'delivered' }) })
  })

  it('tolerates a full delivery record echoed back by a client', async () => {
    const res = await put({
      id: 'd1',
      customer: 'Acme',
      address: '1 Main St',
      status: 'in-transit',
      driver: '',
      assignedDriverId: null,
      items: 3,
      progress: 50,
      notes: null,
      scheduledTime: '',
      estimatedArrival: null,
      accessCodes: ['1234'],
      photos: null,
    })
    expect(res._getStatusCode()).toBe(200)
  })
})
