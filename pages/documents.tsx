import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { confirmAction } from '@/services/notifications'

type Field = { value: string | number | null; confidence: number; citationIds: string[] }
type Line = {
  description: string
  quantity: number | null
  amount: number | null
  confidence: number
  citationIds: string[]
}
type Extraction = {
  documentType: 'service_invoice' | 'inspection_record' | 'unknown'
  fields: Record<string, Field | undefined>
  services: Line[]
  parts: Line[]
  citations: Array<{ id: string; page: number; quote: string }>
  warnings: string[]
}
type DocumentRow = {
  id: string
  originalName: string
  mimeType: string
  status: string
  revision: number
  extraction: Extraction | null
  expiresAt: string
}
const empty: Extraction = { documentType: 'unknown', fields: {}, services: [], parts: [], citations: [], warnings: [] }

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [selected, setSelected] = useState<DocumentRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [pending, setPending] = useState<{ token: string; after: unknown; kind: 'maintenance' | 'expense' } | null>(
    null
  )
  const uploadRegionRef = useRef<HTMLElement>(null)
  const focusUploadAfterDelete = useRef(false)
  const draft = selected?.extraction || empty
  // CONFIRMED is terminal: the document already created its fleet record, so the API refuses another draft or record (409).
  const confirmed = selected?.status === 'CONFIRMED'
  const lowConfidence = useMemo(
    () =>
      Object.entries(draft.fields)
        .filter(([, field]) => field && field.confidence < 0.7)
        .map(([name]) => name),
    [draft]
  )
  const load = async (preferred?: string) => {
    try {
      const response = await fetch('/api/documents/upload')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Documents could not be loaded')
      setDocuments(data.documents)
      setSelected(
        (current) =>
          data.documents.find((item: DocumentRow) => item.id === (preferred || current?.id)) ||
          data.documents[0] ||
          null
      )
    } catch (error) {
      setMessage((error as Error).message)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  useEffect(() => {
    if (!busy && focusUploadAfterDelete.current) {
      focusUploadAfterDelete.current = false
      uploadRegionRef.current?.focus()
    }
  }, [busy])
  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      await load(data.document.id)
      setMessage(data.duplicate ? 'This document was already uploaded.' : 'Upload complete. Review or extract it next.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const operation = async (body: object) => {
    if (!selected) throw new Error('Select a document')
    const response = await fetch(`/api/documents/${selected.id}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    return data
  }
  const extract = async () => {
    setBusy(true)
    try {
      const data = await operation({ action: 'extract' })
      await load(selected?.id)
      setMessage(data.extraction.warnings[0] || 'Extraction complete. Verify every field.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const updateExtraction = (extraction: Extraction) => selected && setSelected({ ...selected, extraction })
  const setField = (name: string, value: string) =>
    updateExtraction({
      ...draft,
      fields: { ...draft.fields, [name]: { value, confidence: 0, citationIds: draft.fields[name]?.citationIds ?? [] } },
    })
  const setLine = (
    kind: 'services' | 'parts',
    index: number,
    key: 'description' | 'quantity' | 'amount',
    raw: string
  ) =>
    updateExtraction({
      ...draft,
      [kind]: draft[kind].map((line, current) =>
        current === index
          ? { ...line, [key]: key === 'description' ? raw : raw.trim() === '' ? null : Number(raw), confidence: 0 }
          : line
      ),
    })
  const addLine = (kind: 'services' | 'parts') =>
    updateExtraction({
      ...draft,
      [kind]: [...draft[kind], { description: '', quantity: null, amount: null, confidence: 0, citationIds: [] }],
    })
  const save = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const data = await operation({ action: 'save_draft', revision: selected.revision, extraction: draft })
      setSelected({ ...selected, revision: data.revision })
      await load(selected.id)
      setMessage('Draft saved. No fleet records were changed.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const previewAndCreate = async (kind: 'maintenance' | 'expense') => {
    if (!selected) return
    const value = (name: string) => draft.fields[name]?.value
    const numberValue = (name: string) => {
      const raw = value(name)
      if (raw === null || raw === undefined || String(raw).trim() === '') return null
      const parsed = Number(raw)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
    }
    const date = String(value('date') || '')
    const vendor = String(value('vendor') || '')
    const total = numberValue('total')
    const subtotal = numberValue('subtotal')
    const tax = numberValue('tax')
    if (!vehicleId || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return setMessage('Vehicle and a valid date are required before preview.')
    const writeDraft =
      kind === 'expense'
        ? {
            kind,
            vehicleId,
            values: {
              vehicleId,
              vendor,
              date,
              category: draft.documentType === 'inspection_record' ? 'inspection' : 'maintenance',
              total,
              ...(subtotal !== null ? { subtotal } : {}),
              ...(tax !== null ? { tax } : {}),
              description:
                [...draft.services, ...draft.parts]
                  .map((item) => item.description)
                  .filter(Boolean)
                  .join(', ') || 'Reviewed uploaded service document',
            },
          }
        : {
            kind,
            vehicleId,
            values: {
              vehicle: String(value('vehicle') || 'Vehicle'),
              type:
                draft.services
                  .map((item) => item.description)
                  .filter(Boolean)
                  .join(', ') ||
                (draft.documentType === 'inspection_record'
                  ? 'Inspection follow-up'
                  : 'Service from reviewed document'),
              dueDate: date,
              priority: 'medium',
              serviceProvider: vendor || undefined,
              costEstimate: total ?? undefined,
              partsNeeded: draft.parts.map((item) => item.description).filter(Boolean),
            },
          }
    if (kind === 'expense' && (!vendor || total === null))
      return setMessage('Vendor and total are required to create an expense.')
    setBusy(true)
    try {
      const saved = await operation({
        action: 'save_draft',
        revision: selected.revision,
        extraction: draft,
        draft: writeDraft,
      })
      setSelected({ ...selected, revision: saved.revision })
      const preview = await operation({ action: 'preview', revision: saved.revision, draft: writeDraft })
      setPending({ token: preview.previewToken, after: preview.after, kind })
      setMessage('Review every proposed field below, then confirm or cancel.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const confirmPending = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await operation({ action: 'confirm', confirm: true, previewToken: pending.token })
      setMessage(`${pending.kind === 'expense' ? 'Expense' : 'Maintenance task'} created and audited.`)
      setPending(null)
      await load(selected?.id)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!selected) return
    const ok = await confirmAction(
      'The private file and extracted draft will be removed. Created fleet records are retained.',
      `Delete ${selected.originalName}?`
    )
    if (!ok) return
    setBusy(true)
    setMessage('Deleting document…')
    try {
      const response = await fetch(`/api/documents/upload?id=${encodeURIComponent(selected.id)}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Document could not be deleted')
      }
      await load()
      focusUploadAfterDelete.current = true
      setMessage('Document deleted. Created fleet records are retained.')
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardLayout
      title="Document intelligence"
      subtitle="Upload service invoices and inspection records, then verify every extracted field."
    >
      <div className="space-y-4 pb-20">
        <section
          ref={uploadRegionRef}
          tabIndex={-1}
          aria-labelledby="document-upload-label"
          className="rounded-xl border bg-white p-4 focus:outline-none focus:ring-2 focus:ring-blue-700"
        >
          <label id="document-upload-label" className="block font-semibold" htmlFor="document-upload">
            Private PDF, JPEG, or PNG
          </label>
          <p className="mt-1 text-sm text-slate-600">
            Maximum 10 MB, 25 PDF pages, retained for 30 days. Files are never public.
          </p>
          <input
            id="document-upload"
            className="mt-3 block min-h-11 w-full"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={busy}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </section>
        {message && (
          <p role="status" aria-live="polite" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            {message}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
          <nav aria-label="Uploaded documents" className="rounded-xl border bg-white p-3">
            <h2 className="font-semibold">Uploads</h2>
            {documents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No documents yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {documents.map((item) => (
                  <li key={item.id}>
                    <button
                      className="min-h-11 w-full rounded-lg border p-2 text-left text-sm focus-visible:ring-2"
                      aria-current={selected?.id === item.id ? 'true' : undefined}
                      onClick={() => setSelected(item)}
                    >
                      <span className="block truncate font-medium">{item.originalName}</span>
                      <span className="text-xs text-slate-500">{item.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>
          {selected && (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <section className="rounded-xl border bg-slate-100 p-3">
                <h2 className="font-semibold">Source document</h2>
                {selected.mimeType.startsWith('image/') ? (
                  <Image
                    unoptimized
                    width={1200}
                    height={1600}
                    className="mt-3 max-h-[70vh] w-full object-contain"
                    src={`/api/documents/upload?id=${encodeURIComponent(selected.id)}`}
                    alt={`Uploaded source: ${selected.originalName}`}
                  />
                ) : (
                  <iframe
                    title={`Uploaded source: ${selected.originalName}`}
                    className="mt-3 h-[65vh] min-h-96 w-full bg-white"
                    src={`/api/documents/upload?id=${encodeURIComponent(selected.id)}`}
                  />
                )}
                <button
                  className="mt-3 min-h-11 rounded-lg border border-red-300 px-4 text-red-700"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Delete document
                </button>
              </section>
              <section className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Review extracted draft</h2>
                  {!confirmed && (
                    <button
                      className="min-h-11 rounded-lg bg-slate-900 px-4 text-white"
                      disabled={busy}
                      onClick={() => void extract()}
                    >
                      Extract
                    </button>
                  )}
                </div>
                {confirmed && (
                  <p role="note" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    Confirmed: this document already created a fleet record, so it cannot create another. The draft
                    below is read-only.
                  </p>
                )}
                {lowConfidence.length > 0 && (
                  <div role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    Low confidence: {lowConfidence.join(', ')}. Check these fields against the source.
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {['vendor', 'vehicle', 'date', 'odometer', 'subtotal', 'tax', 'total'].map((name) => {
                    const field = draft.fields[name]
                    return (
                      <label key={name} className="text-sm capitalize">
                        {name}
                        <input
                          readOnly={confirmed}
                          className={`mt-1 min-h-11 w-full rounded-lg border px-3 ${field && field.confidence < 0.7 ? 'border-amber-500' : 'border-slate-300'}`}
                          value={String(field?.value ?? '')}
                          onChange={(event) => setField(name, event.target.value)}
                        />
                        {field && (
                          <span className="block text-xs text-slate-500">
                            Confidence {Math.round(field.confidence * 100)}% · Sources{' '}
                            {field.citationIds.join(', ') || 'manual'}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
                {(['services', 'parts'] as const).map((kind) => (
                  <fieldset key={kind} className="mt-4">
                    <legend className="font-medium capitalize">{kind}</legend>
                    {draft[kind].map((line, index) => (
                      <div key={`${kind}-${index}`} className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_8rem]">
                        <label className="text-sm">
                          {kind.slice(0, -1)} {index + 1}
                          <input
                            readOnly={confirmed}
                            className="mt-1 min-h-11 w-full rounded-lg border px-3"
                            value={line.description}
                            onChange={(event) => setLine(kind, index, 'description', event.target.value)}
                          />
                        </label>
                        <label className="text-sm">
                          Quantity
                          <input
                            readOnly={confirmed}
                            type="number"
                            min="0.01"
                            step="any"
                            className="mt-1 min-h-11 w-full rounded-lg border px-3"
                            value={line.quantity ?? ''}
                            onChange={(event) => setLine(kind, index, 'quantity', event.target.value)}
                          />
                        </label>
                        <label className="text-sm">
                          Amount
                          <input
                            readOnly={confirmed}
                            type="number"
                            min="0"
                            step="0.01"
                            className="mt-1 min-h-11 w-full rounded-lg border px-3"
                            value={line.amount ?? ''}
                            onChange={(event) => setLine(kind, index, 'amount', event.target.value)}
                          />
                          <span className="block text-xs text-slate-500">
                            Confidence {Math.round(line.confidence * 100)}% · Sources{' '}
                            {line.citationIds.join(', ') || 'manual'}
                          </span>
                        </label>
                      </div>
                    ))}
                    {!confirmed && (
                      <button
                        type="button"
                        className="mt-2 min-h-11 rounded-lg border px-3"
                        onClick={() => addLine(kind)}
                      >
                        Add {kind.slice(0, -1)}
                      </button>
                    )}
                  </fieldset>
                ))}
                {draft.citations.length > 0 && (
                  <details className="mt-4">
                    <summary className="min-h-11 cursor-pointer font-medium">Source citations</summary>
                    <ul className="space-y-2 text-sm">
                      {draft.citations.map((citation) => (
                        <li key={citation.id}>
                          <strong>
                            {citation.id}, page {citation.page}:
                          </strong>{' '}
                          {citation.quote}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <label className="mt-3 block text-sm">
                  Vehicle record ID
                  <input
                    readOnly={confirmed}
                    className="mt-1 min-h-11 w-full rounded-lg border px-3"
                    value={vehicleId}
                    onChange={(event) => setVehicleId(event.target.value)}
                  />
                </label>
                {!confirmed && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="min-h-11 rounded-lg border px-4" disabled={busy} onClick={() => void save()}>
                      Save reviewed draft
                    </button>
                    <button
                      className="min-h-11 rounded-lg bg-emerald-700 px-4 text-white"
                      disabled={busy}
                      onClick={() => void previewAndCreate('maintenance')}
                    >
                      Preview maintenance task
                    </button>
                    <button
                      className="min-h-11 rounded-lg bg-blue-700 px-4 text-white"
                      disabled={busy}
                      onClick={() => void previewAndCreate('expense')}
                    >
                      Preview expense
                    </button>
                  </div>
                )}
                {pending && (
                  <section
                    role="dialog"
                    aria-labelledby="document-confirm-title"
                    className="mt-4 rounded-xl border-2 border-blue-600 p-4"
                  >
                    <h3 id="document-confirm-title" className="font-semibold">
                      Confirm exact proposed {pending.kind}
                    </h3>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">
                      {JSON.stringify(pending.after, null, 2)}
                    </pre>
                    <div className="mt-3 flex gap-2">
                      <button
                        autoFocus
                        className="min-h-11 rounded-lg bg-blue-700 px-4 text-white"
                        onClick={() => void confirmPending()}
                      >
                        Confirm creation
                      </button>
                      <button
                        className="min-h-11 rounded-lg border px-4"
                        onClick={() => {
                          setPending(null)
                          setMessage('Cancelled. No fleet record was changed.')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </section>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Saving never changes fleet data. Each creation shows a separate confirmation.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
