import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { securityHeaders, buildCSP, contentSecurityPolicy } from './lib/security'

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
  
  return response
}

// Apply middleware to all routes except static files
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}
