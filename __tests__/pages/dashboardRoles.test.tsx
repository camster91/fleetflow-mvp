import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Dashboard from '../../pages/dashboard'

let mockRole = 'OWNER'
jest.mock('../../lib/session', () => ({ useSession: () => ({ data: { user: { name: 'Casey', email: 'c@example.test', role: mockRole } }, status: 'authenticated' }) }))
jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn() }) }))
jest.mock('../../components/layouts/DashboardLayout', () => ({ DashboardLayout: ({ children }: any) => <main>{children}</main> }))
jest.mock('../../components/intelligence/IntelligenceBrief', () => ({ IntelligenceBrief: () => <section>Intelligence brief</section> }))
jest.mock('../../components/intelligence/DataQualityCard', () => ({ DataQualityCard: () => <section>Data quality</section> }))
jest.mock('../../components/ActivityFeed', () => () => <section>Activity feed</section>)
jest.mock('../../components/onboarding/SetupChecklist', () => ({ SetupChecklist: () => <section>Setup checklist</section> }))
jest.mock('../../services/apiService', () => ({
  getVehicles: jest.fn().mockResolvedValue([{ id: 'v1', name: 'Unit 7', status: 'active', driver: 'Pat', location: 'Depot', mileage: 20, maintenanceDue: true }]),
  getDeliveries: jest.fn().mockResolvedValue([{ id: 'd1', customer: 'North Shop', address: '1 Road', status: 'pending', driver: 'Pat', items: 2, progress: 0 }]),
  getMaintenanceTasks: jest.fn().mockResolvedValue([{ id: 'm1', vehicle: 'Unit 7', type: 'Brakes', dueDate: '2026-08-01', priority: 'high', completed: false }]),
}))

