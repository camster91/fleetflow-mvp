import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { AuthLayout } from '../../components/layouts/AuthLayout'
import { Button } from '../../components/ui/Button'

export default function RegisterPage() {
  return (
    <AuthLayout title="Registration Disabled" subtitle="Access is by invitation only">
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-slate-400" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invitation Only</h2>
          <p className="mt-2 text-sm text-slate-600">
            New accounts can only be created by an administrator. Contact your team admin to get access.
          </p>
        </div>

        <Link href="/auth/login">
          <Button variant="primary" fullWidth size="lg">
            Back to Sign In
          </Button>
        </Link>
      </div>
    </AuthLayout>
  )
}
