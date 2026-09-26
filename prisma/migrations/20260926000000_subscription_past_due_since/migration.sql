-- Start of the current past-due run, used for the 7-day payment grace period (#150).
ALTER TABLE "Subscription" ADD COLUMN "pastDueSince" TIMESTAMP(3);

-- Existing past-due subscriptions start their grace from the current billing period (best available signal).
UPDATE "Subscription"
SET "pastDueSince" = COALESCE("currentPeriodStart", "updatedAt")
WHERE "status" IN ('PAST_DUE', 'UNPAID');
