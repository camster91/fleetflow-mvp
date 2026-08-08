import { randomUUID } from 'crypto'
import { buildFleetSummaryPrompt } from './prompts'
import { projectSafeFindings } from './redaction'
import {
  fleetSummaryRequestPayloadSchema, fleetSummaryJsonSchema, generatedFleetSummaryContentSchema, type AiDegradationReason,
  type AiProvider, type AiProviderName, type AiResultMetadata, type AiUsage,
  type FleetSummaryContent, type FleetSummaryRequestPayload, type FleetSummaryResult,
  type ProviderFactory, type ProviderRequest, type ProviderSuccess, type SafeFinding,
} from './types'

type Env = Record<string, string | undefined>
type SafeLog = Record<string, string | number | null | undefined>

export interface AiLogger {
  info(event: SafeLog): void
  error(event: SafeLog): void
}

export interface AiDependencies {
  fetch: typeof fetch
  now: () => number
  requestId: () => string
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>
  random: () => number
  setTimer: (callback: () => void, milliseconds: number) => ReturnType<typeof setTimeout>
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void
  logger: AiLogger
}

export interface GenerateFleetSummaryOptions {
  env?: Env
  signal?: AbortSignal
  dependencies?: Partial<AiDependencies>
  registry?: AiProviderRegistry
}

class AiFailure extends Error {
  constructor(readonly code: AiDegradationReason) { super(code) }
}

const NULL_USAGE: AiUsage = { inputTokens: null, outputTokens: null, totalTokens: null }
const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504])
const PROVIDER_NAME = /^[a-z][a-z0-9-]{0,31}$/
const RESERVED_PROVIDER_NAMES = new Set(['__proto__', 'prototype', 'constructor'])

function validProviderName(name: string): boolean {
  return PROVIDER_NAME.test(name) && !RESERVED_PROVIDER_NAMES.has(name)
}

export class AiProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>()

  register(name: string, factory: ProviderFactory): this {
    if (!validProviderName(name)) throw new Error('AI provider name is invalid or reserved')
    if (this.factories.has(name)) throw new Error(`AI provider ${name} is already registered`)
    if (typeof factory !== 'function') throw new Error('AI provider factory is required')
    this.factories.set(name, factory)
    return this
  }

  create(name: string, env: Env): AiProvider {
    if (!validProviderName(name)) throw new AiFailure('provider_misconfigured')
    const factory = this.factories.get(name)
    if (!factory) throw new AiFailure('provider_misconfigured')
    const provider = factory({ env })
    if (!provider || provider.name !== name || typeof provider.generate !== 'function') throw new AiFailure('provider_misconfigured')
    return provider
  }
}

export function sleepWithAbort(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    let settled = false
    const cleanup = () => signal?.removeEventListener('abort', onAbort)
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const timer = setTimeout(finish, milliseconds)
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cleanup()
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

const defaults: AiDependencies = {
  fetch: globalThis.fetch,
  now: Date.now,
  requestId: randomUUID,
  sleep: sleepWithAbort,
  random: Math.random,
  setTimer: (callback, milliseconds) => setTimeout(callback, milliseconds),
  clearTimer: (timer) => clearTimeout(timer),
  logger: {
    info: (event) => console.info(event),
    error: (event) => console.error(event),
  },
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback
}

function fallbackContent(findings: readonly SafeFinding[]): FleetSummaryContent {
  const ranked = [...findings].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5)
  if (!ranked.length) return { sections: [], claims: [], actions: [] }
  return {
    sections: [{
      heading: 'Fleet priorities',
      summary: `${ranked.length} fleet finding${ranked.length === 1 ? '' : 's'} need review.`,
      citationIds: ranked.map((finding) => finding.id),
    }],
    claims: ranked.map((finding) => ({ text: `${finding.title}: ${finding.explanation}`.slice(0, 1_000), citationIds: [finding.id] })),
    actions: ranked.map((finding) => ({ text: finding.recommendedAction, citationIds: [finding.id] })),
  }
}

