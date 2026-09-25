import { createMocks } from 'node-mocks-http'
import handler from '../../../pages/api/vehicles/[id]/details'

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    team: { findMany: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    maintenanceTask: { findMany: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}))
jest.mock('../../../lib/auth', () => ({ getServerSession: jest.fn(), authOptions: {} }))

import { getServerSession } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

const mockSession = { user: { id: 'user-1' } }
const mockVehicle = {
  id: 'v-1',
  name: 'Van 1',
  status: 'active',
  driver: 'John Driver',
  location: '123 Main St',
  eta: '2h',
  mileage: 45000,
  maintenanceDue: false,
  ownerId: 'user-1',
}
const mockTasks = [
  {
    id: 't-1',
    title: 'Oil Change',
    type: 'Oil Change',
    dueDate: new Date(),
    priority: 'high',
    completed: false,
    completedDate: null,
    costEstimate: 50,
    serviceProvider: 'Jiffy Lube',
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  ;(prisma.team.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/vehicles/[id]/details', () => {
  it('returns 401 when unauthenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET', query: { id: 'v-1' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(401)
  })

  it('returns 404 when vehicle not found', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET', query: { id: 'bad-id' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(404)
  })

  it('returns vehicle with maintenance tasks', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(mockVehicle)
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue(mockTasks)
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET', query: { id: 'v-1' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const d = JSON.parse(res._getData())
    expect(d.vehicle.name).toBe('Van 1')
    expect(d.maintenanceTasks).toHaveLength(1)
    expect(d.maintenanceTasks[0].title).toBe('Oil Change')
    expect(d.driverUser).toBeNull()
  })

  it('includes driver user info when user found by name', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(mockVehicle)
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({
      name: 'John Driver',
      email: 'john@fleet.com',
      image: null,
    })
    const { req, res } = createMocks({ method: 'GET', query: { id: 'v-1' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    const d = JSON.parse(res._getData())
    expect(d.driverUser?.email).toBe('john@fleet.com')
  })

  it('returns 405 for non-GET', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(mockSession)
    const { req, res } = createMocks({ method: 'POST', query: { id: 'v-1' } })
    await handler(req as any, res as any)
    expect(res._getStatusCode()).toBe(405)
  })
})
