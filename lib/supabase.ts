/**
 * Supabase client configuration
 *
 * IMPORTANT: Use createPagesBrowserClient (from @supabase/auth-helpers-nextjs) for the
 * browser client so sessions are stored in COOKIES instead of localStorage.
 * This is required for the middleware (createMiddlewareClient) to detect the
 * session and protect routes — localStorage is not accessible server-side.
 */
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Browser client — uses cookie-based session storage.
 * The CookieAuthStorageAdapter inside auth-helpers is safe to create at
 * module level: it guards against SSR with `typeof document === 'undefined'`.
 */
export const supabaseClient = createPagesBrowserClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
})

/**
 * Server / admin client — service-role key, no session persistence.
 * Falls back to the anon client if the service role key is absent.
 */
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabaseClient
