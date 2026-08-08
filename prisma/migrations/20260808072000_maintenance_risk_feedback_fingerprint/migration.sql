ALTER TABLE "MaintenanceRiskFeedback" ADD COLUMN "requestHash" TEXT;
UPDATE "MaintenanceRiskFeedback" SET "requestHash" = 'legacy:' || "id";
ALTER TABLE "MaintenanceRiskFeedback" ALTER COLUMN "requestHash" SET NOT NULL;
