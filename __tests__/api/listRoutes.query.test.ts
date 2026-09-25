import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))
jest.mock('@/lib/prisma', () => {
  const model = () => ({ findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() })
  return {
    prisma: {
      team: { findMany: jest.fn() },
      vehicle: model(),
      delivery: model(),
      maintenanceTask: model(),
      client: model(),
    },
  }
})

import vehiclesHandler from '@/pages/api/vehicles/index'
import deliveriesHandler from '@/pages/api/deliveries/index'
import maintenanceHandler from '@/pages/api/maintenance/index'
import clientsHandler from '@/pages/api/clients/index'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Model = { findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock }
const db = prisma as unknown as Record<'vehicle' | 'delivery' | 'maintenanceTask' | 'client', Model> & {
  team: { findMany: jest.Mock }
}

const TEAM = { teamId: 'team-1' }

function signIn(role: string, userId = 'user-1') {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } })
  db.team.findMany.mockResolvedValue([{ id: 'team-1', ownerId: 'owner-1', members: [{ role }] }])
}

async function get(handler: (req: never, res: never) => unknown, query: Record<string, string | string[]> = {}) {
  const { req, res } = createMocks({ method: 'GET', query })
  await handler(req as never, res as never)
  return {
    status: res._getStatusCode(),
    body: res._getStatusCode() === 200 || res._getStatusCode() === 400 ? res._getJSONData() : null,
  }
}

const vehicleRow = (id: string) => ({
  id,
  name: `Van ${id}`,
  status: 'active',
  driver: 'Pat',
  assignedDriverId: 'driver-1',
  location: 'Depot',
  eta: '',
  mileage: 10,
  maintenanceDue: false,
  vehicleType: null,
  licensePlate: null,
  fuelLevel: 80,
  nextService: null,
  lastService: null,
  year: null,
  ownerId: 'owner-1',
  teamId: 'team-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  lastUpdated: new Date(),
})

beforeEach(() => {
  jest.clearAllMocks()
  for (const model of [db.vehicle, db.delivery, db.maintenanceTask, db.client]) {
    model.findMany.mockResolvedValue([])
    model.count.mockResolvedValue(0)
    model.aggregate.mockResolvedValue({ _avg: { mileage: null } })
  }
})

