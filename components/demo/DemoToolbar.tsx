import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DEMO_ROLES } from '@/lib/demo/policy'
import { clearRecentItems } from '@/services/recentItems'

export function DemoToolbar() {
  const [state, setState] = useState<{ enabled: boolean; active?: boolean; role?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    fetch('/api/demo/status')
      .then((r) => r.json())
      .then((data) => {
        if (live) setState(data)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  if (!state?.enabled) return null
  const change = async (path: string, body = {}) => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Please try again')
      clearRecentItems()
      window.location.assign('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again')
      setBusy(false)
    }
  }
  return (
    <section
      aria-label="Demo controls"
      className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <strong>Private demo workspace</strong>
          <p className="text-xs">Try edits freely. Sample data expires after 4 hours. No real emails or payments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.active ? (
            <>
              <label className="sr-only" htmlFor="demo-role">
                Explore as
              </label>
              <select
                id="demo-role"
                value={state.role || 'OWNER'}
                disabled={busy}
                onChange={(e) => void change('/api/demo/role', { role: e.target.value })}
                className="min-h-11 rounded-lg border border-emerald-300 bg-white px-3"
              >
                {DEMO_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role === 'TECHNICIAN' ? 'Mechanic' : role.charAt(0) + role.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
              <button
                disabled={busy}
                onClick={() => void change('/api/demo/reset')}
                className="min-h-11 rounded-lg border border-emerald-300 bg-white px-3 disabled:opacity-50"
              >
                {busy ? 'Opening…' : 'Reset sample data'}
              </button>
            </>
          ) : (
            <Link href="/demo" className="min-h-11 rounded-lg bg-emerald-900 px-4 py-3 text-white">
              Open a fresh demo
            </Link>
          )}
          <Link href="/demo" className="px-2 py-3 underline">
            Feature guide
          </Link>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-800">
          {error}
        </p>
      )}
    </section>
  )
}
