import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return 'dev-only-placeholder-not-for-production'
}

const PUBLIC_PAGES = new Set([
  '/',
  '/pricing',
  '/cookie-policy',
  '/privacy-policy',
  '/terms-of-service',
  '/gdpr',
])

const RETIRED_PUBLIC_PREFIXES = ['/about', '/features', '/blog', '/changelog', '/status']

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
  '/onboarding',
  '/clients',
  '/sop',
  '/vending-machines',
  '/driver',
  '/routes',
  '/intelligence',
]

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/task']

const PUBLIC_PREFIXES = ['/task', '/help']

async function getTokenPayload(req: NextRequest) {
  const token = req.cookies.get('token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(getJwtSecret()),
      { algorithms: ['HS256'] }
    )
    return payload
  } catch {
    return null
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method.toUpperCase()

  // CSRF: block cross-origin mutating API calls that rely on cookie auth
  const csrfExempt =
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/api/cron/')

  if (
    pathname.startsWith('/api/') &&
    !csrfExempt &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'OPTIONS'
  ) {
    const origin = req.headers.get('origin')
    const referer = req.headers.get('referer')
    const host = req.headers.get('host')
    const allowed = new Set<string>()
    if (host) allowed.add(host)
    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL
    if (appUrl) {
      try {
        allowed.add(new URL(appUrl).host)
      } catch {
        /* ignore */
      }
    }

    const hostOf = (value: string | null) => {
      if (!value) return null
      try {
        return new URL(value).host
      } catch {
        return null
      }
    }

    if (origin) {
      const oHost = hostOf(origin)
      if (!oHost || !allowed.has(oHost)) {
        return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
      }
    } else if (referer) {
      const rHost = hostOf(referer)
      if (!rHost || !allowed.has(rHost)) {
        return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
    }
  }

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
  const token = await getTokenPayload(req)
  const isAuthPage = pathname.startsWith('/auth')

  if (RETIRED_PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Authenticated user hits an auth page → send to dashboard
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Public routes that don't need auth
  if (PUBLIC_PAGES.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
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
