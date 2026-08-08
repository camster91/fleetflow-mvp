import { AiProviderRegistry, generateFleetSummary, sleepWithAbort, type AiDependencies } from '@/lib/ai/provider'
import { fleetSummaryContentSchema, fleetSummaryRequestPayloadSchema, type ProviderRequest, type SafeFinding } from '@/lib/ai/types'

const findings: SafeFinding[] = [
  { id: 'f-high', severity: 'high', title: 'Service overdue', explanation: 'Three days overdue', recommendedAction: 'Schedule service', score: 90 },
  { id: 'f-low', severity: 'low', title: 'Mileage missing', explanation: 'Mileage is absent', recommendedAction: 'Add mileage', score: 20 },
]

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function validOutput() {
  return {
    sections: [{ heading: 'Priority', summary: 'Service needs attention.', citationIds: ['f-high'] }],
    claims: [{ text: 'Service is overdue.', citationIds: ['f-high'] }],
    actions: [{ text: 'Schedule service.', citationIds: ['f-high'] }],
  }
}

function openAiBody(output: unknown = validOutput()) {
  return {
    id: 'resp_123', status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
    usage: { input_tokens: 123, output_tokens: 45, total_tokens: 168 },
  }
}

function deps(fetchImpl: typeof fetch, overrides: Partial<AiDependencies> = {}): AiDependencies {
  return {
    fetch: fetchImpl, now: () => 1_000, requestId: () => 'req-safe', sleep: async () => {},
    random: () => 0, setTimer: setTimeout, clearTimer: clearTimeout,
    logger: { info: jest.fn(), error: jest.fn() }, ...overrides,
  }
}

