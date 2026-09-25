import { z } from 'zod'
import { safeFindingActionUrl } from '@/lib/intelligence/actionUrls'

export type AssistantSource = {
  id: string
  type: 'finding' | 'maintenance' | 'maintenanceAggregate' | 'delivery' | 'vehicle' | 'client'
  recordId: string
  label: string
  href: string
}
export type AssistantClaim = { text: string; citationIds: string[] }

const claimSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .refine((v) => !/[<>]/.test(v)),
    citationIds: z.array(z.string().min(1).max(160)).min(1).max(10),
  })
  .strict()

const sourceSchema = z
  .object({
    id: z.string().min(3).max(160),
    type: z.enum(['finding', 'maintenance', 'maintenanceAggregate', 'delivery', 'vehicle', 'client']),
    recordId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
    label: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((value) => !/[<>]/.test(value)),
    href: z.string().min(1).max(512),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.id !== `${item.type}:${item.recordId}`)
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['id'], message: 'source identity mismatch' })
    const encoded = encodeURIComponent(item.recordId)
    const expected =
      item.type === 'client'
        ? `/clients/${encoded}`
        : item.type === 'finding'
          ? null
          : item.type === 'maintenanceAggregate'
            ? `/assistant/sources/maintenance-cost?vehicle=${encoded}`
            : `/${item.type === 'maintenance' ? 'maintenance' : item.type === 'delivery' ? 'deliveries' : 'vehicles'}?record=${encoded}`
    if (expected ? item.href !== expected : !safeFindingActionUrl(item.href))
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['href'], message: 'noncanonical source link' })
  })

export function parseAssistantSources(value: unknown): AssistantSource[] {
  return z.array(sourceSchema).max(50).parse(value)
}

export function validateAnswerCitations(
  answer: { claims: AssistantClaim[] },
  sources: readonly AssistantSource[]
): boolean {
  const parsed = z.array(sourceSchema).max(50).safeParse(sources)
  if (!parsed.success) return false
  const sourceIds = new Set(parsed.data.map((source) => source.id))
  if (sourceIds.size !== sources.length || !answer.claims.length || answer.claims.length > 20) return false
  return answer.claims.every((claim) => {
    const parsed = claimSchema.safeParse(claim)
    return (
      parsed.success &&
      new Set(claim.citationIds).size === claim.citationIds.length &&
      claim.citationIds.every((id) => sourceIds.has(id))
    )
  })
}
