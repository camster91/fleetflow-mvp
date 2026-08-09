import { dashboardContractSchema } from '../../lib/dashboardContract'
const source={available:true,error:null,items:[],total:0,truncated:false}
const base={role:'DRIVER',dashboardRole:'driver',onboardingCompleted:true,decisions:['One','Two','Three'],actions:[{label:'One',href:'/deliveries'},{label:'Two',href:'/maintenance'},{label:'Three',href:'/sop'}],sources:{vehicles:source,deliveries:source,maintenance:source}}
describe('dashboard client contract',()=>{
  it('accepts the exact bounded operational contract',()=>expect(dashboardContractSchema.safeParse(base).success).toBe(true))
  it.each(['https://evil.test','//evil.test','/safe#fragment','javascript:alert(1)'])('rejects unsafe action href %s',href=>expect(dashboardContractSchema.safeParse({...base,actions:[...base.actions.slice(0,2),{label:'Bad',href}]}).success).toBe(false))
  it('rejects missing, extra, or non-three operational guidance',()=>{ expect(dashboardContractSchema.safeParse({...base,decisions:['One']}).success).toBe(false); expect(dashboardContractSchema.safeParse({...base,extra:true}).success).toBe(false); expect(dashboardContractSchema.safeParse({...base,actions:[]}).success).toBe(false) })
  it('requires viewers to have no actions',()=>{ expect(dashboardContractSchema.safeParse({...base,role:'VIEWER',dashboardRole:'viewer',actions:[]}).success).toBe(true); expect(dashboardContractSchema.safeParse({...base,role:'VIEWER',dashboardRole:'viewer'}).success).toBe(false) })
  it.each([['OWNER','driver'],['DISPATCHER','admin'],['TECHNICIAN','viewer'],['DRIVER','dispatcher'],['MEMBER','driver']])('rejects canonical role mismatch %s -> %s',(role,dashboardRole)=>expect(dashboardContractSchema.safeParse({...base,role,dashboardRole}).success).toBe(false))
})
