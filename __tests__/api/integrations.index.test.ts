import { createMocks } from 'node-mocks-http'

jest.mock('@/lib/integrations/runtime', () => ({
  ...jest.requireActual('@/lib/integrations/runtime'),
  requireIntegrationAdmin: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({ prisma: { integrationConnection: { findMany: jest.fn() } } }))

import handler from '@/pages/api/integrations/index'
import { requireIntegrationAdmin } from '@/lib/integrations/runtime'
import { createProviderRegistry } from '@/lib/integrations/types'
import { prisma } from '@/lib/prisma'

async function get(method = 'GET') {
  const { req, res } = createMocks({ method: method as never })
  await handler(req as never, res as never)
  return res
}

describe('GET /api/integrations', () => {
  const providers = createProviderRegistry().list()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(requireIntegrationAdmin as jest.Mock).mockResolvedValue({ scopeKey: 'team:team-1' })
  })

  it('rejects other methods', async () => {
    const res = await get('POST')
    expect(res._getStatusCode()).toBe(405)
    expect(requireIntegrationAdmin).not.toHaveBeenCalled()
  })

  it('stops when the caller is not an integration admin', async () => {
    ;(requireIntegrationAdmin as jest.Mock).mockResolvedValue(null)
    await get()
    expect(prisma.integrationConnection.findMany).not.toHaveBeenCalled()
  })

  it('lists every registered provider as disconnected when nothing is connected', async () => {
    ;(prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([])
    const res = await get()
    expect(res._getStatusCode()).toBe(200)
    expect(prisma.integrationConnection.findMany).toHaveBeenCalledWith({ where: { scopeKey: 'team:team-1' } })
    const { integrations } = res._getJSONData()
    expect(integrations.map((item: { provider: string }) => item.provider)).toEqual(providers.map((p) => p.id))
    for (const item of integrations) {
      expect(item).toMatchObject({ status: 'DISCONNECTED', connected: false, needsReconnect: false, scopes: [] })
    }
  })

  it('shows connection state without exposing stored credentials', async () => {
    const provider = providers[0]
    ;(prisma.integrationConnection.findMany as jest.Mock).mockResolvedValue([
      {
        provider: provider.id,
        scopeKey: 'team:team-1',
        status: 'RECONNECT_REQUIRED',
        scopes: JSON.stringify(['read', 42]),
        credentialEnvelope: 'ciphertext-envelope',
        externalAccountRef: 'ciphertext-account',
        syncCursor: 'ciphertext-cursor',
        lockToken: 'ciphertext-lock',
        tokenExpiresAt: null,
        lastSyncAt: null,
        nextSyncAt: null,
        lastErrorCode: 'TOKEN_EXPIRED',
      },
    ])
    const res = await get()
    const body = JSON.stringify(res._getJSONData())
    expect(body).not.toContain('ciphertext')
    const item = res._getJSONData().integrations[0]
    expect(item).toMatchObject({
      provider: provider.id,
      name: provider.name,
      status: 'RECONNECT_REQUIRED',
      connected: false,
      needsReconnect: true,
      scopes: ['read'],
      lastErrorCode: 'TOKEN_EXPIRED',
    })
  })
})
