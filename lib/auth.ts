import { supabaseClient, supabaseAdmin } from './supabase'
import bcrypt from 'bcryptjs'

// Types
export interface User {
  id: string
  email: string
  name?: string
  role: string
  company?: string
  emailVerified?: Date
  twoFactorEnabled?: boolean
}

export interface Session {
  user: User
  access_token: string
  refresh_token: string
}

// Sign up with email/password
export async function signUp(email: string, password: string, name: string) {
  // Create auth user in Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm for now (you can change this)
    user_metadata: {
      name,
      role: 'fleet_manager'
    }
  })

  if (authError) {
    throw new Error(authError.message)
  }

  // Create user profile in database
  const { error: profileError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      name,
      role: 'fleet_manager',
      created_at: new Date().toISOString()
    })

  if (profileError) {
    // Rollback auth user if profile creation fails
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    throw new Error(profileError.message)
  }

  return { user: authData.user }
}

// Sign in with email/password
export async function signIn(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    throw new Error(error.message)
  }

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: profile?.name || data.user.user_metadata.name,
      role: profile?.role || 'fleet_manager',
      company: profile?.company,
      emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : undefined,
      twoFactorEnabled: profile?.two_factor_enabled || false
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  }
}

// Sign out
export async function signOut(token?: string) {
  if (token) {
    // Server-side signout with token
    const { error } = await supabaseAdmin.auth.admin.signOut(token)
    if (error) throw new Error(error.message)
  } else {
    // Client-side signout
    const { error } = await supabaseClient.auth.signOut()
    if (error) throw new Error(error.message)
  }
}

// Get session from access token
export async function getSession(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  
  if (error || !data.user) {
    return null
  }

  // Get user profile
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: profile?.name || data.user.user_metadata.name,
      role: profile?.role || 'fleet_manager',
      company: profile?.company,
      emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : undefined,
      twoFactorEnabled: profile?.two_factor_enabled || false
    }
  }
}

// Refresh session
export async function refreshSession(refreshToken: string) {
  const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken })
  
  if (error) {
    throw new Error(error.message)
  }

  return {
    access_token: data.session!.access_token,
    refresh_token: data.session!.refresh_token
  }
}

// OAuth sign in
export async function signInWithOAuth(provider: 'google' | 'azure') {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: provider === 'azure' ? 'azure' : 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://fleet.ashbi.ca'}/auth/callback`
    }
  })

  if (error) {
    throw new Error(error.message)
  }

  return { url: data.url }
}

// Handle OAuth callback
export async function handleOAuthCallback(code: string) {
  const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code)
  
  if (error) {
    throw new Error(error.message)
  }

  // Check if user profile exists, create if not
  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (!existingProfile) {
    await supabaseAdmin
      .from('users')
      .insert({
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata.name || data.user.user_metadata.full_name,
        role: 'fleet_manager',
        created_at: new Date().toISOString()
      })
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata.name || data.user.user_metadata.full_name,
      role: existingProfile?.role || 'fleet_manager',
      company: existingProfile?.company,
      emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : undefined,
      twoFactorEnabled: existingProfile?.two_factor_enabled || false
    },
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  }
}
