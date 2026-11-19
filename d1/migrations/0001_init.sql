-- Fleetvera D1 baseline generated from prisma/schema.prisma (sqlite).
PRAGMA foreign_keys = OFF;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'fleet_manager',
    "driverLicense" TEXT,
    "licenseExpiry" DATETIME,
    "availabilityStatus" TEXT DEFAULT 'Available',
    "company" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "verificationToken" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "backupCodes" TEXT,
    "lastTotpStep" INTEGER,
    "passwordResetToken" TEXT,
    "passwordResetExpires" DATETIME,
    "passwordChangedAt" DATETIME,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" DATETIME,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "googleId" TEXT,
    "microsoftId" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "notificationPreferences" TEXT DEFAULT '{}'
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    "deviceInfo" TEXT,
    "ipAddress" TEXT,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "logo" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "businessHours" TEXT,
    "branding" TEXT,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Toronto',
    CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "inviteeEmail" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invitedBy" TEXT,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '',
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiRateLimit" (
    "keyId" TEXT NOT NULL,
    "bucketStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("keyId", "bucketStart")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'PER_USER',
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" DATETIME,
    "currentPeriodStart" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "pastDueSince" DATETIME,
    "stripeLastEventId" TEXT,
    "stripeLastEventCreated" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "invoicePdf" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IntelligenceFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "score" INTEGER NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "action" TEXT,
    "actionUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "feedback" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "resolvedAt" DATETIME,
    CONSTRAINT "IntelligenceFinding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceFinding_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceComplete" BOOLEAN NOT NULL,
    "findingsComplete" BOOLEAN NOT NULL,
    "reconciliationComplete" BOOLEAN NOT NULL,
    "evidenceComplete" BOOLEAN NOT NULL,
    "findingTotal" INTEGER NOT NULL,
    "sourceCounts" TEXT NOT NULL,
    CONSTRAINT "IntelligenceRun_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntelligenceRun_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRiskFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "rubricVersion" TEXT NOT NULL,
    "scoreSnapshot" INTEGER NOT NULL,
    "bandSnapshot" TEXT NOT NULL,
    "sourceComplete" BOOLEAN NOT NULL,
    "completenessPercent" INTEGER NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "actionTaken" BOOLEAN NOT NULL,
    "outcomeCategory" TEXT,
    "notes" TEXT,
    "consentedAt" DATETIME NOT NULL,
    "submittedById" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceRiskFeedback_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRiskFeedback_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRiskFeedback_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRiskFeedback_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "driver" TEXT,
    "assignedDriverId" TEXT,
    "location" TEXT,
    "eta" TEXT,
    "mileage" INTEGER DEFAULT 0,
    "maintenanceDue" BOOLEAN NOT NULL DEFAULT false,
    "vehicleType" TEXT,
    "licensePlate" TEXT,
    "year" INTEGER,
    "fuelLevel" INTEGER DEFAULT 100,
    "lastService" DATETIME,
    "nextService" DATETIME,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Vehicle_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "driver" TEXT,
    "assignedDriverId" TEXT,
    "items" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "scheduledTime" DATETIME,
    "estimatedArrival" DATETIME,
    "completedTime" DATETIME,
    "parkingInstructions" TEXT,
    "dropoffInstructions" TEXT,
    "contactPerson" TEXT,
    "accessCodes" TEXT,
    "securityNotes" TEXT,
    "businessHours" TEXT,
    "specialRequirements" TEXT,
    "notes" TEXT,
    "vehicleId" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parkingLocation" TEXT,
    "dropoffLocation" TEXT,
    "photos" TEXT,
    CONSTRAINT "Delivery_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Delivery_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Delivery_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "createdBy" TEXT,
    CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vehicleName" TEXT,
    "dueDate" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedDate" DATETIME,
    "reminderSentAt" DATETIME,
    "overdueReminderSentAt" DATETIME,
    "notes" TEXT,
    "estimatedDuration" TEXT,
    "serviceProvider" TEXT,
    "costEstimate" REAL,
    "actualCost" REAL,
    "vehicleId" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "partsNeeded" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceTask_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "businessHours" TEXT,
    "securityNotes" TEXT,
    "notes" TEXT,
    "lastDeliveryDate" DATETIME,
    "deliveryFrequency" TEXT,
    "rating" INTEGER DEFAULT 5,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "contactPerson" TEXT,
    "preferredDeliveryTimes" TEXT,
    "accessCodes" TEXT,
    "specialRequirements" TEXT,
    "primaryLocation" TEXT,
    "parkingLocation" TEXT,
    "dropoffLocation" TEXT,
    "parkingInstructions" TEXT,
    "dropoffInstructions" TEXT,
    "locationPhotos" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Client_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SOPCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SOPCategory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SOPCategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VendingMachine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastService" DATETIME,
    "nextService" DATETIME,
    "machineType" TEXT,
    "serialNumber" TEXT,
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "driverNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VendingMachine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VendingMachine_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "teamId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActionExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "previewNonce" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "proposerId" TEXT NOT NULL,
    "confirmerId" TEXT NOT NULL,
    "sourceFindingId" TEXT,
    "actionType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DocumentUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedBySnapshot" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "scanStatus" TEXT NOT NULL,
    "extraction" TEXT,
    "reviewDraft" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "extractedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "cleanupToken" TEXT,
    "cleanupClaimedAt" DATETIME,
    "processingToken" TEXT,
    "processingLeaseUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentUpload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentUpload_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "confirmerId" TEXT,
    "confirmerSnapshot" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentExecution_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentUpload" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentExecution_confirmerId_fkey" FOREIGN KEY ("confirmerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "subtotal" REAL,
    "tax" REAL,
    "total" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "DocumentUpload" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'low',
    "type" TEXT NOT NULL DEFAULT 'general',
    "category" TEXT,
    "expiresAt" DATETIME,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "author" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Announcement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "usedAt" DATETIME,
    CONSTRAINT "TaskShareLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MaintenanceTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskShareLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "credentialEnvelope" TEXT,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "externalAccountRef" TEXT,
    "tokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "revokedAt" DATETIME,
    "lastSyncAt" DATETIME,
    "nextSyncAt" DATETIME,
    "lastErrorCode" TEXT,
    "syncCursor" TEXT,
    "lockToken" TEXT,
    "lockExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IntegrationConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationOAuthState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "redirectPath" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationOAuthState_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationSyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "lockToken" TEXT NOT NULL,
    "lockExpiresAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cursorBefore" TEXT,
    "cursorAfter" TEXT,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "remoteType" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "remoteUpdatedAt" DATETIME,
    "payloadHash" TEXT NOT NULL,
    "reviewPayload" TEXT,
    "provenance" TEXT NOT NULL,
    "localEntityType" TEXT,
    "localEntityId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "conflictReason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "outcome" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "lastErrorCode" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationRateLimit" (
    "actorId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "bucketStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("actorId", "scopeKey", "provider", "action", "bucketStart")
);

