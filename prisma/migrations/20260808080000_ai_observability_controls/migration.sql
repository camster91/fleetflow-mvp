CREATE TABLE "AiWorkspaceConfig" (
  "id" TEXT NOT NULL, "scopeKey" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "teamId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "killSwitch" BOOLEAN NOT NULL DEFAULT false,
  "retentionDays" INTEGER NOT NULL DEFAULT 30, "provider" TEXT NOT NULL DEFAULT 'disabled',
  "modelVersion" TEXT NOT NULL DEFAULT 'none@v1', "configVersion" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AiWorkspaceConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiWorkspaceConfig_scopeKey_key" ON "AiWorkspaceConfig"("scopeKey");
CREATE INDEX "AiWorkspaceConfig_ownerId_teamId_idx" ON "AiWorkspaceConfig"("ownerId", "teamId");

CREATE TABLE "AiControlAudit" (
  "id" TEXT NOT NULL, "scopeKey" TEXT NOT NULL, "actorId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "configVersion" INTEGER NOT NULL, "metadata" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiControlAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiControlAudit_scopeKey_createdAt_idx" ON "AiControlAudit"("scopeKey", "createdAt");
CREATE INDEX "AiControlAudit_actorId_createdAt_idx" ON "AiControlAudit"("actorId", "createdAt");
CREATE UNIQUE INDEX "AiControlAudit_scopeKey_configVersion_key" ON "AiControlAudit"("scopeKey", "configVersion");

CREATE TABLE "AiTelemetryBucket" (
  "id" TEXT NOT NULL, "scopeKey" TEXT NOT NULL, "bucketStart" TIMESTAMP(3) NOT NULL,
  "provider" TEXT NOT NULL, "modelVersion" TEXT NOT NULL, "status" TEXT NOT NULL, "errorCode" TEXT NOT NULL DEFAULT '',
  "requestCount" INTEGER NOT NULL DEFAULT 0, "latencyTotalMs" BIGINT NOT NULL DEFAULT 0,
  "inputTokens" BIGINT NOT NULL DEFAULT 0, "outputTokens" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiTelemetryBucket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiTelemetryBucket_scopeKey_bucketStart_provider_modelVersion_status_errorCode_key" ON "AiTelemetryBucket"("scopeKey", "bucketStart", "provider", "modelVersion", "status", "errorCode");
CREATE INDEX "AiTelemetryBucket_scopeKey_bucketStart_idx" ON "AiTelemetryBucket"("scopeKey", "bucketStart");

CREATE TABLE "AiEvaluationRun" (
  "id" TEXT NOT NULL, "evaluationVersion" TEXT NOT NULL, "mode" TEXT NOT NULL, "configFingerprint" TEXT NOT NULL, "capturedAt" TIMESTAMP(3) NOT NULL, "provider" TEXT NOT NULL, "modelVersion" TEXT NOT NULL,
  "citationAccuracyBps" INTEGER NOT NULL, "crossTenantFailures" INTEGER NOT NULL, "passed" BOOLEAN NOT NULL,
  "score" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiEvaluationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiEvaluationRun_createdAt_idx" ON "AiEvaluationRun"("createdAt");
CREATE INDEX "AiEvaluationRun_evaluationVersion_provider_modelVersion_idx" ON "AiEvaluationRun"("evaluationVersion", "provider", "modelVersion");

ALTER TABLE "AiWorkspaceConfig" ADD CONSTRAINT "AiWorkspaceConfig_retentionDays_check" CHECK ("retentionDays" BETWEEN 7 AND 90);
ALTER TABLE "AiWorkspaceConfig" ADD CONSTRAINT "AiWorkspaceConfig_configVersion_check" CHECK ("configVersion" > 0);
ALTER TABLE "AiTelemetryBucket" ADD CONSTRAINT "AiTelemetryBucket_nonnegative_check" CHECK ("requestCount" >= 0 AND "latencyTotalMs" >= 0 AND "inputTokens" >= 0 AND "outputTokens" >= 0);
ALTER TABLE "AiEvaluationRun" ADD CONSTRAINT "AiEvaluationRun_scores_check" CHECK ("citationAccuracyBps" BETWEEN 0 AND 10000 AND "crossTenantFailures" >= 0);
