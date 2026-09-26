import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/rateLimit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/entitlements', () => ({
  ...jest.requireActual('@/lib/entitlements'),
  getWorkspaceEntitlement: jest.fn(),
}))

import handler from '@/pages/api/subscription/entitlement'
import { requireTenantContext } from '@/lib/apiAuth'
import { getWorkspaceEntitlement, NOT_ENFORCED } from '@/lib/entitlements'

function asRole(role: string) {
  ;(requireTenantContext as jest.Mock).mockResolvedValue({
    session: { user: { id: 'u1' } },
    tenant: { ownerId: 'owner', teamId: 'team-1', role },
  })
}

async function get(method = 'GET') {
  const { req, res } = createMocks({ method: method as never })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/subscription/entitlement', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects other methods', async () => {
    expect((await get('POST'))._getStatusCode()).toBe(405)
  })

  it('reports the owner-scoped state to every member, offering billing only to managers', async () => {
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue({
      enforced: true,
      access: 'READ_ONLY',
      reason: 'TRIAL_EXPIRED',
      trialEndsAt: new Date('2027-01-15T00:00:00Z'),
      graceEndsAt: null,
      accessEndsAt: null,
      readOnlySince: new Date('2027-01-15T00:00:00Z'),
    })
    for (const [role, canManageBilling] of [
      ['OWNER', true],
      ['ADMIN', true],
      ['DRIVER', false],
      ['VIEWER', false],
    ] as const) {
      asRole(role)
      const res = await get()
      expect(res._getStatusCode()).toBe(200)
      expect(res.getHeader('Cache-Control')).toBe('private, no-store')
      expect(res._getJSONData()).toEqual({
        entitlement: {
          enforced: true,
          access: 'READ_ONLY',
          reason: 'TRIAL_EXPIRED',
          trialEndsAt: '2027-01-15T00:00:00.000Z',
          graceEndsAt: null,
          accessEndsAt: null,
          readOnlySince: '2027-01-15T00:00:00.000Z',
        },
        canManageBilling,
      })
    }
    expect(getWorkspaceEntitlement).toHaveBeenCalledWith('owner')
  })

  it('reports not enforced during the beta', async () => {
    asRole('OWNER')
    ;(getWorkspaceEntitlement as jest.Mock).mockResolvedValue(NOT_ENFORCED)
    const res = await get()
    expect(res._getJSONData().entitlement).toMatchObject({ enforced: false, access: 'FULL' })
  })
})