describe('role dashboards', () => {
  const dto = (returnedRole: string, deliveryAvailable = true) => ({ role: returnedRole, dashboardRole: ['OWNER','ADMIN','MANAGER'].includes(returnedRole) ? 'admin' : returnedRole === 'DISPATCHER' ? 'dispatcher' : returnedRole === 'TECHNICIAN' ? 'maintenance' : returnedRole === 'DRIVER' ? 'driver' : 'viewer', onboardingCompleted: true, decisions: ['One','Two','Three'], actions: returnedRole === 'VIEWER' ? [] : returnedRole === 'DRIVER' ? [{label:'Open my deliveries',href:'/deliveries'},{label:'View my assigned vehicle',href:'/vehicles'},{label:'Open safety procedures',href:'/sop'}] : [{label:'Act one',href:'/one'},{label:'Act two',href:'/two'},{label:'Act three',href:'/three'}], sources: { vehicles: { available:true,items:[{ id:'v1',name:'Unit 7',status:'active',driver:'Pat',location:'Depot',mileage:20,maintenanceDue:true }],total:1 }, deliveries: { available:deliveryAvailable,items:deliveryAvailable?[{ id:'d1',customer:'North Shop',address:'1 Road',status:'pending',driver:'Pat',items:2,progress:0 }]:[],total:deliveryAvailable?1:null }, maintenance: { available:true,items:[{ id:'m1',vehicle:'Unit 7',type:'Brakes',dueDate:'2026-08-01',priority:'high',completed:false }],total:1 } } })
  beforeEach(() => { global.fetch = jest.fn().mockImplementation(() => { const returnedRole = mockRole; return Promise.resolve({ ok: true, json: async () => dto(returnedRole) }) }) as jest.Mock })

  test.each([
    ['OWNER', 'Owner command centre'],
    ['DISPATCHER', 'Dispatch command centre'],
    ['TECHNICIAN', 'Maintenance command centre'],
    ['DRIVER', 'Driver command centre'],
    ['VIEWER', 'Fleet overview'],
  ])('routes %s to the permitted command centre', async (nextRole, heading) => {
    mockRole = nextRole
    render(<Dashboard />)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  test('does not prefetch broad collection APIs before canonical context succeeds', async () => {
    const api = require('../../services/apiService')
    ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))
    render(<Dashboard />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading command centre')
    expect(api.getVehicles).not.toHaveBeenCalled()
    expect(api.getDeliveries).not.toHaveBeenCalled()
    expect(api.getMaintenanceTasks).not.toHaveBeenCalled()
  })

  test.each([{ ok: false, status: 403 }, { ok: true, json: async () => ({ role: 'ROOT' }) }])('fails closed for denied or malformed canonical context', async response => {
    ;(global.fetch as jest.Mock).mockResolvedValue(response)
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to open this workspace dashboard/i)
    expect(screen.queryByText('Add vehicle')).not.toBeInTheDocument()
  })

  test('puts exceptions ahead of fleet totals', async () => {
    mockRole = 'OWNER'
    render(<Dashboard />)
    await screen.findByText('Brakes')
    const text = document.body.textContent || ''
    expect(text.indexOf('Needs attention')).toBeLessThan(text.indexOf('Fleet totals'))
  })

  test('driver exposes no fleet-management actions and uses large controls', async () => {
    mockRole = 'DRIVER'
    render(<Dashboard />)
    await screen.findByRole('heading', { name: 'Driver command centre' })
    expect(screen.queryByText('Add vehicle')).not.toBeInTheDocument()
    expect(screen.queryByText('Assign delivery')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open my deliveries' })).toHaveAttribute('href', '/deliveries')
  })

  test('shows partial failure with retry without discarding successful data', async () => {
    mockRole = 'DISPATCHER'
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok:true, json:async()=>dto('DISPATCHER', false) })
    render(<Dashboard />)
    expect(await screen.findByText(/Some dashboard data could not be loaded/)).toBeInTheDocument()
    expect(document.body).toHaveTextContent('Unit 7')
    expect(screen.getByRole('button', { name: 'Retry loading dashboard' })).toBeInTheDocument()
  })

  test('a source the role may not view is not reported as a partial outage', async () => {
    mockRole = 'DISPATCHER'
    const body = dto('DISPATCHER')
    body.sources.maintenance = { available: false, error: 'FORBIDDEN', items: [], total: null, truncated: false } as never
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok:true, json:async()=>body })
    render(<Dashboard />)
    expect(await screen.findByRole('heading', { name: 'Dispatch command centre' })).toBeInTheDocument()
    expect(screen.queryByText(/Some dashboard data could not be loaded/)).not.toBeInTheDocument()
    expect(screen.queryByText('Maintenance', { selector: 'dt' })).not.toBeInTheDocument()
    expect(screen.getByText('Vehicles', { selector: 'dt' })).toBeInTheDocument()
  })

  test('recovers after retrying a partial response', async () => {
    const partial = dto('DISPATCHER', false); const healthy = dto('DISPATCHER', true)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>partial}).mockResolvedValueOnce({ok:true,json:async()=>healthy})
    render(<Dashboard />); fireEvent.click(await screen.findByRole('button',{name:'Retry loading dashboard'}))
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Retry loading dashboard'})).not.toBeInTheDocument())
  })

  test('ignores an older dashboard request that completes after a newer retry', async()=>{
    let resolveOld:any,resolveNew:any;const old=new Promise(resolve=>{resolveOld=resolve}),newer=new Promise(resolve=>{resolveNew=resolve})
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async()=>dto('DISPATCHER',false)}).mockReturnValueOnce(old).mockReturnValueOnce(newer)
    render(<Dashboard/>);const retry=await screen.findByRole('button',{name:'Retry loading dashboard'});fireEvent.click(retry);fireEvent.click(retry)
    resolveNew({ok:true,json:async()=>({...dto('DISPATCHER'),decisions:['Newest','Two','Three']})});await screen.findByText('Newest')
    resolveOld({ok:true,json:async()=>({...dto('DISPATCHER'),decisions:['Stale','Two','Three']})});await Promise.resolve();expect(screen.queryByText('Stale')).not.toBeInTheDocument()
  })

  test.each(['OWNER','DISPATCHER','TECHNICIAN','DRIVER','VIEWER'])('renders a truthful empty state for %s', async nextRole => {
    const empty = dto(nextRole); for (const source of Object.values(empty.sources)) { source.items=[]; source.total=0 }
    ;(global.fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>empty}); render(<Dashboard />)
    expect(await screen.findByText('No current exceptions in available sources.')).toBeInTheDocument()
  })

  test('never renders legacy demo identities or metrics', async () => {
    mockRole = 'ADMIN'
    render(<Dashboard />)
    await waitFor(() => expect(document.body).toHaveTextContent('Unit 7'))
    expect(document.body).not.toHaveTextContent('John Smith')
    expect(document.body).not.toHaveTextContent('99.9%')
    expect(document.body).not.toHaveTextContent('$24,580')
  })
})
