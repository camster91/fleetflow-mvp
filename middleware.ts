import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Define protected routes and their allowed roles
const protectedRoutes = [
  {
    path: '/',
    allowedRoles: ['admin', 'fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance']
  },
  {
    path: '/dashboard',
    allowedRoles: ['admin', 'fleet_manager', 'dispatch', 'driver', 'maintenance', 'safety_officer', 'finance']
  },
  {
    path: '/admin',
    allowedRoles: ['admin']
  },
  {
    path: '/dispatch',
    allowedRoles: ['dispatch', 'admin']
  },
  {
    path: '/driver',
    allowedRoles: ['driver', 'admin']
  },
  {
    path: '/maintenance',
    allowedRoles: ['maintenance', 'admin']
  },
  {
    path: '/safety',
    allowedRoles: ['safety_officer', 'admin']
  },
  {
    path: '/finance',
    allowedRoles: ['finance', 'admin']
  }
]

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Check if the user has the required role for the route
    const route = protectedRoutes.find(r => pathname.startsWith(r.path))
    
    if (route && token?.role) {
      const userRole = token.role as string
      const hasAccess = route.allowedRoles.includes(userRole)
      
      if (!hasAccess) {
        // Redirect to unauthorized page or dashboard
        return NextResponse.redirect(new URL('/unauthorized', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Require authentication for all routes except auth pages and public assets
        return !!token
      }
    },
    pages: {
      signIn: '/auth/login'
    }
  }
)

// Specify which routes to protect
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - auth/ (auth pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api/auth|auth/|_next/static|_next/image|favicon.ico|public).*)',
  ],
}