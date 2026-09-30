import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { useSession } from '@/lib/session'

type Source = 'admin' | 'environment' | 'unset' | 'unreadable'
type Setting = {
  key: string
  group: 'billing' | 'integrations' | 'ai' | 'operations'
  label: string
  help: string
  secret: boolean
  source: Source
  value: string | null
  environmentFallback: boolean
  mode?: 'test' | 'live'
  updatedAt: string | null
}

const GROUPS: Array<{ id: Setting['group']; title: string; intro: string }> = [
  {
    id: 'billing',
    title: 'Stripe billing',
    intro: 'Checkout, the customer portal and plan enforcement turn on once every billing value is set.',
  },
  { id: 'integrations', title: 'Google Maps and QuickBooks', intro: 'Server credentials for workspace integrations.' },
  { id: 'ai', title: 'AI provider', intro: 'The assistant stays off until a provider, key and model are set.' },
  { id: 'operations', title: 'Scheduled jobs', intro: 'Secret that cron requests must present.' },
]

const SOURCE_LABEL: Record<Source, string> = {
  admin: 'Set here',
  environment: 'From environment',
  unset: 'Not set',
  unreadable: 'Cannot be decrypted — enter it again',
}
const SOURCE_CLASS: Record<Source, string> = {
  admin: 'bg-green-100 text-green-800',
  environment: 'bg-blue-100 text-blue-800',
  unset: 'bg-slate-100 text-slate-700',
  unreadable: 'bg-red-100 text-red-800',
}

function SettingRow({ setting, onChange }: { setting: Setting; onChange: (settings: Setting[]) => void }) {
  const [value, setValue] = useState(setting.secret ? '' : (setting.value ?? ''))
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const inputId = `setting-${setting.key}`
  const errorId = `${inputId}-error`

  const send = async (method: 'PUT' | 'DELETE') => {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const response = await fetch(
        method === 'PUT' ? '/api/admin/settings' : `/api/admin/settings?key=${encodeURIComponent(setting.key)}`,
        {
          method,
          credentials: 'same-origin',
          headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
          body: method === 'PUT' ? JSON.stringify({ key: setting.key, value }) : undefined,
        }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'The setting could not be saved.')
        document.getElementById(inputId)?.focus()
        return
      }
      onChange(body.settings)
      const next = (body.settings as Setting[]).find((item) => item.key === setting.key)
      setValue(setting.secret ? '' : (next?.value ?? ''))
      setStatus(method === 'PUT' ? 'Saved.' : 'Removed.')
    } catch {
      setError('The setting could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-2 border-t border-slate-200 py-4 first:border-t-0"
      onSubmit={(event) => {
        event.preventDefault()
        void send('PUT')
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900">
          {setting.label}
        </label>
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-medium ${SOURCE_CLASS[setting.source]}`}>
          {SOURCE_LABEL[setting.source]}
        </span>
        {setting.mode ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[13px] font-medium text-amber-900">
            {setting.mode === 'live' ? 'Live mode' : 'Test mode'}
          </span>
        ) : null}
      </div>
      <p className="text-[13px] text-slate-600">
        <code className="text-[13px]">{setting.key}</code> · {setting.help}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type={setting.secret ? 'password' : 'text'}
          autoComplete={setting.secret ? 'new-password' : 'off'}
          spellCheck={false}
          required
          value={value}
          placeholder={setting.secret && setting.source !== 'unset' ? 'Enter a new value to replace it' : undefined}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="block min-h-11 w-full rounded border border-slate-300 px-3 font-mono text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 shrink-0 rounded bg-blue-700 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {setting.source === 'admin' || setting.source === 'unreadable' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send('DELETE')}
            className="min-h-11 shrink-0 rounded border border-slate-300 px-4 text-sm font-medium text-slate-800 disabled:opacity-60"
          >
            {setting.environmentFallback ? 'Use environment value' : 'Remove'}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-[13px] text-green-800">
          {status}
        </p>
      ) : null}
    </form>
  )
}

export default function PlatformSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<Setting[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const admin = String(session?.user?.role ?? '').toLowerCase() === 'admin'

  useEffect(() => {
    if (status === 'unauthenticated') void router.push('/auth/login?callbackUrl=/admin/settings')
    else if (status === 'authenticated' && !admin) void router.push('/unauthorized')
  }, [status, admin, router])
  useEffect(() => {
    if (status !== 'authenticated' || !admin) return
    fetch('/api/admin/settings')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then((body) => setSettings(body.settings))
      .catch(() => setLoadError('Platform settings could not be loaded.'))
  }, [status, admin])

  return (
    <DashboardLayout
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin' }, { label: 'Platform settings' }]}
    >
      <Head>
        <title>Platform settings | Fleetvera</title>
      </Head>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">Platform settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Platform administrators only. Values set here replace the deployment environment within a minute and are
            encrypted at rest. Secrets are never shown again after saving, and every change is recorded in the audit log
            without its value.
          </p>
          <a
            href="/admin/email-delivery"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-blue-700 underline"
          >
            Transactional email (Mailgun) is configured separately
          </a>
        </header>
        {loadError ? (
          <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {loadError}
          </p>
        ) : null}
        {!settings && !loadError ? <p className="text-sm text-slate-600">Loading settings…</p> : null}
        {settings
          ? GROUPS.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`group-${group.id}`}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <h2 id={`group-${group.id}`} className="text-lg font-semibold text-slate-900">
                  {group.title}
                </h2>
                <p className="mb-2 text-sm text-slate-600">{group.intro}</p>
                {settings
                  .filter((setting) => setting.group === group.id)
                  .map((setting) => (
                    <SettingRow key={setting.key} setting={setting} onChange={setSettings} />
                  ))}
              </section>
            ))
          : null}
      </div>
    </DashboardLayout>
  )
}
