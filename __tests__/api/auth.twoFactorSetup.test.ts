import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/auth', () => ({ getUserFromRequest: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ encryptSecret: jest.fn(() => 'encrypted-secret') }))
jest.mock('@/lib/tokens', () => ({
  generateBackupCodes: jest.fn(() => Array.from({ length: 10 }, (_, i) => `${String(i).padStart(4, '0')}-1111-2222`)),
}))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('speakeasy', () => ({
  __esModule: true,
  default: {
    generateSecret: jest.fn(() => ({
      base32: 'BASE32SECRET',
      otpauth_url: 'otpauth://totp/Fleetvera',
    })),
  },
}))
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,qr')) },
}))
jest.mock('bcryptjs', () => ({ hashSync: jest.fn((value: string) => `hash(${value})`) }))

import handler from '@/pages/api/auth/2fa/setup'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('POST /api/auth/2fa/setup', () => {
  beforeEach(() => jest.clearAllMocks())

  it('stores the encrypted seed and server-generated backup-code hashes together', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      twoFactorEnabled: false,
    })

    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        twoFactorSecret: 'encrypted-secret',
        backupCodes: JSON.stringify(
          Array.from({ length: 10 }, (_, i) => `hash(${String(i).padStart(4, '0')}-1111-2222)`)
        ),
      },
    })
    const body = JSON.parse(res._getData())
    expect(body.backupCodes).toHaveLength(10)
  })
})
