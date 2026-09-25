import { createMocks } from 'node-mocks-http'

const backupCodes = Array.from({ length: 10 }, (_, i) =>
  `${String(i).padStart(4, '0')}-1111-2222`
)
const storedBackupCodes = backupCodes.map((code) => `hash(${code})`)

jest.mock('@/lib/auth', () => ({
  getUserFromRequest: jest.fn(),
  signToken: jest.fn(() => 'rotated-session'),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: jest.fn(), updateMany: jest.fn() } },
}))
jest.mock('@/lib/cryptoSecrets', () => ({ decryptSecret: jest.fn(() => 'BASE32SECRET') }))
jest.mock('@/lib/apiAuth', () => ({ assertSameOrigin: jest.fn(() => true) }))
jest.mock('speakeasy', () => ({
  __esModule: true,
  default: { totp: { verifyDelta: jest.fn(() => ({ delta: -1 })) } },
}))
jest.mock('bcryptjs', () => ({
  compareSync: jest.fn((value: string, hash: string) => hash === `hash(${value})`),
}))
jest.mock('@/lib/email', () => ({ sendBackupCodesEmail: jest.fn(() => Promise.resolve()) }))

import handler from '@/pages/api/auth/2fa/verify'
import { getUserFromRequest, signToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendBackupCodesEmail } from '@/lib/email'

describe('POST /api/auth/2fa/verify setup', () => {
  beforeEach(() => jest.clearAllMocks())

  it('atomically enables the exact server-generated setup snapshot', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      role: 'fleet_manager',
      tokenVersion: 2,
      twoFactorEnabled: false,
      twoFactorSecret: 'encrypted-secret',
      backupCodes: JSON.stringify(storedBackupCodes),
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const { req, res } = createMocks({
      method: 'POST',
      body: { code: '123456', backupCodes, isSetup: true },
    })
    const before = Math.floor(Date.now() / 1000 / 30) - 1
    await handler(req as never, res as never)
    const after = Math.floor(Date.now() / 1000 / 30) - 1

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'u1',
        twoFactorEnabled: false,
        twoFactorSecret: 'encrypted-secret',
        backupCodes: JSON.stringify(storedBackupCodes),
      },
      data: { twoFactorEnabled: true, lastTotpStep: expect.any(Number), tokenVersion: { increment: 1 } },
    })
    // The matched setup step (current step + delta) is stored atomically with
    // enabling 2FA, so /api/auth/2fa/validate rejects a replay of this code.
    const recordedStep = (prisma.user.updateMany as jest.Mock).mock.calls[0][0].data.lastTotpStep
    expect(recordedStep).toBeGreaterThanOrEqual(before)
    expect(recordedStep).toBeLessThanOrEqual(after)
    // Enabling 2FA revokes other sessions and re-issues this one at the new version.
    expect(signToken).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u1', tv: 3 }))
    expect(res.getHeader('set-cookie')).toEqual(expect.stringContaining('token=rotated-session'))
    expect(sendBackupCodesEmail).toHaveBeenCalledWith(
      'user@example.com',
      'User',
      backupCodes
    )
    expect(res._getStatusCode()).toBe(200)
  })

  it('rejects client-supplied backup codes that do not match the stored setup', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      twoFactorEnabled: false,
      twoFactorSecret: 'encrypted-secret',
      backupCodes: JSON.stringify(storedBackupCodes),
    })

    const changedCodes = [...backupCodes]
    changedCodes[0] = '9999-9999-9999'
    const { req, res } = createMocks({
      method: 'POST',
      body: { code: '123456', backupCodes: changedCodes, isSetup: true },
    })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(400)
    expect(prisma.user.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a verified code when setup changed concurrently', async () => {
    ;(getUserFromRequest as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      name: 'User',
      twoFactorEnabled: false,
      twoFactorSecret: 'encrypted-secret',
      backupCodes: JSON.stringify(storedBackupCodes),
    })
    ;(prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const { req, res } = createMocks({
      method: 'POST',
      body: { code: '123456', backupCodes, isSetup: true },
    })
    await handler(req as never, res as never)

    expect(res._getStatusCode()).toBe(409)
    expect(sendBackupCodesEmail).not.toHaveBeenCalled()
  })
})
