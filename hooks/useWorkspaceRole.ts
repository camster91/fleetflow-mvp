import { useEffect, useState } from 'react'
import type { TeamRole } from '../types'

interface WorkspaceSummary { id: string; role?: string | null }

const TEAM_ROLES: TeamRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'DISPATCHER', 'TECHNICIAN', 'DRIVER', 'MEMBER', 'VIEWER']

/**
 * Resolve the caller's role in the active workspace the same way the server
 * does (lib/apiAuth resolveTenantContext): no workspace means a personal
 * workspace (OWNER); otherwise the cookie-selected workspace, or the only one.
 * Returns null while loading, when no workspace is selected, or on failure, so
 * callers hide role-gated controls until the role is known. The APIs remain
 * the authority; this only keeps the UI from offering actions they refuse.
 */
export function resolveWorkspaceRole(data: { activeTeamId?: string | null; workspaces?: WorkspaceSummary[] } | null): TeamRole | null {
  if (!data || !Array.isArray(data.workspaces)) return null
  if (data.workspaces.length === 0) return 'OWNER'
  const active = data.activeTeamId
    ? data.workspaces.find((workspace) => workspace.id === data.activeTeamId)
    : data.workspaces.length === 1 ? data.workspaces[0] : undefined
  const role = active?.role
  return role && (TEAM_ROLES as string[]).includes(role) ? role as TeamRole : null
}

export function useWorkspaceRole(): { role: TeamRole | null; loading: boolean } {
  const [role, setRole] = useState<TeamRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => fetch('/api/team/workspaces'))
      .then(async (response) => (response && response.ok ? response.json() : null))
      .then((data) => { if (active) setRole(resolveWorkspaceRole(data)) })
      .catch(() => { if (active) setRole(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return { role, loading }
}
