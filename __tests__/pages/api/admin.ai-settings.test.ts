import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn(), assertSameOrigin: jest.fn(() => true) }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiWorkspaceConfig: { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    aiControlAudit: { create: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(require('@/lib/prisma').prisma)),
  },
}))
import handler from '@/pages/api/admin/ai-settings'
import { requireTenantContext, assertSameOrigin } from '@/lib/apiAuth'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { prisma } from '@/lib/prisma'
const tenant = {
    ownerId: 'owner-1',
    teamId: 'team-1',
    role: 'ADMIN',
    resourceWhere: { OR: [] },
    auditWhere: { OR: [] },
  },
  context = { session: { user: { id: 'admin-1' } }, tenant },
  body = { enabled: false, retentionDays: 30, killSwitch: true, expectedConfigVersion: 1 }
describe('/api/admin/ai-settings concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    ;(assertSameOrigin as jest.Mock).mockReturnValue(true)
    ;(rateLimitMiddleware as jest.Mock).mockResolvedValue(true)
    delete process.env.AI_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
  })
  test('rejects stale version without clearing kill switch or auditing', async () => {
    ;(prisma.aiWorkspaceConfig.findUnique as jest.Mock).mockResolvedValue({
      enabled: false,
      killSwitch: true,
      retentionDays: 30,
      provider: 'disabled',
      modelVersion: 'none@v1',
      configVersion: 2,
    })
    const { req, res } = createMocks({ method: 'PUT', body: { ...body, killSwitch: false } })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(409)
    expect(prisma.aiWorkspaceConfig.updateMany).not.toHaveBeenCalled()
    expect(prisma.aiControlAudit.create).not.toHaveBeenCalled()
  })
  test('atomic compare-and-swap returns 409 when another writer wins', async () => {
    ;(prisma.aiWorkspaceConfig.findUnique as jest.Mock).mockResolvedValue({
      ...body,
      provider: 'disabled',
      modelVersion: 'none@v1',
      configVersion: 1,
    })
    ;(prisma.aiWorkspaceConfig.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
    const { req, res } = createMocks({ method: 'PUT', body: { ...body, retentionDays: 7 } })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(409)
    expect(prisma.aiControlAudit.create).not.toHaveBeenCalled()
  })
  test('updates exact version and writes uniquely ordered audit', async () => {
    const current = {
      enabled: false,
      killSwitch: true,
      retentionDays: 30,
      provider: 'disabled',
      modelVersion: 'none@v1',
      configVersion: 1,
    }
    ;(prisma.aiWorkspaceConfig.findUnique as jest.Mock)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...current, retentionDays: 7, configVersion: 2 })
    ;(prisma.aiWorkspaceConfig.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    const { req, res } = createMocks({ method: 'PUT', body: { ...body, retentionDays: 7 } })
    await handler(req as never, res as never)
    expect(res.statusCode).toBe(200)
    expect(prisma.aiWorkspaceConfig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scopeKey: 'team:team-1', configVersion: 1 },
        data: expect.objectContaining({ configVersion: 2 }),
      })
    )
    expect(prisma.aiControlAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scopeKey: 'team:team-1', configVersion: 2 }),
    })
  })
  test('rejects enabling disabled or misconfigured provider', async () => {
    ;(prisma.aiWorkspaceConfig.findUnique as jest.Mock).mockResolvedValue({
      enabled: false,
      killSwitch: false,
      retentionDays: 30,
      provider: 'disabled',
      modelVersion: 'none@v1',
      configVersion: 1,
    })
    let pair = createMocks({ method: 'PUT', body: { ...body, enabled: true, killSwitch: false } })
    await handler(pair.req as never, pair.res as never)
    expect(pair.res.statusCode).toBe(400)
    process.env.AI_PROVIDER = 'openai'
    process.env.OPENAI_MODEL = 'gpt'
    pair = createMocks({ method: 'PUT', body: { ...body, enabled: true, killSwitch: false } })
    await handler(pair.req as never, pair.res as never)
    expect(pair.res.statusCode).toBe(400)
  })
  test('role same-origin rate and tamper gates remain closed', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ ...context, tenant: { ...tenant, role: 'VIEWER' } })
    let pair = createMocks({ method: 'PUT', body })
    await handler(pair.req as never, pair.res as never)
    expect(pair.res.statusCode).toBe(403)
    ;(requireTenantContext as jest.Mock).mockResolvedValue(context)
    pair = createMocks({ method: 'PUT', body: { ...body, teamId: 'x' } })
    await handler(pair.req as never, pair.res as never)
    expect(pair.res.statusCode).toBe(400)
  })
})
