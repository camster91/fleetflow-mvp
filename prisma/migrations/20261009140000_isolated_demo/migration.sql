CREATE TABLE "DemoSession" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userIds" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DemoSession_ownerId_key" ON "DemoSession"("ownerId");
CREATE UNIQUE INDEX "DemoSession_teamId_key" ON "DemoSession"("teamId");
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");
CREATE INDEX "DemoSession_createdAt_idx" ON "DemoSession"("createdAt");
