import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuth } from '../../context/SupabaseAuthContext'
import AdminUserManagement from '../../components/AdminUserManagement'
import { Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AdminUsersPage() {
  const { user, userRole, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect if not authenticated or not an admin
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
    } else if (!isLoading && isAuthenticated && userRole !== 'admin') {
      router.push('/unauthorized')
    }
  }, [isLoading, isAuthenticated, userRole, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Show access denied if not admin
  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You need administrator privileges to access this page.</p>
          <Link href="/" className="text-primary-600 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">Admin Panel</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminUserManagement />
      </main>
    </div>
  )
}
