import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, X } from 'lucide-react'

type Reason =
  | 'NOT_ENFORCED'
  | 'TRIAL'
  | 'ACTIVE'
  | 'CANCELLING'
  | 'PAYMENT_GRACE'
  | 'TRIAL_EXPIRED'
  | 'PAYMENT_OVERDUE'
  | 'CANCELLED'

interface EntitlementResponse {
  entitlement: {
    enforced: boolean
    access: 'FULL' | 'READ_ONLY'
    reason: Reason
    trialEndsAt: string | null
    graceEndsAt: string | null
    accessEndsAt: string | null
  }
  /** Set only when lapsed-workspace deletion is switched on. */
  deletionAt?: string | null
  canManageBilling: boolean
}

/** Show the trial countdown only in its final two weeks, so a long beta grace period is not nagging. */
const TRIAL_NOTICE_DAYS = 14
const DAY_MS = 86_400_000

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : ''

const READ_ONLY_LEAD: Partial<Record<Reason, string>> = {
  TRIAL_EXPIRED: 'Your free trial has ended.',
  PAYMENT_OVERDUE: 'Your payment is overdue.',
  CANCELLED: 'Your subscription has ended.',
}

/**
 * Dashboard notice for plan state (#150): trial countdown, failed-payment grace, pending cancellation,
 * and read-only workspaces. Renders nothing while billing is not enforced (the free beta).
 */
export function PlanBanner() {
  const [data, setData] = useState<EntitlementResponse | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/subscription/entitlement')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: EntitlementResponse | null) => {
        if (body?.entitlement?.enforced) setData(body)
      })
      .catch(() => {})
  }, [])

  if (!data) return null
  const { entitlement, canManageBilling } = data
  const readOnly = entitlement.access === 'READ_ONLY'
  if (dismissed && !readOnly) return null

  let message: string
  let action: string | null = null
  switch (entitlement.reason) {
    case 'TRIAL': {
      const daysLeft = Math.max(0, Math.ceil((new Date(entitlement.trialEndsAt ?? 0).getTime() - Date.now()) / DAY_MS))
      if (daysLeft > TRIAL_NOTICE_DAYS) return null
      message = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free trial.`
      action = 'Subscribe'
      break
    }
    case 'PAYMENT_GRACE':
      message = `Your last payment failed. Update your payment details by ${formatDate(entitlement.graceEndsAt)} to keep editing.`
      action = 'Update payment'
      break
    case 'CANCELLING':
      message = `Your subscription ends on ${formatDate(entitlement.accessEndsAt)}. After that the workspace becomes read-only.`
      action = 'Manage billing'
      break
    default:
      if (!readOnly) return null
      message =
        `${READ_ONLY_LEAD[entitlement.reason] ?? ''} This workspace is read-only: you can still view and export your data.`.trim()
      if (data.deletionAt)
        message += ` Unless it is reactivated, its data will be deleted on or after ${formatDate(data.deletionAt)}.`
      action = 'Subscribe'
  }

  const tone = readOnly
    ? 'border-red-200 bg-red-50 text-red-900'
    : entitlement.reason === 'PAYMENT_GRACE'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-900'
  const Icon = readOnly || entitlement.reason === 'PAYMENT_GRACE' ? AlertTriangle : Clock

  return (
    <div role="status" className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-sm ${tone}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {message}{' '}
          {canManageBilling ? (
            <Link href="/billing" className="font-semibold underline">
              {action}
            </Link>
          ) : (
            readOnly && <span>Ask your workspace owner or admin to subscribe.</span>
          )}
        </span>
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss plan notice"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
