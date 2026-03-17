import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-placeholder-not-for-production'

// Marketing / SaaS pages that should redirect to login (private deployment)
const REDIRECT_TO_LOGIN = new Set([
  '/',
  '/pricing',
  '/about',
  '/features',
  '/changelog',
  '/status',
  '/cookie-policy',
  '/privacy-policy',
  '/terms-of-service',
  '/gdpr',
])

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/vehicles',
  '/deliveries',
  '/maintenance',
  '/analytics',
  '/admin',
  '/settings',
  '/team',
  '/billing',
  '/notifications',
  '/report',
]

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/task']

const PUBLIC_PREFIXES = ['/task']

function getTokenPayload(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; role: string }
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Let auth API and static files pass through
  if (
    PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/manifest') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next()
  }

  // Marketing routes → redirect everyone to login (private deployment)
  if (
    REDIRECT_TO_LOGIN.has(pathname) ||
    pathname.startsWith('/blog') ||
    pathname.startsWith('/help')
  ) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  const token = getTokenPayload(req)
  const isAuthPage = pathname.startsWith('/auth')

  // Authenticated user hits an auth page → send to dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Public routes that don't need auth
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Protected route without a session → send to login
  if (PROTECTED_PREFIXES.some(p => pathname.startsWith(p)) && !token) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
