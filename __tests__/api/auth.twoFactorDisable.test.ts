import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getUserFromRequest: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'SECRET') }))
jest.mock('speakeasy', () => ({ totp: { verify: jest.fn(() => true) } }))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))

import handler from '@/pages/api/auth/2fa/disable'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('passwordless 2FA disable', () => {
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
})
