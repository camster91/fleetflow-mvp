/**
 * Shared API authorization helpers for owner-scoped resources and CSRF checks.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions, type Session } from './auth'
import { prisma } from './prisma'
import { canManageTeam } from './permissions'
import type { TeamRole } from '../types'
import { parse as parseCookie } from 'cookie'
import { constantTimeCompare, hashToken } from './tokens'
import { consumePublicApiQuota } from './apiRateLimit'

export type AuthedSession = Session & { user: Session['user'] & { id: string } }

export class TenantContextError extends Error {
  constructor(
    public code: 'TENANT_SELECTION_REQUIRED' | 'TENANT_FORBIDDEN',
    message: string
  ) {
    super(message)
    this.name = 'TenantContextError'
  }
}

export interface TenantContext {
  ownerId: string
  teamId: string | null
  role: TeamRole
  resourceWhere:
    | { ownerId: string; teamId: null }
    | { OR: Array<{ teamId: string } | { ownerId: string; teamId: null }> }
  auditWhere:
    | { userId: string; teamId: null }
    | { OR: Array<{ teamId: string } | { userId: string; teamId: null }> }
}

export type ApiKeyScope = 'read'

export interface ApiKeyContext {
  apiKeyId: string
  user: { id: string; email: string; name: string | null }
  scopes: ApiKeyScope[]
  tenant: TenantContext
  apiResourceWhere: { teamId: string } | { ownerId: string; teamId: null }
}

export function apiError(res: NextApiResponse, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } })
}

function parseScopes(value: string): ApiKeyScope[] {
  return value.split(/[\s,]+/).filter((scope): scope is ApiKeyScope => scope === 'read')
}

/** Authenticate a public API request with a generated, hashed API key. */
export async function requireApiKey(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredScope: ApiKeyScope = 'read'
): Promise<ApiKeyContext | null> {
  const authorization = req.headers.authorization
  if (!authorization) {
    apiError(res, 401, 'API_KEY_MISSING', 'Provide an API key using Authorization: Bearer <key>')
    return null
  }

  const match = /^Bearer (ff_[a-f0-9]{64})$/i.exec(authorization)
  if (!match) {
    apiError(res, 401, 'API_KEY_MALFORMED', 'The Authorization header is malformed')
    return null
  }

  const presentedKey = match[1]
  const candidateHash = hashToken(presentedKey)
  let record
  try {
    record = await prisma.apiKey.findUnique({
      where: { key: candidateHash },
      select: {
        id: true, userId: true, key: true, scopes: true, revokedAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })
  } catch {
    console.error('API key authentication lookup failed')
    apiError(res, 500, 'INTERNAL_ERROR', 'Authentication could not be completed')
    return null
  }

  if (!record || record.revokedAt || !constantTimeCompare(candidateHash, record.key)) {
    apiError(res, 401, 'API_KEY_INVALID', 'The API key is invalid or revoked')
    return null
  }

  const scopes = parseScopes(record.scopes)
  if (!scopes.includes(requiredScope)) {
    apiError(res, 403, 'INSUFFICIENT_SCOPE', `This API key requires the ${requiredScope} scope`)
    return null
  }

  let quota
  try {
    quota = await consumePublicApiQuota(prisma, record.id)
  } catch {
    console.error('Public API durable rate limit failed')
    apiError(res, 503, 'RATE_LIMIT_UNAVAILABLE', 'Request quota could not be verified')
    return null
  }
  if (!quota.allowed) {
    const retryAfter = quota.retryAfter
    res.setHeader('Retry-After', String(retryAfter))
    apiError(res, 429, 'RATE_LIMITED', `Too many requests; try again in ${retryAfter} seconds`)
    return null
  }
  res.setHeader('X-RateLimit-Remaining', String(quota.remaining))

  const requested = req.headers['x-team-id']
  const selectedTeamId = Array.isArray(requested) ? requested[0] : requested
  let tenant: TenantContext
  try {
    tenant = await resolveTenantContext(record.userId, selectedTeamId)
  } catch (error) {
    if (error instanceof TenantContextError) {
      apiError(res, error.code === 'TENANT_SELECTION_REQUIRED' ? 409 : 403, error.code, error.message)
      return null
    }
    throw error
  }

  void prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => console.error('API key last-used update failed'))

  const apiResourceWhere = tenant.teamId
    ? { teamId: tenant.teamId }
    : { ownerId: record.userId, teamId: null as null }
  return { apiKeyId: record.id, user: record.user, scopes, tenant, apiResourceWhere }
}

/**
 * Resolve the tenant selected by the authenticated user.
 *
 * Existing owner-only rows have a null teamId, so a team may read those legacy
 * rows only when their owner is the team owner. New writes should persist both
 * ownerId and teamId from this context. Users with multiple teams must select
 * one explicitly; silently merging tenants would leak data across workspaces.
 */
