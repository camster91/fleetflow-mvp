import { useCallback, useEffect, useId, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { useSession } from '@/lib/session'

type CheckStatus = 'pass' | 'warn' | 'fail'
interface LaunchCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
  items?: string[]
  issue?: number
  action?: { href: string; label: string }
}
interface OpsRecord {
  id: string
  kind: 'backup_drill' | 'restore_drill' | 'monitoring_test' | 'go_no_go'
  outcome: 'pass' | 'fail' | 'go' | 'no_go'
  performedAt: string
  summary: string
  evidenceUrl: string | null
  reference: string | null
  recordedByName: string | null
}
interface Snapshot {
  mode: string
  ready: boolean
  checks: LaunchCheck[]
  records: OpsRecord[]
  deployConfigured: boolean
}

const STATUS_LABEL: Record<CheckStatus, string> = { pass: 'Pass', warn: 'Attention', fail: 'Fail' }
const STATUS_CLASS: Record<CheckStatus, string> = {
  pass: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-900',
  fail: 'bg-red-100 text-red-800',
}
const KIND_LABEL: Record<OpsRecord['kind'], string> = {
  backup_drill: 'Backup drill',
  restore_drill: 'Restore drill',
  monitoring_test: 'Monitoring test',
  go_no_go: 'Go / no-go',
}
const OUTCOME_LABEL: Record<OpsRecord['outcome'], string> = { pass: 'Passed', fail: 'Failed', go: 'Go', no_go: 'No-go' }
const ISSUES_URL = 'https://github.com/camster91/fleetflow-mvp/issues'

function localNow(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { response, body: await response.json().catch(() => ({})) }
}

type FieldName = 'kind' | 'outcome' | 'performedAt' | 'summary' | 'reference' | 'evidenceUrl'