function elapsed(start: number, end: number): number {
  return Math.max(0, Math.round(end - start))
}

function usageCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

async function readLimited(response: Response, limit: number): Promise<string> {
  const declared = response.headers.get('content-length')
  if (declared && Number(declared) > limit) {
    await discardResponseBody(response)
    throw new AiFailure('response_too_large')
  }
  if (!response.body) {
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > limit) throw new AiFailure('response_too_large')
    return text
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let output = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw new AiFailure('response_too_large')
      }
      output += decoder.decode(value, { stream: true })
    }
    return output + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  if (!response.body || response.bodyUsed) return
  try {
    await response.body.cancel()
  } catch { /* Never replace failed cancellation with an unbounded body drain. */ }
}

function responseOutputText(body: unknown): { text: string; usage: AiUsage } {
  if (!body || typeof body !== 'object') throw new AiFailure('output_malformed')
  const data = body as Record<string, unknown>
  if (data.status !== 'completed') throw new AiFailure('provider_incomplete')
  const output = Array.isArray(data.output) ? data.output : []
  const parts: Record<string, unknown>[] = []
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as { content: unknown[] }).content : []
    for (const part of content) {
      if (part && typeof part === 'object') parts.push(part as Record<string, unknown>)
    }
  }
  if (parts.some((part) => part.type === 'refusal')) throw new AiFailure('provider_refusal')
  const textPart = parts.find((part) => part.type === 'output_text' && typeof part.text === 'string')
  if (textPart) {
    const usage = data.usage && typeof data.usage === 'object' ? data.usage as Record<string, unknown> : {}
    return { text: textPart.text as string, usage: {
      inputTokens: usageCount(usage.input_tokens), outputTokens: usageCount(usage.output_tokens),
      totalTokens: usageCount(usage.total_tokens),
    } }
  }
  throw new AiFailure('output_malformed')
}

function validateGroundedOutput(json: unknown, allowedIds: ReadonlySet<string>): FleetSummaryContent {
  const parsed = generatedFleetSummaryContentSchema.safeParse(json)
  if (!parsed.success) throw new AiFailure('output_invalid')
  for (const item of [...parsed.data.sections, ...parsed.data.claims, ...parsed.data.actions]) {
    if (item.citationIds.some((id) => !allowedIds.has(id))) throw new AiFailure('citation_invalid')
  }
  return parsed.data
}

function parseGroundedOutput(text: string, allowedIds: ReadonlySet<string>): FleetSummaryContent {
  let json: unknown
  try { json = JSON.parse(text) } catch { throw new AiFailure('output_malformed') }
  return validateGroundedOutput(json, allowedIds)
}

function abortContext(caller: AbortSignal | undefined, timeoutMs: number, dependencies: Pick<AiDependencies, 'setTimer' | 'clearTimer'>) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = dependencies.setTimer(() => { timedOut = true; controller.abort() }, timeoutMs)
  const onCallerAbort = () => controller.abort()
  caller?.addEventListener('abort', onCallerAbort, { once: true })
  if (caller?.aborted) controller.abort()
  return {
    signal: controller.signal,
    reason: (): AiDegradationReason => caller?.aborted ? 'caller_aborted' : timedOut ? 'timeout' : 'provider_unavailable',
    cleanup: () => { dependencies.clearTimer(timeout); caller?.removeEventListener('abort', onCallerAbort) },
  }
}

