import { z } from 'zod'

const boundedProvider = z.string().regex(/^[a-z0-9][a-z0-9._@-]{0,31}$/i)
const boundedModelVersion = z.string().regex(/^[a-z0-9][a-z0-9._@-]{0,63}$/i)
const nullableTokens = z.number().int().min(0).max(10_000_000).nullable().default(null)

export const aiTelemetryEventSchema = z
  .object({
    provider: boundedProvider,
    modelVersion: boundedModelVersion,
    status: z.enum(['generated', 'fallback']),
    errorCode: z
      .enum([
        'provider_disabled',
        'provider_misconfigured',
        'provider_auth',
        'provider_request',
        'provider_unavailable',
        'provider_refusal',
        'provider_incomplete',
        'timeout',
        'caller_aborted',
        'input_invalid',
        'input_too_large',
        'response_too_large',
        'output_malformed',
        'output_invalid',
        'citation_invalid',
        'no_findings',
      ])
      .optional(),
    latencyMs: z.number().int().min(0).max(300_000),
    inputTokens: nullableTokens,
    outputTokens: nullableTokens,
    occurredAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type AiTelemetryEvent = z.infer<typeof aiTelemetryEventSchema>
export const parseAiTelemetryEvent = (value: unknown): AiTelemetryEvent => aiTelemetryEventSchema.parse(value)

export function aggregateAiTelemetry(events: readonly AiTelemetryEvent[]) {
  const requests = events.length
  const generated = events.filter((event) => event.status === 'generated').length
  const fallbacks = requests - generated
  return {
    requests,
    generated,
    fallbacks,
    errors: events.filter((event) => Boolean(event.errorCode)).length,
    averageLatencyMs: requests ? Math.round(events.reduce((sum, event) => sum + event.latencyMs, 0) / requests) : 0,
    inputTokens: events.reduce((sum, event) => sum + (event.inputTokens ?? 0), 0),
    outputTokens: events.reduce((sum, event) => sum + (event.outputTokens ?? 0), 0),
  }
}

export const workspaceAiSettingsSchema = z
  .object({
    enabled: z.boolean().default(false),
    retentionDays: z.number().int().min(7).max(90).default(30),
  })
  .strict()
  .default({ enabled: false, retentionDays: 30 })

export function resolveAiRuntimeControl(
  settings: { enabled: boolean; killSwitch: boolean },
  env: Record<string, string | undefined>
) {
  if (/^(1|true|yes|on)$/i.test(env.AI_KILL_SWITCH?.trim() ?? ''))
    return { enabled: false as const, reason: 'global_kill_switch' as const }
  if (settings.killSwitch) return { enabled: false as const, reason: 'workspace_kill_switch' as const }
  if (!settings.enabled) return { enabled: false as const, reason: 'workspace_disabled' as const }
  return { enabled: true as const }
}
export function providerReadiness(provider: string, modelVersion: string, env: Record<string, string | undefined>) {
  if (provider === 'disabled') return { ready: false as const, reason: 'provider_disabled' as const }
  if (
    provider !== 'openai' ||
    !env.OPENAI_API_KEY?.trim() ||
    !env.OPENAI_MODEL?.trim() ||
    env.OPENAI_MODEL.trim() !== modelVersion
  )
    return { ready: false as const, reason: 'provider_misconfigured' as const }
  return { ready: true as const }
}

export function telemetryRetentionCutoff(now: Date, requestedDays: number): Date {
  const days = Math.min(90, Math.max(7, Number.isSafeInteger(requestedDays) ? requestedDays : 30))
  return new Date(now.getTime() - days * 86_400_000)
}
