ALTER TABLE "DocumentUpload"
  ADD COLUMN "uploadedBySnapshot" TEXT,
  ADD COLUMN "cleanupToken" TEXT,
  ADD COLUMN "cleanupClaimedAt" TIMESTAMP(3),
  ADD COLUMN "processingToken" TEXT,
  ADD COLUMN "processingLeaseUntil" TIMESTAMP(3);

UPDATE "DocumentUpload" d
SET "uploadedBySnapshot" = COALESCE(u."email", d."uploadedById")
FROM "User" u
WHERE u."id" = d."uploadedById";

UPDATE "DocumentUpload"
SET "uploadedBySnapshot" = "uploadedById"
WHERE "uploadedBySnapshot" IS NULL;

ALTER TABLE "DocumentUpload" ALTER COLUMN "uploadedBySnapshot" SET NOT NULL;
ALTER TABLE "DocumentUpload" ALTER COLUMN "uploadedById" DROP NOT NULL;
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentExecution" ADD COLUMN "confirmerSnapshot" TEXT;
UPDATE "DocumentExecution" e
SET "confirmerSnapshot" = COALESCE(u."email", e."confirmerId")
FROM "User" u
WHERE u."id" = e."confirmerId";
UPDATE "DocumentExecution" SET "confirmerSnapshot" = "confirmerId" WHERE "confirmerSnapshot" IS NULL;
ALTER TABLE "DocumentExecution" ALTER COLUMN "confirmerSnapshot" SET NOT NULL;
ALTER TABLE "DocumentExecution" ALTER COLUMN "confirmerId" DROP NOT NULL;
ALTER TABLE "DocumentExecution" ADD CONSTRAINT "DocumentExecution_confirmerId_fkey"
  FOREIGN KEY ("confirmerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DocumentUpload_status_cleanupClaimedAt_idx" ON "DocumentUpload"("status", "cleanupClaimedAt");
CREATE INDEX "DocumentUpload_status_processingLeaseUntil_idx" ON "DocumentUpload"("status", "processingLeaseUntil");
CREATE INDEX "DocumentUpload_uploadedById_createdAt_idx" ON "DocumentUpload"("uploadedById", "createdAt");
CREATE INDEX "DocumentExecution_confirmerId_createdAt_idx" ON "DocumentExecution"("confirmerId", "createdAt");
