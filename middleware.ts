import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { securityHeaders, buildCSP, contentSecurityPolicy } from './lib/security'

// Paths that don't require authentication
const publicPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/error',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/public',
]

// Paths that don't require active subscription (always accessible)
const subscriptionExemptPaths = [
  '/pricing',
  '/billing',
  '/api/stripe',
  '/api/subscription',
  '/api/auth',
]

// Check if path is public
function isPublicPath(path: string): boolean {
  return publicPaths.some(publicPath => 
    path.startsWith(publicPath)
  )
}

// Check if path is subscription-exempt
function isSubscriptionExempt(path: string): boolean {
  return subscriptionExemptPaths.some(exemptPath => 
    path.startsWith(exemptPath)
  )
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Add Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    buildCSP(contentSecurityPolicy)
  )

  const { pathname } = request.nextUrl

  // Skip subscription checks for public paths and subscription-related paths
  if (isPublicPath(pathname) || isSubscriptionExempt(pathname)) {
    return response
  }

  // Check for subscription-related redirects
  const subscriptionStatus = request.cookies.get('subscription_status')?.value
  
  if (subscriptionStatus) {
    try {
      const status = JSON.parse(subscriptionStatus)
      
      // If no active subscription and not in trial, redirect to pricing
      if (!status.isActive && !pathname.startsWith('/pricing')) {
        // Allow access to dashboard if in trial
        if (status.trial?.isInTrial) {
          return response
        }
        
        // Check if user has any subscription at all
        if (!status.hasSubscription && pathname !== '/pricing') {
          return NextResponse.redirect(new URL('/pricing', request.url))
        }
        
        // If subscription needs attention (past due, etc.), allow access but will show banner
        if (status.billing?.needsAttention) {
          return response
        }
      }
    } catch {
      // Invalid cookie, continue normally
    }
  }
  
  return response
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}
