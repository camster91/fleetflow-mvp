import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Clock, X } from 'lucide-react'

export function TrialBanner() {
  const [data, setData] = useState<{ status: string; trialEndsAt: string | null } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // During the free beta checkout is off, so a trial countdown or "Subscribe" link would be a dead
    // end: only show the banner when online billing is actually available.
    Promise.all([
      fetch('/api/subscription/status').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/stripe/availability').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([status, availability]) => {
        if (status?.subscription && availability?.available === true) setData(status.subscription)
      })
      .catch(() => {})
  }, [])

  if (dismissed || !data || data.status !== 'TRIAL') return null

  const trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0
  const expired = trialEndsAt && trialEndsAt < new Date()

  return (
    <div
      role="status"
      className={`px-4 py-2.5 text-sm flex items-center justify-between ${expired ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        {expired ? (
          <span>
            Your trial has expired.{' '}
            <Link href="/billing" className="font-medium underline">
              Subscribe now
            </Link>{' '}
            to keep using Fleetvera.
          </span>
        ) : (
          <span>
            {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your trial.{' '}
            <Link href="/billing" className="font-medium underline">
              Subscribe
            </Link>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss trial notice"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
