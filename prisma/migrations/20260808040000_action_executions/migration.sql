CREATE TABLE "ActionExecution" (
  "id" TEXT NOT NULL,
  "previewNonce" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamId" TEXT,
  "proposerId" TEXT NOT NULL,
  "confirmerId" TEXT NOT NULL,
  "sourceFindingId" TEXT,
  "actionType" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActionExecution_previewNonce_key" ON "ActionExecution"("previewNonce");
CREATE INDEX "ActionExecution_ownerId_teamId_createdAt_idx" ON "ActionExecution"("ownerId", "teamId", "createdAt");
ALTER TABLE "ActionExecution" ADD CONSTRAINT "ActionExecution_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
