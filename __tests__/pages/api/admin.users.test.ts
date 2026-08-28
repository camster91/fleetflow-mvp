import { createMocks } from 'node-mocks-http'

const tx = {
  user: { update: jest.fn(), delete: jest.fn() },
  auditLog: { create: jest.fn() },
}

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(),
  authOptions: {},
}))
jest.mock('@/lib/apiAuth', () => ({
  assertSameOrigin: jest.fn(() => true),
}))
jest.mock('@/lib/security', () => ({
  rateLimit: jest.fn(() => Promise.resolve(true)),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  },
}))

import handler from '@/pages/api/admin/users'
import { getServerSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/apiAuth'
import { rateLimit } from '@/lib/security'
import { prisma } from '@/lib/prisma'

describe('/api/admin/users mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(rateLimit as jest.Mock).mockResolvedValue(true)
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    })
  })

  it('rejects a cross-origin mutation before rate limiting or session lookup', async () => {
    ;(assertSameOrigin as jest.Mock).mockReturnValue(false)
    const { req, res } = createMocks({
      method: 'PATCH',
      body: { userId: 'user-1', role: 'viewer' },
    })

    await handler(req as never, res as never)

    expect(rateLimit).not.toHaveBeenCalled()
    expect(getServerSession).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('updates a role and writes its audit record in one transaction', async () => {
    tx.user.update.mockResolvedValue({
      id: 'user-1', name: 'User', email: 'user@example.com', role: 'viewer',
    })
    tx.auditLog.create.mockResolvedValue({ id: 'audit-1' })
    const { req, res } = createMocks({
      method: 'PATCH',
      body: { userId: 'user-1', role: 'viewer' },
      headers: {
        origin: 'https://fleet.example.com',
        host: 'fleet.example.com',
        'user-agent': 'test-agent',
      },
    })

    await handler(req as never, res as never)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1' },
      data: { role: 'viewer' },
    }))
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'USER_ROLE_CHANGED',
        entityId: 'user-1',
        metadata: expect.stringContaining('"newRole":"viewer"'),
      }),
    })
    expect(res._getStatusCode()).toBe(200)
  })

  it('deletes a user and writes its audit record in one transaction', async () => {
    tx.user.delete.mockResolvedValue({ id: 'user-1' })
    tx.auditLog.create.mockResolvedValue({ id: 'audit-1' })
    const { req, res } = createMocks({
      method: 'DELETE',
      body: { userId: 'user-1' },
      headers: { origin: 'https://fleet.example.com', host: 'fleet.example.com' },
    })

    await handler(req as never, res as never)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'USER_DELETED',
        entityId: 'user-1',
      }),
    })
    expect(res._getStatusCode()).toBe(200)
  })
})
