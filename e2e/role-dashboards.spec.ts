import { expect, test } from '@playwright/test'
import { SignJWT } from 'jose'

async function mockDashboard(page: import('@playwright/test').Page, role: string, options: { onboardingCompleted?: boolean; unavailable?: Array<'vehicles'|'deliveries'|'maintenance'> } = {}) {
  await page.addInitScript(() => localStorage.clear())
  const baseURL = test.info().project.use.baseURL as string
  const origin = new URL(baseURL)
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required for role dashboard browser QA')
  const token = await new SignJWT({ sub: 'role-qa', email: 'role-qa@fleetvera.test', role }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET))
  await page.context().addCookies([{ name: 'token', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'role-qa', email: 'role-qa@fleetvera.test', name: 'Role QA', role, onboardingCompleted: true } } }))
  const roleActions: Record<string, Array<{label:string;href:string}>> = { OWNER:[{label:'Review fleet risks',href:'/intelligence'},{label:'Add vehicle',href:'/vehicles'},{label:'Manage team',href:'/team'}], DISPATCHER:[{label:'Assign delivery',href:'/deliveries'},{label:'Review active deliveries',href:'/deliveries'},{label:'Check driver status',href:'/vehicles'}], TECHNICIAN:[{label:'Update work orders',href:'/maintenance'},{label:'Review maintenance schedule',href:'/maintenance'},{label:'Open service procedures',href:'/sop'}], DRIVER:[{label:'Open my deliveries',href:'/deliveries'},{label:'View my assigned vehicle',href:'/vehicles'},{label:'Open safety procedures',href:'/sop'}], VIEWER:[] }
  const unavailable = new Set(options.unavailable || [])
  await page.route('**/api/dashboard/context', route => route.fulfill({ json: { role, dashboardRole: ['OWNER','ADMIN','MANAGER'].includes(role) ? 'admin' : role === 'DISPATCHER' ? 'dispatcher' : role === 'TECHNICIAN' ? 'maintenance' : role === 'DRIVER' ? 'driver' : 'viewer', onboardingCompleted:options.onboardingCompleted ?? true, decisions:['Decision one','Decision two','Decision three'], actions:roleActions[role], sources:{ vehicles:unavailable.has('vehicles')?{available:false,error:'Vehicles unavailable',items:[],total:null}:{available:true,items:[{id:'v1',name:'QA Unit',status:'active',driver:'QA Driver',location:'Depot',mileage:100,maintenanceDue:true}],total:1}, deliveries:unavailable.has('deliveries')?{available:false,error:'Deliveries unavailable',items:[],total:null}:{available:true,items:[{id:'d1',customer:'QA Customer',address:'1 Test Rd',status:'pending',driver:'',items:1,progress:0}],total:1}, maintenance:unavailable.has('maintenance')?{available:false,error:'Maintenance unavailable',items:[],total:null}:{available:true,items:[{id:'m1',vehicle:'QA Unit',type:'Brake inspection',dueDate:'2026-08-08',priority:'high',completed:false}],total:1} } } }))
  await page.route('**/api/notifications**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/vehicles', route => route.fulfill({ json: { data: [{ id: 'v1', name: 'QA Unit', status: 'active', driver: 'QA Driver', location: 'Depot', mileage: 100, maintenanceDue: true }] } }))
  await page.route('**/api/deliveries', route => route.fulfill({ json: { data: [{ id: 'd1', customer: 'QA Customer', address: '1 Test Rd', status: 'pending', driver: '', items: 1, progress: 0 }] } }))
  await page.route('**/api/maintenance', route => route.fulfill({ json: { data: [{ id: 'm1', vehicle: 'QA Unit', type: 'Brake inspection', dueDate: '2026-08-08', priority: 'high', completed: false }] } }))
  await page.route('**/api/subscription/status**', route => route.fulfill({ json: { subscription: null } }))
  await page.route('**/api/team/workspaces**', route => route.fulfill({ json: { workspaces: [] } }))
  await page.route('**/api/intelligence/brief**', route => route.fulfill({ json: { findings:[],totalOpen:0,generatedAt:null,stale:false,coverage:{complete:true,sourceTruncated:false,evidenceComplete:true},capabilities:{refresh:false,manage:false,feedback:false} } }))
  await page.route('**/api/intelligence/data-quality**', route => route.fulfill({ json: { issues:[],summary:{total:0,bySeverity:{},countsComplete:true},coverage:{complete:true,sourceTruncated:false,issuesTruncated:false},generatedAt:'2026-08-08T00:00:00.000Z' } }))
  await page.route('**/api/activity**', route => route.fulfill({ json: [] }))
}

