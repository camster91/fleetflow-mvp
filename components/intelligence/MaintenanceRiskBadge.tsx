import { type FormEvent, useId, useState } from 'react'
import type { MaintenanceRiskResult } from '@/lib/intelligence/maintenanceRisk'

const styles = {
  high: 'border-red-200 bg-red-50 text-red-900',
  watch: 'border-amber-200 bg-amber-50 text-amber-950',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-950',
} as const

export function MaintenanceRiskBadge({ risk }: { risk: MaintenanceRiskResult }) {
  const [open, setOpen] = useState(false)
  const detailId = useId()
  const tooltipId = useId()
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [actionTaken, setActionTaken] = useState(false)
  const [outcomeCategory, setOutcomeCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [consent, setConsent] = useState(false)
  const newKey = () => `pilot_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`
  const [idempotencyKey, setIdempotencyKey] = useState(newKey)
  const [feedbackId, setFeedbackId] = useState<string | null>(null)
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'withdrawing' | 'withdrawn'>('idle')
  async function saveFeedback(event: FormEvent) {
    event.preventDefault()
    if (helpful === null || !consent || (actionTaken && !outcomeCategory)) return
    setFeedbackState('saving')
    try {
      const response = await fetch('/api/intelligence/maintenance-risk-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ vehicleId: risk.vehicleId, helpful, actionTaken, ...(actionTaken ? { outcomeCategory } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), consent: true }) })
      if (response.ok) { const body = await response.json(); setFeedbackId(body.feedback.id); setFeedbackState('saved') } else setFeedbackState(response.status === 409 ? 'conflict' : 'error')
    } catch { setFeedbackState('error') }
  }
  async function withdrawFeedback() {
    if (!feedbackId) return
    setFeedbackState('withdrawing')
    try { const response = await fetch('/api/intelligence/maintenance-risk-feedback', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: feedbackId }) }); setFeedbackState(response.ok ? 'withdrawn' : 'saved') } catch { setFeedbackState('saved') }
  }
  return (
    <article data-testid="maintenance-risk-badge" className={`w-full min-w-0 rounded-xl border ${styles[risk.band]}`}>
      <button
        type="button"
        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        aria-expanded={open}
        aria-controls={detailId}
        aria-describedby={tooltipId}
        onClick={() => setOpen(value => !value)}
      >
        <span className="min-w-0 font-semibold">{risk.vehicleName}</span>
        <span className="whitespace-nowrap rounded-full bg-white/80 px-2 py-1 text-sm font-bold">{risk.score} points · {risk.band}</span>
        <span id={tooltipId} role="tooltip" className="sr-only">Select to {open ? 'hide' : 'show'} the recorded factors behind this attention score.</span>
      </button>
      {open && (
        <div id={detailId} className="border-t border-current/10 px-3 pb-3 pt-2 text-sm">
          <p>{risk.wording}</p>
          <p className="mt-1 text-xs">Rules rubric {risk.rubricVersion}; this is an operational attention indicator, not a failure prediction.</p>
          {risk.factors.length > 0 && <ol className="mt-3 space-y-2">
            {risk.factors.map(factor => <li key={factor.code} className="rounded-lg bg-white/70 p-2">
              <div className="flex flex-wrap justify-between gap-2 font-medium"><span>{factor.label}</span><span>+{factor.points} points</span></div>
              <p className="mt-1">{factor.evidence}</p>
              {factor.links.length > 0 && <div className="mt-1 flex flex-wrap gap-3">{factor.links.map((href, index) => <a key={`${href}-${index}`} href={href} className="min-h-11 py-3 font-medium underline">Source {index + 1}</a>)}</div>}
            </li>)}
          </ol>}
          <p className="mt-3 text-xs">Data completeness: {risk.completeness.percent}% ({risk.completeness.available} of {risk.completeness.expected} inputs).</p>
          {risk.missingData.length > 0 && <div className="mt-2 rounded-lg bg-white/70 p-2"><p className="font-medium">Missing or limited data</p><ul className="mt-1 list-disc pl-5">{risk.missingData.map(message => <li key={message}>{message}</li>)}</ul></div>}
          {feedbackState === 'saved' || feedbackState === 'withdrawing' ? <div role="status" className="mt-3 rounded-lg bg-white/80 p-3"><p className="font-medium">Pilot feedback saved.</p><p className="mt-1 text-xs">It will be retained for up to 180 days unless you withdraw it sooner.</p><button type="button" disabled={feedbackState === 'withdrawing'} onClick={() => void withdrawFeedback()} className="mt-2 min-h-11 font-medium underline">Withdraw pilot feedback</button></div> : feedbackState === 'withdrawn' ? <div role="status" className="mt-3 rounded-lg bg-white/80 p-3"><p className="font-medium">Pilot feedback withdrawn.</p><button type="button" onClick={() => { setFeedbackState('idle'); setHelpful(null); setConsent(false); setFeedbackId(null); setIdempotencyKey(newKey()) }} className="mt-2 min-h-11 font-medium underline">Submit new feedback</button></div> : <form onSubmit={saveFeedback} className="mt-3 rounded-lg border border-current/20 bg-white/80 p-3">
            <fieldset><legend className="font-medium">Was this attention score useful?</legend><div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setHelpful(true)} aria-pressed={helpful === true} className="min-h-11 rounded-lg border px-3 py-2 aria-pressed:bg-emerald-100">Helpful</button>
              <button type="button" onClick={() => setHelpful(false)} aria-pressed={helpful === false} className="min-h-11 rounded-lg border px-3 py-2 aria-pressed:bg-slate-200">Not helpful</button>
            </div></fieldset>
            {helpful !== null && <div className="mt-3 space-y-3">
              <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={actionTaken} onChange={event => { setActionTaken(event.target.checked); if (!event.target.checked) setOutcomeCategory('') }} /> I took an action after reviewing this score.</label>
              {actionTaken && <label className="block font-medium">Operational outcome<select aria-label="Operational outcome" value={outcomeCategory} onChange={event => setOutcomeCategory(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-slate-950"><option value="">Select an outcome</option><option value="SERVICE_SCHEDULED">Service scheduled</option><option value="SERVICE_COMPLETED">Service completed</option><option value="MONITORING">Monitoring records</option><option value="NO_ACTION">No further action</option><option value="OTHER">Other operational outcome</option></select></label>}
              <label className="block font-medium">Optional pilot notes<textarea aria-label="Optional pilot notes" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-950" /></label>
              <label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> <span>I consent to storing this score snapshot and operational feedback for up to 180 days for the Fleetvera pilot. I can withdraw it here sooner. Notes may contain personal information; include only what is necessary.</span></label>
              <button type="submit" disabled={!consent || (actionTaken && !outcomeCategory) || feedbackState === 'saving'} className="min-h-11 rounded-lg bg-slate-950 px-3 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{feedbackState === 'saving' ? 'Saving…' : 'Save pilot feedback'}</button>
              {feedbackState === 'error' && <p role="alert">Save status unknown. Retry safely; the same submission key prevents a duplicate.</p>}
              {feedbackState === 'conflict' && <div role="alert"><p>This submission key was already used for different feedback. Nothing new was saved.</p><button type="button" className="min-h-11 font-medium underline" onClick={() => { setIdempotencyKey(newKey()); setFeedbackState('idle') }}>Start new feedback</button></div>}
            </div>}
          </form>}
        </div>
      )}
    </article>
  )
}
