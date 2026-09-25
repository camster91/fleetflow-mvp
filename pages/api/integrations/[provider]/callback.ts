import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../lib/prisma'
import { encryptCredentialEnvelope, hashOAuthState, sanitizeProviderError } from '../../../../lib/integrations/oauth'
import { providerEndpoint, providerFromRequest, requireIntegrationAdmin } from '../../../../lib/integrations/runtime'
import { fetchJsonBounded, ProviderHttpError } from '../../../../lib/integrations/sync'
import { enforceIntegrationRateLimit } from '../../../../lib/integrations/rateLimit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const provider = providerFromRequest(req, res)
  if (!provider) return
  if (provider.id !== 'quickbooks') return res.status(404).json({ error: 'This provider has no OAuth callback' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const context = await requireIntegrationAdmin(req, res)
  if (!context) return
  if (!(await enforceIntegrationRateLimit(context.session.user.id, context.scopeKey, provider.id, 'callback', res)))
    return
  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code
  const state = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state
  const realmId = Array.isArray(req.query.realmId) ? req.query.realmId[0] : req.query.realmId
  const redirectFailure = (status: 'oauth_invalid' | 'oauth_failed' | 'connection_changed') =>
    res.redirect(303, `/settings/integrations?integration=quickbooks&status=${status}`)
  if (!code || !state || !realmId || code.length > 512 || state.length > 256 || realmId.length > 128)
    return redirectFailure('oauth_invalid')
  const oauthState = await prisma.integrationOAuthState.findUnique({
    where: { stateDigest: hashOAuthState(state) },
    include: { connection: true },
  })
  if (
    !oauthState ||
    oauthState.connection.scopeKey !== context.scopeKey ||
    oauthState.connection.provider !== provider.id ||
    oauthState.generation !== oauthState.connection.generation ||
    oauthState.connection.revokedAt ||
    oauthState.connection.status !== 'CONNECTING' ||
    oauthState.consumedAt ||
    oauthState.expiresAt <= new Date()
  )
    return redirectFailure('oauth_invalid')
  const consumed = await prisma.integrationOAuthState.updateMany({
    where: {
      id: oauthState.id,
      generation: oauthState.generation,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      connection: { generation: oauthState.generation, revokedAt: null, status: 'CONNECTING' },
    },
    data: { consumedAt: new Date() },
  })
  if (consumed.count !== 1) return redirectFailure('connection_changed')
  try {
    const tokens = (await fetchJsonBounded(
      providerEndpoint('QUICKBOOKS_TOKEN_URL', 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'),
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
        }),
      },
      64_000,
      2
    )) as Record<string, unknown>
    if (
      typeof tokens.access_token !== 'string' ||
      tokens.access_token.length > 8192 ||
      typeof tokens.expires_in !== 'number' ||
      !Number.isFinite(tokens.expires_in) ||
      tokens.expires_in <= 0
    )
      throw new Error('invalid token response')
    const accessToken = tokens.access_token
    const expiresIn = tokens.expires_in
    const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(' ').filter(Boolean).slice(0, 20) : []
    if (!scopes.includes('com.intuit.quickbooks.accounting')) throw new Error('required scope missing')
    const completed = await prisma.$transaction(async (tx) => {
      const changed = await tx.integrationConnection.updateMany({
        where: {
          id: oauthState.connectionId,
          generation: oauthState.generation,
          revokedAt: null,
          status: 'CONNECTING',
        },
        data: {
          credentialEnvelope: encryptCredentialEnvelope(
            {
              accessToken,
              refreshToken: typeof tokens.refresh_token === 'string' ? tokens.refresh_token : undefined,
              realmId,
            },
            context.scopeKey,
            provider.id
          ),
          externalAccountRef: realmId,
          scopes: JSON.stringify(scopes),
          tokenExpiresAt: new Date(Date.now() + Math.min(expiresIn, 86400) * 1000),
          refreshTokenExpiresAt:
            typeof tokens.x_refresh_token_expires_in === 'number' &&
            Number.isFinite(tokens.x_refresh_token_expires_in) &&
            tokens.x_refresh_token_expires_in > 0
              ? new Date(Date.now() + Math.min(tokens.x_refresh_token_expires_in, 10_000_000) * 1000)
              : null,
          status: 'CONNECTED',
          lastErrorCode: null,
        },
      })
      if (changed.count !== 1) return false
      await tx.auditLog.create({
        data: {
          userId: context.session.user.id,
          teamId: context.tenant.teamId,
          userName: context.session.user.name,
          userRole: context.tenant.role,
          action: 'integration_oauth_completed',
          entityType: 'integration',
          entityId: oauthState.connectionId,
          entityName: provider.id,
          description: `${provider.name} authorization completed`,
          metadata: JSON.stringify({ provider: provider.id, generation: oauthState.generation }),
        },
      })
      return true
    })
    if (!completed) return redirectFailure('connection_changed')
    return res.redirect(303, '/settings/integrations?connected=quickbooks')
  } catch (error) {
    const unusable =
      error instanceof ProviderHttpError && (error.status === 401 || error.providerCode === 'invalid_grant')
    await prisma.$transaction(async (tx) => {
      const changed = await tx.integrationConnection.updateMany({
        where: {
          id: oauthState.connectionId,
          generation: oauthState.generation,
          revokedAt: null,
          status: 'CONNECTING',
        },
        data: {
          status: 'RECONNECT_REQUIRED',
          lastErrorCode: unusable ? 'OAUTH_RECONNECT_REQUIRED' : 'OAUTH_EXCHANGE_FAILED',
          ...(unusable
            ? {
                credentialEnvelope: null,
                tokenExpiresAt: null,
                refreshTokenExpiresAt: null,
                scopes: '[]',
                externalAccountRef: null,
              }
            : {}),
        },
      })
      if (changed.count === 1)
        await tx.auditLog.create({
          data: {
            userId: context.session.user.id,
            teamId: context.tenant.teamId,
            userName: context.session.user.name,
            userRole: context.tenant.role,
            action: 'integration_oauth_failed',
            entityType: 'integration',
            entityId: oauthState.connectionId,
            entityName: provider.id,
            description: `${provider.name} authorization failed`,
            metadata: JSON.stringify({
              provider: provider.id,
              generation: oauthState.generation,
              errorCode: unusable ? 'OAUTH_RECONNECT_REQUIRED' : 'OAUTH_EXCHANGE_FAILED',
            }),
          },
        })
    })
    void sanitizeProviderError(error)
    return redirectFailure('oauth_failed')
  }
}
