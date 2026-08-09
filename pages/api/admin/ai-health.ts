import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTenantContext } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { resolveAiRuntimeControl,providerReadiness } from '@/lib/ai/telemetry'
import { pricingTableSchema,aiConfigFingerprint } from '@/lib/ai/evaluation'
import pricingJson from '@/lib/ai/pricing.json'

const scopeKey = (ownerId: string, teamId: string | null) => teamId ? `team:${teamId}` : `owner:${ownerId}`
const safeNumber = (value: bigint | number) => Math.min(Number.MAX_SAFE_INTEGER, Number(value))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }) }
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!['OWNER', 'ADMIN'].includes(context.tenant.role)) return res.status(403).json({ error: 'Administrator access required' })
  if (!await rateLimitMiddleware(req, res, 'admin', `ai-health:${context.session.user.id}`)) return
  const key = scopeKey(context.tenant.ownerId, context.tenant.teamId)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [config, evaluation] = await Promise.all([
    prisma.aiWorkspaceConfig.findUnique({ where: { scopeKey: key } }),
    prisma.aiEvaluationRun.findFirst({ orderBy: { createdAt: 'desc' }, select: { evaluationVersion: true,mode:true,configFingerprint:true,capturedAt:true,provider:true,modelVersion:true, passed: true, createdAt: true } }),
  ])
  const buckets:Array<{id:string;requestCount:number;latencyTotalMs:bigint;inputTokens:bigint;outputTokens:bigint;status:string;errorCode:string}>=[];let cursor:string|undefined
  do{const page=await prisma.aiTelemetryBucket.findMany({where:{scopeKey:key,bucketStart:{gte:since}},select:{id:true,requestCount:true,latencyTotalMs:true,inputTokens:true,outputTokens:true,status:true,errorCode:true},orderBy:{id:'asc'},take:500,...(cursor?{cursor:{id:cursor},skip:1}:{})});buckets.push(...page);if(page.length<500)break;cursor=page.at(-1)!.id}while(true)
  const requests = buckets.reduce((sum, item) => sum + item.requestCount, 0)
  const fallbacks = buckets.filter(item => item.status === 'fallback').reduce((sum, item) => sum + item.requestCount, 0)
  const latency = buckets.reduce((sum, item) => sum + safeNumber(item.latencyTotalMs), 0)
  const errorCounts = new Map<string, number>()
  buckets.forEach(item => { if (item.errorCode) errorCounts.set(item.errorCode, (errorCounts.get(item.errorCode) ?? 0) + item.requestCount) })
  const runtime=resolveAiRuntimeControl({enabled:config?.enabled??false,killSwitch:config?.killSwitch??false},process.env),readiness=providerReadiness(config?.provider??'disabled',config?.modelVersion??'none@v1',process.env)
  const pricing=pricingTableSchema.parse(pricingJson),price=pricing.models[`${config?.provider??'disabled'}:${config?.modelVersion??'none@v1'}`]
  const inputTokens=buckets.reduce((sum, item) => sum + safeNumber(item.inputTokens), 0),outputTokens=buckets.reduce((sum, item) => sum + safeNumber(item.outputTokens), 0)
  return res.status(200).json({
    status: runtime.enabled ? readiness.ready?'enabled':'misconfigured' : runtime.reason?.includes('kill_switch') ? 'killed' : 'disabled',
    provider: config?.provider ?? 'disabled', modelVersion: config?.modelVersion ?? 'none@v1', configVersion: config?.configVersion ?? 1, retentionDays: config?.retentionDays ?? 30,
    requests, averageLatencyMs: requests ? Math.round(latency / requests) : 0, fallbackRate: requests ? fallbacks / requests : 0,
    inputTokens, outputTokens, cost:{currency:pricing.currency,asOf:pricing.asOf,source:pricing.source,estimatedUsd:price?Number((inputTokens/1e6*price.inputUsdPerMillion+outputTokens/1e6*price.outputUsdPerMillion).toFixed(8)):null},
    errors: [...errorCounts].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([code, count]) => ({ code, count })),
    evaluation: evaluation ? { version: evaluation.evaluationVersion,mode:evaluation.mode??'legacy', passed: evaluation.passed, runAt: evaluation.createdAt.toISOString(),capturedAt:(evaluation.capturedAt??evaluation.createdAt).toISOString(),stale:Date.now()-(evaluation.capturedAt??evaluation.createdAt).getTime()>30*86400000,applicable:Boolean(evaluation.configFingerprint)&&evaluation.configFingerprint===aiConfigFingerprint(config?.provider??'disabled',config?.modelVersion??'none@v1',String(config?.configVersion??0)) } : null,
  })
}
