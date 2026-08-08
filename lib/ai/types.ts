import { z } from 'zod'

export const AI_LIMITS = {
  findings: 20,
  titleChars: 240,
  explanationChars: 1_000,
  actionChars: 500,
  outputItems: 8,
  headingChars: 120,
  outputTextChars: 1_000,
  citationIds: 10,
} as const

export const safeFindingSchema = z.object({
  id: z.string().trim().min(1).max(128),
  severity: z.enum(['high', 'medium', 'low']),
  title: z.string().trim().min(1).max(AI_LIMITS.titleChars),
  explanation: z.string().trim().min(1).max(AI_LIMITS.explanationChars),
  recommendedAction: z.string().trim().min(1).max(AI_LIMITS.actionChars),
  score: z.number().finite().min(0).max(100),
}).strict()

export const safeFindingsSchema = z.array(safeFindingSchema).max(AI_LIMITS.findings).superRefine((items, context) => {
  const seen = new Set<string>()
  items.forEach((item, index) => {
    if (seen.has(item.id)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'id'], message: 'duplicate finding id' })
    seen.add(item.id)
  })
})

const citationsSchema = z.array(z.string().trim().min(1).max(128))
  .min(1).max(AI_LIMITS.citationIds)
  .refine((ids) => new Set(ids).size === ids.length, 'duplicate citation ids')

const sectionSchema = z.object({
  heading: z.string().trim().min(1).max(AI_LIMITS.headingChars),
  summary: z.string().trim().min(1).max(AI_LIMITS.outputTextChars),
  citationIds: citationsSchema,
}).strict()

const statementSchema = z.object({
  text: z.string().trim().min(1).max(AI_LIMITS.outputTextChars),
  citationIds: citationsSchema,
}).strict()

export const generatedFleetSummaryContentSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(AI_LIMITS.outputItems),
  claims: z.array(statementSchema).max(AI_LIMITS.outputItems),
  actions: z.array(statementSchema).max(AI_LIMITS.outputItems),
}).strict()

export const emptyFleetSummaryContentSchema = z.object({
  sections: z.array(z.never()).max(0),
  claims: z.array(z.never()).max(0),
  actions: z.array(z.never()).max(0),
}).strict()

export const fleetSummaryContentSchema = z.union([
  generatedFleetSummaryContentSchema,
  emptyFleetSummaryContentSchema,
])

export const fleetSummaryRequestPayloadSchema = z.object({
  findings: safeFindingsSchema,
}).strict()

export type SafeFinding = z.infer<typeof safeFindingSchema>
export type FleetSummaryContent = z.infer<typeof fleetSummaryContentSchema>
export type FleetSummaryRequestPayload = z.infer<typeof fleetSummaryRequestPayloadSchema>

export type AiProviderName = string
export type AiDegradationReason =
  | 'provider_disabled' | 'provider_misconfigured' | 'provider_auth' | 'provider_request'
  | 'provider_unavailable' | 'provider_refusal' | 'provider_incomplete' | 'timeout'
  | 'caller_aborted' | 'input_invalid' | 'input_too_large' | 'response_too_large'
  | 'output_malformed' | 'output_invalid' | 'citation_invalid' | 'no_findings'

export interface AiUsage {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export interface AiResultMetadata {
  requestId: string
  provider: AiProviderName
  model: string | null
  latencyMs: number
  usage: AiUsage
  status: 'generated' | 'fallback'
  fallbackReason?: AiDegradationReason
}

export interface FleetSummaryResult {
  content: FleetSummaryContent
  meta: AiResultMetadata
}

export interface ProviderRequest {
  findings: SafeFinding[]
  requestId: string
  signal?: AbortSignal
}

export interface ProviderSuccess {
  content: FleetSummaryContent
  usage: AiUsage
}

export interface AiProvider {
  readonly name: AiProviderName
  readonly model: string | null
  generate(request: ProviderRequest): Promise<ProviderSuccess>
}

export interface ProviderFactoryContext {
  readonly env: Readonly<Record<string, string | undefined>>
}

export type ProviderFactory = (context: ProviderFactoryContext) => AiProvider

export const fleetSummaryJsonSchema = {
  type: 'object', additionalProperties: false, required: ['sections', 'claims', 'actions'],
  properties: {
    sections: { type: 'array', minItems: 1, maxItems: AI_LIMITS.outputItems, items: {
      type: 'object', additionalProperties: false, required: ['heading', 'summary', 'citationIds'],
      properties: {
        heading: { type: 'string', minLength: 1, maxLength: AI_LIMITS.headingChars },
        summary: { type: 'string', minLength: 1, maxLength: AI_LIMITS.outputTextChars },
        citationIds: { type: 'array', minItems: 1, maxItems: AI_LIMITS.citationIds, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } },
      },
    } },
    claims: { type: 'array', maxItems: AI_LIMITS.outputItems, items: {
      type: 'object', additionalProperties: false, required: ['text', 'citationIds'],
      properties: {
        text: { type: 'string', minLength: 1, maxLength: AI_LIMITS.outputTextChars },
        citationIds: { type: 'array', minItems: 1, maxItems: AI_LIMITS.citationIds, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } },
      },
    } },
    actions: { type: 'array', maxItems: AI_LIMITS.outputItems, items: {
      type: 'object', additionalProperties: false, required: ['text', 'citationIds'],
      properties: {
        text: { type: 'string', minLength: 1, maxLength: AI_LIMITS.outputTextChars },
        citationIds: { type: 'array', minItems: 1, maxItems: AI_LIMITS.citationIds, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } },
      },
    } },
  },
} as const