-- CreateTable
CREATE TABLE "IntegrationRecordReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payloadSnapshot" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerSnapshot" TEXT NOT NULL,
    "mappedVehicleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationRecordReview_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "IntegrationRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiWorkspaceConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "provider" TEXT NOT NULL DEFAULT 'disabled',
    "modelVersion" TEXT NOT NULL DEFAULT 'none@v1',
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiControlAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "configVersion" INTEGER NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiTelemetryBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "bucketStart" DATETIME NOT NULL,
    "provider" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL DEFAULT '',
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "latencyTotalMs" BIGINT NOT NULL DEFAULT 0,
    "inputTokens" BIGINT NOT NULL DEFAULT 0,
    "outputTokens" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiEvaluationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "configFingerprint" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "provider" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "citationAccuracyBps" INTEGER NOT NULL,
    "crossTenantFailures" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmailDeliveryConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "provider" TEXT NOT NULL DEFAULT 'mailgun',
    "apiKeyEnvelope" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verifiedDomain" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "configuredById" TEXT NOT NULL,
    "configuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "envelope" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PilotEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "pilotStartsAt" DATETIME,
    "pilotEndsAt" DATETIME,
    "consentedAt" DATETIME,
    "supportOwnerId" TEXT,
    "supportOwnerLabel" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PilotEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "actorId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PilotIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeKey" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceRetention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "readOnlySince" DATETIME NOT NULL,
    "warned30At" DATETIME,
    "warned7At" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceRetention_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpsRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "performedAt" DATETIME NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "reference" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_microsoftId_key" ON "User"("microsoftId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_microsoftId_idx" ON "User"("microsoftId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_idx" ON "LoginHistory"("userId");

