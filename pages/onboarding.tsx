import { useRouter } from 'next/router'
import { useSession } from '@/lib/session'
import toast from 'react-hot-toast'
import { FtueWizard } from '@/components/onboarding/FtueWizard'

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--fleetvera-mist)] dark:bg-slate-950 flex items-center justify-center">
        <div
          className="h-10 w-10 rounded-full border-2 border-emerald-800 border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.replace('/auth/login')
    return null
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'there'

  const completeOnboarding = async () => {
    try {
      await fetch('/api/auth/complete-onboarding', { method: 'POST' })
    } catch {
      // non-critical
    }
    router.push('/dashboard')
  }

  return (
    <FtueWizard
      firstName={firstName}
      onComplete={completeOnboarding}
      onAddVehicle={async (vehicle) => {
        try {
          const res = await fetch('/api/vehicles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
              make: vehicle.make,
              model: vehicle.model,
              year: parseInt(vehicle.year, 10),
              licensePlate: vehicle.plate,
              status: 'active',
            }),
          })
          if (!res.ok) return 'error'
          toast.success('First vehicle added')
          return 'ok'
        } catch {
          return 'error'
        }
      }}
    />
  )
}
