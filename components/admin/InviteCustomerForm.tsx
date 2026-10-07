import { useState } from 'react'

interface Props {
  onInvited: () => void
}

/**
 * Platform admins onboard a new customer here: the account is created and the customer is emailed how
 * to sign in. They start in their own workspace and can create a team and invite teammates from /team.
 */
export default function InviteCustomerForm({ onInvited }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(name.trim() ? { name } : {}), ...(company.trim() ? { company } : {}) }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'The customer could not be invited.')
        document.getElementById('invite-customer-email')?.focus()
        return
      }
      setStatus(
        body.emailSent
          ? `Invitation sent to ${email}.`
          : `Account created for ${email}, but the email could not be sent. Ask them to sign in at /auth/login.`
      )
      setEmail('')
      setName('')
      setCompany('')
      onInvited()
    } catch {
      setError('The customer could not be invited.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby="invite-customer-title"
      className="rounded-xl border bg-white p-5 shadow-xs"
    >
      <h3 id="invite-customer-title" className="text-lg font-semibold text-gray-900">
        Invite a customer
      </h3>
      <p className="mt-1 text-sm text-gray-600">
        Creates their account and emails them how to sign in. They get their own workspace and can invite their team.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium text-gray-800">
          Email
          <input
            id="invite-customer-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'invite-customer-error' : undefined}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3"
          />
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Name (optional)
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3"
          />
        </label>
        <label className="block text-sm font-medium text-gray-800">
          Company (optional)
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3"
          />
        </label>
      </div>
      {error ? (
        <p id="invite-customer-error" role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="mt-3 text-sm text-emerald-800">
          {status}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 min-h-11 rounded-lg bg-emerald-800 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send invitation'}
      </button>
    </form>
  )
}
