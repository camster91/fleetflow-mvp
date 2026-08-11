-- Controlled-pilot operations are tenant-scoped and intentionally content-free.
CREATE TABLE "PilotEnrollment" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "pilotStartsAt" TIMESTAMP(3),
  "pilotEndsAt" TIMESTAMP(3),
  "consentedAt" TIMESTAMP(3),
  "supportOwnerId" TEXT,
  "supportOwnerLabel" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotEnrollment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PilotEnrollment_scopeKey_key" ON "PilotEnrollment"("scopeKey");
CREATE INDEX "PilotEnrollment_ownerId_teamId_idx" ON "PilotEnrollment"("ownerId", "teamId");
CREATE INDEX "PilotEnrollment_status_pilotEndsAt_idx" ON "PilotEnrollment"("status", "pilotEndsAt");

CREATE TABLE "PilotEvent" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamId" TEXT,
  "actorId" TEXT NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PilotEvent_scopeKey_actorId_sessionKey_eventType_key" ON "PilotEvent"("scopeKey", "actorId", "sessionKey", "eventType");
CREATE INDEX "PilotEvent_scopeKey_occurredAt_idx" ON "PilotEvent"("scopeKey", "occurredAt");
CREATE INDEX "PilotEvent_actorId_occurredAt_idx" ON "PilotEvent"("actorId", "occurredAt");
CREATE INDEX "PilotEvent_expiresAt_idx" ON "PilotEvent"("expiresAt");

CREATE TABLE "PilotIncident" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "teamId" TEXT,
  "severity" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PilotIncident_scopeKey_occurredAt_idx" ON "PilotIncident"("scopeKey", "occurredAt");
CREATE INDEX "PilotIncident_expiresAt_idx" ON "PilotIncident"("expiresAt");
