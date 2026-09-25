import fixtures from '@/lib/ai/evaluation-fixtures.json'
import {
  AI_EVAL_CITATION_THRESHOLD,
  aiConfigFingerprint,
  evaluateAiCases,
  evaluationFixtureSchema,
  releaseGate,
  runEvaluationHarness,
  pricingTableSchema,
  validatePricingAlignment,
  validateProviderEvaluationRecord,
} from '@/lib/ai/evaluation'
import pricing from '@/lib/ai/pricing.json'

describe('offline AI evaluation gate', () => {
  test('fixtures cover supported, missing, adversarial, and cross-tenant cases with unique ids', () => {
    const parsed = evaluationFixtureSchema.parse(fixtures)
    expect(new Set(parsed.map((item) => item.category))).toEqual(
      new Set(['supported', 'missing_data', 'adversarial', 'tenant_isolation'])
    )
    expect(new Set(parsed.map((item) => item.expectedTool))).toEqual(
      new Set([
        'attention',
        'maintenance_due',
        'cost_drivers',
        'delivery_exceptions',
        'vehicle_summary',
        'client_summary',
        'activity',
        'refusal',
      ])
    )
    expect(new Set(parsed.map((item) => item.id)).size).toBe(parsed.length)
  })

  test('scores citations, unsupported claims, tool choice, refusal, latency, tokens, and configured cost deterministically', () => {
    const fixture = {
      id: 'one',
      category: 'supported',
      question: 'What needs attention?',
      expectedTool: 'attention',
      allowedCitationIds: ['finding:a'],
      maxLatencyMs: 500,
      maxTokens: 100,
      maxCostUsd: 0.001,
      tenant: { ownerId: 'o', teamId: 't' },
      records: {},
    }
    const result = evaluateAiCases(
      [fixture],
      [
        {
          fixtureId: 'one',
          selectedTool: 'attention',
          claims: [{ text: 'Needs attention', citationIds: ['finding:a'] }],
          refusalCorrect: true,
          status: 'generated',
          latencyMs: 250,
          inputTokens: 20,
          outputTokens: 10,
          provider: 'openai',
          modelVersion: 'model@v1',
          isolationViolation: false,
        },
      ],
      {
        currency: 'USD',
        asOf: '2026-08-08',
        source: 'https://example.test/pricing',
        models: { 'openai:model@v1': { inputUsdPerMillion: 1, outputUsdPerMillion: 2 } },
      }
    )
    expect(result).toEqual(
      expect.objectContaining({
        outcomeCoverage: 1,
        citationAccuracy: 1,
        unsupportedClaims: 0,
        toolSelectionAccuracy: 1,
        latencyPassRate: 1,
        tokenPassRate: 1,
        refusalQuality: 1,
        costPassRate: 1,
        estimatedCostUsd: 0.00004,
      })
    )
    expect(releaseGate(result).passed).toBe(true)
  })

  test('fails closed at citation threshold boundary and on any cross-tenant disclosure', () => {
    const baseline = {
      outcomeCoverage: 1,
      duplicateOutcomes: 0,
      citationAccuracy: AI_EVAL_CITATION_THRESHOLD,
      citationCoverage: 1,
      unsupportedClaims: 0,
      toolSelectionAccuracy: 1,
      latencyPassRate: 1,
      tokenPassRate: 1,
      costPassRate: 1,
      pricingKnown: true,
      refusalQuality: 1,
      generatedSupportedCoverage: 1,
      estimatedCostUsd: 0,
      crossTenantFailures: 0,
      caseCount: 1,
    }
    expect(releaseGate(baseline).passed).toBe(true)
    expect(releaseGate({ ...baseline, citationAccuracy: AI_EVAL_CITATION_THRESHOLD - 0.0001 }).passed).toBe(false)
    expect(releaseGate({ ...baseline, crossTenantFailures: 1 }).passed).toBe(false)
  })

  test('fails closed for missing, zero, duplicate outcomes and unknown pricing', () => {
    const parsed = evaluationFixtureSchema.parse(fixtures)
    const score = evaluateAiCases(parsed, [], pricing)
    expect(releaseGate(score)).toEqual(expect.objectContaining({ passed: false }))
    expect(score.outcomeCoverage).toBe(0)
    const one = {
      fixtureId: parsed[0].id,
      selectedTool: 'attention',
      claims: [],
      refusalCorrect: false,
      status: 'fallback' as const,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      provider: 'unknown',
      modelVersion: 'unknown',
      isolationViolation: false,
    }
    expect(releaseGate(evaluateAiCases(parsed, [one, one], pricing)).passed).toBe(false)
  })

  test('runs the real planner, fleet tools, citation validator, and disabled Task8 fallback', async () => {
    pricingTableSchema.parse(pricing)
    const outcomes = await runEvaluationHarness(evaluationFixtureSchema.parse(fixtures), {
      now: new Date('2026-08-08T12:00:00Z'),
    })
    expect(outcomes).toHaveLength(fixtures.length)
    expect(outcomes.find((item) => item.fixtureId === 'attention-supported')).toEqual(
      expect.objectContaining({ selectedTool: 'attention', provider: 'disabled', isolationViolation: false })
    )
    expect(releaseGate(evaluateAiCases(fixtures, outcomes, pricing)).passed).toBe(true)
  })
  test('configured provider and model must have an exact versioned price', () => {
    expect(validatePricingAlignment({ AI_PROVIDER: 'openai', OPENAI_MODEL: 'gpt-5-mini@2026-08' }, pricing)).toBe(true)
    expect(validatePricingAlignment({ AI_PROVIDER: 'openai', OPENAI_MODEL: 'unknown' }, pricing)).toBe(false)
  })
  test.each([
    { sections: [], claims: [], actions: [] },
    { sections: [{ heading: 'bad', summary: 'invented', citationIds: ['finding:foreign'] }], claims: [], actions: [] },
  ])('malicious adapter output fails the gate %#', async (content) => {
    const fixture = evaluationFixtureSchema.parse(fixtures)[0]
    const outcomes = await runEvaluationHarness([fixture], {
      generate: (async () => ({
        content,
        meta: {
          requestId: 'r',
          provider: 'disabled',
          model: null,
          latencyMs: 0,
          usage: { inputTokens: null, outputTokens: null, totalTokens: null },
          status: 'generated',
        },
      })) as never,
    })
    expect(outcomes[0].synthesisValid).toBe(false)
    expect(releaseGate(evaluateAiCases([fixture], outcomes, pricing)).passed).toBe(false)
  })
  test('overbroad mutated query adapter exposes the targeted foreign id and fails isolation gate', async () => {
    const fixture = evaluationFixtureSchema.parse(fixtures).find((item) => item.id === 'tenant-isolation')!
    const outcomes = await runEvaluationHarness([fixture], {
      dbFactory: () => ({
        vehicle: {
          findFirst: async () => ({
            id: 'secret-b',
            name: 'Tenant B Secret',
            status: 'active',
            mileage: 999,
            maintenanceDue: true,
            lastUpdated: new Date(),
          }),
        },
      }),
    })
    expect(outcomes[0].isolationViolation).toBe(true)
    expect(releaseGate(evaluateAiCases([fixture], outcomes, pricing)).passed).toBe(false)
  })
  test('incorrect reasonless fallback fails evaluation', async () => {
    const fixture = evaluationFixtureSchema.parse(fixtures)[0]
    const outcomes = await runEvaluationHarness([fixture], {
      generate: (async () => ({
        content: { sections: [{ heading: 'x', summary: 'x', citationIds: ['finding:f1'] }], claims: [], actions: [] },
        meta: {
          requestId: 'r',
          provider: 'disabled',
          model: null,
          latencyMs: 0,
          usage: { inputTokens: null, outputTokens: null, totalTokens: null },
          status: 'fallback',
        },
      })) as never,
    })
    expect(outcomes[0].synthesisValid).toBe(false)
    expect(releaseGate(evaluateAiCases([fixture], outcomes, pricing)).passed).toBe(false)
  })
  test('provider-quality recordings reject disabled fallback, mixed models, and missing usage', () => {
    const supported = evaluationFixtureSchema
      .parse(fixtures)
      .filter((item) => item.category === 'supported')
      .slice(0, 1)
    const intended = {
      provider: 'openai',
      modelVersion: 'gpt-5-mini@2026-08',
      configFingerprint: aiConfigFingerprint('openai', 'gpt-5-mini@2026-08', '1'),
      evaluationVersion: 'task9-realpath@v2',
    }
    const base = {
      ...intended,
      capturedAt: '2026-08-08T12:00:00.000Z',
      provenance: 'capture:sha256:abc',
      outputs: [
        {
          fixtureId: supported[0].id,
          result: {
            content: {
              sections: [{ heading: 'Fleet', summary: 'Grounded', citationIds: ['finding:f1'] }],
              claims: [],
              actions: [],
            },
            meta: {
              requestId: 'recorded-1',
              provider: 'openai',
              model: 'gpt-5-mini@2026-08',
              latencyMs: 12,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              status: 'generated' as const,
            },
          },
        },
      ],
    }
    expect(validateProviderEvaluationRecord(base, supported, intended).provider).toBe('openai')
    expect(() =>
      validateProviderEvaluationRecord(
        {
          ...base,
          outputs: [
            {
              ...base.outputs[0],
              result: {
                ...base.outputs[0].result,
                meta: {
                  ...base.outputs[0].result.meta,
                  provider: 'disabled',
                  model: 'none@v1',
                  status: 'fallback' as const,
                  fallbackReason: 'provider_disabled',
                },
              },
            },
          ],
        },
        supported,
        intended
      )
    ).toThrow()
    expect(() =>
      validateProviderEvaluationRecord(
        {
          ...base,
          outputs: [
            {
              ...base.outputs[0],
              result: { ...base.outputs[0].result, meta: { ...base.outputs[0].result.meta, model: 'other' } },
            },
          ],
        },
        supported,
        intended
      )
    ).toThrow()
    expect(() =>
      validateProviderEvaluationRecord(
        {
          ...base,
          outputs: [
            {
              ...base.outputs[0],
              result: {
                ...base.outputs[0].result,
                meta: {
                  ...base.outputs[0].result.meta,
                  usage: { inputTokens: null, outputTokens: null, totalTokens: null },
                },
              },
            },
          ],
        },
        supported,
        intended
      )
    ).toThrow()
  })
  test('provider-quality gate requires every supported case to be generated', () => {
    const fixture = {
      id: 'one',
      category: 'supported',
      question: 'What needs attention?',
      expectedTool: 'attention',
      allowedCitationIds: [],
      maxLatencyMs: 10,
      maxTokens: 10,
      maxCostUsd: 1,
      tenant: { ownerId: 'o', teamId: 't' },
      records: {},
    }
    const outcome = {
      fixtureId: 'one',
      selectedTool: 'attention',
      claims: [],
      refusalCorrect: true,
      status: 'fallback' as const,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      provider: 'openai',
      modelVersion: 'gpt-5-mini@2026-08',
      isolationViolation: false,
    }
    const score = evaluateAiCases([fixture], [outcome], pricing, {
      provider: 'openai',
      modelVersion: 'gpt-5-mini@2026-08',
    })
    expect(releaseGate(score, { requireGeneratedSupported: true }).reasons).toContain('supported_generation_coverage')
  })
  test('provider-quality scoring uses recorded provider latency and fails above the fixture ceiling', async () => {
    const fixture = evaluationFixtureSchema.parse(fixtures).find((item) => item.id === 'attention-supported')!
    const outcomes = await runEvaluationHarness([fixture], {
      now: new Date('2026-08-08T12:00:00Z'),
      latencySource: 'recorded',
      generate: (async () => ({
        content: {
          sections: [{ heading: 'Attention', summary: 'Brake inspection overdue', citationIds: ['finding:f1'] }],
          claims: [],
          actions: [],
        },
        meta: {
          requestId: 'recorded-latency',
          provider: 'openai',
          model: 'gpt-5-mini@2026-08',
          latencyMs: fixture.maxLatencyMs + 1,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          status: 'generated',
        },
      })) as never,
    })
    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        status: 'generated',
        provider: 'openai',
        modelVersion: 'gpt-5-mini@2026-08',
        latencyMs: fixture.maxLatencyMs + 1,
        synthesisValid: true,
      })
    )
    const gate = releaseGate(
      evaluateAiCases([fixture], outcomes, pricing, { provider: 'openai', modelVersion: 'gpt-5-mini@2026-08' }),
      { requireGeneratedSupported: true }
    )
    expect(gate).toEqual({ passed: false, reasons: ['latency'] })
  })
})
