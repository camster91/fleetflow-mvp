import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { createProviderRegistry } from '../../../lib/integrations/types'
import { publicConnection, requireIntegrationAdmin } from '../../../lib/integrations/runtime'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireIntegrationAdmin(req, res)
  if (!context) return
  const registry = createProviderRegistry()
  const existing = await prisma.integrationConnection.findMany({ where: { scopeKey: context.scopeKey } })
  const byProvider = new Map(existing.map((item) => [item.provider, item]))
  return res.status(200).json({
    integrations: registry.list().map((provider) => {
      const connection = byProvider.get(provider.id)
      return connection
        ? {
            ...publicConnection(connection, provider.readiness()),
            name: provider.name,
            authMode: provider.authMode,
            capabilities: provider.capabilities,
          }
        : {
            provider: provider.id,
            name: provider.name,
            authMode: provider.authMode,
            capabilities: provider.capabilities,
            status: 'DISCONNECTED',
            connected: false,
            needsReconnect: false,
            readiness: provider.readiness(),
            scopes: [],
            tokenExpiresAt: null,
            lastSyncAt: null,
            nextSyncAt: null,
            lastErrorCode: null,
          }
    }),
  })
}
