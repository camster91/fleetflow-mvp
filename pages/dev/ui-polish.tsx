/**
 * Development-only UI polish sandbox for manual verification.
 * Returns 404 outside development so it never ships as a product surface.
 */
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert, InlineAlert } from '@/components/ui/Alert'
import { FadeIn } from '@/components/ui/FadeIn'
import { FtueWizard } from '@/components/onboarding/FtueWizard'
import { confirmAction, promptAction, notify } from '@/services/notifications'

export default function UiPolishSandboxPage() {
  const [allowed, setAllowed] = useState(false)
  const [showFtue, setShowFtue] = useState(false)

  useEffect(() => {
    setAllowed(process.env.NODE_ENV !== 'production')
  }, [])

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Not found
      </div>
    )
  }

  if (showFtue) {
    return (
      <FtueWizard
        firstName="Cam"
        dryRun
        onComplete={async () => {
          notify.success('FTUE preview finished')
          setShowFtue(false)
        }}
      />
    )
  }

  return (
    <>
      <Head>
        <title>UI polish sandbox · Fleetvera</title>
      </Head>
      <main className="min-h-screen bg-[var(--fleetvera-mist)] px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl space-y-8">
          <FadeIn>
            <header>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                Fleetvera
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                UI polish sandbox
              </h1>
              <p className="mt-2 text-slate-500">
                Confirm dialogs, toasts, empty states, and the 3-step FTUE.
              </p>
            </header>
          </FadeIn>

          <InlineAlert type="error" title="Fetch failed" actionLabel="Try again" onAction={() => notify.info('Retry clicked')}>
            Could not load vehicles (demo).
          </InlineAlert>

          <Alert type="info" dismissible>
            Soft banners replace disruptive browser alerts for day-to-day feedback.
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              className="min-h-11"
              onClick={async () => {
                const ok = await confirmAction('This cannot be undone.', 'Delete vehicle')
                notify.success(ok ? 'Confirmed' : 'Cancelled')
              }}
            >
              Open confirm
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                const notes = await promptAction('Describe the issue', '', 'Report issue')
                if (notes) notify.success(`Noted: ${notes}`)
                else notify.info('Prompt cancelled')
              }}
            >
              Open prompt
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => notify.success('Toast looks good')}>
              Show toast
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setShowFtue(true)}>
              Preview FTUE
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <EmptyState
              type="data"
              title="No vehicles yet"
              description="Add your first vehicle to start tracking your fleet"
              actionLabel="Add Vehicle"
              onAction={() => notify.success('Add vehicle CTA')}
            />
          </div>
        </div>
      </main>
    </>
  )
}