function RecordForm({
  decision,
  ready,
  onSaved,
}: {
  decision: boolean
  ready: boolean
  onSaved: (snapshot: Snapshot) => void
}) {
  const id = useId()
  const [kind, setKind] = useState<OpsRecord['kind']>(decision ? 'go_no_go' : 'backup_drill')
  const [outcome, setOutcome] = useState(decision ? 'no_go' : 'pass')
  const [performedAt, setPerformedAt] = useState(localNow)
  const [summary, setSummary] = useState('')
  const [reference, setReference] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [error, setError] = useState<{ message: string; field?: FieldName } | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const fieldId = (field: FieldName) => `${id}-${field}`
  const errorId = `${id}-error`
  const invalid = (field: FieldName) =>
    error?.field === field ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}

  const submit = async () => {
    setBusy(true)
    setError(null)
    setStatus('')
    try {
      const at = new Date(performedAt)
      const { response, body } = await postJson('/api/admin/launch', {
        kind,
        outcome,
        performedAt: Number.isNaN(at.getTime()) ? '' : at.toISOString(),
        summary,
        reference,
        evidenceUrl,
      })
      if (!response.ok) {
        const field = (['kind', 'outcome', 'performedAt', 'summary', 'reference', 'evidenceUrl'] as const).find(
          (name) => name === body.field
        )
        setError({ message: body.error || 'The record could not be saved.', field })
        document.getElementById(fieldId(field ?? 'summary'))?.focus()
        return
      }
      onSaved(body as Snapshot)
      setSummary('')
      setReference('')
      setEvidenceUrl('')
      setPerformedAt(localNow())
      setStatus(decision ? 'Decision recorded.' : 'Evidence recorded.')
    } catch {
      setError({ message: 'The record could not be saved.' })
    } finally {
      setBusy(false)
    }
  }

  const outcomes = decision
    ? [
        { value: 'go', label: 'Go — invite real customers' },
        { value: 'no_go', label: 'No-go — not yet' },
      ]
    : [
        { value: 'pass', label: 'Passed' },
        { value: 'fail', label: 'Failed' },
      ]

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {error ? (
        <p id={errorId} role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error.message}
        </p>
      ) : null}
      {!decision ? (
        <div>
          <label htmlFor={fieldId('kind')} className="block text-sm font-medium text-slate-900">
            What was done
          </label>
          <select
            id={fieldId('kind')}
            value={kind}
            onChange={(event) => setKind(event.target.value as OpsRecord['kind'])}
            className="mt-1 block min-h-11 w-full rounded border border-slate-300 px-3 text-sm"
            {...invalid('kind')}
          >
            <option value="backup_drill">Encrypted backup verified (npm run verify:backup-restore)</option>
            <option value="restore_drill">Restore drill by a second operator</option>
            <option value="monitoring_test">Monitoring test: Sentry events and alert delivered</option>
          </select>
        </div>
      ) : null}
      <fieldset>
        <legend className="text-sm font-medium text-slate-900">{decision ? 'Decision' : 'Result'}</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {outcomes.map((option) => (
            <label key={option.value} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-800">
              <input
                type="radio"
                name={`${id}-outcome`}
                id={option.value === outcomes[0].value ? fieldId('outcome') : undefined}
                value={option.value}
                checked={outcome === option.value}
                disabled={decision && option.value === 'go' && !ready}
                onChange={() => setOutcome(option.value)}
                {...invalid('outcome')}
              />
              {option.label}
            </label>
          ))}
        </div>
        {decision && !ready ? (
          <p className="text-[13px] text-slate-600">Go is available once no check is failing.</p>
        ) : null}
      </fieldset>
      <div>
        <label htmlFor={fieldId('performedAt')} className="block text-sm font-medium text-slate-900">
          {decision ? 'Decided at' : 'Done at'}
        </label>
        <input
          id={fieldId('performedAt')}
          type="datetime-local"
          required
          value={performedAt}
          onChange={(event) => setPerformedAt(event.target.value)}
          className="mt-1 block min-h-11 w-full rounded border border-slate-300 px-3 text-sm sm:w-72"
          {...invalid('performedAt')}
        />
      </div>
      <div>
        <label htmlFor={fieldId('summary')} className="block text-sm font-medium text-slate-900">
          {decision ? 'Reasoning and who agreed' : 'Summary'}
        </label>
        <textarea
          id={fieldId('summary')}
          required
          rows={3}
          maxLength={1000}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm"
          {...invalid('summary')}
        />
      </div>
      {!decision ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={fieldId('reference')} className="block text-sm font-medium text-slate-900">
              Checksum or ID <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input
              id={fieldId('reference')}
              value={reference}
              maxLength={128}
              spellCheck={false}
              onChange={(event) => setReference(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded border border-slate-300 px-3 font-mono text-sm"
              {...invalid('reference')}
            />
          </div>
          <div>
            <label htmlFor={fieldId('evidenceUrl')} className="block text-sm font-medium text-slate-900">
              Evidence link <span className="font-normal text-slate-600">(optional, https)</span>
            </label>
            <input
              id={fieldId('evidenceUrl')}
              type="url"
              value={evidenceUrl}
              maxLength={500}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded border border-slate-300 px-3 text-sm"
              {...invalid('evidenceUrl')}
            />
          </div>
        </div>
      ) : null}
      <p className="text-[13px] text-slate-600">
        Never paste passwords, keys, backup contents or customer data here; link to where the evidence is kept.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded bg-blue-700 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : decision ? 'Record decision' : 'Record evidence'}
        </button>
        {status ? (
          <p role="status" className="text-[13px] text-green-800">
            {status}
          </p>
        ) : null}
      </div>
    </form>
  )
}

