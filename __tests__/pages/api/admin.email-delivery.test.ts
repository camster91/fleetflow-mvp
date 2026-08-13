import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn(), assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))
jest.mock('@/lib/emailConfig', () => ({ encryptMailgunApiKey: jest.fn(() => 'sealed'), publicEmailConfig: jest.fn(() => ({ configured: false })) }))
jest.mock('@/lib/prisma', () => ({ prisma: { emailDeliveryConfig: { findUnique: jest.fn() }, $transaction: jest.fn(async (callback: any) => callback({ emailDeliveryConfig: { upsert: jest.fn() }, auditLog: { create: jest.fn() } })) } }))

import handler from '@/pages/api/admin/email/delivery'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const context = (role: string) => ({ session: { user: { id: 'user-1', role, name: 'System admin' } }, tenant: { ownerId: 'owner-1', teamId: 'team-1', role: 'OWNER' } })

describe('/api/admin/email/delivery', () => {
  beforeEach(() => { jest.clearAllMocks() })

  it('denies a workspace owner before reading or writing the deployment-wide credential', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context('user'))
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(403)
    expect(prisma.emailDeliveryConfig.findUnique).not.toHaveBeenCalled()
  })

  it('allows a platform administrator to read only a safe configuration summary', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context('admin'))
    ;(prisma.emailDeliveryConfig.findUnique as jest.Mock).mockResolvedValue({ id: 'global', apiKeyEnvelope: 'secret' })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(res._getData()).not.toContain('secret')
  })
})
