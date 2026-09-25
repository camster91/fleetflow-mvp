import { prisma } from './prisma'
import { DEFAULT_TIME_ZONE, normalizeTimeZone } from './dateOnly'

type TimeZoneDb = {
  team: {
    findUnique(args: { where: { id: string }; select: { timeZone: true } }): Promise<{ timeZone: string } | null>
  }
  user: {
    findUnique(args: { where: { id: string }; select: { timeZone: true } }): Promise<{ timeZone: string } | null>
  }
}

/**
 * The IANA time zone of the selected workspace: Team.timeZone for team scope,
 * the owner's User.timeZone for a personal workspace. A failed lookup falls
 * back to the default zone rather than failing the request.
 */
export async function getWorkspaceTimeZone(
  tenant: { ownerId: string; teamId: string | null },
  db: TimeZoneDb = prisma as unknown as TimeZoneDb
): Promise<string> {
  try {
    const row = tenant.teamId
      ? await db.team.findUnique({ where: { id: tenant.teamId }, select: { timeZone: true } })
      : await db.user.findUnique({ where: { id: tenant.ownerId }, select: { timeZone: true } })
    return normalizeTimeZone(row?.timeZone)
  } catch {
    console.error('Workspace time zone lookup failed; using default')
    return DEFAULT_TIME_ZONE
  }
}