function OperationsActions({ deployConfigured }: { deployConfigured: boolean }) {
  const [alertState, setAlertState] = useState<{ busy: boolean; message: string; ok: boolean }>({
    busy: false,
    message: '',
    ok: true,
  })
  const [confirmed, setConfirmed] = useState(false)
  const [deployState, setDeployState] = useState<{ busy: boolean; message: string; ok: boolean }>({
    busy: false,
    message: '',
    ok: true,
  })

  const sendTestAlert = async () => {
    setAlertState({ busy: true, message: '', ok: true })
    try {
      const { response, body } = await postJson('/api/admin/launch/test-alert')
      setAlertState({
        busy: false,
        ok: response.ok,
        message: response.ok ? 'Test alert sent. Check the inbox.' : body.error || 'The test alert failed.',
      })
    } catch {
      setAlertState({ busy: false, ok: false, message: 'The test alert failed.' })
    }
  }

  const redeploy = async () => {
    setDeployState({ busy: true, message: '', ok: true })
    try {
      const { response, body } = await postJson('/api/admin/deploy', { confirm: true })
      setDeployState({
        busy: false,
        ok: response.ok,
        message: response.ok
          ? `Coolify accepted the redeploy${body.deploymentId ? ` (deployment ${body.deploymentId})` : ''}. It usually takes a few minutes; follow it in Coolify.`
          : body.error || 'The redeploy failed.',
      })
      if (response.ok) setConfirmed(false)
    } catch {
      setDeployState({ busy: false, ok: false, message: 'The redeploy failed.' })
    }
  }

  const feedback = (state: { message: string; ok: boolean }) =>
    state.message ? (
      <p role={state.ok ? 'status' : 'alert'} className={`text-[13px] ${state.ok ? 'text-green-800' : 'text-red-700'}`}>
        {state.message}
      </p>
    ) : null

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">Alerts</h3>
        <p className="text-sm text-slate-600">Sends one email to the alert address so you know alerts arrive.</p>
        <button
          type="button"
          onClick={() => void sendTestAlert()}
          disabled={alertState.busy}
          className="min-h-11 rounded border border-slate-300 px-4 text-sm font-medium text-slate-800 disabled:opacity-60"
        >
          {alertState.busy ? 'Sending…' : 'Send test alert'}
        </button>
        {feedback(alertState)}
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-900">Redeploy</h3>
        <p className="text-sm text-slate-600">
          Coolify rebuilds the branch it is set to deploy. This button does not check CI, so confirm it first.
        </p>
        {deployConfigured ? (
          <>
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              The latest commit passed CI
            </label>
            <button
              type="button"
              onClick={() => void redeploy()}
              disabled={!confirmed || deployState.busy}
              className="min-h-11 rounded bg-blue-700 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {deployState.busy ? 'Redeploying…' : 'Redeploy'}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-700">
            Add the Coolify webhook and token in{' '}
            <a href="/admin/settings" className="font-medium text-blue-700 underline">
              Platform settings
            </a>{' '}
            to enable it.
          </p>
        )}
        {feedback(deployState)}
      </div>
    </div>
  )
}

