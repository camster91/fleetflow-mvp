import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { assertSameOrigin, requireTenantContext } from '@/lib/apiAuth'
import { canViewBusinessData } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rateLimit'
import { planFleetQuestion, selectedEntitySchema } from '@/lib/ai/queryPlanner'
import { runFleetTool } from '@/lib/ai/fleetTools'
import { parseAssistantSources, validateAnswerCitations, type AssistantClaim, type AssistantSource } from '@/lib/ai/answerCitations'
import { generateFleetSummary } from '@/lib/ai/provider'
import type { SafeFinding } from '@/lib/ai/types'

const requestSchema = z.object({ question: z.string().trim().min(1).max(500), selectedEntity: selectedEntitySchema.optional() }).strict()
const TIMEOUT_MS = 8_000

function timeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
    timer.unref?.()
    promise.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
  })
}

function evidenceFindings(claims: AssistantClaim[], sources: AssistantSource[]): SafeFinding[] {
  return sources.slice(0, 20).map((item, index) => {
    const evidence = claims.filter(entry => entry.citationIds.includes(item.id)).map(entry => entry.text).join(' ').slice(0, 1_000)
    return { id: item.id, severity: 'medium', title: item.label, explanation: evidence || 'This authorized record supports the requested fleet summary.', recommendedAction: `Review ${item.type} record`, score: Math.max(0, 100 - index) }
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }) }
  if (!assertSameOrigin(req, res)) return
  const context = await requireTenantContext(req, res)
  if (!context) return
  if (!canViewBusinessData(context.tenant.role)) return res.status(403).json({ error: 'Insufficient permissions' })
  if (!await rateLimitMiddleware(req, res, 'api', `assistant:${context.session.user.id}`)) return
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a question of 500 characters or fewer.' })
  const plan = planFleetQuestion(parsed.data.question, parsed.data.selectedEntity)
  if (!plan.supported) return res.status(422).json({ error: 'I can answer questions about fleet priorities, due maintenance, recorded maintenance costs, delivery exceptions, specific vehicles or clients, and activity in a stated date range.', code: plan.reason })
  try {
    const result = await timeout(runFleetTool(plan, { resourceWhere: context.tenant.resourceWhere, findingScope: { ownerId: context.tenant.ownerId, teamId: context.tenant.teamId } }, {}))
    if (!result.claims.length) return res.status(200).json({ mode: 'deterministic', empty: true, answer: { claims: [], summary: 'No matching Fleetvera records were found.' }, sources: [] })
    const sources = parseAssistantSources(result.sources)
    if (!validateAnswerCitations({ claims: result.claims }, sources)) throw new Error('invalid tool citations')
    const providerDeadline = new AbortController()
    const providerTimer = setTimeout(() => providerDeadline.abort(), 7_500); providerTimer.unref?.()
    let generated
    try { generated = await generateFleetSummary({ findings: evidenceFindings(result.claims, sources) }, { env: { ...process.env, AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || '7000' }, signal: providerDeadline.signal }) }
    finally { clearTimeout(providerTimer) }
    const generatedClaims: AssistantClaim[] = generated.content.claims.length ? generated.content.claims : generated.content.sections.map(section => ({ text: section.summary, citationIds: section.citationIds }))
    if (!validateAnswerCitations({ claims: generatedClaims }, sources)) throw new Error('invalid generated citations')
    // The model may select/order evidence, but never authors factual prose. All
    // shipped facts and values remain byte-for-byte deterministic tool claims.
    const selectedOrder = generatedClaims.flatMap(item => item.citationIds)
    const deterministicClaims = [...result.claims].sort((a, b) => {
      const rank = (item: AssistantClaim) => Math.min(...item.citationIds.map(id => { const index = selectedOrder.indexOf(id); return index < 0 ? Number.MAX_SAFE_INTEGER : index }))
      return rank(a) - rank(b)
    })
    return res.status(200).json({
      mode: generated.meta.status === 'generated' ? 'generated' : 'deterministic', empty: false,
      ...(generated.meta.fallbackReason ? { degradationReason: generated.meta.fallbackReason } : {}),
      answer: { claims: deterministicClaims }, sources,
    })
  } catch {
    console.error('Assistant query failed')
    return res.status(503).json({ error: 'Fleet data could not be checked right now. Please retry.' })
  }
}
