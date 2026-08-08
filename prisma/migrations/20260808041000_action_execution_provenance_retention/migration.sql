-- ActionExecution stores immutable identifier snapshots. Deliberately remove
-- the owner FK so account deletion cannot erase security/audit receipts.
ALTER TABLE "ActionExecution" DROP CONSTRAINT "ActionExecution_ownerId_fkey";

CREATE INDEX "ActionExecution_proposerId_createdAt_idx" ON "ActionExecution"("proposerId", "createdAt");
CREATE INDEX "ActionExecution_confirmerId_createdAt_idx" ON "ActionExecution"("confirmerId", "createdAt");
CREATE INDEX "ActionExecution_sourceFindingId_idx" ON "ActionExecution"("sourceFindingId");
CREATE INDEX "ActionExecution_teamId_createdAt_idx" ON "ActionExecution"("teamId", "createdAt");
