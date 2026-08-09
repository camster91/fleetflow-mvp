import { createMocks } from 'node-mocks-http'
jest.mock('@/lib/apiAuth', () => ({ requireTenantContext: jest.fn() }))
jest.mock('@/lib/prisma', () => ({ prisma: { vehicle: { findMany: jest.fn(), count: jest.fn() }, delivery: { findMany: jest.fn(), count: jest.fn() }, maintenanceTask: { findMany: jest.fn(), count: jest.fn() } } }))
import handler from '@/pages/api/dashboard/context'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

describe('/api/dashboard/context', () => {
  beforeEach(() => { jest.clearAllMocks(); for (const model of [prisma.vehicle,prisma.delivery,prisma.maintenanceTask]) { (model.findMany as jest.Mock).mockResolvedValue([]); (model.count as jest.Mock).mockResolvedValue(0) } })
  it('returns a bounded canonical role DTO without identity data', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ session: { user: { id: 'u-secret', email: 'private@example.test' } }, tenant: { ownerId: 'owner-secret', teamId: 'team-secret', role: 'TECHNICIAN', resourceWhere: {} } })
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(200)
    expect(res._getJSONData()).toEqual(expect.objectContaining({ role: 'TECHNICIAN', dashboardRole: 'maintenance', decisions: expect.arrayContaining([expect.any(String)]), actions: expect.any(Array), sources: expect.any(Object) }))
    expect(res._getData()).not.toContain('secret')
  })
  it('scopes every driver source by stable user id and tenant scope', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ session:{user:{id:'driver-1'}}, tenant:{ownerId:'o1',teamId:'t1',role:'DRIVER',resourceWhere:{ownerId:'o1',teamId:'t1'}} })
    const {req,res}=createMocks({method:'GET'}); await handler(req as never,res as never)
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{ownerId:'o1',teamId:'t1',assignedDriverId:'driver-1'},take:10}))
    expect(prisma.delivery.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{ownerId:'o1',teamId:'t1',assignedDriverId:'driver-1'},take:10}))
    expect(prisma.maintenanceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{ownerId:'o1',teamId:'t1',vehicle:{assignedDriverId:'driver-1'}},take:10}))
  })
  it('returns only minimized operational fields for non-empty driver sources', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ session:{user:{id:'driver-1'}}, tenant:{ownerId:'o1',teamId:'t1',role:'DRIVER',resourceWhere:{ownerId:'o1',teamId:'t1'}} })
    ;(prisma.delivery.findMany as jest.Mock).mockResolvedValue([{id:'d1',address:'10 Main',customer:'Customer',status:'IN_TRANSIT',assignedDriverId:'driver-1',contactPerson:'SENTINEL_SECRET',accessCodes:'SENTINEL_SECRET',securityNotes:'SENTINEL_SECRET',photos:['SENTINEL_SECRET'],notes:'SENTINEL_SECRET',specialRequirements:'SENTINEL_SECRET',internal:'SENTINEL_SECRET',ownerId:'o1',teamId:'t1'}])
    ;(prisma.vehicle.findMany as jest.Mock).mockResolvedValue([{id:'v1',name:'Truck 1',status:'ACTIVE',assignedDriverId:'driver-1',notes:'SENTINEL_SECRET',photos:['SENTINEL_SECRET'],internal:'SENTINEL_SECRET',ownerId:'o1',teamId:'t1'}])
    ;(prisma.maintenanceTask.findMany as jest.Mock).mockResolvedValue([{id:'m1',vehicleName:'Truck 1',vehicleId:'v1',title:'Oil change',dueDate:new Date('2026-08-10'),priority:'HIGH',completed:false,vehicle:{name:'Truck 1'},notes:'SENTINEL_SECRET',specialRequirements:'SENTINEL_SECRET',internal:'SENTINEL_SECRET',ownerId:'o1',teamId:'t1'}])
    for (const model of [prisma.vehicle,prisma.delivery,prisma.maintenanceTask]) (model.count as jest.Mock).mockResolvedValue(1)
    const {req,res}=createMocks({method:'GET'}); await handler(req as never,res as never)
    const body=res._getJSONData()
    expect(body.sources.deliveries.items[0]).toEqual(expect.objectContaining({id:'d1',address:'10 Main',assignedDriverId:'driver-1'}))
    expect(body.sources.vehicles.items[0]).toEqual(expect.objectContaining({id:'v1',name:'Truck 1',assignedDriverId:'driver-1'}))
    expect(body.sources.maintenance.items[0]).toEqual(expect.objectContaining({id:'m1',vehicle:'Truck 1',vehicleId:'v1'}))
    const serialized=JSON.stringify(body.sources)
    for (const key of ['contactPerson','accessCodes','securityNotes','photos','notes','specialRequirements','internal','ownerId','teamId']) expect(serialized).not.toContain(`\"${key}\"`)
    expect(serialized).not.toContain('SENTINEL_SECRET')
    expect(prisma.delivery.findMany).toHaveBeenCalledWith(expect.objectContaining({select:expect.any(Object)}))
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(expect.objectContaining({select:expect.any(Object)}))
    expect(prisma.maintenanceTask.findMany).toHaveBeenCalledWith(expect.objectContaining({select:expect.any(Object)}))
  })
  it('reports authoritative totals beyond the bounded item window', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ session:{user:{id:'u1'}}, tenant:{ownerId:'o1',teamId:null,role:'OWNER',resourceWhere:{ownerId:'o1',teamId:null}} })
    ;(prisma.vehicle.count as jest.Mock).mockResolvedValue(73)
    const {req,res}=createMocks({method:'GET'}); await handler(req as never,res as never)
    expect(res._getJSONData().sources.vehicles).toEqual(expect.objectContaining({ total:73, truncated:true, items:[] }))
  })
  it('returns a sanitized service-unavailable response when every source fails', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue({ session:{user:{id:'u1'}}, tenant:{ownerId:'o1',teamId:null,role:'OWNER',resourceWhere:{ownerId:'o1',teamId:null}} })
    for (const model of [prisma.vehicle,prisma.delivery,prisma.maintenanceTask]) (model.findMany as jest.Mock).mockRejectedValue(new Error('private database detail'))
    const {req,res}=createMocks({method:'GET'}); await handler(req as never,res as never)
    expect(res._getStatusCode()).toBe(503); expect(res._getJSONData()).toEqual({error:'Dashboard data unavailable'}); expect(res._getData()).not.toContain('private')
  })
  it('rejects non-GET before authentication', async () => {
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req as never, res as never)
    expect(res._getStatusCode()).toBe(405)
    expect(res.getHeader('Allow')).toBe('GET')
    expect(requireTenantContext).not.toHaveBeenCalled()
  })
  it('does not respond again when authentication fails', async () => {
    ;(requireTenantContext as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req as never, res as never)
    expect(res._isEndCalled()).toBe(false)
  })
})
