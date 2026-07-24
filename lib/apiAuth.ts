/**
 * Shared API authorization helpers for owner-scoped resources and CSRF checks.
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, authOptions, type Session } from './auth'
import { prisma } from './prisma'
import { canManageTeam } from './permissions'
import type { TeamRole } from '../types'

export type AuthedSession = Session & { user: Session['user'] & { id: string } }

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
