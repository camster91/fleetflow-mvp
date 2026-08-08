ALTER TABLE "MaintenanceRiskFeedback" ADD COLUMN "scopeKey" TEXT;
ALTER TABLE "MaintenanceRiskFeedback" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "MaintenanceRiskFeedback" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "MaintenanceRiskFeedback" SET "scopeKey" = CASE WHEN "teamId" IS NULL THEN 'owner:' || "ownerId" ELSE 'team:' || "teamId" END, "idempotencyKey" = 'legacy:' || "id", "expiresAt" = "createdAt" + INTERVAL '180 days';
ALTER TABLE "MaintenanceRiskFeedback" ALTER COLUMN "scopeKey" SET NOT NULL;
ALTER TABLE "MaintenanceRiskFeedback" ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "MaintenanceRiskFeedback" ALTER COLUMN "expiresAt" SET NOT NULL;
CREATE UNIQUE INDEX "MaintenanceRiskFeedback_submit_scope_idem_key" ON "MaintenanceRiskFeedback"("submittedById", "scopeKey", "idempotencyKey");
CREATE INDEX "MaintenanceRiskFeedback_expiresAt_idx" ON "MaintenanceRiskFeedback"("expiresAt");
