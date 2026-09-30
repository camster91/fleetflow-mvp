import { useState } from 'react'
import { Users } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  role?: string
}

interface Props {
  workspaces: Workspace[]
  /** Called once the active workspace changed. Defaults to a full reload so the whole layout follows. */
  onDone?: () => void
}

const reloadPage = () => window.location.reload()

/**
 * Shown on /team when no team workspace is active: either the person has no team yet (their personal
 * workspace), or they belong to several teams and none is selected. Teammates can only be invited to a
 * team, so this offers to open one of their teams or to create their own.
 */
export function TeamWorkspaceSetup({ workspaces, onDone = reloadPage }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ownsTeam = workspaces.some((workspace) => workspace.role === 'OWNER')

  const switchTo = async (teamId: string) => {
    setBusy(true)
    const response = await fetch('/api/team/workspaces', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    }).catch(() => null)
    if (response?.ok) return onDone()
    setBusy(false)
    setError('That workspace could not be opened. Please try again.')
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const response = await fetch('/api/team/create', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => null)
    if (response?.ok) return onDone()
    const body = response ? await response.json().catch(() => ({})) : {}
    setBusy(false)
    setError(body.error || 'The team could not be created. Please try again.')
    document.getElementById('team-name')?.focus()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section aria-labelledby="team-setup-title" className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-emerald-50 p-3">
            <Users className="h-6 w-6 text-emerald-700" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 id="team-setup-title" className="text-lg font-semibold text-slate-900">
              {workspaces.length > 0 ? 'Choose a workspace' : 'Work with your team'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {workspaces.length > 0
                ? ownsTeam
                  ? 'Open one of your team workspaces to see and invite members.'
                  : 'Open a team you belong to, or create your own team workspace.'
                : 'Create a team workspace to invite dispatchers, drivers and mechanics. Everything you have added so far moves into the team, so nothing is lost.'}
            </p>
          </div>
        </div>

        {workspaces.length > 0 ? (
          <ul className="mt-5 space-y-2">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void switchTo(workspace.id)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                >
                  Open {workspace.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!ownsTeam ? (
          <form onSubmit={create} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label htmlFor="team-name" className="block flex-1 text-sm font-medium text-slate-800">
              Team name
              <input
                id="team-name"
                required
                minLength={2}
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Northside Deliveries"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'team-name-error' : undefined}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-lg bg-emerald-800 px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create team'}
            </button>
          </form>
        ) : null}
        {error ? (
          <p id="team-name-error" role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  )
}
