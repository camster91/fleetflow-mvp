import type { FleetToolResult } from './fleetTools'
import type { FleetSummaryResult } from './types'
import { parseAssistantSources, validateAnswerCitations, type AssistantClaim } from './answerCitations'

export function synthesizeFleetAnswer(tool: FleetToolResult, generated: FleetSummaryResult) {
  const sources = parseAssistantSources(tool.sources)
  if (!tool.claims.length || !validateAnswerCitations({ claims: tool.claims }, sources))
    throw new Error('invalid tool citations')
  if (generated.meta.status === 'fallback' && !generated.meta.fallbackReason) throw new Error('fallback reason missing')
  if (generated.meta.status === 'generated' && generated.meta.fallbackReason)
    throw new Error('generated response has fallback reason')
  const selection: AssistantClaim[] = generated.content.claims.length
    ? generated.content.claims
    : generated.content.sections.map((section) => ({ text: section.summary, citationIds: section.citationIds }))
  if (!selection.length || !validateAnswerCitations({ claims: selection }, sources))
    throw new Error('invalid generated citations')
  const selectedOrder = selection.flatMap((item) => item.citationIds),
    claims = [...tool.claims].sort((a, b) => {
      const rank = (item: AssistantClaim) =>
        Math.min(
          ...item.citationIds.map((id) => {
            const index = selectedOrder.indexOf(id)
            return index < 0 ? Number.MAX_SAFE_INTEGER : index
          })
        )
      return rank(a) - rank(b)
    })
  return {
    mode: generated.meta.status === 'generated' ? ('generated' as const) : ('deterministic' as const),
    ...(generated.meta.fallbackReason ? { degradationReason: generated.meta.fallbackReason } : {}),
    answer: { claims },
    sources,
  }
}
