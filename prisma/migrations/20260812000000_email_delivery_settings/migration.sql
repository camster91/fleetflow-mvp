CREATE TABLE "EmailDeliveryConfig" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "provider" TEXT NOT NULL DEFAULT 'mailgun',
  "apiKeyEnvelope" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "verifiedDomain" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "configuredById" TEXT NOT NULL,
  "configuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailDeliveryConfig_pkey" PRIMARY KEY ("id")
);
