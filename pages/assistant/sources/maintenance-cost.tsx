import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'

type CostSource = { vehicleId: string; total: number; count: number; contributors: Array<{ id: string; actualCost: number; href: string }>; contributorsTruncated: boolean }

export default function MaintenanceCostSourcePage() {
  const router = useRouter(); const raw = router.query.vehicle; const vehicle = Array.isArray(raw) ? raw[0] : raw
  const [data, setData] = useState<CostSource | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!router.isReady || !vehicle) return
    const controller = new AbortController(); setLoading(true); setError('')
    fetch(`/api/assistant/sources/maintenance-cost?vehicle=${encodeURIComponent(vehicle)}`, { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<CostSource> }).then(setData).catch(caught => { if (!(caught instanceof Error && caught.name === 'AbortError')) setError('This cited source is unavailable.') }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [router.isReady, vehicle])
  return <DashboardLayout title="Maintenance cost source" subtitle="Authoritative totals from your current workspace" breadcrumbs={[{ label: 'Ask Fleetvera', href: '/assistant' }, { label: 'Maintenance cost source' }]}>
    <div className="mx-auto max-w-3xl space-y-4">
      {loading && <p role="status">Loading cited records…</p>}{error && <p role="alert">{error}</p>}
      {data && <><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Vehicle {data.vehicleId}</h2><p className="mt-3 text-3xl font-bold">${data.total.toFixed(2)}</p><p className="text-sm text-slate-600">Total actual cost across {data.count} recorded maintenance entries.</p></section><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Contributing records</h2><ul className="mt-3 space-y-2">{data.contributors.map(item => <li key={item.id}><Link href={item.href} className="inline-flex min-h-11 items-center text-blue-800 underline">Maintenance record {item.id}: ${item.actualCost.toFixed(2)}</Link></li>)}</ul>{data.contributorsTruncated && <p className="mt-3 text-sm text-slate-600">Additional contributing records are included in the authoritative total but omitted from this bounded list.</p>}</section></>}
    </div>
  </DashboardLayout>
}
