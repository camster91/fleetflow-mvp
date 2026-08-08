import { FormEvent, useRef, useState } from 'react'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { AnswerWithSources } from '@/components/assistant/AnswerWithSources'
import type { AssistantClaim, AssistantSource } from '@/lib/ai/answerCitations'

const PROMPTS = ['What needs attention today?', 'What maintenance is overdue or due soon?', 'Which vehicles have the highest recorded maintenance cost?', 'Which deliveries are late, incomplete, or unassigned?']
type Result = { empty: boolean; answer: { claims: AssistantClaim[]; summary?: string }; sources: AssistantSource[] }

export default function AssistantPage() {
  const [question, setQuestion] = useState(''); const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const abortRef = useRef<AbortController | null>(null)
  const [recordType, setRecordType] = useState<'vehicle' | 'client'>('vehicle'); const [recordId, setRecordId] = useState(''); const [statusMessage, setStatusMessage] = useState('')
  const [entities, setEntities] = useState<Array<{ id: string; label: string }>>([]); const [entitiesLoading, setEntitiesLoading] = useState(false)
  const loadEntities = async () => { setEntitiesLoading(true); setRecordId(''); try { const response = await fetch(`/api/assistant/entities?type=${recordType}`); if (!response.ok) throw new Error(); const body = await response.json() as { entities?: Array<{ id: string; label: string }> }; setEntities(Array.isArray(body.entities) ? body.entities.slice(0, 20) : []) } catch { setEntities([]); setError('Authorized records could not be loaded. Retry when you are ready.') } finally { setEntitiesLoading(false) } }
  const ask = async (value = question) => {
    const normalized = value.trim(); if (!normalized || loading) return
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller
    setQuestion(normalized); setLoading(true); setError(''); setStatusMessage(''); setResult(null)
    try {
      const selectedEntity = /selected (?:vehicle|client)/i.test(normalized) && recordId.trim() ? { type: recordType, id: recordId.trim() } : undefined
      const response = await fetch('/api/assistant/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: normalized, ...(selectedEntity ? { selectedEntity } : {}) }), signal: controller.signal })
      const body = await response.json() as Result & { error?: string }
      if (!response.ok) throw new Error(body.error || 'Request failed')
      if (abortRef.current === controller) setResult(body)
    } catch (caught) {
      if (abortRef.current === controller) {
        if (caught instanceof DOMException && caught.name === 'AbortError') setStatusMessage('Request cancelled. Your records were not changed.')
        else setError('Fleetvera could not answer that right now. Retry when you are ready.')
      }
    } finally { if (abortRef.current === controller) { abortRef.current = null; setLoading(false) } }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask() }
  return <DashboardLayout title="Ask Fleetvera" subtitle="Grounded answers from your current workspace records" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ask Fleetvera' }]}>
    <div className="mx-auto w-full max-w-3xl space-y-6 overflow-hidden">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-5 text-white sm:p-7">
        <h2 className="text-xl font-semibold">What would you like to check?</h2>
        <p className="mt-2 text-sm text-blue-100">Fleetvera answers only from records you can access and shows a source for every fact.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label htmlFor="fleet-question" className="sr-only">Ask a fleet question</label>
          <textarea id="fleet-question" rows={3} maxLength={500} value={question} onChange={event => setQuestion(event.target.value)} className="w-full resize-y rounded-xl border border-white/20 bg-white p-3 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="Ask a fleet question" />
          <fieldset className="grid gap-2 rounded-xl border border-white/20 p-3 sm:grid-cols-2"><legend className="px-1 text-xs text-blue-100">Optional selected record</legend><label className="text-xs text-blue-100">Record type<select aria-label="Record type" value={recordType} onChange={event => { setRecordType(event.target.value as 'vehicle' | 'client'); setEntities([]); setRecordId('') }} className="mt-1 min-h-11 w-full rounded-lg bg-white px-3 text-slate-900"><option value="vehicle">Vehicle</option><option value="client">Client</option></select></label><button type="button" onClick={() => void loadEntities()} disabled={entitiesLoading} className="min-h-11 self-end rounded-lg border border-white/40 px-3 text-sm disabled:opacity-50">{entitiesLoading ? 'Loading records…' : 'Load authorized records'}</button><label className="text-xs text-blue-100 sm:col-span-2">Authorized record<select aria-label="Authorized record" value={recordId} onChange={event => setRecordId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg bg-white px-3 text-slate-900"><option value="">Select a {recordType}</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label><button type="button" disabled={!recordId} onClick={() => void ask(`Summarize the selected ${recordType}`)} className="min-h-11 rounded-lg border border-white/40 px-3 text-sm disabled:opacity-50 sm:col-span-2">Summarize selected {recordType}</button></fieldset>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={loading || !question.trim()} className="min-h-11 rounded-lg bg-blue-500 px-5 py-2 font-medium text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Checking records…' : 'Ask'}</button>
            {loading && <button type="button" onClick={() => { const current = abortRef.current; abortRef.current = null; current?.abort(); setStatusMessage('Request cancelled. Your records were not changed.'); setLoading(false) }} className="min-h-11 rounded-lg border border-white/40 px-4 py-2">Cancel</button>}
            {error && <button type="button" onClick={() => void ask()} className="min-h-11 rounded-lg border border-white/40 px-4 py-2">Retry</button>}
          </div>
        </form>
      </div>
      <section aria-label="Suggested questions"><h2 className="text-sm font-semibold text-slate-700">Suggested questions</h2><div className="mt-2 grid gap-2 sm:grid-cols-2">{PROMPTS.map(prompt => <button key={prompt} type="button" onClick={() => void ask(prompt)} className="min-h-11 rounded-xl border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-700">{prompt}</button>)}</div></section>
      {loading && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Checking authorized Fleetvera records…</p>}
      {statusMessage && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{statusMessage}</p>}
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {result?.empty && <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{result.answer.summary}</p>}
      {result && !result.empty && <AnswerWithSources claims={result.answer.claims} sources={result.sources} />}
      <p className="text-xs text-slate-500">Ask Fleetvera is read-only. It cannot change records or contact people.</p>
    </div>
  </DashboardLayout>
}
