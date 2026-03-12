import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired (keeps cookies up to date)
  const { data: { session } } = await supabase.auth.getSession()

  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const isProtected = req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/vehicles') ||
    req.nextUrl.pathname.startsWith('/deliveries') ||
    req.nextUrl.pathname.startsWith('/analytics') ||
    req.nextUrl.pathname.startsWith('/admin') ||
    req.nextUrl.pathname.startsWith('/settings') ||
    req.nextUrl.pathname.startsWith('/team') ||
    req.nextUrl.pathname.startsWith('/billing') ||
    req.nextUrl.pathname.startsWith('/notifications') ||
    req.nextUrl.pathname.startsWith('/maintenance')

  // If authenticated and on auth page → redirect to dashboard
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // If not authenticated and on protected page → redirect to login
  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/vehicles/:path*',
    '/deliveries/:path*',
    '/analytics/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/team/:path*',
    '/billing/:path*',
    '/notifications/:path*',
    '/maintenance/:path*',
    '/auth/:path*',
  ],
}
