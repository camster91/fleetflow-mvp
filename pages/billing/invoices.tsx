import { useEffect, useState } from 'react'
import { AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { PageHeader } from '../../components/PageHeader'

interface Invoice {
  id: string
  amount: number
  currency: string
  status: string
  invoicePdf: string | null
  createdAt: string
  periodStart: string
  periodEnd: string
}

const DISPLAY_CURRENCIES = new Set(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD'])

function formatAmount(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount) || !DISPLAY_CURRENCIES.has(currency)) return 'Amount unavailable'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
  } catch {
    return 'Amount unavailable'
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : 'Date unavailable'
}

function safePdf(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'))
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/subscription/invoices')
      .then(async (response) => {
        if (!response.ok) throw new Error('request failed')
        const data = await response.json()
        setInvoices(data.invoices || [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Billing', href: '/billing' },
        { label: 'Invoices' },
      ]}
    >
      <PageHeader title="Invoices" subtitle="Payment history synchronized from Stripe" />
      <div className="max-w-3xl mx-auto rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {loading && (
          <div className="flex justify-center p-16">
            <Loader2 aria-label="Loading invoices" className="h-7 w-7 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && error && (
          <div role="alert" className="flex gap-3 p-6 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Invoices could not be loaded. Please try again later.
          </div>
        )}
        {!loading && !error && invoices.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            <FileText className="mx-auto mb-3 h-8 w-8" />
            No invoices have been recorded yet.
          </div>
        )}
        {!loading && !error && invoices.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {invoices.map((invoice) => {
              const pdf = safePdf(invoice.invoicePdf)
              return (
                <li key={invoice.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{formatAmount(invoice.amount, invoice.currency)}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {invoice.status}
                    </span>
                    {pdf && (
                      <a
                        href={pdf}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-blue-800 hover:underline"
                      >
                        PDF invoice
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  )
}
