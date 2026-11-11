import { useState } from 'react'
import Head from 'next/head'
import { Truck, Package, Wrench, Users, BarChart3, Sparkles, FileText, RotateCcw } from 'lucide-react'
import { demoEnabled } from '@/lib/demo/policy'
import { clearRecentItems } from '@/services/recentItems'

const features = [
  {
    icon: Truck,
    title: 'Vehicles & clients',
    text: 'Explore a six-vehicle fleet and six fictional customers. Add or edit your own sample records.',
  },
  {
    icon: Package,
    title: 'Delivery operations',
    text: 'Plan deliveries, assign a driver, update status, and inspect delivery history.',
  },
  {
    icon: Wrench,
    title: 'Maintenance',
    text: 'Review overdue work, schedule service, complete tasks, and explore maintenance risks.',
  },
  {
    icon: Users,
    title: 'Team roles',
    text: 'Switch between owner, dispatcher, driver, and mechanic to see what each person can access.',
  },
  {
    icon: BarChart3,
    title: 'Reports & analytics',
    text: 'See delivery trends, fleet status, service costs, and download sample CSV reports.',
  },
  {
    icon: Sparkles,
    title: 'Ask Fleetvera',
    text: 'Ask about fleet priorities, deliveries or maintenance. Answers use the sample records, without paid AI calls.',
  },
  {
    icon: FileText,
    title: 'Documents & procedures',
    text: 'Inspect a preloaded sample invoice and extraction, organize procedure categories, and explore service assets.',
  },
  {
    icon: RotateCcw,
    title: 'Safe to experiment',
    text: 'Your changes belong to your session. Reset anytime. Real invitations, uploads, payments and connections are protected.',
  },
]

export async function getServerSideProps() {
  return demoEnabled() ? { props: {} } : { notFound: true }
}

export default function DemoPage() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const start = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/demo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Please try again')
      clearRecentItems()
      window.location.assign('/dashboard')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again')
      setBusy(false)
    }
  }
  return (
    <>
      <Head>
        <title>Explore Fleetvera · Interactive demo</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-800">
            Fleetvera · Interactive demo
          </p>
          <section className="max-w-3xl py-10">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              See a working fleet.
              <br />
              Then make it yours.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Open your own sample workspace in one click. Explore everyday operations, switch roles, and try changes
              without affecting anyone else.
            </p>
            <button
              onClick={() => void start()}
              disabled={busy}
              className="mt-8 min-h-12 rounded-xl bg-emerald-900 px-7 py-4 text-lg font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {busy ? 'Preparing your workspace…' : 'Explore the demo'}
            </button>
            <p className="mt-3 text-sm text-slate-500">
              No account or email needed · Fictional data · Resets in 4 hours
            </p>
            {error && (
              <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                {error}
              </p>
            )}
          </section>
          <section aria-label="Demo feature guide" className="grid gap-4 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <Icon aria-hidden="true" className="mb-3 h-6 w-6 text-emerald-800" />
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </article>
            ))}
          </section>
          <p className="mt-8 text-sm leading-6 text-slate-500">
            Please use fictional information only. Billing records are examples, integrations are disconnected, and
            platform administration stays private. Expired workspaces are removed as fresh demos open.
          </p>
        </div>
      </main>
    </>
  )
}
