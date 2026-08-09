import { z } from 'zod'

const source = z.object({ available:z.boolean(), error:z.string().nullable().optional(), items:z.array(z.record(z.unknown())).max(10), total:z.number().int().nonnegative().nullable(), truncated:z.boolean().optional() }).strict()
const action = z.object({ label:z.string().trim().min(1).max(80), href:z.string().regex(/^\/(?!\/)[A-Za-z0-9/_-]*(?:\?[A-Za-z0-9._~=&%-]+)?$/).max(200) }).strict()
export const dashboardContractSchema = z.object({
  role:z.enum(['OWNER','ADMIN','MANAGER','DISPATCHER','DISPATCH','TECHNICIAN','MAINTENANCE','DRIVER','VIEWER','MEMBER']),
  dashboardRole:z.enum(['admin','dispatcher','maintenance','driver','viewer']),
  onboardingCompleted:z.boolean(),
  decisions:z.array(z.string().trim().min(1).max(160)).length(3),
  actions:z.array(action).max(3),
  sources:z.object({vehicles:source,deliveries:source,maintenance:source}).strict(),
}).strict().superRefine((value,ctx)=>{ const roleMap={OWNER:'admin',ADMIN:'admin',MANAGER:'admin',DISPATCHER:'dispatcher',DISPATCH:'dispatcher',TECHNICIAN:'maintenance',MAINTENANCE:'maintenance',DRIVER:'driver',VIEWER:'viewer',MEMBER:'viewer'} as const; if(roleMap[value.role]!==value.dashboardRole) ctx.addIssue({code:z.ZodIssueCode.custom,path:['dashboardRole'],message:'Dashboard role does not match canonical role'}); const expected=value.dashboardRole==='viewer'?0:3; if(value.actions.length!==expected) ctx.addIssue({code:z.ZodIssueCode.custom,path:['actions'],message:`Expected ${expected} actions`}) })