export default function LaunchReadinessPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loadError, setLoadError] = useState('')
  const admin = String(session?.user?.role ?? '').toLowerCase() === 'admin'

  useEffect(() => {
    if (status === 'unauthenticated') void router.push('/auth/login?callbackUrl=/admin/launch')
    else if (status === 'authenticated' && !admin) void router.push('/unauthorized')
  }, [status, admin, router])

  const load = useCallback(() => {
    setLoadError('')
    fetch('/api/admin/launch', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((body: Snapshot) => setSnapshot(body))
      .catch(() => setLoadError('Launch readiness could not be loaded.'))
  }, [])
  useEffect(() => {
    if (status === 'authenticated' && admin) load()
  }, [status, admin, load])

  const failing = snapshot?.checks.filter((check) => check.status === 'fail' && check.id !== 'decision') ?? []

  return (
    <DashboardLayout
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin' }, { label: 'Launch readiness' }]}
    >
      <Head>
        <title>Launch readiness | Fleetvera</title>
      </Head>
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Launch readiness</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live checks of this deployment, evidence of backups and monitoring, and the go/no-go decision. Platform
            administrators only. No setting value is shown here.
          </p>
        </header>
        {loadError ? (
          <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {loadError}{' '}
            <button type="button" onClick={load} className="ml-2 min-h-11 font-medium underline">
              Try again
            </button>
          </div>
        ) : null}
        {!snapshot && !loadError ? <p className="text-sm text-slate-600">Loading checks…</p> : null}
        {snapshot ? (
          <>
            <section
              aria-labelledby="summary-heading"
              className={`rounded-lg border p-5 ${snapshot.ready ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
            >
              <h2 id="summary-heading" className="text-lg font-semibold text-slate-900">
                {snapshot.ready
                  ? 'No blocking problems'
                  : `${failing.length} check${failing.length === 1 ? '' : 's'} failing`}
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Release mode: <strong>{snapshot.mode}</strong>.{' '}
                {snapshot.ready
                  ? 'Review the items needing attention, then record the go/no-go decision below.'
                  : 'Fix the failing checks before inviting real customers.'}
              </p>
            </section>

            <section aria-labelledby="checks-heading" className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="checks-heading" className="text-lg font-semibold text-slate-900">
                  Checks
                </h2>
                <button
                  type="button"
                  onClick={load}
                  className="min-h-11 rounded border border-slate-300 px-4 text-sm font-medium text-slate-800"
                >
                  Re-run checks
                </button>
              </div>
              <ul className="mt-2 divide-y divide-slate-200">
                {snapshot.checks.map((check) => (
                  <li key={check.id} className="py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${STATUS_CLASS[check.status]}`}
                      >
                        {STATUS_LABEL[check.status]}
                      </span>
                      <h3 className="text-sm font-medium text-slate-900">{check.label}</h3>
                      {check.issue ? (
                        <a
                          href={`${ISSUES_URL}/${check.issue}`}
                          className="text-[13px] text-slate-600 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Issue #{check.issue}
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{check.detail}</p>
                    {check.items?.length ? (
                      <ul className="mt-1 list-disc pl-5 text-[13px] text-slate-700">
                        {check.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                    {check.action && check.status !== 'pass' ? (
                      <a
                        href={check.action.href}
                        className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-blue-700 underline"
                      >
                        {check.action.label}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="ops-heading" className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 id="ops-heading" className="mb-3 text-lg font-semibold text-slate-900">
                Operations
              </h2>
              <OperationsActions deployConfigured={snapshot.deployConfigured} />
            </section>

            <section
              id="record-evidence"
              aria-labelledby="evidence-heading"
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <h2 id="evidence-heading" className="text-lg font-semibold text-slate-900">
                Record backup and monitoring evidence
              </h2>
              <p className="mb-3 text-sm text-slate-600">
                Backups run on the server (docs/runbooks/backup-restore.md). Record each verified backup, restore drill
                and monitoring test here so the checks above stay current.
              </p>
              <RecordForm decision={false} ready={snapshot.ready} onSaved={setSnapshot} />
            </section>

            <section
              id="decision"
              aria-labelledby="decision-heading"
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <h2 id="decision-heading" className="text-lg font-semibold text-slate-900">
                Go / no-go
              </h2>
              <p className="mb-3 text-sm text-slate-600">
                Record whether this deployment may take real customers. Every decision is kept with who made it.
              </p>
              <RecordForm decision ready={snapshot.ready} onSaved={setSnapshot} />
            </section>

            <section aria-labelledby="history-heading" className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 id="history-heading" className="mb-3 text-lg font-semibold text-slate-900">
                History
              </h2>
              {snapshot.records.length ? (
                <ul className="divide-y divide-slate-200">
                  {snapshot.records.map((record) => (
                    <li key={record.id} className="py-3 text-sm">
                      <p className="font-medium text-slate-900">
                        {KIND_LABEL[record.kind]} · {OUTCOME_LABEL[record.outcome]}
                      </p>
                      <p className="text-[13px] text-slate-600">
                        {new Date(record.performedAt).toLocaleString()}
                        {record.recordedByName ? ` · ${record.recordedByName}` : ''}
                        {record.reference ? (
                          <>
                            {' · '}
                            <code className="text-[13px]">{record.reference}</code>
                          </>
                        ) : null}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-slate-700">{record.summary}</p>
                      {record.evidenceUrl ? (
                        <a
                          href={record.evidenceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-h-11 items-center text-[13px] font-medium text-blue-700 underline"
                        >
                          Evidence
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">Nothing recorded yet.</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
