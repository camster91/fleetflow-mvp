import { createMocks } from 'node-mocks-http'

const mockTransaction = {
  $executeRaw: jest.fn(),
  taskShareLink: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    maintenanceTask: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTransaction) => unknown) =>
      callback(mockTransaction)
    ),
  },
}))
jest.mock('@/lib/apiAuth', () => ({
  assertSameOrigin: jest.fn(() => true),
  requireTenantContext: jest.fn(() => Promise.resolve({
    session: { user: { id: 'manager-1' } },
    tenant: {
      ownerId: 'owner-1',
      teamId: 'team-1',
      role: 'MANAGER',
      resourceWhere: { OR: [{ teamId: 'team-1' }] },
    },
  })),
}))
jest.mock('@/lib/permissions', () => ({ canManageMaintenance: jest.fn(() => true) }))

import handler from '@/pages/api/maintenance/[id]/share'
import { prisma } from '@/lib/prisma'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'

const originalNodeEnv = process.env.NODE_ENV
const originalNextAuthUrl = process.env.NEXTAUTH_URL
const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

describe('POST /api/maintenance/[id]/share', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NODE_ENV = 'test'
    process.env.NEXTAUTH_URL = 'https://fleet.example.com/path/'
    delete process.env.NEXT_PUBLIC_APP_URL
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(prisma.maintenanceTask.findFirst as jest.Mock).mockResolvedValue({ id: 'task-1' })
    mockTransaction.$executeRaw.mockResolvedValue(0)
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = originalNextAuthUrl
    if (originalPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl
  })

  it('reuses the active link after taking a task-scoped transaction lock', async () => {
    mockTransaction.taskShareLink.findFirst.mockResolvedValue({
      id: 'link-1', taskId: 'task-1', token: 'existing-token',
      ownerId: 'owner-1', expiresAt: new Date(Date.now() + 60_000),
      usedAt: null, revokedAt: null,
    })

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'task-1' },
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    await handler(req as never, res as never)

    expect(mockTransaction.$executeRaw).toHaveBeenCalledTimes(1)
    expect(mockTransaction.taskShareLink.findFirst).toHaveBeenCalledWith({
      where: {
        taskId: 'task-1',
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
    })
    expect(mockTransaction.taskShareLink.create).not.toHaveBeenCalled()
    expect(JSON.parse(res._getData())).toEqual({
      token: 'existing-token',
      url: 'https://fleet.example.com/task/existing-token',
    })
  })

  it('creates one link inside the same locked transaction when none is active', async () => {
    mockTransaction.taskShareLink.findFirst.mockResolvedValue(null)
    mockTransaction.taskShareLink.create.mockResolvedValue({
      id: 'link-2', taskId: 'task-1', token: 'new-token',
      ownerId: 'owner-1', expiresAt: new Date(Date.now() + 60_000),
      usedAt: null, revokedAt: null,
    })

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'task-1' },
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    await handler(req as never, res as never)

    expect(mockTransaction.taskShareLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 'task-1',
        ownerId: 'owner-1',
        token: expect.stringMatching(/^[a-f0-9]{48}$/),
        expiresAt: expect.any(Date),
      }),
    })
    expect(res._getStatusCode()).toBe(200)
  })

  it('rejects a cross-origin mutation before resolving session or tenant state', async () => {
    ;(assertSameOrigin as jest.Mock).mockReturnValue(false)
    const { req, res } = createMocks({ method: 'POST', query: { id: 'task-1' } })

    await handler(req as never, res as never)

    expect(requireTenantContext).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('fails closed before creating a token when the production URL is unsafe', async () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXTAUTH_URL = 'http://fleet.example.com'
    const { req, res } = createMocks({ method: 'POST', query: { id: 'task-1' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(503)
    expect(prisma.maintenanceTask.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
