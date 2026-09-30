import { createMocks } from 'node-mocks-http'

const mockTransaction = {
  user: { update: jest.fn(), delete: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
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
jest.mock('@/lib/email', () => ({ sendAccountInvitationEmail: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof mockTransaction) => unknown) => callback(mockTransaction)),
  },
}))

import handler from '@/pages/api/admin/users'
import { getServerSession } from '@/lib/auth'
import { assertSameOrigin } from '@/lib/apiAuth'
import { rateLimit } from '@/lib/security'
import { prisma } from '@/lib/prisma'
import { sendAccountInvitationEmail } from '@/lib/email'

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
    mockTransaction.user.update.mockResolvedValue({
      id: 'user-1',
      name: 'User',
      email: 'user@example.com',
      role: 'viewer',
    })
    mockTransaction.auditLog.create.mockResolvedValue({ id: 'audit-1' })
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
    expect(mockTransaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { role: 'viewer' },
      })
    )
    expect(mockTransaction.auditLog.create).toHaveBeenCalledWith({
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
    mockTransaction.user.delete.mockResolvedValue({ id: 'user-1' })
    mockTransaction.auditLog.create.mockResolvedValue({ id: 'audit-1' })
    const { req, res } = createMocks({
      method: 'DELETE',
      body: { userId: 'user-1' },
      headers: { origin: 'https://fleet.example.com', host: 'fleet.example.com' },
    })

    await handler(req as never, res as never)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockTransaction.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
    expect(mockTransaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'USER_DELETED',
        entityId: 'user-1',
      }),
    })
    expect(res._getStatusCode()).toBe(200)
  })

  it('records the proxy-appended client IP, not a spoofed first X-Forwarded-For hop', async () => {
    mockTransaction.user.update.mockResolvedValue({ id: 'user-1', role: 'viewer' })
    mockTransaction.auditLog.create.mockResolvedValue({ id: 'audit-1' })
    const { req, res } = createMocks({
      method: 'PATCH',
      body: { userId: 'user-1', role: 'viewer' },
      headers: {
        origin: 'https://fleet.example.com',
        host: 'fleet.example.com',
        'x-forwarded-for': '198.51.100.66, 203.0.113.7',
      },
    })

    await handler(req as never, res as never)

    const metadata = mockTransaction.auditLog.create.mock.calls[0][0].data.metadata as string
    expect(metadata).toContain('"ip":"203.0.113.7"')
    expect(metadata).not.toContain('198.51.100.66')
  })

  describe('POST (invite a customer)', () => {
    const created = { id: 'user-9', name: 'Riley', email: 'riley@acme.test', role: 'fleet_manager', company: 'Acme' }

    beforeEach(() => {
      mockTransaction.user.findUnique.mockResolvedValue(null)
      mockTransaction.user.create.mockResolvedValue(created)
      ;(sendAccountInvitationEmail as jest.Mock).mockResolvedValue({ success: true })
    })

    async function invite(body: unknown) {
      const { req, res } = createMocks({ method: 'POST', body: body as never })
      await handler(req as never, res as never)
      return res
    }

    it('is limited to platform admins', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u2', role: 'fleet_manager' } })
      const res = await invite({ email: 'riley@acme.test' })
      expect(res._getStatusCode()).toBe(403)
      expect(mockTransaction.user.create).not.toHaveBeenCalled()
    })

    it('rejects an invalid email or unknown fields', async () => {
      expect((await invite({ email: 'not-an-email' }))._getStatusCode()).toBe(400)
      expect((await invite({ email: 'riley@acme.test', role: 'admin' }))._getStatusCode()).toBe(400)
      expect(mockTransaction.user.create).not.toHaveBeenCalled()
    })

    it('creates a regular account (never admin), audits it and emails sign-in instructions', async () => {
      const res = await invite({ email: 'Riley@Acme.test', name: 'Riley', company: 'Acme' })
      expect(res._getStatusCode()).toBe(201)
      expect(mockTransaction.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { email: 'riley@acme.test', name: 'Riley', company: 'Acme' } })
      )
      expect(mockTransaction.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'admin-1', action: 'USER_INVITED', entityId: 'user-9' }),
      })
      expect(sendAccountInvitationEmail).toHaveBeenCalledWith('riley@acme.test', 'Admin')
      expect(res._getJSONData()).toMatchObject({ user: { id: 'user-9' }, emailSent: true })
    })

    it('refuses an email that already has an account', async () => {
      mockTransaction.user.findUnique.mockResolvedValue({ id: 'existing' })
      const res = await invite({ email: 'riley@acme.test' })
      expect(res._getStatusCode()).toBe(409)
      expect(mockTransaction.user.create).not.toHaveBeenCalled()
      expect(sendAccountInvitationEmail).not.toHaveBeenCalled()
    })

    it('still creates the account and reports it when the email fails', async () => {
      ;(sendAccountInvitationEmail as jest.Mock).mockRejectedValue(new Error('mailgun down'))
      const res = await invite({ email: 'riley@acme.test' })
      expect(res._getStatusCode()).toBe(201)
      expect(res._getJSONData().emailSent).toBe(false)
    })
  })
})
