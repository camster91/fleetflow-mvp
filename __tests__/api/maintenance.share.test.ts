import { createHash } from 'crypto'
import { createMocks } from 'node-mocks-http'

const mockTransaction = {
  $executeRaw: jest.fn(),
  taskShareLink: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    maintenanceTask: { findFirst: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTransaction) => unknown) => callback(mockTransaction)),
  },
}))
jest.mock('@/lib/apiAuth', () => ({
  assertSameOrigin: jest.fn(() => true),
  requireTenantContext: jest.fn(() =>
    Promise.resolve({
      session: { user: { id: 'manager-1' } },
      tenant: {
        ownerId: 'owner-1',
        teamId: 'team-1',
        role: 'MANAGER',
        resourceWhere: { OR: [{ teamId: 'team-1' }] },
      },
    })
  ),
}))
jest.mock('@/lib/permissions', () => ({ canManageMaintenance: jest.fn(() => true) }))

import handler from '@/pages/api/maintenance/[id]/share'
import { prisma } from '@/lib/prisma'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'

const originalNodeEnv = process.env.NODE_ENV
const originalNextAuthUrl = process.env.NEXTAUTH_URL
const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

function setNodeEnv(value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
  else Reflect.set(process.env, 'NODE_ENV', value)
}

describe('POST /api/maintenance/[id]/share', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setNodeEnv('test')
    process.env.NEXTAUTH_URL = 'https://fleet.example.com/path/'
    delete process.env.NEXT_PUBLIC_APP_URL
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(prisma.maintenanceTask.findFirst as jest.Mock).mockResolvedValue({ id: 'task-1' })
    mockTransaction.$executeRaw.mockResolvedValue(0)
  })

  afterAll(() => {
    setNodeEnv(originalNodeEnv)
    if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = originalNextAuthUrl
    if (originalPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl
  })

  it('revokes the active link and issues a fresh one inside the task-scoped lock', async () => {
    mockTransaction.taskShareLink.updateMany.mockResolvedValue({ count: 1 })
    mockTransaction.taskShareLink.create.mockResolvedValue({})

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'task-1' },
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    await handler(req as never, res as never)

    expect(mockTransaction.$executeRaw).toHaveBeenCalledTimes(1)
    expect(mockTransaction.taskShareLink.updateMany).toHaveBeenCalledWith({
      where: {
        taskId: 'task-1',
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { revokedAt: expect.any(Date) },
    })
    expect(res._getStatusCode()).toBe(200)
    const body = JSON.parse(res._getData())
    expect(body.token).toMatch(/^[a-f0-9]{48}$/)
    expect(body.url).toBe(`https://fleet.example.com/task/${body.token}`)
  })

  it('stores only the sha256 hash of the share token', async () => {
    mockTransaction.taskShareLink.updateMany.mockResolvedValue({ count: 0 })
    mockTransaction.taskShareLink.create.mockResolvedValue({})

    const { req, res } = createMocks({
      method: 'POST',
      query: { id: 'task-1' },
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    await handler(req as never, res as never)

    const { token } = JSON.parse(res._getData())
    expect(mockTransaction.taskShareLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 'task-1',
        ownerId: 'owner-1',
        token: createHash('sha256').update(token).digest('hex'),
        expiresAt: expect.any(Date),
      }),
    })
    const stored = mockTransaction.taskShareLink.create.mock.calls[0][0].data.token
    expect(stored).not.toBe(token)
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
    setNodeEnv('production')
    process.env.NEXTAUTH_URL = 'http://fleet.example.com'
    const { req, res } = createMocks({ method: 'POST', query: { id: 'task-1' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(503)
    expect(prisma.maintenanceTask.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