async function invokeProvider(
  provider: AiProvider, request: Omit<ProviderRequest, 'signal'>,
  callerSignal: AbortSignal | undefined, timeoutMs: number, dependencies: AiDependencies,
): Promise<ProviderSuccess> {
  const abort = abortContext(callerSignal, timeoutMs, dependencies)
  let onAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new AiFailure(abort.reason()))
    abort.signal.addEventListener('abort', onAbort, { once: true })
    if (abort.signal.aborted) onAbort()
  })
  try {
    return await Promise.race([
      Promise.resolve().then(() => provider.generate({ ...request, signal: abort.signal })),
      cancelled,
    ])
  } catch (error) {
    if (abort.signal.aborted) throw new AiFailure(abort.reason())
    throw error
  } finally {
    if (onAbort) abort.signal.removeEventListener('abort', onAbort)
    abort.cleanup()
  }
}

class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly maxOutputTokens: number,
    private readonly responseLimit: number,
    private readonly dependencies: AiDependencies,
  ) {}

  async generate(request: ProviderRequest): Promise<ProviderSuccess> {
    const prompt = buildFleetSummaryPrompt(request.findings)
    const body = JSON.stringify({
      model: this.model,
      store: false,
      max_output_tokens: this.maxOutputTokens,
      instructions: prompt.system,
      input: prompt.input,
      text: { format: { type: 'json_schema', name: 'fleet_summary', schema: fleetSummaryJsonSchema, strict: true } },
    })
    const abort = abortContext(request.signal, this.timeoutMs, this.dependencies)
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (abort.signal.aborted) throw new AiFailure(abort.reason())
        let response: Response
        try {
          response = await this.dependencies.fetch('https://api.openai.com/v1/responses', {
            method: 'POST', signal: abort.signal, body,
            headers: {
              'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}`,
              'X-Client-Request-Id': request.requestId,
            },
          })
        } catch (error) {
          if (abort.signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw new AiFailure(abort.reason())
          if (attempt < 2) { await this.dependencies.sleep(250 * (2 ** attempt) + Math.floor(this.dependencies.random() * 100), abort.signal); continue }
          throw new AiFailure('provider_unavailable')
        }
        if (!response.ok) {
          await discardResponseBody(response)
          if (response.status === 401 || response.status === 403) throw new AiFailure('provider_auth')
          if (!RETRYABLE.has(response.status)) throw new AiFailure('provider_request')
          if (attempt < 2) {
            const retryAfter = Number(response.headers.get('retry-after'))
            const serverDelay = Number.isFinite(retryAfter) ? retryAfter * 1_000 : 0
            const delay = Math.min(2_000, Math.max(250 * (2 ** attempt), serverDelay) + Math.floor(this.dependencies.random() * 100))
            await this.dependencies.sleep(delay, abort.signal)
            continue
          }
          throw new AiFailure('provider_unavailable')
        }
        const raw = await readLimited(response, this.responseLimit)
        let decoded: unknown
        try { decoded = JSON.parse(raw) } catch { throw new AiFailure('output_malformed') }
        const output = responseOutputText(decoded)
        return { content: parseGroundedOutput(output.text, new Set(request.findings.map((item) => item.id))), usage: output.usage }
      }
      throw new AiFailure('provider_unavailable')
    } catch (error) {
      if (error instanceof AiFailure) throw error
      if (abort.signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw new AiFailure(abort.reason())
      throw new AiFailure('provider_unavailable')
    } finally {
      abort.cleanup()
    }
  }
}

export function createDefaultAiProviderRegistry(dependencies: AiDependencies): AiProviderRegistry {
  return new AiProviderRegistry()
    .register('disabled', () => ({
      name: 'disabled', model: null,
      generate: async () => { throw new AiFailure('provider_disabled') },
    }))
    .register('openai', ({ env }) => {
      if (!env.OPENAI_API_KEY?.trim() || !env.OPENAI_MODEL?.trim()) throw new AiFailure('provider_misconfigured')
      return new OpenAiProvider(
        env.OPENAI_MODEL.trim(), env.OPENAI_API_KEY.trim(),
        boundedInteger(env.AI_TIMEOUT_MS, 15_000, 10, 60_000),
        boundedInteger(env.AI_MAX_OUTPUT_TOKENS, 1_200, 100, 4_000),
        boundedInteger(env.AI_MAX_RESPONSE_BYTES, 64_000, 100, 1_000_000), dependencies,
      )
    })
}

