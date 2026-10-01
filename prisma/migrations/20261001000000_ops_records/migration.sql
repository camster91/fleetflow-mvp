-- CreateTable
CREATE TABLE "OpsRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "reference" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsRecord_kind_performedAt_idx" ON "OpsRecord"("kind", "performedAt");
