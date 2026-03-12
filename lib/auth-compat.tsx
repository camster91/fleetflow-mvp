/**
 * NextAuth compatibility shim for Supabase Auth
 * 
 * This module re-implements next-auth/react's API surface using Supabase,
 * allowing all existing `useSession`, `signOut`, `signIn` calls to work
 * without requiring a NextAuth backend.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { supabaseClient } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Session {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
    company?: string;
    // Legacy fields from old NextAuth session
    [key: string]: any;
  };
  expires: string;
  // Legacy optional fields
  impersonation?: {
    isImpersonating?: boolean;
    impersonatedUserName?: string;
    originalUserId?: string;
  };
  [key: string]: any;
}

type SessionStatus = 'authenticated' | 'unauthenticated' | 'loading';

interface SessionContextValue {
  data: Session | null;
  status: SessionStatus;
  update: () => Promise<Session | null>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: 'unauthenticated',
  update: async () => null,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children, session: initialSession }: {
  children: ReactNode;
  session?: Session | null;
}) {
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [status, setStatus] = useState<SessionStatus>(initialSession ? 'authenticated' : 'loading');

  const buildSession = async (supabaseUser: any): Promise<Session | null> => {
    if (!supabaseUser) return null;

    // Try to get role from public.users table
    let role = supabaseUser.user_metadata?.role || 'fleet_manager';
    let name = supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || '';
    let company = supabaseUser.user_metadata?.company;

    try {
      const { data: profile } = await supabaseClient
        .from('users')
        .select('role, name, company')
        .eq('id', supabaseUser.id)
        .single();
      if (profile) {
        role = profile.role || role;
        name = profile.name || name;
        company = profile.company || company;
      }
    } catch {
      // Profile table might not have the user yet — use metadata
    }

    return {
      user: {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name,
        role,
        company,
        image: supabaseUser.user_metadata?.avatar_url || null,
      },
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  };

  useEffect(() => {
    // Get initial session
    supabaseClient.auth.getSession().then(async ({ data: { session: supabaseSession } }) => {
      if (supabaseSession?.user) {
        const sess = await buildSession(supabaseSession.user);
        setSession(sess);
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      async (event, supabaseSession) => {
        if (supabaseSession?.user) {
          const sess = await buildSession(supabaseSession.user);
          setSession(sess);
          setStatus('authenticated');
        } else {
          setSession(null);
          setStatus('unauthenticated');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const update = async (): Promise<Session | null> => {
    const { data: { session: supabaseSession } } = await supabaseClient.auth.getSession();
    if (supabaseSession?.user) {
      const sess = await buildSession(supabaseSession.user);
      setSession(sess);
      return sess;
    }
    return null;
  };

  return (
    <SessionContext.Provider value={{ data: session, status, update }}>
      {children}
    </SessionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

// ─── signOut ──────────────────────────────────────────────────────────────────

export async function signOut(options?: { redirect?: boolean; callbackUrl?: string }) {
  await supabaseClient.auth.signOut();
  if (options?.redirect !== false) {
    window.location.href = options?.callbackUrl || '/auth/login';
  }
}

// ─── signIn ───────────────────────────────────────────────────────────────────

export async function signIn(
  provider?: string,
  options?: { email?: string; password?: string; redirect?: boolean; callbackUrl?: string }
): Promise<{ error?: string; ok?: boolean; url?: string } | undefined> {
  if (provider === 'credentials' && options?.email && options?.password) {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: options.email,
      password: options.password,
    });
    if (error) return { error: error.message, ok: false };
    return { ok: true };
  }
  // Redirect to login for other cases
  window.location.href = options?.callbackUrl || '/auth/login';
  return undefined;
}

// ─── getCsrfToken (stub) ──────────────────────────────────────────────────────
export async function getCsrfToken(): Promise<string> {
  return 'supabase-no-csrf';
}

// ─── getSession (server-side stub) ────────────────────────────────────────────
export async function getSession(): Promise<Session | null> {
  return null;
}