function metadata(requestId: string, provider: AiProviderName, model: string | null, latencyMs: number, status: AiResultMetadata['status'], usage: AiUsage, fallbackReason?: AiDegradationReason): AiResultMetadata {
  return { requestId, provider, model, latencyMs, usage, status, ...(fallbackReason ? { fallbackReason } : {}) }
}

function emitTelemetry(logger: AiLogger, level: 'info' | 'error', event: SafeLog): void {
  try { logger[level](event) } catch { /* Telemetry must never alter product behavior. */ }
}

export async function generateFleetSummary(payload: FleetSummaryRequestPayload, options: GenerateFleetSummaryOptions = {}): Promise<FleetSummaryResult> {
  if (typeof window !== 'undefined') throw new Error('The AI provider layer is server-only')
  const dependencies = { ...defaults, ...options.dependencies }
  const env = options.env ?? process.env
  const requestId = dependencies.requestId()
  const started = dependencies.now()
  let findings: SafeFinding[] = []
  let providerName: AiProviderName = 'disabled'
  let model: string | null = null
  let reason: AiDegradationReason | undefined
  let usage = NULL_USAGE
  try {
    const parsedPayload = fleetSummaryRequestPayloadSchema.safeParse(payload)
    if (!parsedPayload.success) throw new AiFailure('input_invalid')
    findings = projectSafeFindings(parsedPayload.data.findings)
    if (findings.length === 0) throw new AiFailure('no_findings')
    const maxInputChars = boundedInteger(env.AI_MAX_INPUT_CHARS, 24_000, 20, 250_000)
    if (JSON.stringify(findings).length > maxInputChars) throw new AiFailure('input_too_large')
    const selectedName = env.AI_PROVIDER === undefined || env.AI_PROVIDER === '' ? 'disabled' : env.AI_PROVIDER
    if (!validProviderName(selectedName)) throw new AiFailure('provider_misconfigured')
    providerName = selectedName
    const provider = (options.registry ?? createDefaultAiProviderRegistry(dependencies)).create(selectedName, env)
    providerName = provider.name
    model = provider.model
    const orchestrationTimeoutMs = boundedInteger(env.AI_TIMEOUT_MS, 15_000, 10, 60_000)
    const generated = await invokeProvider(provider, { findings, requestId }, options.signal, orchestrationTimeoutMs, dependencies)
    const content = validateGroundedOutput(generated.content, new Set(findings.map((item) => item.id)))
    usage = {
      inputTokens: usageCount(generated.usage?.inputTokens),
      outputTokens: usageCount(generated.usage?.outputTokens),
      totalTokens: usageCount(generated.usage?.totalTokens),
    }
    const meta = metadata(requestId, providerName, model, elapsed(started, dependencies.now()), 'generated', usage)
    emitTelemetry(dependencies.logger, 'info', {
      event: 'ai_summary', requestId, provider: providerName, model, status: 'generated', latencyMs: meta.latencyMs,
      usageInputTokens: usage.inputTokens, usageOutputTokens: usage.outputTokens, usageTotalTokens: usage.totalTokens,
    })
    return { content, meta }
  } catch (error) {
    reason = error instanceof AiFailure ? error.code : 'provider_unavailable'
    const meta = metadata(requestId, providerName, model, elapsed(started, dependencies.now()), 'fallback', usage, reason)
    emitTelemetry(dependencies.logger, 'error', {
      event: 'ai_summary', requestId, provider: providerName, model, status: 'fallback', code: reason, latencyMs: meta.latencyMs,
      usageInputTokens: usage.inputTokens, usageOutputTokens: usage.outputTokens, usageTotalTokens: usage.totalTokens,
    })
    return { content: fallbackContent(findings), meta }
  }
}
