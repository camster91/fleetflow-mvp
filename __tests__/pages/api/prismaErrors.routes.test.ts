import { readFileSync } from 'fs'
import { join } from 'path'
import { createMocks } from 'node-mocks-http'
import { Prisma } from '@prisma/client'

const mockTx = {
  vehicle: { delete: jest.fn() },
  maintenanceTask: { update: jest.fn(), delete: jest.fn() },
  client: { deleteMany: jest.fn() },
  user: { delete: jest.fn(), update: jest.fn() },
  auditLog: { create: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: { findFirst: jest.fn() },
    maintenanceTask: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTx) => unknown) => callback(mockTx)),
  },
}))
jest.mock('@/lib/apiAuth', () => ({
  assertSameOrigin: jest.fn(() => true),
  requireTenantContext: jest.fn(async () => ({
    session: { user: { id: 'owner-1', name: 'Owner' } },
    tenant: { ownerId: 'owner-1', teamId: null, role: 'OWNER', resourceWhere: { ownerId: 'owner-1', teamId: null } },
  })),
}))
jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(async () => ({ user: { id: 'admin-1', role: 'admin' } })),
  authOptions: {},
}))
jest.mock('@/lib/security', () => ({ rateLimit: jest.fn(async () => true) }))

import vehicleHandler from '@/pages/api/vehicles/[id]'
import maintenanceHandler from '@/pages/api/maintenance/[id]'
import adminUsersHandler from '@/pages/api/admin/users'
import { prisma } from '@/lib/prisma'
import { mapPrismaError } from '@/lib/prismaErrors'

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`${code} test`, { code, clientVersion: 'test' })

describe('mapPrismaError', () => {
  it('maps P2003 to 409, P2025 to 404 and P2002 to 409 with readable messages', () => {
    expect(mapPrismaError(knownError('P2003'))).toMatchObject({ status: 409, code: 'P2003' })
    expect(mapPrismaError(knownError('P2025'))).toMatchObject({ status: 404, error: 'Not found' })
    expect(mapPrismaError(knownError('P2002'))).toMatchObject({ status: 409, code: 'P2002' })
    expect(mapPrismaError(knownError('P2003'), { foreignKey: 'custom' })?.error).toBe('custom')
  })

  it('leaves other errors unmapped', () => {
    expect(mapPrismaError(knownError('P2024'))).toBeNull()
    expect(mapPrismaError(new Error('boom'))).toBeNull()
    expect(mapPrismaError(null)).toBeNull()
  })
})

describe('delete and update routes map Prisma errors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore()
  })

  it('returns 409 instead of 500 when deleting a vehicle that has expense records', async () => {
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1', name: 'Van 1' })
    mockTx.vehicle.delete.mockRejectedValue(knownError('P2003'))
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'v1' } })

    await vehicleHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(409)
    expect(JSON.parse(res._getData())).toEqual({
      error: expect.stringContaining('expense records'),
      code: 'P2003',
    })
  })

  it('returns 404 when a maintenance task disappears before the update commits', async () => {
    ;(prisma.maintenanceTask.findFirst as jest.Mock).mockResolvedValue({
      id: 't1',
      title: 'Oil',
      type: 'Oil',
      dueDate: new Date('2026-09-25T00:00:00.000Z'),
      priority: 'medium',
      completed: false,
      completedDate: null,
      ownerId: 'owner-1',
      vehicleId: null,
    })
    mockTx.maintenanceTask.update.mockRejectedValue(knownError('P2025'))
    const { req, res } = createMocks({ method: 'PUT', query: { id: 't1' }, body: { notes: 'x' } })

    await maintenanceHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(404)
  })

  it('still surfaces unexpected errors instead of masking them', async () => {
    ;(prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1', name: 'Van 1' })
    mockTx.vehicle.delete.mockRejectedValue(new Error('connection lost'))
    const { req, res } = createMocks({ method: 'DELETE', query: { id: 'v1' } })

    await expect(vehicleHandler(req as never, res as never)).rejects.toThrow('connection lost')
  })

  it('returns 409 when an admin deletes a user whose records are restricted', async () => {
    mockTx.user.delete.mockRejectedValue(knownError('P2003'))
    const { req, res } = createMocks({ method: 'DELETE', body: { userId: 'user-2' } })

    await adminUsersHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(409)
    expect(JSON.parse(res._getData()).error).toMatch(/expense history/)
  })

  it('returns 404 when an admin deletes a user that no longer exists', async () => {
    mockTx.user.delete.mockRejectedValue(knownError('P2025'))
    const { req, res } = createMocks({ method: 'DELETE', body: { userId: 'gone' } })

    await adminUsersHandler(req as never, res as never)

    expect(res._getStatusCode()).toBe(404)
  })
})

describe('deletion policy in the schema', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const relationLine = (model: string, field: string) => {
    const body = schema.slice(schema.indexOf(`model ${model} {`))
    return (
      body
        .slice(0, body.indexOf('\n}'))
        .split('\n')
        .find((line) => line.trim().startsWith(`${field} `)) ?? ''
    )
  }

  it.each([
    'Vehicle',
    'Delivery',
    'MaintenanceTask',
    'Client',
    'SOPCategory',
    'VendingMachine',
    'ExpenseRecord',
    'Announcement',
  ])('refuses to delete a team that still owns %s rows instead of moving them to personal scope', (model) => {
    expect(relationLine(model, 'team')).toContain('onDelete: NoAction')
  })

  it('keeps expense history restricted and removes password history with its user', () => {
    expect(relationLine('ExpenseRecord', 'vehicle')).toContain('onDelete: Restrict')
    expect(relationLine('PasswordHistory', 'user')).toContain('onDelete: Cascade')
  })
})