-- CreateIndex
CREATE INDEX "LoginHistory_timestamp_idx" ON "LoginHistory"("timestamp");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_timestamp_idx" ON "LoginHistory"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "Team_ownerId_idx" ON "Team"("ownerId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_inviteeEmail_idx" ON "TeamMember"("inviteeEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "ApiRateLimit_bucketStart_idx" ON "ApiRateLimit"("bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_stripeInvoiceId_idx" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_processedAt_idx" ON "StripeWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "IntelligenceFinding_ownerId_teamId_status_severity_idx" ON "IntelligenceFinding"("ownerId", "teamId", "status", "severity");

-- CreateIndex
CREATE INDEX "IntelligenceFinding_ownerId_teamId_score_id_idx" ON "IntelligenceFinding"("ownerId", "teamId", "score" DESC, "id");

-- CreateIndex
CREATE INDEX "IntelligenceFinding_ownerId_teamId_status_score_id_idx" ON "IntelligenceFinding"("ownerId", "teamId", "status", "score" DESC, "id");

-- CreateIndex
CREATE INDEX "IntelligenceFinding_expiresAt_idx" ON "IntelligenceFinding"("expiresAt");

-- CreateIndex
CREATE INDEX "IntelligenceRun_ownerId_teamId_idx" ON "IntelligenceRun"("ownerId", "teamId");

-- CreateIndex
CREATE INDEX "IntelligenceRun_generatedAt_idx" ON "IntelligenceRun"("generatedAt");

-- CreateIndex
CREATE INDEX "MaintenanceRiskFeedback_ownerId_teamId_vehicleId_createdAt_idx" ON "MaintenanceRiskFeedback"("ownerId", "teamId", "vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRiskFeedback_rubricVersion_createdAt_idx" ON "MaintenanceRiskFeedback"("rubricVersion", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRiskFeedback_submittedById_createdAt_idx" ON "MaintenanceRiskFeedback"("submittedById", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRiskFeedback_expiresAt_idx" ON "MaintenanceRiskFeedback"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRiskFeedback_submit_scope_idem_key" ON "MaintenanceRiskFeedback"("submittedById", "scopeKey", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON "IdempotencyKey"("scope", "key");

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");

-- CreateIndex
CREATE INDEX "Vehicle_teamId_idx" ON "Vehicle"("teamId");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE INDEX "Vehicle_status_createdAt_idx" ON "Vehicle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_maintenanceDue_idx" ON "Vehicle"("maintenanceDue");

-- CreateIndex
CREATE INDEX "Vehicle_assignedDriverId_idx" ON "Vehicle"("assignedDriverId");

-- CreateIndex
CREATE INDEX "Delivery_ownerId_idx" ON "Delivery"("ownerId");

-- CreateIndex
CREATE INDEX "Delivery_teamId_idx" ON "Delivery"("teamId");

-- CreateIndex
CREATE INDEX "Delivery_vehicleId_idx" ON "Delivery"("vehicleId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Delivery_customer_idx" ON "Delivery"("customer");

-- CreateIndex
CREATE INDEX "Delivery_createdAt_idx" ON "Delivery"("createdAt");

-- CreateIndex
CREATE INDEX "Delivery_assignedDriverId_idx" ON "Delivery"("assignedDriverId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_deliveryId_idx" ON "DeliveryEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryEvent_timestamp_idx" ON "DeliveryEvent"("timestamp");

-- CreateIndex
CREATE INDEX "MaintenanceTask_ownerId_idx" ON "MaintenanceTask"("ownerId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_teamId_idx" ON "MaintenanceTask"("teamId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_vehicleId_idx" ON "MaintenanceTask"("vehicleId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_priority_idx" ON "MaintenanceTask"("priority");

-- CreateIndex
CREATE INDEX "MaintenanceTask_dueDate_idx" ON "MaintenanceTask"("dueDate");

-- CreateIndex
CREATE INDEX "MaintenanceTask_completed_idx" ON "MaintenanceTask"("completed");

-- CreateIndex
CREATE INDEX "MaintenanceTask_completed_dueDate_idx" ON "MaintenanceTask"("completed", "dueDate");

-- CreateIndex
CREATE INDEX "Client_ownerId_idx" ON "Client"("ownerId");

-- CreateIndex
CREATE INDEX "Client_teamId_idx" ON "Client"("teamId");

-- CreateIndex
CREATE INDEX "Client_type_idx" ON "Client"("type");

-- CreateIndex
CREATE INDEX "Client_name_idx" ON "Client"("name");

-- CreateIndex
CREATE INDEX "SOPCategory_ownerId_idx" ON "SOPCategory"("ownerId");

-- CreateIndex
CREATE INDEX "SOPCategory_teamId_idx" ON "SOPCategory"("teamId");

-- CreateIndex
CREATE INDEX "SOPCategory_name_idx" ON "SOPCategory"("name");

-- CreateIndex
CREATE INDEX "VendingMachine_ownerId_idx" ON "VendingMachine"("ownerId");

-- CreateIndex
CREATE INDEX "VendingMachine_teamId_idx" ON "VendingMachine"("teamId");

-- CreateIndex
CREATE INDEX "VendingMachine_status_idx" ON "VendingMachine"("status");

-- CreateIndex
CREATE INDEX "VendingMachine_location_idx" ON "VendingMachine"("location");

-- CreateIndex
CREATE INDEX "UserData_userId_idx" ON "UserData"("userId");

-- CreateIndex
CREATE INDEX "UserData_dataType_idx" ON "UserData"("dataType");

-- CreateIndex
CREATE UNIQUE INDEX "UserData_userId_dataType_key" ON "UserData"("userId", "dataType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_teamId_idx" ON "AuditLog"("teamId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionExecution_previewNonce_key" ON "ActionExecution"("previewNonce");

-- CreateIndex
CREATE INDEX "ActionExecution_ownerId_teamId_createdAt_idx" ON "ActionExecution"("ownerId", "teamId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionExecution_proposerId_createdAt_idx" ON "ActionExecution"("proposerId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionExecution_confirmerId_createdAt_idx" ON "ActionExecution"("confirmerId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionExecution_sourceFindingId_idx" ON "ActionExecution"("sourceFindingId");

-- CreateIndex
CREATE INDEX "ActionExecution_teamId_createdAt_idx" ON "ActionExecution"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentUpload_storageKey_key" ON "DocumentUpload"("storageKey");

-- CreateIndex
CREATE INDEX "DocumentUpload_ownerId_teamId_createdAt_idx" ON "DocumentUpload"("ownerId", "teamId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentUpload_expiresAt_deletedAt_idx" ON "DocumentUpload"("expiresAt", "deletedAt");

-- CreateIndex
CREATE INDEX "DocumentUpload_status_cleanupClaimedAt_idx" ON "DocumentUpload"("status", "cleanupClaimedAt");

-- CreateIndex
CREATE INDEX "DocumentUpload_status_processingLeaseUntil_idx" ON "DocumentUpload"("status", "processingLeaseUntil");

-- CreateIndex
CREATE INDEX "DocumentUpload_uploadedById_createdAt_idx" ON "DocumentUpload"("uploadedById", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentUpload_scopeKey_contentSha256_key" ON "DocumentUpload"("scopeKey", "contentSha256");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExecution_nonce_key" ON "DocumentExecution"("nonce");

-- CreateIndex
CREATE INDEX "DocumentExecution_documentId_createdAt_idx" ON "DocumentExecution"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentExecution_confirmerId_createdAt_idx" ON "DocumentExecution"("confirmerId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseRecord_ownerId_teamId_date_idx" ON "ExpenseRecord"("ownerId", "teamId", "date");

-- CreateIndex
CREATE INDEX "ExpenseRecord_vehicleId_idx" ON "ExpenseRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_sourceDocumentId_idx" ON "ExpenseRecord"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "Announcement_ownerId_idx" ON "Announcement"("ownerId");

-- CreateIndex
CREATE INDEX "Announcement_teamId_idx" ON "Announcement"("teamId");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskShareLink_token_key" ON "TaskShareLink"("token");

-- CreateIndex
CREATE INDEX "TaskShareLink_token_idx" ON "TaskShareLink"("token");

-- CreateIndex
CREATE INDEX "TaskShareLink_taskId_idx" ON "TaskShareLink"("taskId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_ownerId_teamId_idx" ON "IntegrationConnection"("ownerId", "teamId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_status_nextSyncAt_idx" ON "IntegrationConnection"("status", "nextSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_scopeKey_provider_key" ON "IntegrationConnection"("scopeKey", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationOAuthState_stateDigest_key" ON "IntegrationOAuthState"("stateDigest");

-- CreateIndex
CREATE INDEX "IntegrationOAuthState_connectionId_expiresAt_idx" ON "IntegrationOAuthState"("connectionId", "expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationSyncJob_status_createdAt_idx" ON "IntegrationSyncJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSyncJob_connectionId_idempotencyKey_key" ON "IntegrationSyncJob"("connectionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationRecord_connectionId_reviewStatus_idx" ON "IntegrationRecord"("connectionId", "reviewStatus");

-- CreateIndex
CREATE INDEX "IntegrationRecord_localEntityType_localEntityId_idx" ON "IntegrationRecord"("localEntityType", "localEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationRecord_connectionId_remoteType_remoteId_key" ON "IntegrationRecord"("connectionId", "remoteType", "remoteId");

-- CreateIndex
CREATE INDEX "IntegrationRateLimit_bucketStart_idx" ON "IntegrationRateLimit"("bucketStart");

-- CreateIndex
CREATE INDEX "IntegrationRecordReview_reviewerId_createdAt_idx" ON "IntegrationRecordReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationRecordReview_recordId_createdAt_idx" ON "IntegrationRecordReview"("recordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationRecordReview_recordId_revision_decision_key" ON "IntegrationRecordReview"("recordId", "revision", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "AiWorkspaceConfig_scopeKey_key" ON "AiWorkspaceConfig"("scopeKey");

-- CreateIndex
CREATE INDEX "AiWorkspaceConfig_ownerId_teamId_idx" ON "AiWorkspaceConfig"("ownerId", "teamId");

-- CreateIndex
CREATE INDEX "AiControlAudit_scopeKey_createdAt_idx" ON "AiControlAudit"("scopeKey", "createdAt");

-- CreateIndex
CREATE INDEX "AiControlAudit_actorId_createdAt_idx" ON "AiControlAudit"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiControlAudit_scopeKey_configVersion_key" ON "AiControlAudit"("scopeKey", "configVersion");

-- CreateIndex
CREATE INDEX "AiTelemetryBucket_scopeKey_bucketStart_idx" ON "AiTelemetryBucket"("scopeKey", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "AiTelemetryBucket_scopeKey_bucketStart_provider_modelVersion_st" ON "AiTelemetryBucket"("scopeKey", "bucketStart", "provider", "modelVersion", "status", "errorCode");

-- CreateIndex
CREATE INDEX "AiEvaluationRun_createdAt_idx" ON "AiEvaluationRun"("createdAt");

-- CreateIndex
CREATE INDEX "AiEvaluationRun_evaluationVersion_provider_modelVersion_idx" ON "AiEvaluationRun"("evaluationVersion", "provider", "modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "PilotEnrollment_scopeKey_key" ON "PilotEnrollment"("scopeKey");

-- CreateIndex
CREATE INDEX "PilotEnrollment_ownerId_teamId_idx" ON "PilotEnrollment"("ownerId", "teamId");

-- CreateIndex
CREATE INDEX "PilotEnrollment_status_pilotEndsAt_idx" ON "PilotEnrollment"("status", "pilotEndsAt");

-- CreateIndex
CREATE INDEX "PilotEvent_scopeKey_occurredAt_idx" ON "PilotEvent"("scopeKey", "occurredAt");

-- CreateIndex
CREATE INDEX "PilotEvent_actorId_occurredAt_idx" ON "PilotEvent"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "PilotEvent_expiresAt_idx" ON "PilotEvent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PilotEvent_scopeKey_actorId_sessionKey_eventType_key" ON "PilotEvent"("scopeKey", "actorId", "sessionKey", "eventType");

-- CreateIndex
CREATE INDEX "PilotIncident_scopeKey_occurredAt_idx" ON "PilotIncident"("scopeKey", "occurredAt");

-- CreateIndex
CREATE INDEX "PilotIncident_expiresAt_idx" ON "PilotIncident"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRetention_ownerId_key" ON "WorkspaceRetention"("ownerId");

-- CreateIndex
CREATE INDEX "OpsRecord_kind_performedAt_idx" ON "OpsRecord"("kind", "performedAt");
PRAGMA foreign_keys = ON;
