import { useState } from 'react'
import { useRouter } from 'next/router'
import { useSession } from '@/lib/session'
import { Truck, Users, CheckCircle, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const TOTAL_STEPS = 4

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1 state
  const [companyName, setCompanyName] = useState('')

  // Step 2 state
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', plate: '' })

  // Step 3 state
  const [inviteEmail, setInviteEmail] = useState('')

  // Track what was completed for summary
  const [vehicleAdded, setVehicleAdded] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.replace('/auth/login')
    return null
  }

  const completeOnboarding = async () => {
    try {
      await fetch('/api/auth/complete-onboarding', { method: 'POST' })
    } catch {
      // non-critical, continue
    }
    router.push('/dashboard')
  }

  const handleSkip = async () => {
    await completeOnboarding()
  }

  const handleAddVehicle = async () => {
    if (!vehicle.make || !vehicle.model || !vehicle.year || !vehicle.plate) {
      toast.error('Please fill in all vehicle fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          make: vehicle.make,
          model: vehicle.model,
          year: parseInt(vehicle.year),
          licensePlate: vehicle.plate,
          status: 'active',
        }),
      })
      if (!res.ok) throw new Error('Failed to add vehicle')
      setVehicleAdded(true)
      toast.success('Vehicle added!')
      setStep(3)
    } catch {
      toast.error('Failed to add vehicle. You can add it later from the dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: [inviteEmail], role: 'member' }),
      })
      if (!res.ok) throw new Error('Failed to send invite')
      setInviteSent(true)
      toast.success('Invitation sent!')
      setStep(4)
    } catch {
      toast.error('Failed to send invite. You can invite team members later.')
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = (step / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Progress bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Step {step} of {TOTAL_STEPS}</span>
            {step > 1 && step < 4 && (
              <button
                onClick={handleSkip}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Skip setup
              </button>
            )}
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
                  <Sparkles className="h-8 w-8 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Welcome to Fleetvera!</h1>
                <p className="text-slate-500 mt-2">Let&apos;s get your fleet set up in a few quick steps.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Logistics"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <button
                onClick={() => setStep(2)}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 2: Add Vehicle */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-4">
                  <Truck className="h-8 w-8 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Add Your First Vehicle</h1>
                <p className="text-slate-500 mt-2">Enter your vehicle details to start tracking.</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Make</label>
                    <input
                      type="text"
                      value={vehicle.make}
                      onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                      placeholder="e.g. Ford"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                    <input
                      type="text"
                      value={vehicle.model}
                      onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                      placeholder="e.g. Transit"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                    <input
                      type="number"
                      value={vehicle.year}
                      onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                      placeholder="e.g. 2024"
                      min="1990"
                      max="2030"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">License Plate</label>
                    <input
                      type="text"
                      value={vehicle.plate}
                      onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value })}
                      placeholder="e.g. ABC-1234"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleAddVehicle}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Vehicle'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => setStep(3)}
                className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Skip this step
              </button>
            </div>
          )}

          {/* Step 3: Invite Team */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Invite Your Team</h1>
                <p className="text-slate-500 mt-2">Invite a team member to collaborate on fleet management.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                  onClick={handleInvite}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={() => setStep(4)}
                className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Skip this step
              </button>
            </div>
          )}

          {/* Step 4: All Set */}
          {step === 4 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-2xl mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">You&apos;re All Set!</h1>
                <p className="text-slate-500 mt-2">Here&apos;s a summary of your setup.</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-700">
                    Company: <strong>{companyName || 'Not set'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  {vehicleAdded ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-300 shrink-0" />
                  )}
                  <span className="text-sm text-slate-700">
                    {vehicleAdded
                      ? `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}`
                      : 'No vehicle added yet'}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  {inviteSent ? (
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-300 shrink-0" />
                  )}
                  <span className="text-sm text-slate-700">
                    {inviteSent
                      ? `Invite sent to ${inviteEmail}`
                      : 'No team member invited yet'}
                  </span>
                </div>
              </div>

              <button
                onClick={completeOnboarding}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
