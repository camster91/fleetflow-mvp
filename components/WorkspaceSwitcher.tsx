import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

interface Workspace {
  id: string
  name: string
  role: string
}

export function WorkspaceSwitcher() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeTeamId, setActiveTeamId] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/team/workspaces')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !data) return
        setWorkspaces(data.workspaces || [])
        setActiveTeamId(data.activeTeamId || (data.workspaces?.length === 1 ? data.workspaces[0].id : ''))
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const selectWorkspace = async (teamId: string) => {
    setActiveTeamId(teamId)
    setSwitching(true)
    const response = await fetch('/api/team/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    })
    if (response.ok) router.reload()
    else setSwitching(false)
  }

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" aria-label="Loading workspaces" />
  }

  if (workspaces.length === 0) {
    return <span className="hidden sm:inline text-sm text-slate-500">Personal workspace</span>
  }

  return (
    <select
      aria-label="Workspace"
      value={activeTeamId}
      disabled={switching}
      onChange={(event) => selectWorkspace(event.target.value)}
      className="max-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60"
    >
      {workspaces.length > 1 && !activeTeamId && <option value="">Select workspace</option>}
      {workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.id}>
          {workspace.name} ({workspace.role.toLowerCase()})
        </option>
      ))}
    </select>
  )
}
