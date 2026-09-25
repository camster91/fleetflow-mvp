import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../prisma'
import { assertSameOrigin, requireTenantContext } from '../apiAuth'
import { canManageIntegrations } from '../permissions'
import { createProviderRegistry } from './types'
import type { IntegrationConnection } from '@prisma/client'

export const scopeKeyFor = (ownerId: string, teamId: string | null) => (teamId ? `team:${teamId}` : `owner:${ownerId}`)

export async function requireIntegrationAdmin(req: NextApiRequest, res: NextApiResponse, mutate = false) {
  const context = await requireTenantContext(req, res)
  if (!context) return null
  if (!canManageIntegrations(context.tenant.role)) {
    res.status(403).json({ error: 'Owner or admin access is required' })
    return null
  }
  if (mutate && !assertSameOrigin(req, res)) return null
  return { ...context, scopeKey: scopeKeyFor(context.tenant.ownerId, context.tenant.teamId) }
}

export function providerFromRequest(req: NextApiRequest, res: NextApiResponse) {
  const raw = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider
  const provider = raw ? createProviderRegistry().get(raw) : undefined
  if (!provider) res.status(404).json({ error: 'Integration provider not found' })
  return provider || null
}

export function publicConnection(connection: IntegrationConnection, readiness: { ready: boolean; reason?: string }) {
  return {
    provider: connection.provider,
    status: connection.status,
    connected: connection.status === 'CONNECTED',
    scopes: safeStringArray(connection.scopes),
    tokenExpiresAt: connection.tokenExpiresAt,
    lastSyncAt: connection.lastSyncAt,
    nextSyncAt: connection.nextSyncAt,
    lastErrorCode: connection.lastErrorCode,
    needsReconnect: connection.status === 'RECONNECT_REQUIRED',
    readiness,
  }
}

function safeStringArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(typeof value === 'string' ? value : '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 20) : []
  } catch {
    return []
  }
}

export function payloadHash(payload: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export function providerEndpoint(envName: 'QUICKBOOKS_TOKEN_URL' | 'QUICKBOOKS_REVOKE_URL', official: string) {
  const configured = process.env[envName]
  if (!configured) return official
  const url = new URL(configured)
  const loopback =
    process.env.INTEGRATION_ALLOW_TEST_PROVIDERS === '1' &&
    process.env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname)
  if (!loopback) throw new Error('Provider endpoint override is not allowed')
  return url.toString()
}

export async function findScopedConnection(scopeKey: string, provider: string) {
  return prisma.integrationConnection.findUnique({ where: { scopeKey_provider: { scopeKey, provider } } })
}
