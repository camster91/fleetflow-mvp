CREATE TABLE "IntelligenceFinding" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "action" TEXT,
    "actionUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "feedback" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IntelligenceFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntelligenceFinding_ownerId_teamId_status_severity_idx"
    ON "IntelligenceFinding"("ownerId", "teamId", "status", "severity");
CREATE INDEX "IntelligenceFinding_ownerId_teamId_score_id_idx"
    ON "IntelligenceFinding"("ownerId", "teamId", "score" DESC, "id" ASC);
CREATE INDEX "IntelligenceFinding_ownerId_teamId_status_score_id_idx"
    ON "IntelligenceFinding"("ownerId", "teamId", "status", "score" DESC, "id" ASC);
CREATE INDEX "IntelligenceFinding_expiresAt_idx"
    ON "IntelligenceFinding"("expiresAt");

ALTER TABLE "IntelligenceFinding"
    ADD CONSTRAINT "IntelligenceFinding_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntelligenceFinding"
    ADD CONSTRAINT "IntelligenceFinding_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
