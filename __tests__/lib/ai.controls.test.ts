import { providerReadiness, resolveAiRuntimeControl, workspaceAiSettingsSchema } from '@/lib/ai/telemetry'

describe('AI runtime controls', () => {
  test('defaults disabled and clamps retention', () => {
    expect(workspaceAiSettingsSchema.parse({})).toEqual({ enabled: false, retentionDays: 30 })
    expect(workspaceAiSettingsSchema.parse({ enabled: true, retentionDays: 90 })).toEqual({ enabled: true, retentionDays: 90 })
  })

  test('environment and durable kill switches prevent provider calls deterministically', () => {
    expect(resolveAiRuntimeControl({ enabled: true, killSwitch: false }, { AI_KILL_SWITCH: 'true' })).toEqual({ enabled: false, reason: 'global_kill_switch' })
    expect(resolveAiRuntimeControl({ enabled: true, killSwitch: true }, {})).toEqual({ enabled: false, reason: 'workspace_kill_switch' })
    expect(resolveAiRuntimeControl({ enabled: false, killSwitch: false }, {})).toEqual({ enabled: false, reason: 'workspace_disabled' })
    expect(resolveAiRuntimeControl({ enabled: true, killSwitch: false }, {})).toEqual({ enabled: true })
  })

  test('provider readiness fails closed for disabled, unknown, missing, and mismatched configuration', () => {
    expect(providerReadiness('disabled', 'none@v1', {})).toEqual({ ready: false, reason: 'provider_disabled' })
    expect(providerReadiness('invented', 'model@v1', {})).toEqual({ ready: false, reason: 'provider_misconfigured' })
    expect(providerReadiness('openai', 'gpt-5-mini@2026-08', { OPENAI_MODEL: 'gpt-5-mini@2026-08' })).toEqual({ ready: false, reason: 'provider_misconfigured' })
    expect(providerReadiness('openai', 'gpt-5-mini@2026-08', { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'other' })).toEqual({ ready: false, reason: 'provider_misconfigured' })
    expect(providerReadiness('openai', 'gpt-5-mini@2026-08', { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'gpt-5-mini@2026-08' })).toEqual({ ready: true })
  })
})
