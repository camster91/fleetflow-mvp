import { useEffect, useId, useRef, useState } from 'react'
import type { SuggestedAction } from '@/lib/ai/actionRegistry'

type Preview = {
  kind: 'write' | 'read' | 'navigation'
  label?: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}
type PreviewResponse = {
  requiresConfirmation: boolean
  token?: string
  preview: Preview
  href?: string
}

function Values({ title, values }: { title: string; values: Record<string, unknown> }) {
  return (
    <section className="min-w-0 rounded-lg bg-slate-50 p-3" aria-label={title}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <dl className="mt-2 space-y-2">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs text-slate-500">{key}</dt>
            <dd className="break-words text-sm font-medium text-slate-900">
              {value == null ? 'None' : typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ActionPreview({ action, sourceFindingId }: { action: SuggestedAction; sourceFindingId?: string }) {
  const titleId = useId()
  const [response, setResponse] = useState<PreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (response) headingRef.current?.focus()
  }, [response])
  const request = async (body: object) => {
    const result = await fetch('/api/assistant/actions/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await result.json()
    if (!result.ok) throw new Error(data.error || 'Action failed')
    return data
  }
  const preview = async () => {
    setBusy(true)
    setMessage('')
    try {
      setResponse(
        await request({
          action,
          ...(sourceFindingId ? { sourceFindingId } : {}),
        })
      )
    } catch {
      setMessage('This suggested action could not be previewed. No records were changed.')
      requestAnimationFrame(() => triggerRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    if (!response?.token) return
    setBusy(true)
    try {
      await request({ previewToken: response.token, confirm: true })
      setMessage('Change confirmed and recorded in the audit log.')
    } catch {
      setMessage('The change was not applied. Refresh the preview and try again.')
    } finally {
      setResponse(null)
      setBusy(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }
  const copyDraft = async () => {
    if (!response) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(response.preview.after, null, 2))
      setMessage('Draft copied to clipboard.')
    } catch {
      setMessage('Copy was unavailable. Select the visible draft values instead.')
    }
  }
  const cancel = () => {
    setResponse(null)
    setMessage('Suggested action cancelled. No records were changed.')
    requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return (
    <div className="w-full min-w-0 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void preview()}
        disabled={busy || Boolean(response)}
        className={`${response ? 'hidden' : ''} min-h-11 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-50`}
      >
        {busy ? 'Preparing preview…' : 'Preview suggested action'}
      </button>
      {response && (
        <div role="dialog" aria-modal="false" aria-labelledby={titleId} className="space-y-4">
          <div>
            <h3
              ref={headingRef}
              tabIndex={-1}
              id={titleId}
              className="font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              {response.preview.label || 'Suggested action preview'}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Review the exact values below. Nothing changes until you confirm.
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Values title="Before" values={response.preview.before} />
            <Values title="After" values={response.preview.after} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {response.requiresConfirmation && (
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={busy}
                className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {busy ? 'Confirming…' : 'Confirm this change'}
              </button>
            )}
            {response.preview.kind === 'read' && (
              <button
                type="button"
                onClick={() => void copyDraft()}
                className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              >
                Copy draft
              </button>
            )}
            {response.href && (
              <a
                href={response.href}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              >
                Open edit screen
              </a>
            )}
            <button
              type="button"
              onClick={cancel}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            >
              Cancel suggested action
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </p>
      )}
    </div>
  )
}