const openAiEnv = { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-secret', OPENAI_MODEL: 'gpt-pinned', AI_TIMEOUT_MS: '1000', AI_MAX_INPUT_CHARS: '10000', AI_MAX_OUTPUT_TOKENS: '700', AI_MAX_RESPONSE_BYTES: '20000' }

describe('provider-neutral fleet summary service', () => {
  it('exports a strict request payload schema and keeps AbortSignal outside it', async () => {
    expect(fleetSummaryRequestPayloadSchema.safeParse({ findings }).success).toBe(true)
    expect(fleetSummaryRequestPayloadSchema.safeParse({ findings, signal: new AbortController().signal }).success).toBe(false)
    expect(fleetSummaryRequestPayloadSchema.safeParse({ findings, tenantId: 'must-not-enter-domain' }).success).toBe(false)

    const result = await generateFleetSummary({ findings, tenantId: 'x' } as never, {
      env: openAiEnv, dependencies: deps(jest.fn()),
    })
    expect(result.meta.fallbackReason).toBe('input_invalid')
  })

  it('refuses to run the provider layer in a browser runtime', async () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
    try {
      await expect(generateFleetSummary({ findings }, { env: { AI_PROVIDER: 'disabled' }, dependencies: deps(jest.fn()) })).rejects.toThrow('server-only')
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })

  it('uses deterministic grounded fallback when AI is disabled', async () => {
    const result = await generateFleetSummary({ findings }, { env: { AI_PROVIDER: 'disabled' }, dependencies: deps(jest.fn()) })
    expect(result.meta).toMatchObject({ requestId: 'req-safe', provider: 'disabled', model: null, status: 'fallback', fallbackReason: 'provider_disabled' })
    expect(result.content.claims[0].citationIds).toEqual(['f-high'])
    expect(result.content.actions[0].citationIds).toEqual(['f-high'])
    expect(result.content.claims[0].text).toContain('Service overdue')
  })

  it('validates every registered provider response at the domain boundary', async () => {
    const unsafeProvider = {
      name: 'unsafe-test', model: 'test-provider',
      generate: jest.fn(async () => ({
        content: { ...validOutput(), claims: [{ text: 'Cross-record claim', citationIds: ['outside-workspace'] }] },
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      })),
    }
    const registry = new AiProviderRegistry().register('unsafe-test', () => unsafeProvider)
    const result = await generateFleetSummary({ findings }, {
      env: { AI_PROVIDER: 'unsafe-test' }, dependencies: deps(jest.fn()), registry,
    })
    expect(result.meta.fallbackReason).toBe('citation_invalid')
    expect(result.content.claims[0].citationIds).toEqual(['f-high'])
  })

  it('selects a registered third-party provider without core edits or OpenAI configuration', async () => {
    const provider = {
      name: 'local-test', model: 'fixture-v1',
      generate: jest.fn(async () => ({ content: validOutput(), usage: { inputTokens: 4, outputTokens: 5, totalTokens: 9 } })),
    }
    const registry = new AiProviderRegistry().register('local-test', ({ env }) => {
      expect(env.CUSTOM_ENDPOINT).toBe('internal')
      return provider
    })
    const result = await generateFleetSummary({ findings }, {
      env: { AI_PROVIDER: 'local-test', CUSTOM_ENDPOINT: 'internal' }, dependencies: deps(jest.fn()), registry,
    })
    expect(result.meta).toMatchObject({ status: 'generated', provider: 'local-test', model: 'fixture-v1' })
    expect(provider.generate).toHaveBeenCalledTimes(1)
  })

  it.each(['', 'UPPER', 'has space', 'x'.repeat(33), '__proto__', 'constructor', 'prototype'])('rejects invalid or reserved provider name %p', (name) => {
    expect(() => new AiProviderRegistry().register(name, () => ({ name, model: null, generate: async () => ({ content: validOutput(), usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }) }))).toThrow()
  })

  it('rejects duplicate provider registration', () => {
    const factory = () => ({ name: 'custom', model: null, generate: async () => ({ content: validOutput(), usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }) })
    const registry = new AiProviderRegistry().register('custom', factory)
    expect(() => registry.register('custom', factory)).toThrow('already registered')
  })

  it('requires explicit OpenAI key and pinned model and degrades without throwing', async () => {
    for (const env of [
      { AI_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-pinned' },
      { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'key' },
      { AI_PROVIDER: 'surprise' },
    ]) {
      const result = await generateFleetSummary({ findings }, { env, dependencies: deps(jest.fn()) })
      expect(result.meta.status).toBe('fallback')
      expect(result.meta.fallbackReason).toBe('provider_misconfigured')
    }
  })

  it('posts a non-retained strict Responses API request and normalizes usage', async () => {
    const fetchMock = jest.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      expect(_url).toBe('https://api.openai.com/v1/responses')
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-secret', 'X-Client-Request-Id': 'req-safe' })
      expect(body).toMatchObject({ model: 'gpt-pinned', store: false, max_output_tokens: 700, text: { format: { type: 'json_schema', name: 'fleet_summary', strict: true } } })
      expect(body.text.format.schema.additionalProperties).toBe(false)
      expect(JSON.stringify(body)).not.toContain('tenant')
      return response(openAiBody())
    }) as unknown as typeof fetch

    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.meta).toMatchObject({ status: 'generated', provider: 'openai', model: 'gpt-pinned', usage: { inputTokens: 123, outputTokens: 45, totalTokens: 168 } })
    expect(result.content.claims[0].citationIds).toEqual(['f-high'])
  })

  it('never sends embedded sensitive patterns to the provider', async () => {
    const sensitiveFindings: SafeFinding[] = [{
      ...findings[0],
      title: 'Email dispatch@example.com',
      explanation: 'Call +1 (416) 555-0199 with api_key=private-secret-value',
      recommendedAction: 'Use Bearer extremely-private-token',
    }]
    const fetchMock = jest.fn(async (_url, init) => {
      const body = String(init?.body)
      expect(body).toContain('[REDACTED_EMAIL]')
      expect(body).toContain('[REDACTED_PHONE]')
      expect(body).toContain('[REDACTED_SECRET]')
      expect(body).not.toMatch(/dispatch@example|416|private-secret|extremely-private/)
      return response(openAiBody({
        sections: [{ heading: 'Priority', summary: 'Attention required.', citationIds: ['f-high'] }],
        claims: [{ text: 'Attention is required.', citationIds: ['f-high'] }],
        actions: [{ text: 'Review it.', citationIds: ['f-high'] }],
      }))
    }) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings: sensitiveFindings }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.meta.status).toBe('generated')
  })

  it.each([
    ['unknown citation', { ...validOutput(), claims: [{ text: 'Invented', citationIds: ['nope'] }] }, 'citation_invalid'],
    ['missing citation', { ...validOutput(), claims: [{ text: 'Uncited', citationIds: [] }] }, 'output_invalid'],
    ['duplicate citation', { ...validOutput(), claims: [{ text: 'Repeated', citationIds: ['f-high', 'f-high'] }] }, 'output_invalid'],
    ['extra field', { ...validOutput(), secret: 'bad' }, 'output_invalid'],
  ])('degrades on %s', async (_name, output, code) => {
    const fetchMock = jest.fn(async () => response(openAiBody(output))) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.meta).toMatchObject({ status: 'fallback', fallbackReason: code })
  })

  it('rejects a totally empty generated answer when findings were supplied', async () => {
    const empty = { sections: [], claims: [], actions: [] }
    const result = await generateFleetSummary({ findings }, {
      env: openAiEnv,
      dependencies: deps(jest.fn(async () => response(openAiBody(empty))) as unknown as typeof fetch),
    })
    expect(result.meta.fallbackReason).toBe('output_invalid')
    expect(result.content.claims).not.toHaveLength(0)
  })

  it('returns an empty deterministic summary without calling a provider when input is empty', async () => {
    const fetchMock = jest.fn() as unknown as typeof fetch
    const result = await generateFleetSummary({ findings: [] }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.content).toEqual({ sections: [], claims: [], actions: [] })
    expect(fleetSummaryContentSchema.safeParse(result.content).success).toBe(true)
    expect(result.meta).toMatchObject({ status: 'fallback', fallbackReason: 'no_findings' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['excessive output text', { ...validOutput(), claims: [{ text: 'x'.repeat(1_001), citationIds: ['f-high'] }] }],
    ['excessive output items', { ...validOutput(), actions: new Array(9).fill(0).map((_, i) => ({ text: `Action ${i}`, citationIds: ['f-high'] })) }],
  ])('rejects %s', async (_name, output) => {
    const fetchMock = jest.fn(async () => response(openAiBody(output))) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.meta.fallbackReason).toBe('output_invalid')
  })

  it.each([
    ['malformed JSON', { id: 'x', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{' }] }] }, 'output_malformed'],
    ['refusal', { id: 'x', status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }, 'provider_refusal'],
    ['incomplete response', { id: 'x', status: 'incomplete', output: [] }, 'provider_incomplete'],
  ])('degrades on %s', async (_name, body, code) => {
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: deps(jest.fn(async () => response(body)) as unknown as typeof fetch) })
    expect(result.meta.fallbackReason).toBe(code)
  })

  it('rejects a mixed response containing both output and refusal', async () => {
    const body = openAiBody()
    ;(body.output[0].content as Array<Record<string, unknown>>).push({ type: 'refusal', refusal: 'No' })
    const result = await generateFleetSummary({ findings }, {
      env: openAiEnv, dependencies: deps(jest.fn(async () => response(body)) as unknown as typeof fetch),
    })
    expect(result.meta.fallbackReason).toBe('provider_refusal')
  })

  it('retries only transient statuses with bounded delay', async () => {
    const sleep = jest.fn(async () => {})
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response({ error: { message: 'busy' } }, 429, { 'retry-after': '999' }))
      .mockResolvedValueOnce(response(openAiBody())) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: deps(fetchMock, { sleep }) })
    expect(result.meta.status).toBe('generated')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(expect.any(Number), expect.any(AbortSignal))
    expect((sleep as jest.Mock).mock.calls[0][0]).toBeLessThanOrEqual(2_000)
  })

  it.each([[401, 'provider_auth'], [400, 'provider_request'], [500, 'provider_unavailable']])('classifies HTTP %i', async (status, code) => {
    const fetchMock = jest.fn(async () => response({ error: { message: 'do not log me' } }, status)) as unknown as typeof fetch
    const d = deps(fetchMock)
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: d })
    expect(result.meta.fallbackReason).toBe(code)
    expect(fetchMock).toHaveBeenCalledTimes(status === 500 ? 3 : 1)
    expect(JSON.stringify((d.logger.error as jest.Mock).mock.calls)).not.toMatch(/do not log me|sk-secret|f-high/)
  })

  it('times out and aborts the provider request', async () => {
    const fetchMock = jest.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: { ...openAiEnv, AI_TIMEOUT_MS: '10' }, dependencies: deps(fetchMock) })
    expect(result.meta.fallbackReason).toBe('timeout')
  })

  it('honours caller cancellation without retrying', async () => {
    const controller = new AbortController()
    const fetchMock = jest.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })) as unknown as typeof fetch
    const promise = generateFleetSummary({ findings }, { env: openAiEnv, signal: controller.signal, dependencies: deps(fetchMock) })
    controller.abort()
    const result = await promise
    expect(result.meta.fallbackReason).toBe('caller_aborted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('classifies cancellation while waiting to retry', async () => {
    const controller = new AbortController()
    const sleep = jest.fn(async (_milliseconds: number, signal?: AbortSignal) => {
      controller.abort()
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })
    const fetchMock = jest.fn(async () => response({ error: {} }, 429)) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, signal: controller.signal, dependencies: deps(fetchMock, { sleep }) })
    expect(result.meta.fallbackReason).toBe('caller_aborted')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('times out a hanging custom provider at the orchestration boundary', async () => {
    const provider = {
      name: 'hanging', model: 'fixture',
      generate: jest.fn(async (_request: ProviderRequest) => new Promise<never>(() => {})),
    }
    const registry = new AiProviderRegistry().register('hanging', () => provider)
    const result = await generateFleetSummary({ findings }, {
      env: { AI_PROVIDER: 'hanging', AI_TIMEOUT_MS: '10' }, dependencies: deps(jest.fn()), registry,
    })
    expect(result.meta.fallbackReason).toBe('timeout')
    expect(provider.generate.mock.calls[0]![0].signal).toBeInstanceOf(AbortSignal)
    expect(provider.generate.mock.calls[0]![0].signal?.aborted).toBe(true)
  })

  it('cancels a hanging custom provider from the transport signal', async () => {
    const controller = new AbortController()
    const provider = { name: 'hanging', model: null, generate: jest.fn(async (_request: ProviderRequest) => new Promise<never>(() => {})) }
    const registry = new AiProviderRegistry().register('hanging', () => provider)
    const pending = generateFleetSummary({ findings }, {
      env: { AI_PROVIDER: 'hanging' }, signal: controller.signal, dependencies: deps(jest.fn()), registry,
    })
    controller.abort()
    const result = await pending
    expect(result.meta.fallbackReason).toBe('caller_aborted')
    expect(provider.generate.mock.calls[0]![0].signal?.aborted).toBe(true)
  })

  it('cleans up the orchestration timeout after provider completion', async () => {
    const timer = Symbol('timer') as unknown as ReturnType<typeof setTimeout>
    const setTimer = jest.fn(() => timer)
    const clearTimer = jest.fn()
    const provider = { name: 'instant', model: null, generate: jest.fn(async () => ({ content: validOutput(), usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } })) }
    const registry = new AiProviderRegistry().register('instant', () => provider)
    const result = await generateFleetSummary({ findings }, {
      env: { AI_PROVIDER: 'instant' }, dependencies: deps(jest.fn(), { setTimer, clearTimer }), registry,
    })
    expect(result.meta.status).toBe('generated')
    expect(setTimer).toHaveBeenCalledTimes(1)
    expect(clearTimer).toHaveBeenCalledWith(timer)
  })

  it('rejects oversized input before a provider call', async () => {
    const fetchMock = jest.fn() as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: { ...openAiEnv, AI_MAX_INPUT_CHARS: '20' }, dependencies: deps(fetchMock) })
    expect(result.meta.fallbackReason).toBe('input_too_large')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('classifies malformed runtime input without calling a provider', async () => {
    const fetchMock = jest.fn() as unknown as typeof fetch
    const result = await generateFleetSummary({ findings: [{ ...findings[0], unexpected: 'not allowed' }] as never }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.meta.fallbackReason).toBe('input_invalid')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized response body while streaming', async () => {
    const huge = 'x'.repeat(300)
    const fetchMock = jest.fn(async () => response({ data: huge })) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: { ...openAiEnv, AI_MAX_RESPONSE_BYTES: '100' }, dependencies: deps(fetchMock) })
    expect(result.meta.fallbackReason).toBe('response_too_large')
  })

  it('cancels a declared oversized response before returning fallback', async () => {
    const cancel = jest.fn()
    const fetchMock = jest.fn(async () => new Response(new ReadableStream({ cancel }), {
      status: 200, headers: { 'content-length': '1000', 'content-type': 'application/json' },
    })) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, {
      env: { ...openAiEnv, AI_MAX_RESPONSE_BYTES: '100' }, dependencies: deps(fetchMock),
    })
    expect(result.meta.fallbackReason).toBe('response_too_large')
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('does not perform an unbounded drain when error-body cancellation fails', async () => {
    const cancel = jest.fn(async () => { throw new Error('cancel failed') })
    const providerResponse = new Response(new ReadableStream({ cancel }), { status: 400 })
    const arrayBuffer = jest.spyOn(providerResponse, 'arrayBuffer')
    const result = await generateFleetSummary({ findings }, {
      env: openAiEnv, dependencies: deps(jest.fn(async () => providerResponse) as unknown as typeof fetch),
    })
    expect(result.meta.fallbackReason).toBe('provider_request')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('uses injected time so fallback and metadata are deterministic', async () => {
    const result = await generateFleetSummary({ findings }, { env: { AI_PROVIDER: 'disabled' }, dependencies: deps(jest.fn(), { now: () => 4_321 }) })
    expect(result.meta.latencyMs).toBe(0)
    expect(JSON.stringify(result)).not.toMatch(/generatedAt|2026-/)
  })

  it('logs metadata only', async () => {
    const d = deps(jest.fn(async () => response(openAiBody())) as unknown as typeof fetch)
    await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: d })
    const logs = JSON.stringify((d.logger.info as jest.Mock).mock.calls)
    expect(logs).toContain('req-safe')
    expect((d.logger.info as jest.Mock).mock.calls[0][0]).toMatchObject({
      usageInputTokens: 123, usageOutputTokens: 45, usageTotalTokens: 168,
    })
    expect(logs).not.toMatch(/Service overdue|f-high|sk-secret|Three days/)
  })

  it('keeps a generated result when success telemetry throws', async () => {
    const d = deps(jest.fn(async () => response(openAiBody())) as unknown as typeof fetch, {
      logger: { info: jest.fn(() => { throw new Error('telemetry offline') }), error: jest.fn() },
    })
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: d })
    expect(result.meta.status).toBe('generated')
    expect(d.logger.error).not.toHaveBeenCalled()
  })

  it('never lets throwing fallback telemetry escape', async () => {
    const d = deps(jest.fn(async () => response({ error: {} }, 401)) as unknown as typeof fetch, {
      logger: { info: jest.fn(), error: jest.fn(() => { throw new Error('telemetry offline') }) },
    })
    await expect(generateFleetSummary({ findings }, { env: openAiEnv, dependencies: d })).resolves.toMatchObject({
      meta: { status: 'fallback', fallbackReason: 'provider_auth' },
    })
  })

  it('cancels every non-OK response body before retrying or returning fallback', async () => {
    const cancellations = [jest.fn(), jest.fn(), jest.fn()]
    let attempt = 0
    const fetchMock = jest.fn(async () => {
      const cancel = cancellations[attempt++]
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('private provider error')) }, cancel }), { status: 500 })
    }) as unknown as typeof fetch
    const result = await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: deps(fetchMock) })
    expect(result.meta.fallbackReason).toBe('provider_unavailable')
    expect(cancellations).toHaveLength(3)
    cancellations.forEach((cancel) => expect(cancel).toHaveBeenCalledTimes(1))
  })

  it('removes the default sleep abort listener after normal resolution', async () => {
    const controller = new AbortController()
    const add = jest.spyOn(controller.signal, 'addEventListener')
    const remove = jest.spyOn(controller.signal, 'removeEventListener')
    await sleepWithAbort(0, controller.signal)
    expect(add).toHaveBeenCalledWith('abort', expect.any(Function), { once: true })
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
  })

  it('removes the default sleep abort listener after cancellation', async () => {
    const controller = new AbortController()
    const add = jest.spyOn(controller.signal, 'addEventListener')
    const remove = jest.spyOn(controller.signal, 'removeEventListener')
    const pending = sleepWithAbort(60_000, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
  })

  it('emits typed null usage in fallback metrics without payload identifiers', async () => {
    const d = deps(jest.fn(async () => response({ error: {} }, 401)) as unknown as typeof fetch)
    await generateFleetSummary({ findings }, { env: openAiEnv, dependencies: d })
    const event = (d.logger.error as jest.Mock).mock.calls[0][0]
    expect(event).toMatchObject({ usageInputTokens: null, usageOutputTokens: null, usageTotalTokens: null })
    expect(JSON.stringify(event)).not.toMatch(/f-high|Service overdue|sk-secret/)
  })

  it('normalizes invalid or omitted provider usage without trusting it', async () => {
    const body = openAiBody() as Record<string, unknown>
    body.usage = { input_tokens: -1, output_tokens: 1.5, total_tokens: '2' }
    const result = await generateFleetSummary({ findings }, {
      env: openAiEnv,
      dependencies: deps(jest.fn(async () => response(body)) as unknown as typeof fetch),
    })
    expect(result.meta.usage).toEqual({ inputTokens: null, outputTokens: null, totalTokens: null })
  })
})