describe('GET list routes: search, filters, sort and pagination', () => {
  it('keeps the unfiltered request and response shape backward compatible', async () => {
    signIn('MANAGER')
    db.vehicle.findMany.mockResolvedValue([vehicleRow('v1')])
    db.vehicle.count.mockResolvedValue(1)

    const { status, body } = await get(vehiclesHandler)

    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['data', 'hasMore', 'limit', 'page', 'total'])
    expect(body).toMatchObject({ total: 1, page: 1, limit: 50, hasMore: false })
    expect(db.vehicle.findMany).toHaveBeenCalledWith({
      where: TEAM,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 50,
    })
    expect(db.vehicle.count).toHaveBeenCalledWith({ where: TEAM })
  })

  it('applies search, filter and allow-listed sort inside the tenant scope', async () => {
    signIn('MANAGER')
    await get(vehiclesHandler, { q: 'van', status: 'delayed', sort: 'name', order: 'desc', page: '2', limit: '25' })

    const call = db.vehicle.findMany.mock.calls[0][0]
    expect(call.where.AND[0]).toEqual(TEAM)
    expect(call.where.AND).toContainEqual({ status: 'delayed' })
    expect(call.where.AND[1].OR).toContainEqual({ name: { contains: 'van', mode: 'insensitive' } })
    expect(call.orderBy).toEqual([{ name: 'desc' }, { id: 'desc' }])
    expect(call).toMatchObject({ skip: 25, take: 25 })
    // total counts the filtered set, not the whole fleet.
    expect(db.vehicle.count).toHaveBeenCalledWith({ where: call.where })
  })

  it('reports hasMore from the filtered total and returns an empty page past the end', async () => {
    signIn('MANAGER')
    db.delivery.count.mockResolvedValue(60)
    let res = await get(deliveriesHandler, { page: '2', limit: '25' })
    expect(res.body).toMatchObject({ total: 60, page: 2, limit: 25, hasMore: true })
    res = await get(deliveriesHandler, { page: '3', limit: '25' })
    expect(res.body).toMatchObject({ page: 3, hasMore: false })
    res = await get(deliveriesHandler, { page: '9', limit: '25' })
    expect(res.body).toMatchObject({ data: [], page: 9, hasMore: false })
    expect(db.delivery.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 200, take: 25 }))
  })

  it.each([
    ['vehicles', vehiclesHandler, { sort: 'ownerId' }, 'Invalid sort'],
    ['vehicles', vehiclesHandler, { sort: 'name', order: 'up' }, 'Invalid sort order'],
    ['vehicles', vehiclesHandler, { status: 'retired' }, 'Invalid status filter'],
    ['deliveries', deliveriesHandler, { status: 'lost' }, 'Invalid status filter'],
    ['deliveries', deliveriesHandler, { q: 'x'.repeat(101) }, 'Search query is too long'],
    ['maintenance', maintenanceHandler, { state: 'someday' }, 'Invalid state filter'],
    ['maintenance', maintenanceHandler, { dueFrom: 'soon' }, 'Invalid due date range'],
    ['maintenance', maintenanceHandler, { today: '2026-02-31' }, 'Invalid today'],
    ['clients', clientsHandler, { type: 'castle' }, 'Invalid type filter'],
    ['clients', clientsHandler, { sort: 'notes' }, 'Invalid sort'],
  ] as const)('%s rejects invalid params #%# with 400 before querying', async (_name, handler, query, message) => {
    signIn('MANAGER')
    const { status, body } = await get(handler, query as Record<string, string>)
    expect(status).toBe(400)
    expect(body).toEqual({ error: message })
    for (const model of [db.vehicle, db.delivery, db.maintenanceTask, db.client])
      expect(model.findMany).not.toHaveBeenCalled()
  })

  it('treats "all" as no filter', async () => {
    signIn('MANAGER')
    await get(clientsHandler, { type: 'all' })
    expect(db.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: TEAM, orderBy: [{ name: 'asc' }, { id: 'asc' }] })
    )
  })

  it('filters maintenance by state relative to the caller day and by due range', async () => {
    signIn('MANAGER')
    await get(maintenanceHandler, {
      state: 'overdue',
      today: '2026-09-20',
      dueFrom: '2026-09-01',
      dueTo: '2026-09-30',
      q: 'brake',
    })
    const { where, include } = db.maintenanceTask.findMany.mock.calls[0][0]
    expect(include).toEqual({ vehicle: { select: { name: true } } })
    expect(where.AND[0]).toEqual(TEAM)
    expect(where.AND).toContainEqual({ completed: false, dueDate: { lt: new Date('2026-09-20T00:00:00Z') } })
    expect(where.AND).toContainEqual({
      dueDate: { gte: new Date('2026-09-01T00:00:00Z'), lt: new Date('2026-10-01T00:00:00Z') },
    })
  })
})

