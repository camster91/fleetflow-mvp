CREATE TABLE "MaintenanceRiskFeedback" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "scoreSnapshot" INTEGER NOT NULL,
    "bandSnapshot" TEXT NOT NULL,
    "sourceComplete" BOOLEAN NOT NULL,
    "completenessPercent" INTEGER NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "actionTaken" BOOLEAN NOT NULL,
    "outcomeCategory" TEXT,
    "notes" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceRiskFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceRiskFeedback_ownerId_teamId_vehicleId_createdAt_idx" ON "MaintenanceRiskFeedback"("ownerId", "teamId", "vehicleId", "createdAt");
CREATE INDEX "MaintenanceRiskFeedback_rubricVersion_createdAt_idx" ON "MaintenanceRiskFeedback"("rubricVersion", "createdAt");
CREATE INDEX "MaintenanceRiskFeedback_submittedById_createdAt_idx" ON "MaintenanceRiskFeedback"("submittedById", "createdAt");
ALTER TABLE "MaintenanceRiskFeedback" ADD CONSTRAINT "MaintenanceRiskFeedback_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRiskFeedback" ADD CONSTRAINT "MaintenanceRiskFeedback_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRiskFeedback" ADD CONSTRAINT "MaintenanceRiskFeedback_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRiskFeedback" ADD CONSTRAINT "MaintenanceRiskFeedback_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
