import { useState } from 'react'
import {
  Truck,
  Package,
  Wrench,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react'
import { FadeIn } from '@/components/ui/FadeIn'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

const TOTAL_STEPS = 3

const FEATURES = [
  {
    icon: Truck,
    title: 'Vehicles',
    description: 'Track status, mileage, and drivers across your fleet in one place.',
    accent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  {
    icon: Package,
    title: 'Deliveries',
    description: 'Schedule routes, follow progress, and keep customers informed.',
    accent: 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300',
  },
  {
    icon: Wrench,
    title: 'Maintenance',
    description: 'Stay ahead of service due dates before downtime hits the road.',
    accent: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  },
] as const

export interface FtueWizardProps {
  firstName?: string
  onComplete: () => void | Promise<void>
  onAddVehicle?: (vehicle: {
    make: string
    model: string
    year: string
    plate: string
  }) => Promise<'ok' | 'error'>
  /** When true, skip API and just call onComplete after local validation */
  dryRun?: boolean
}

export function FtueWizard({
  firstName = 'there',
  onComplete,
  onAddVehicle,
  dryRun = false,
}: FtueWizardProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [vehicle, setVehicle] = useState({ make: '', model: '', year: '', plate: '' })
  const [vehicleAdded, setVehicleAdded] = useState(false)

  const handleAddVehicle = async () => {
    setBanner(null)
    if (!vehicle.make || !vehicle.model || !vehicle.year || !vehicle.plate) {
      setBanner('Fill in make, model, year, and plate — or skip for now.')
      return
    }
    setLoading(true)
    try {
      if (dryRun || !onAddVehicle) {
        setVehicleAdded(true)
        await onComplete()
        return
      }
      const result = await onAddVehicle(vehicle)
      if (result !== 'ok') {
        setBanner('Could not add the vehicle. You can finish setup and add it from Vehicles.')
        return
      }
      setVehicleAdded(true)
      await onComplete()
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = (step / TOTAL_STEPS) * 100

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[var(--fleetvera-mist)] via-white to-emerald-50/40 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="border-b border-emerald-900/10 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Step {step} of {TOTAL_STEPS}
            </p>
            {step < TOTAL_STEPS && (
              <button
                type="button"
                onClick={() => void onComplete()}
                className="min-h-11 px-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Skip setup
              </button>
            )}
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label="Onboarding progress"
          >
            <div
              className="h-full rounded-full bg-[var(--fleetvera-evergreen)] transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {step === 1 && (
            <FadeIn>
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[var(--fleetvera-shadow)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-8 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-400">
                    Fleetvera
                  </p>
                  <div className="mx-auto mt-4 mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    <Sparkles className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Welcome, {firstName}
                  </h1>
                  <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
                    Three quick steps to get comfortable with your fleet workspace.
                  </p>
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  className="min-h-12"
                  iconRight={<ArrowRight className="h-4 w-4" />}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </FadeIn>
          )}

          {step === 2 && (
            <FadeIn>
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[var(--fleetvera-shadow)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-6 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    How Fleetvera helps
                  </h1>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    The three tools you&apos;ll use every day.
                  </p>
                </div>
                <ul className="space-y-3">
                  {FEATURES.map((feature, index) => {
                    const Icon = feature.icon
                    return (
                      <FadeIn key={feature.title} delay={80 * (index + 1)}>
                        <li className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${feature.accent}`}
                          >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {feature.title}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                              {feature.description}
                            </p>
                          </div>
                        </li>
                      </FadeIn>
                    )
                  })}
                </ul>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    iconLeft={<ArrowLeft className="h-4 w-4" />}
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    className="min-h-11 flex-1"
                    iconRight={<ArrowRight className="h-4 w-4" />}
                    onClick={() => setStep(3)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </FadeIn>
          )}

          {step === 3 && (
            <FadeIn>
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-[var(--fleetvera-shadow)] sm:p-8 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {vehicleAdded ? (
                      <CheckCircle className="h-7 w-7" aria-hidden="true" />
                    ) : (
                      <Truck className="h-7 w-7" aria-hidden="true" />
                    )}
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Add your first vehicle
                  </h1>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Optional — you can always do this from Vehicles later.
                  </p>
                </div>

                {banner && (
                  <Alert type="warning" dismissible onDismiss={() => setBanner(null)} className="mb-4">
                    {banner}
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ob-make" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Make
                      </label>
                      <input
                        id="ob-make"
                        type="text"
                        value={vehicle.make}
                        onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
                        placeholder="e.g. Ford"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="ob-model" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Model
                      </label>
                      <input
                        id="ob-model"
                        type="text"
                        value={vehicle.model}
                        onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
                        placeholder="e.g. Transit"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ob-year" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Year
                      </label>
                      <input
                        id="ob-year"
                        type="number"
                        value={vehicle.year}
                        onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
                        placeholder="e.g. 2024"
                        min={1990}
                        max={2030}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label htmlFor="ob-plate" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        License plate
                      </label>
                      <input
                        id="ob-plate"
                        type="text"
                        value={vehicle.plate}
                        onChange={(e) => setVehicle({ ...vehicle, plate: e.target.value })}
                        placeholder="e.g. ABC-1234"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    iconLeft={<ArrowLeft className="h-4 w-4" />}
                    onClick={() => setStep(2)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    className="min-h-11 flex-1"
                    loading={loading}
                    iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
                    onClick={() => void handleAddVehicle()}
                  >
                    {loading ? 'Adding…' : 'Add & go to dashboard'}
                  </Button>
                </div>
                <button
                  type="button"
                  onClick={() => void onComplete()}
                  className="mt-3 min-h-11 w-full text-center text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Skip and open dashboard
                </button>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  )
}

export default FtueWizard
