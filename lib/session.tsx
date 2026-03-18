/**
 * Drop-in replacement for next-auth/react.
 * Exports: SessionProvider, useSession, signIn, signOut
 * Session shape matches NextAuth so existing components work unchanged.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface SessionUser {
  id: string
  email: string
  name: string | null
  role: string
  image?: string | null
}

interface Session {
  user: SessionUser
}

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface SessionContextValue {
  data: Session | null
  status: SessionStatus
  update: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: 'loading',
  update: async () => {},
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<SessionStatus>('loading')

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setSession({ user: data.user })
        setStatus('authenticated')
      } else {
        setSession(null)
        setStatus('unauthenticated')
      }
    } catch {
      setSession(null)
      setStatus('unauthenticated')
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  return (
    <SessionContext.Provider value={{ data: session, status, update: fetchSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}

/**
 * sendCode — POST email to /api/auth/send-code to request a magic login code.
 */
export async function sendCode(email: string) {
  try {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { error: data.error || 'Failed to send code', ok: false }
    }
    return { error: null, ok: true, message: data.message }
  } catch {
    return { error: 'Failed to send code', ok: false }
  }
}

/**
 * signIn — POST email + code to /api/auth/login.
 */
export async function signIn(
  _provider: string,
  opts?: { email?: string; code?: string; password?: string; redirect?: boolean; callbackUrl?: string }
) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: opts?.email, code: opts?.code }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { error: data.error || 'CredentialsSignin', ok: false }
    }
    return { error: null, ok: true }
  } catch {
    return { error: 'Login failed', ok: false }
  }
}

/**
 * signOut — POST to /api/auth/logout, then redirect.
 */
export async function signOut(opts?: { callbackUrl?: string }) {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = opts?.callbackUrl || '/auth/login'
}