export async function resolveTenantContext(
  userId: string,
  selectedTeamId?: string
): Promise<TenantContext> {
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId, status: 'ACCEPTED' } } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      members: {
        where: { userId, status: 'ACCEPTED' },
        select: { role: true },
      },
    },
  })

  if (teams.length === 0) {
    if (selectedTeamId) {
      throw new TenantContextError('TENANT_FORBIDDEN', 'Workspace access denied')
    }
    return {
      ownerId: userId,
      teamId: null,
      role: 'OWNER',
      resourceWhere: { ownerId: userId, teamId: null },
      auditWhere: { userId, teamId: null },
    }
  }

  const team = selectedTeamId
    ? teams.find((candidate) => candidate.id === selectedTeamId)
    : teams.length === 1
      ? teams[0]
      : null

  if (selectedTeamId && !team) {
    throw new TenantContextError('TENANT_FORBIDDEN', 'Workspace access denied')
  }
  if (!team) {
    throw new TenantContextError(
      'TENANT_SELECTION_REQUIRED',
      'Select a workspace before accessing business data'
    )
  }

  const role = team.ownerId === userId
    ? 'OWNER'
    : team.members[0]?.role as TeamRole | undefined
  if (!role) {
    throw new TenantContextError('TENANT_FORBIDDEN', 'Workspace access denied')
  }

  return {
    ownerId: team.ownerId,
    teamId: team.id,
    role,
    resourceWhere: {
      OR: [
        { teamId: team.id },
        { ownerId: team.ownerId, teamId: null },
      ],
    },
    auditWhere: {
      OR: [
        { teamId: team.id },
        { userId: team.ownerId, teamId: null },
      ],
    },
  }
}

/** Authenticate and resolve the request's selected workspace in one step. */
export async function requireTenantContext(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ session: AuthedSession; tenant: TenantContext } | null> {
  const session = await requireSession(req, res)
  if (!session) return null

  const requested = req.headers['x-team-id']
  const headerTeamId = Array.isArray(requested) ? requested[0] : requested
  const selectedTeamId = headerTeamId || parseCookie(req.headers.cookie || '').fleetflow_team
  try {
    const tenant = await resolveTenantContext(session.user.id, selectedTeamId)
    return { session, tenant }
  } catch (error) {
    if (error instanceof TenantContextError) {
      const status = error.code === 'TENANT_SELECTION_REQUIRED' ? 409 : 403
      res.status(status).json({ error: error.message, code: error.code })
      return null
    }
    throw error
  }
}

/** Require an authenticated session; returns null after writing 401. */
export async function requireSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthedSession | null> {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  return session as AuthedSession
}

/**
 * Reject cross-site mutating requests that rely on cookie auth.
 * Allows missing Origin/Referer for same-site navigations and non-browser clients
 * only in development; in production require a matching Origin or Referer.
 */
export function assertSameOrigin(req: NextApiRequest, res: NextApiResponse): boolean {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true

  const host = req.headers.host
  if (!host) {
    res.status(400).json({ error: 'Missing host' })
    return false
  }

  const origin = req.headers.origin
  const referer = req.headers.referer

  const allowedHosts = new Set<string>([host])
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL
  if (appUrl) {
    try {
      allowedHosts.add(new URL(appUrl).host)
    } catch {
      /* ignore invalid URL */
    }
  }

  const matchesHost = (value: string | undefined): boolean => {
    if (!value) return false
    try {
      return allowedHosts.has(new URL(value).host)
    } catch {
      return false
    }
  }

  if (origin) {
    if (!matchesHost(origin)) {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    }
    return true
  }

  if (referer) {
    if (!matchesHost(referer)) {
      res.status(403).json({ error: 'Forbidden origin' })
      return false
    }
    return true
  }

  // No Origin/Referer: allow only outside production (curl, server-to-server tests)
  if (process.env.NODE_ENV !== 'production') return true

  res.status(403).json({ error: 'Forbidden origin' })
  return false
}

/** Invite expiry window (matches invite-details UI). */
export const TEAM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function isTeamInviteExpired(invitedAt: Date): boolean {
  return Date.now() - new Date(invitedAt).getTime() > TEAM_INVITE_TTL_MS
}

/**
 * Resolve whether the current user may manage a team member record
 * (owner of team, or ACCEPTED ADMIN/OWNER membership).
 */
export async function getTeamMemberManageContext(userId: string, memberId: string) {
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: { team: true },
  })
  if (!member) return null

  const isOwner = member.team.ownerId === userId
  const userMembership = await prisma.teamMember.findFirst({
    where: { teamId: member.teamId, userId, status: 'ACCEPTED' },
  })
  const role = (isOwner ? 'OWNER' : userMembership?.role) as TeamRole | undefined
  const canManage = !!role && canManageTeam(role)

  return { member, isOwner, userMembership, canManage }
}