for (const [role, heading] of [['OWNER','Owner command centre'], ['DISPATCHER','Dispatch command centre'], ['TECHNICIAN','Maintenance command centre'], ['DRIVER','Driver command centre'], ['VIEWER','Fleet overview']] as const) {
 for (const viewport of ['desktop','375px'] as const) {
  test(`${role} receives its bounded command centre at ${viewport}`, async ({ page }) => {
    if (viewport === '375px') await page.setViewportSize({width:375,height:812})
    await mockDashboard(page, role)
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    if (role === 'OWNER') {
      await expect(page.getByRole('heading',{name:'What needs attention today'})).toBeVisible()
      await expect(page.getByRole('heading',{name:'Data quality'})).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Needs attention', exact: true })).toBeVisible()
    await expect(page.getByText('John Smith')).toHaveCount(0)
    if (role === 'DRIVER') {
      await expect(page.getByText('Add vehicle')).toHaveCount(0)
      const box = await page.getByRole('link', { name: 'Open my deliveries' }).boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }
    const forbidden: Record<string,string[]> = { OWNER:['Assign delivery','Update work orders','Open my deliveries'], DISPATCHER:['Add vehicle','Manage team','Update work orders'], TECHNICIAN:['Add vehicle','Manage team','Assign delivery'], DRIVER:['Add vehicle','Manage team','Assign delivery','Update work orders'], VIEWER:['Add vehicle','Manage team','Assign delivery','Update work orders','Open my deliveries'] }
    for (const label of forbidden[role]) await expect(page.getByText(label, {exact:true})).toHaveCount(0)
    if (role !== 'OWNER') {
      await expect(page.getByRole('heading',{name:'What needs attention today'})).toHaveCount(0)
      await expect(page.getByRole('heading',{name:'Data quality'})).toHaveCount(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  })
 }
}

test('denied canonical context fails closed without privileged actions', async ({page}) => { await mockDashboard(page,'OWNER'); await page.route('**/api/dashboard/context', route=>route.fulfill({status:403,json:{error:'Forbidden'}})); await page.goto('/dashboard'); await expect(page.getByText('Unable to open this workspace dashboard')).toBeVisible(); await expect(page.getByText('Add vehicle')).toHaveCount(0) })

test('unauthenticated dashboard redirects to login', async ({page}) => {
  await page.route('**/api/auth/me', route => route.fulfill({status:401,json:{error:'Unauthorized'}}))
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/login/)
})

test('admin setup checklist is functional and dismissible', async ({page}) => {
  await mockDashboard(page,'OWNER',{onboardingCompleted:false})
  await page.goto('/dashboard')
  await page.getByRole('button',{name:'Skip onboarding'}).evaluate(element => (element as HTMLButtonElement).click())
  await expect(page.getByRole('heading',{name:'Setup Checklist'})).toBeVisible()
  await page.getByRole('button',{name:'Dismiss checklist'}).evaluate(element => (element as HTMLButtonElement).click())
  await expect(page.getByRole('heading',{name:'Setup Checklist'})).toHaveCount(0)
})

for (const viewport of ['desktop','375px'] as const) test(`partial source truth never claims empty delivery data at ${viewport}`, async ({page}) => {
  if (viewport === '375px') await page.setViewportSize({width:375,height:812})
  await mockDashboard(page,'DISPATCHER',{unavailable:['deliveries']})
  await page.goto('/dashboard')
  await expect(page.getByText('Delivery assignments unavailable')).toBeVisible()
  await expect(page.getByText('No unassigned deliveries')).toHaveCount(0)
})
