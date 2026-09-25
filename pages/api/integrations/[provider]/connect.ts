import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { createOAuthChallenge, decryptCredentialEnvelope } from '../../../../lib/integrations/oauth'
import { providerEndpoint, providerFromRequest, requireIntegrationAdmin } from '../../../../lib/integrations/runtime'
import { enforceIntegrationRateLimit } from '../../../../lib/integrations/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = providerFromRequest(req, res)
  if (!provider) return
  if (!['POST', 'DELETE'].includes(req.method || '')) return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireIntegrationAdmin(req, res, true)
  if (!context) return
  if (!(await enforceIntegrationRateLimit(context.session.user.id, context.scopeKey, provider.id, 'connect', res)))
    return

  if (req.method === 'DELETE') {
    const connection = await prisma.integrationConnection.findUnique({
      where: { scopeKey_provider: { scopeKey: context.scopeKey, provider: provider.id } },
    })
    if (!connection) return res.status(204).end()
    let revocationFailed = false
    if (provider.id === 'quickbooks' && connection.credentialEnvelope) {
      try {
        const credential = decryptCredentialEnvelope(connection.credentialEnvelope, context.scopeKey, provider.id)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        try {
          const response = await fetch(
            providerEndpoint('QUICKBOOKS_REVOKE_URL', 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'),
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
              },
              body: new URLSearchParams({ token: credential.refreshToken || credential.accessToken }),
              signal: controller.signal,
            }
          )
          revocationFailed = !response.ok
        } finally {
          clearTimeout(timer)
        }
      } catch {
        revocationFailed = true
      }
    }
    const disconnected = await prisma.$transaction(async (tx) => {
      const changed = await tx.integrationConnection.updateMany({
        where: { id: connection.id, generation: connection.generation },
        data: {
          generation: { increment: 1 },
          credentialEnvelope: null,
          externalAccountRef: null,
          tokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scopes: '[]',
          status: 'DISCONNECTED',
          revokedAt: new Date(),
          lockToken: null,
          lockExpiresAt: null,
          syncCursor: null,
          lastErrorCode: revocationFailed ? 'REVOCATION_UNCONFIRMED' : null,
        },
      })
      if (changed.count !== 1) return false
      await tx.integrationOAuthState.deleteMany({
        where: { connectionId: connection.id, generation: connection.generation },
      })
      await tx.integrationSyncJob.updateMany({
        where: { connectionId: connection.id, generation: connection.generation, status: 'RUNNING' },
        data: { status: 'CANCELLED', errorCode: 'CONNECTION_REVOKED', completedAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          userId: context.session.user.id,
          teamId: context.tenant.teamId,
          userName: context.session.user.name,
          userRole: context.tenant.role,
          action: 'integration_disconnected',
          entityType: 'integration',
          entityId: connection.id,
          entityName: provider.id,
          description: `Disconnected ${provider.name}`,
          metadata: JSON.stringify({
            provider: provider.id,
            revocationConfirmed: !revocationFailed,
            generation: connection.generation,
          }),
        },
      })
      return true
    })
    if (!disconnected) return res.status(409).json({ error: 'Connection changed; reload and try again' })
    return res.status(200).json({ disconnected: true, revocationConfirmed: !revocationFailed })
  }

  const readiness = provider.readiness()
  if (!readiness.ready) return res.status(503).json({ error: readiness.reason })
  const connection = await prisma.$transaction(async (tx) => {
    const value = await tx.integrationConnection.upsert({
      where: { scopeKey_provider: { scopeKey: context.scopeKey, provider: provider.id } },
      create: {
        ownerId: context.tenant.ownerId,
        teamId: context.tenant.teamId,
        scopeKey: context.scopeKey,
        provider: provider.id,
        status: provider.id === 'google-maps' ? 'CONNECTED' : 'CONNECTING',
      },
      update: {
        generation: { increment: 1 },
        status: provider.id === 'google-maps' ? 'CONNECTED' : 'CONNECTING',
        revokedAt: null,
        lastErrorCode: null,
        lockToken: null,
        lockExpiresAt: null,
      },
    })
    await tx.auditLog.create({
      data: {
        userId: context.session.user.id,
        teamId: context.tenant.teamId,
        userName: context.session.user.name,
        userRole: context.tenant.role,
        action: 'integration_connect_started',
        entityType: 'integration',
        entityId: value.id,
        entityName: provider.id,
        description: `${provider.name} connection started`,
        metadata: JSON.stringify({ provider: provider.id, generation: value.generation }),
      },
    })
    return value
  })
  if (provider.id === 'google-maps') return res.status(200).json({ connected: true })

  const challenge = createOAuthChallenge()
  await prisma.integrationOAuthState.deleteMany({
    where: { connectionId: connection.id, expiresAt: { lte: new Date() } },
  })
  await prisma.integrationOAuthState.create({
    data: {
      connectionId: connection.id,
      stateDigest: challenge.stateDigest,
      generation: connection.generation,
      redirectPath: '/settings/integrations',
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  })
  const url = new URL('https://appcenter.intuit.com/connect/oauth2')
  url.searchParams.set('client_id', process.env.QUICKBOOKS_CLIENT_ID!)
  url.searchParams.set('redirect_uri', process.env.QUICKBOOKS_REDIRECT_URI!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  url.searchParams.set('state', challenge.state)
  return res.status(200).json({ authorizationUrl: url.toString() })
}
