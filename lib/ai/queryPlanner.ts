import { z } from 'zod'

export const assistantQuestionSchema = z.string().trim().min(1).max(500)
export type FleetIntent =
  | 'attention'
  | 'maintenance_due'
  | 'cost_drivers'
  | 'delivery_exceptions'
  | 'activity'
  | 'vehicle_summary'
  | 'client_summary'
export type FleetQueryPlan =
  | { supported: true; intent: FleetIntent; entityId?: string; from?: Date; to?: Date }
  | { supported: false; reason: 'unsupported' | 'ambiguous' }
export const selectedEntitySchema = z
  .object({ type: z.enum(['vehicle', 'client']), id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) })
  .strict()

const MUTATING =
  /\b(delete|remove|update|change|create|send|email|purchase|buy|ignore previous|dump (?:the )?database|raw sql)\b/i

function exactDate(value: string, end = false): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}

export function planFleetQuestion(input: string, selectedEntity?: unknown): FleetQueryPlan {
  const question = assistantQuestionSchema.parse(input)
  if (MUTATING.test(question)) return { supported: false, reason: 'unsupported' }
  if (/what needs attention|priorit(?:y|ies)|urgent/i.test(question)) return { supported: true, intent: 'attention' }
  if (/maintenance.*(?:overdue|due soon)|(?:overdue|due soon).*maintenance/i.test(question))
    return { supported: true, intent: 'maintenance_due' }
  if (/(?:highest|most|top).*(?:maintenance )?cost|cost driver/i.test(question))
    return { supported: true, intent: 'cost_drivers' }
  if (/deliver(?:y|ies).*(?:late|incomplete|unassigned)|(?:late|incomplete|unassigned).*deliver/i.test(question))
    return { supported: true, intent: 'delivery_exceptions' }
  const selected = selectedEntitySchema.safeParse(selectedEntity)
  if (/summari[sz]e (?:the )?selected vehicle/i.test(question) && selected.success && selected.data.type === 'vehicle')
    return { supported: true, intent: 'vehicle_summary', entityId: selected.data.id }
  if (/summari[sz]e (?:the )?selected client/i.test(question) && selected.success && selected.data.type === 'client')
    return { supported: true, intent: 'client_summary', entityId: selected.data.id }
  const vehicle = /summari[sz]e vehicle\s+([a-z0-9_-]{1,64})/i.exec(question)
  if (vehicle) return { supported: true, intent: 'vehicle_summary', entityId: vehicle[1] }
  const client = /summari[sz]e client\s+([a-z0-9_-]{1,64})/i.exec(question)
  if (client) return { supported: true, intent: 'client_summary', entityId: client[1] }
  const dates = /(?:activity|summari[sz]e).*(\d{4}-\d{2}-\d{2}).*(\d{4}-\d{2}-\d{2})/i.exec(question)
  if (dates) {
    const from = exactDate(dates[1])
    const to = exactDate(dates[2], true)
    if (from && to && from <= to && to.getTime() - from.getTime() <= 366 * 86400000)
      return { supported: true, intent: 'activity', from, to }
    return { supported: false, reason: 'ambiguous' }
  }
  return { supported: false, reason: 'ambiguous' }
}
