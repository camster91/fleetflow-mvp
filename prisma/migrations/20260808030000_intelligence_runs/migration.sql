CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceComplete" BOOLEAN NOT NULL,
    "findingsComplete" BOOLEAN NOT NULL,
    "reconciliationComplete" BOOLEAN NOT NULL,
    "evidenceComplete" BOOLEAN NOT NULL,
    "findingTotal" INTEGER NOT NULL,
    "sourceCounts" TEXT NOT NULL,

    CONSTRAINT "IntelligenceRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntelligenceRun_ownerId_teamId_idx"
    ON "IntelligenceRun"("ownerId", "teamId");
CREATE INDEX "IntelligenceRun_generatedAt_idx"
    ON "IntelligenceRun"("generatedAt");
ALTER TABLE "IntelligenceRun"
    ADD CONSTRAINT "IntelligenceRun_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntelligenceRun"
    ADD CONSTRAINT "IntelligenceRun_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
