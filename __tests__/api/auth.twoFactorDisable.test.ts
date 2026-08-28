import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getUserFromRequest: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'SECRET') }))
jest.mock('speakeasy', () => ({ totp: { verify: jest.fn(() => true) } }))
jest.mock('bcryptjs', () => ({ compareSync: jest.fn(() => false) }))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))

import handler from '@/pages/api/auth/2fa/disable'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import speakeasy from 'speakeasy'
import bcrypt from 'bcryptjs'

describe('passwordless 2FA disable', () => {
  beforeEach(() => jest.clearAllMocks())

  it('disables 2FA with a valid authenticator code when no password exists', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1', password: null, twoFactorEnabled: true,
      twoFactorSecret: 'encrypted', backupCodes: null,
    })
    const { req, res } = createMocks({ method: 'POST', body: { code: '123456' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: null },
    })
  })

  it('does not disable 2FA when a backup code was consumed concurrently', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(speakeasy.totp.verify as jest.Mock).mockReturnValue(false)
    ;(bcrypt.compareSync as jest.Mock).mockReturnValue(true)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1', password: null, twoFactorEnabled: true,
      twoFactorSecret: 'encrypted', backupCodes: '["hashed-backup-code"]',
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const { req, res } = createMocks({ method: 'POST', body: { code: 'backup-code' } })

    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
