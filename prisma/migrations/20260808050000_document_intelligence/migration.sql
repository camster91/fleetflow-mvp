CREATE TABLE "DocumentUpload" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "teamId" TEXT, "scopeKey" TEXT NOT NULL, "uploadedById" TEXT NOT NULL,
  "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "byteSize" INTEGER NOT NULL,
  "contentSha256" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "scanStatus" TEXT NOT NULL, "extraction" TEXT, "reviewDraft" TEXT, "revision" INTEGER NOT NULL DEFAULT 1,
  "extractedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentUpload_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DocumentExecution" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "nonce" TEXT NOT NULL, "confirmerId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL, "result" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentUpload_storageKey_key" ON "DocumentUpload"("storageKey");
CREATE UNIQUE INDEX "DocumentUpload_scopeKey_contentSha256_key" ON "DocumentUpload"("scopeKey", "contentSha256");
CREATE INDEX "DocumentUpload_ownerId_teamId_createdAt_idx" ON "DocumentUpload"("ownerId", "teamId", "createdAt");
CREATE INDEX "DocumentUpload_expiresAt_deletedAt_idx" ON "DocumentUpload"("expiresAt", "deletedAt");
CREATE UNIQUE INDEX "DocumentExecution_nonce_key" ON "DocumentExecution"("nonce");
CREATE INDEX "DocumentExecution_documentId_createdAt_idx" ON "DocumentExecution"("documentId", "createdAt");
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentUpload" ADD CONSTRAINT "DocumentUpload_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentExecution" ADD CONSTRAINT "DocumentExecution_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "ExpenseRecord" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "teamId" TEXT, "vehicleId" TEXT NOT NULL, "vendor" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL, "category" TEXT NOT NULL, "subtotal" DOUBLE PRECISION, "tax" DOUBLE PRECISION,
  "total" DOUBLE PRECISION NOT NULL, "description" TEXT NOT NULL, "sourceDocumentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExpenseRecord_ownerId_teamId_date_idx" ON "ExpenseRecord"("ownerId", "teamId", "date");
CREATE INDEX "ExpenseRecord_vehicleId_idx" ON "ExpenseRecord"("vehicleId");
CREATE INDEX "ExpenseRecord_sourceDocumentId_idx" ON "ExpenseRecord"("sourceDocumentId");
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "DocumentUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
