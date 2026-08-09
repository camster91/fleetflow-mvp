import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { providerReadiness } from '@/lib/ai/telemetry'

const mutationSchema = z.object({ enabled: z.boolean(), killSwitch: z.boolean(), retentionDays: z.number().int().min(7).max(90), expectedConfigVersion:z.number().int().min(0) }).strict()
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN'])
const scopeKey = (ownerId: string, teamId: string | null) => teamId ? `team:${teamId}` : `owner:${ownerId}`
const publicConfig = (value: { enabled: boolean; killSwitch: boolean; retentionDays: number; provider: string; modelVersion: string; configVersion: number }) => ({ enabled: value.enabled, killSwitch: value.killSwitch, retentionDays: value.retentionDays, provider: value.provider, modelVersion: value.modelVersion, configVersion: value.configVersion })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PUT'].includes(req.method ?? '')) { res.setHeader('Allow', 'GET, PUT'); return res.status(405).json({ error: 'Method not allowed' }) }
  if (req.method === 'PUT' && !assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!ADMIN_ROLES.has(context.tenant.role)) return res.status(403).json({ error: 'Administrator access required' })
  if (!await rateLimitMiddleware(req, res, 'admin', `ai-settings:${context.session.user.id}`)) return
  const key = scopeKey(context.tenant.ownerId, context.tenant.teamId)
  const existing = await prisma.aiWorkspaceConfig.findUnique({ where: { scopeKey: key } })
  if (req.method === 'GET') return res.status(200).json(publicConfig(existing ?? { enabled: false, killSwitch: false, retentionDays: 30, provider: 'disabled', modelVersion: 'none@v1', configVersion: 0 }))
  const parsed = mutationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid AI settings' })
  const provider = process.env.AI_PROVIDER?.trim() || 'disabled'
  const modelVersion = process.env.OPENAI_MODEL?.trim() || 'none@v1'
  if(parsed.data.enabled&&!providerReadiness(provider,modelVersion,process.env).ready)return res.status(400).json({error:'Configured AI provider is not ready'})
  if((existing?.configVersion??0)!==parsed.data.expectedConfigVersion)return res.status(409).json({error:'AI settings changed; reload and retry'})
  if (existing && existing.enabled === parsed.data.enabled && existing.killSwitch === parsed.data.killSwitch && existing.retentionDays === parsed.data.retentionDays) return res.status(200).json(publicConfig(existing))
  const nextVersion = parsed.data.expectedConfigVersion + 1,{expectedConfigVersion:_,...settings}=parsed.data
  try{const saved = await prisma.$transaction(async tx => {
    if(existing){const changed=await tx.aiWorkspaceConfig.updateMany({where:{scopeKey:key,configVersion:parsed.data.expectedConfigVersion},data:{...settings,provider,modelVersion,configVersion:nextVersion,updatedById:context.session.user.id}});if(changed.count!==1)throw Object.assign(new Error('stale'),{code:'STALE_CONFIG'})}
    else await tx.aiWorkspaceConfig.create({data:{scopeKey:key,ownerId:context.tenant.ownerId,teamId:context.tenant.teamId,...settings,provider,modelVersion,configVersion:nextVersion,updatedById:context.session.user.id}})
    await tx.aiControlAudit.create({ data: { scopeKey: key, actorId: context.session.user.id, action: 'AI_SETTINGS_UPDATED', configVersion: nextVersion, metadata: JSON.stringify({ enabled: parsed.data.enabled, killSwitch: parsed.data.killSwitch, retentionDays: parsed.data.retentionDays, provider, modelVersion }) } })
    return tx.aiWorkspaceConfig.findUnique({where:{scopeKey:key}})
  })
  if(!saved)throw new Error('save failed');return res.status(200).json(publicConfig(saved))}catch(error){if((error as {code?:string}).code==='STALE_CONFIG'||(error as {code?:string}).code==='P2002')return res.status(409).json({error:'AI settings changed; reload and retry'});throw error}
}