describe('GET list routes: driver scoping survives search and filters', () => {
  it('a driver searching vehicles only matches assigned vehicles and gets the driver DTO', async () => {
    signIn('DRIVER', 'driver-1')
    db.vehicle.findMany.mockResolvedValue([vehicleRow('v1')])
    db.vehicle.count.mockResolvedValue(1)

    const { status, body } = await get(vehiclesHandler, { q: 'van', status: 'active' })

    expect(status).toBe(200)
    const { where } = db.vehicle.findMany.mock.calls[0][0]
    expect(where.AND[0]).toEqual({ AND: [TEAM, { assignedDriverId: 'driver-1' }] })
    expect(body.data[0]).not.toHaveProperty('ownerId')
  })

  it('a driver filtering deliveries keeps the assignment constraint', async () => {
    signIn('DRIVER', 'driver-1')
    await get(deliveriesHandler, { status: 'pending', q: 'north', summary: '1' })
    const { where } = db.delivery.findMany.mock.calls[0][0]
    expect(where.AND[0]).toEqual({ AND: [TEAM, { assignedDriverId: 'driver-1' }] })
    // Summary counts use the same driver scope.
    for (const [args] of db.delivery.count.mock.calls) {
      const scope = args.where.AND?.[0]?.AND ? args.where.AND[0] : args.where
      expect(scope).toEqual({ AND: [TEAM, { assignedDriverId: 'driver-1' }] })
    }
  })

  it('a driver searching maintenance only sees work on assigned vehicles', async () => {
    signIn('DRIVER', 'driver-1')
    await get(maintenanceHandler, { q: 'brake', state: 'upcoming' })
    const { where } = db.maintenanceTask.findMany.mock.calls[0][0]
    expect(where.AND[0]).toEqual({ AND: [TEAM, { vehicle: { assignedDriverId: 'driver-1' } }] })
  })

  it('a driver still cannot list clients, even with a search', async () => {
    signIn('DRIVER', 'driver-1')
    const { status } = await get(clientsHandler, { q: 'north' })
    expect(status).toBe(403)
    expect(db.client.findMany).not.toHaveBeenCalled()
  })
})

describe('GET list routes: summary', () => {
  it('is only included when requested and covers the whole scope, ignoring search and filters', async () => {
    signIn('MANAGER')
    db.vehicle.count.mockResolvedValue(3)
    db.vehicle.aggregate.mockResolvedValue({ _avg: { mileage: 1234.6 } })

    const plain = await get(vehiclesHandler, { q: 'van' })
    expect(plain.body).not.toHaveProperty('summary')
    expect(db.vehicle.aggregate).not.toHaveBeenCalled()

    const { body } = await get(vehiclesHandler, { q: 'van', summary: '1' })
    expect(body.summary).toEqual({ total: 3, active: 3, maintenanceDue: 3, averageMileage: 1235 })
    expect(db.vehicle.aggregate).toHaveBeenCalledWith({ where: TEAM, _avg: { mileage: true } })
    expect(db.vehicle.count).toHaveBeenCalledWith({ where: TEAM })
    expect(db.vehicle.count).toHaveBeenCalledWith({ where: { AND: [TEAM, { status: 'active' }] } })
  })

  it('returns per-status delivery counts', async () => {
    signIn('DISPATCHER')
    db.delivery.count.mockImplementation(({ where }) =>
      Promise.resolve(where.AND ? (where.AND[1].status === 'pending' ? 4 : 1) : 9)
    )
    const { body } = await get(deliveriesHandler, { summary: '1' })
    expect(body.summary).toEqual({ total: 9, byStatus: { pending: 4, 'in-transit': 1, delivered: 1, cancelled: 1 } })
  })

  it('computes maintenance counts from the caller day', async () => {
    signIn('TECHNICIAN')
    await get(maintenanceHandler, { summary: '1', today: '2026-09-20' })
    const today = new Date('2026-09-20T00:00:00Z')
    expect(db.maintenanceTask.count).toHaveBeenCalledWith({
      where: { AND: [TEAM, { completed: false, dueDate: { lt: today } }] },
    })
    expect(db.maintenanceTask.count).toHaveBeenCalledWith({
      where: { AND: [TEAM, { completed: false, dueDate: { gte: today, lt: new Date('2026-09-28T00:00:00Z') } }] },
    })
  })

  it('returns client stat counts', async () => {
    signIn('MANAGER')
    db.client.count.mockResolvedValue(2)
    const { body } = await get(clientsHandler, { summary: 'true' })
    expect(body.summary).toEqual({ total: 2, restaurantHotel: 2, highRating: 2 })
  })
})
