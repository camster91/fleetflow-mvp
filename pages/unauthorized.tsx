import { useRouter } from 'next/router'
import { ShieldAlert, Home, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

export default function UnauthorizedPage() {
  const router = useRouter()

  const handleGoHome = () => {
    router.push('/')
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h1>
        
        <div className="space-y-4 text-gray-600 mb-8">
          <p>
            You don't have permission to access this page with your current role.
          </p>
          <p className="text-sm">
            If you believe this is an error, please contact your administrator or try logging in with a different account.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            <Home className="h-5 w-5" />
            <span>Go to Dashboard</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout and Sign In as Different User</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact your system administrator or email support@fleetflow.com
          </p>
        </div>
      </div>
    </div>
  )
}