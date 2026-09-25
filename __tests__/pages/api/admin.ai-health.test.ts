import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn(async () => true) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiWorkspaceConfig: { findUnique: jest.fn() },
    aiTelemetryBucket: { findMany: jest.fn() },
    aiEvaluationRun: { findFirst: jest.fn() },
  },
}))
import handler from '@/pages/api/admin/ai-health'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { aiConfigFingerprint } from '@/lib/ai/evaluation'
describe('/api/admin/ai-health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'admin' } },
      tenant: { ownerId: 'owner', teamId: 'team', role: 'OWNER' },
    })
    ;(prisma.aiWorkspaceConfig.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
      killSwitch: false,
      provider: 'openai',
      modelVersion: 'gpt-5-mini@2026-08',
      configVersion: 2,
      retentionDays: 30,
    })
    process.env.OPENAI_API_KEY = 'test'
    process.env.OPENAI_MODEL = 'gpt-5-mini@2026-08'
    ;(prisma.aiTelemetryBucket.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'a',
        requestCount: 2,
        latencyTotalMs: BigInt(300),
        inputTokens: BigInt(20),
        outputTokens: BigInt(10),
        status: 'generated',
        errorCode: '',
      },
      {
        id: 'b',
        requestCount: 1,
        latencyTotalMs: BigInt(300),
        inputTokens: BigInt(0),
        outputTokens: BigInt(0),
        status: 'fallback',
        errorCode: 'timeout',
      },
    ])
    const captured = new Date()
    ;(prisma.aiEvaluationRun.findFirst as jest.Mock).mockResolvedValue({
      evaluationVersion: 'v2',
      mode: 'provider-quality-recorded',
      configFingerprint: aiConfigFingerprint('openai', 'gpt-5-mini@2026-08', '2'),
      capturedAt: captured,
      passed: true,
      createdAt: captured,
    })
  })
  test('returns full applicable aggregates without secrets', async () => {
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    const b = res._getJSONData()
    expect(b).toEqual(
      expect.objectContaining({
        status: 'enabled',
        requests: 3,
        averageLatencyMs: 200,
        cost: expect.objectContaining({ estimatedUsd: 0.000025 }),
        evaluation: expect.objectContaining({ mode: 'provider-quality-recorded', applicable: true, stale: false }),
      })
    )
    expect(JSON.stringify(b)).not.toMatch(/apiKey|secret|prompt|userId/i)
  })
  test('paginates all telemetry beyond 500 rows exactly', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({
      id: `b${i}`,
      requestCount: 1,
      latencyTotalMs: BigInt(1),
      inputTokens: BigInt(1),
      outputTokens: BigInt(1),
      status: 'generated',
      errorCode: '',
    }))
    ;(prisma.aiTelemetryBucket.findMany as jest.Mock)
      .mockResolvedValueOnce(rows.slice(0, 500))
      .mockResolvedValueOnce(rows.slice(500))
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getJSONData().requests).toBe(501)
    expect(prisma.aiTelemetryBucket.findMany).toHaveBeenCalledTimes(2)
    expect((prisma.aiTelemetryBucket.findMany as jest.Mock).mock.calls[1][0]).toEqual(
      expect.objectContaining({ cursor: { id: 'b499' }, skip: 1 })
    )
  })
  test('global kill overrides and stale or mismatched evaluation is not applicable', async () => {
    process.env.AI_KILL_SWITCH = 'true'
    ;(prisma.aiEvaluationRun.findFirst as jest.Mock).mockResolvedValue({
      evaluationVersion: 'v2',
      mode: 'provider-quality-recorded',
      configFingerprint: 'wrong',
      capturedAt: new Date(0),
      passed: true,
      createdAt: new Date(0),
    })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getJSONData()).toEqual(
      expect.objectContaining({
        status: 'killed',
        evaluation: expect.objectContaining({ applicable: false, stale: true }),
      })
    )
    delete process.env.AI_KILL_SWITCH
  })
  test('denies non-admin and unsupported methods', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({
      session: { user: { id: 'v' } },
      tenant: { ownerId: 'o', teamId: 't', role: 'VIEWER' },
    })
    let p = createMocks({ method: 'GET' })
    await handler(p.req as never, p.res as never)
    expect(p.res.statusCode).toBe(403)
    p = createMocks({ method: 'POST' })
    await handler(p.req as never, p.res as never)
    expect(p.res.statusCode).toBe(405)
  })
})
