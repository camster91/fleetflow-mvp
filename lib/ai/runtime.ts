import { prisma } from '@/lib/prisma'
import type { TenantContext } from '@/lib/apiAuth'
import {
  aiTelemetryEventSchema,
  resolveAiRuntimeControl,
  providerReadiness,
  telemetryRetentionCutoff,
  type AiTelemetryEvent,
} from './telemetry'

const scopeKey = (tenant: Pick<TenantContext, 'ownerId' | 'teamId'>) =>
  tenant.teamId ? `team:${tenant.teamId}` : `owner:${tenant.ownerId}`

export async function getWorkspaceAiRuntime(
  tenant: Pick<TenantContext, 'ownerId' | 'teamId'>,
  env: Record<string, string | undefined> = process.env
) {
  const stored = await prisma.aiWorkspaceConfig.findUnique({
    where: { scopeKey: scopeKey(tenant) },
    select: { enabled: true, killSwitch: true, retentionDays: true, provider: true, modelVersion: true },
  })
  const config = stored ?? {
    enabled: false,
    killSwitch: false,
    retentionDays: 30,
    provider: 'disabled',
    modelVersion: 'none@v1',
  }
  const control = resolveAiRuntimeControl(config, env),
    readiness = providerReadiness(config.provider, config.modelVersion, env)
  return {
    ...(control.enabled && !readiness.ready ? { enabled: false as const, reason: readiness.reason } : control),
    config: { provider: config.provider, modelVersion: config.modelVersion, retentionDays: config.retentionDays },
  }
}

export async function recordWorkspaceAiTelemetry(
  event: Omit<AiTelemetryEvent, 'occurredAt'> & { occurredAt?: string },
  tenant: Pick<TenantContext, 'ownerId' | 'teamId'>,
  now = new Date()
): Promise<void> {
  const parsed = aiTelemetryEventSchema.parse({ ...event, occurredAt: event.occurredAt ?? now.toISOString() })
  const bucketStart = new Date(parsed.occurredAt)
  bucketStart.setUTCMinutes(0, 0, 0)
  const key = {
    scopeKey_bucketStart_provider_modelVersion_status_errorCode: {
      scopeKey: scopeKey(tenant),
      bucketStart,
      provider: parsed.provider,
      modelVersion: parsed.modelVersion,
      status: parsed.status,
      errorCode: parsed.errorCode ?? '',
    },
  }
  await prisma.aiTelemetryBucket.upsert({
    where: key,
    create: {
      ...key.scopeKey_bucketStart_provider_modelVersion_status_errorCode,
      requestCount: 1,
      latencyTotalMs: BigInt(parsed.latencyMs),
      inputTokens: BigInt(parsed.inputTokens ?? 0),
      outputTokens: BigInt(parsed.outputTokens ?? 0),
    },
    update: {
      requestCount: { increment: 1 },
      latencyTotalMs: { increment: BigInt(parsed.latencyMs) },
      inputTokens: { increment: BigInt(parsed.inputTokens ?? 0) },
      outputTokens: { increment: BigInt(parsed.outputTokens ?? 0) },
    },
  })
}

export async function cleanupWorkspaceAiTelemetry(
  tenant: Pick<TenantContext, 'ownerId' | 'teamId'>,
  retentionDays: number,
  now = new Date()
) {
  return prisma.aiTelemetryBucket.deleteMany({
    where: { scopeKey: scopeKey(tenant), bucketStart: { lt: telemetryRetentionCutoff(now, retentionDays) } },
  })
}
