import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '@/lib/session'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import AdminDashboard from '@/components/role-dashboards/AdminDashboard'
import DispatchDashboard from '@/components/role-dashboards/DispatchDashboard'
import DriverDashboard from '@/components/role-dashboards/DriverDashboard'
import MaintenanceDashboard from '@/components/role-dashboards/MaintenanceDashboard'
import { resolveDashboardRole, type DashboardRole } from '@/lib/dashboardRoles'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { dashboardContractSchema } from '@/lib/dashboardContract'
import { CommandShell, Exceptions, FleetTotals, type CommandCentreData, type CommandCentreProps } from '@/components/role-dashboards/CommandCentre'

const EMPTY: CommandCentreData = { vehicles: [], deliveries: [], maintenance: [] }

function ViewerDashboard({ vehicles, deliveries, maintenance, partial, retry, totals, availability, restricted }: CommandCentreProps) {
  return <CommandShell title="Fleet overview" partial={partial} retry={retry} availability={availability} restricted={restricted}>
    <Exceptions deliveries={deliveries} maintenance={maintenance} availability={availability} />
    <FleetTotals totals={totals} restricted={restricted} />
  </CommandShell>
}

export default function Dashboard() {
  const { status } = useSession()
  const [role, setRole] = useState<DashboardRole | null>(null)
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [partial, setPartial] = useState(false)
  const [decisions, setDecisions] = useState<string[]>([])
  const [actions, setActions] = useState<Array<{label:string;href:string}>>([])
  const [availability, setAvailability] = useState({ vehicles: false, deliveries: false, maintenance: false })
  const [restricted, setRestricted] = useState({ vehicles: false, deliveries: false, maintenance: false })
  const [totals, setTotals] = useState<Record<'vehicles'|'deliveries'|'maintenance',number|null>>({ vehicles:null, deliveries:null, maintenance:null })
  const [onboardingCompleted, setOnboardingCompleted] = useState(true)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [error, setError] = useState(false)
  const requestGeneration = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const cancelActiveRequest = useCallback(()=>{requestGeneration.current++;activeRequest.current?.abort()},[])
  const load = useCallback(async () => {
    const generation=++requestGeneration.current; activeRequest.current?.abort(); const controller=new AbortController(); activeRequest.current=controller
    setLoading(true); setError(false)
    try {
      const response = await fetch('/api/dashboard/context',{signal:controller.signal})
      if (!response.ok) throw new Error('denied')
      const body = dashboardContractSchema.parse(await response.json())
      if(controller.signal.aborted||generation!==requestGeneration.current)return
      const rawRole = typeof body?.role === 'string' ? body.role.trim().toUpperCase() : ''
      if (!['OWNER','ADMIN','MANAGER','DISPATCHER','DISPATCH','TECHNICIAN','MAINTENANCE','DRIVER','VIEWER','MEMBER'].includes(rawRole)) throw new Error('invalid')
      const sources = body.sources
      setRole(resolveDashboardRole(rawRole)); setDecisions(body.decisions); setActions(body.actions)
      setOnboardingCompleted(body.onboardingCompleted !== false)
      setData({ vehicles: sources.vehicles.items as unknown as CommandCentreData['vehicles'], deliveries: sources.deliveries.items as unknown as CommandCentreData['deliveries'], maintenance: sources.maintenance.items as unknown as CommandCentreData['maintenance'] })
      setTotals({ vehicles:sources.vehicles?.total ?? null, deliveries:sources.deliveries?.total ?? null, maintenance:sources.maintenance?.total ?? null })
      const nextAvailability = { vehicles: sources.vehicles?.available === true, deliveries: sources.deliveries?.available === true, maintenance: sources.maintenance?.available === true }
      // A source the role may not view is not a partial outage.
      const nextRestricted = { vehicles: sources.vehicles?.error === 'FORBIDDEN', deliveries: sources.deliveries?.error === 'FORBIDDEN', maintenance: sources.maintenance?.error === 'FORBIDDEN' }
      setAvailability(nextAvailability); setRestricted(nextRestricted); setPartial((Object.keys(nextAvailability) as Array<keyof typeof nextAvailability>).some(key => !nextAvailability[key] && !nextRestricted[key])); setLoading(false)
    } catch(error) { if(controller.signal.aborted||generation!==requestGeneration.current)return; setRole(null); setError(true); setLoading(false) }
  }, [])
  useEffect(() => { if (status === 'authenticated') void load(); return cancelActiveRequest }, [cancelActiveRequest,load, status])
  useEffect(() => {
    if (!role || typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'test') return
    const keyName = 'fleetvera_pilot_session'
    let sessionKey = window.sessionStorage.getItem(keyName)
    if (!sessionKey) { sessionKey = crypto.randomUUID().replace(/-/g, ''); window.sessionStorage.setItem(keyName, sessionKey) }
    void fetch('/api/pilot/events', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'DASHBOARD_OPENED', sessionKey }) }).catch(() => undefined)
  }, [role])
  if ((loading && !role) || status === 'loading') return <DashboardLayout><div role="status" aria-live="polite" className="p-6">Loading command centre…</div></DashboardLayout>
  if (status !== 'authenticated' || error || !role) return <DashboardLayout><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5"><h1 className="font-semibold">Unable to open this workspace dashboard</h1><p className="mt-1 text-sm">Your workspace access could not be verified.</p>{status === 'authenticated' && <button onClick={load} className="mt-4 min-h-[44px] rounded-lg border px-4">Retry</button>}</div></DashboardLayout>
  const props = { ...data, partial, retry: load, decisions, actions, availability, restricted, totals, onboardingCompleted }
  return <DashboardLayout>{role === 'admin' ? <AdminDashboard {...props} /> : role === 'dispatcher' ? <DispatchDashboard {...props} /> : role === 'maintenance' ? <MaintenanceDashboard {...props} /> : role === 'driver' ? <DriverDashboard {...props} /> : <ViewerDashboard {...props} />}{role === 'admin' && <OnboardingModal isOpen={!onboardingCompleted && !onboardingDismissed} onClose={()=>setOnboardingDismissed(true)} onComplete={()=>{setOnboardingCompleted(true);setOnboardingDismissed(true)}}/>}</DashboardLayout>
}
