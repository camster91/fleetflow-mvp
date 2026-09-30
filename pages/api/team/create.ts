import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { prisma } from '../../../lib/prisma'
import { assertSameOrigin, requireSession } from '../../../lib/apiAuth'
import { rateLimitMiddleware } from '../../../lib/rateLimit'
import { teamCookie } from '../../../lib/authCookies'
import { movePersonalWorkspaceIntoTeam } from '../../../lib/teamWorkspace'

/** During the beta each person can own one team workspace (and join any number of others). */
export const MAX_OWNED_TEAMS = 1

const schema = z.object({ name: z.string().trim().min(2).max(80) }).strict()

/**
 * Create a team workspace owned by the caller and make it their active workspace. Everything they
 * recorded in their personal workspace moves into the team: a personal workspace is only reachable
 * while someone belongs to no team, so leaving the records behind would hide them. Teammates are
 * then added through /api/team/invite.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!assertSameOrigin(req, res)) return
  const session = await requireSession(req, res)
  if (!session) return
  if (!(await rateLimitMiddleware(req, res, 'api', `team-create:${session.user.id}`))) return

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Team name must be 2 to 80 characters', field: 'name' })
  const userId = session.user.id

  let result: { id: string; name: string } | null
  try {
    result = await prisma.$transaction(
      async (tx) => {
        // Serialize per user so two quick submissions cannot both pass the one-team check.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`team-create:${userId}`}, 0))`
        if ((await tx.team.count({ where: { ownerId: userId } })) >= MAX_OWNED_TEAMS) return null
        const team = await tx.team.create({
          data: { name: parsed.data.name, ownerId: userId },
          select: { id: true, name: true },
        })
        const moved = await movePersonalWorkspaceIntoTeam(tx, userId, team.id)
        await tx.auditLog.create({
          data: {
            userId,
            teamId: team.id,
            userName: session.user.name ?? null,
            userRole: 'OWNER',
            action: 'created',
            entityType: 'team',
            entityId: team.id,
            entityName: team.name,
            description: `Created team workspace ${team.name}`,
            metadata: JSON.stringify({ movedFromPersonalWorkspace: moved }),
          },
        })
        return team
      },
      { maxWait: 10_000, timeout: 60_000 }
    )
  } catch {
    console.error('Team creation failed')
    return res.status(500).json({ error: 'The team could not be created. Please try again.' })
  }

  if (!result) return res.status(409).json({ error: 'You already own a team workspace' })
  res.setHeader('Set-Cookie', teamCookie(result.id))
  return res.status(201).json({ team: result })
}
