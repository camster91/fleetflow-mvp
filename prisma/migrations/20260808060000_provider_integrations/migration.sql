CREATE TABLE "IntegrationConnection" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "teamId" TEXT, "scopeKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL, "generation" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'DISCONNECTED', "credentialEnvelope" TEXT,
  "scopes" TEXT NOT NULL DEFAULT '[]', "externalAccountRef" TEXT, "tokenExpiresAt" TIMESTAMP(3), "refreshTokenExpiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3), "lastSyncAt" TIMESTAMP(3), "nextSyncAt" TIMESTAMP(3), "lastErrorCode" TEXT,
  "syncCursor" TEXT, "lockToken" TEXT, "lockExpiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntegrationOAuthState" (
  "id" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "stateDigest" TEXT NOT NULL, "generation" INTEGER NOT NULL,
  "redirectPath" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IntegrationOAuthState_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntegrationSyncJob" (
  "id" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "generation" INTEGER NOT NULL, "lockToken" TEXT NOT NULL, "lockExpiresAt" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "cursorBefore" TEXT, "cursorAfter" TEXT, "processedCount" INTEGER NOT NULL DEFAULT 0, "errorCode" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntegrationRecord" (
  "id" TEXT NOT NULL, "connectionId" TEXT NOT NULL, "remoteType" TEXT NOT NULL, "remoteId" TEXT NOT NULL,
  "remoteUpdatedAt" TIMESTAMP(3), "payloadHash" TEXT NOT NULL, "reviewPayload" TEXT, "provenance" TEXT NOT NULL,
  "localEntityType" TEXT, "localEntityId" TEXT, "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "conflictReason" TEXT, "revision" INTEGER NOT NULL DEFAULT 1, "outcome" TEXT, "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextRetryAt" TIMESTAMP(3), "lastErrorCode" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntegrationRateLimit" (
  "actorId" TEXT NOT NULL, "scopeKey" TEXT NOT NULL, "provider" TEXT NOT NULL, "action" TEXT NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL, "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "IntegrationRateLimit_pkey" PRIMARY KEY ("actorId", "scopeKey", "provider", "action", "bucketStart")
);
CREATE TABLE "IntegrationRecordReview" (
  "id" TEXT NOT NULL, "recordId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "decision" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL, "payloadSnapshot" TEXT NOT NULL, "reviewerId" TEXT NOT NULL, "reviewerSnapshot" TEXT NOT NULL,
  "mappedVehicleId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationRecordReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationConnection_scopeKey_provider_key" ON "IntegrationConnection"("scopeKey", "provider");
CREATE INDEX "IntegrationConnection_ownerId_teamId_idx" ON "IntegrationConnection"("ownerId", "teamId");
CREATE INDEX "IntegrationConnection_status_nextSyncAt_idx" ON "IntegrationConnection"("status", "nextSyncAt");
CREATE UNIQUE INDEX "IntegrationOAuthState_stateDigest_key" ON "IntegrationOAuthState"("stateDigest");
CREATE INDEX "IntegrationOAuthState_connectionId_expiresAt_idx" ON "IntegrationOAuthState"("connectionId", "expiresAt");
CREATE UNIQUE INDEX "IntegrationSyncJob_connectionId_idempotencyKey_key" ON "IntegrationSyncJob"("connectionId", "idempotencyKey");
CREATE INDEX "IntegrationSyncJob_status_createdAt_idx" ON "IntegrationSyncJob"("status", "createdAt");
CREATE UNIQUE INDEX "IntegrationRecord_connectionId_remoteType_remoteId_key" ON "IntegrationRecord"("connectionId", "remoteType", "remoteId");
CREATE INDEX "IntegrationRecord_connectionId_reviewStatus_idx" ON "IntegrationRecord"("connectionId", "reviewStatus");
CREATE INDEX "IntegrationRecord_localEntityType_localEntityId_idx" ON "IntegrationRecord"("localEntityType", "localEntityId");
CREATE UNIQUE INDEX "IntegrationRecordReview_recordId_revision_decision_key" ON "IntegrationRecordReview"("recordId", "revision", "decision");
CREATE INDEX "IntegrationRecordReview_reviewerId_createdAt_idx" ON "IntegrationRecordReview"("reviewerId", "createdAt");
CREATE INDEX "IntegrationRecordReview_recordId_createdAt_idx" ON "IntegrationRecordReview"("recordId", "createdAt");
CREATE INDEX "IntegrationRateLimit_bucketStart_idx" ON "IntegrationRateLimit"("bucketStart");
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationOAuthState" ADD CONSTRAINT "IntegrationOAuthState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationRecord" ADD CONSTRAINT "IntegrationRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationRecordReview" ADD CONSTRAINT "IntegrationRecordReview_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "IntegrationRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
