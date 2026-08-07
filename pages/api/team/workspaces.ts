import type { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie'
import { parse as parseCookie } from 'cookie'
import { prisma } from '../../../lib/prisma'
import {
  requireSession,
  resolveTenantContext,
  TenantContextError,
} from '../../../lib/apiAuth'

const COOKIE_NAME = 'fleetflow_team'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireSession(req, res)
  if (!session) return
  const userId = session.user.id

  if (req.method === 'GET') {
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId, status: 'ACCEPTED' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        members: {
          where: { userId, status: 'ACCEPTED' },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const cookieTeamId = parseCookie(req.headers.cookie || '')[COOKIE_NAME]
    const activeTeamId = teams.some((team) => team.id === cookieTeamId) ? cookieTeamId : null
    return res.json({
      activeTeamId,
      workspaces: teams.map((team) => ({
        id: team.id,
        name: team.name,
        role: team.ownerId === userId ? 'OWNER' : team.members[0]?.role,
      })),
    })
  }

  if (req.method === 'POST') {
    const teamId = typeof req.body?.teamId === 'string' ? req.body.teamId : ''
    if (!teamId) return res.status(400).json({ error: 'teamId is required' })

    try {
      await resolveTenantContext(userId, teamId)
    } catch (error) {
      if (error instanceof TenantContextError) {
        return res.status(403).json({ error: 'Workspace access denied' })
      }
      throw error
    }

    res.setHeader('Set-Cookie', serialize(COOKIE_NAME, teamId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    }))
    return res.json({ ok: true, teamId })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
