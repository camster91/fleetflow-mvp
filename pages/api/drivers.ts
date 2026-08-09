import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { canAssignDrivers } from '@/lib/permissions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Method not allowed'}) }
  const context=await requireTenantContext(req,res); if(!context) return
  if(!canAssignDrivers(context.tenant.role)) return res.status(403).json({error:'Forbidden'})
  if(!context.tenant.teamId) return res.status(200).json({drivers:[]})
  const rows=await prisma.teamMember.findMany({where:{teamId:context.tenant.teamId,status:'ACCEPTED',role:'DRIVER',userId:{not:null}},select:{user:{select:{id:true,name:true}}},orderBy:{user:{name:'asc'}},take:100})
  const users=rows.flatMap(row=>row.user?.name?.trim()?[{id:row.user.id,name:row.user.name.trim()}]:[])
  const counts=new Map<string,number>(); for(const user of users) counts.set(user.name,(counts.get(user.name)||0)+1)
  return res.status(200).json({drivers:users.map(user=>({...user,label:(counts.get(user.name)||0)>1?`${user.name} · ${user.id.slice(-6)}`:user.name}))})
}
