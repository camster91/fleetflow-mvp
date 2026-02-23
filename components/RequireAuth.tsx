import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

interface RequireAuthProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      // Redirect to login page if not authenticated
      router.push('/auth/login')
      return
    }

    // Check role-based access if allowedRoles is provided
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = session.user?.role
      if (!userRole || !allowedRoles.includes(userRole)) {
        // Redirect to unauthorized page or dashboard
        router.push('/unauthorized')
      }
    }
  }, [session, status, router, allowedRoles])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading authentication...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Check role-based access if allowedRoles is provided
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = session.user?.role
    if (!userRole || !allowedRoles.includes(userRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="p-6 bg-white rounded-lg shadow-sm max-w-md">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">
                You don't have permission to access this page.
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}