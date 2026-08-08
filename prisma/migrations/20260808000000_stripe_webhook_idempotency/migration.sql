-- Stripe retries webhook deliveries. Persist the provider event ID so each
-- event can transition subscription state at most once.
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StripeWebhookEvent_processedAt_idx"
    ON "StripeWebhookEvent"("processedAt");

-- Track the newest applied Stripe event so delayed deliveries cannot regress
-- or resurrect subscription state.
ALTER TABLE "Subscription"
    ADD COLUMN "stripeLastEventId" TEXT,
    ADD COLUMN "stripeLastEventCreated" INTEGER;

-- Existing invoice values were stored as major-unit floating point numbers.
-- Convert them once to exact provider minor units.
ALTER TABLE "Invoice"
    ALTER COLUMN "amount" TYPE INTEGER
    USING ROUND("amount" * 100)::INTEGER;
