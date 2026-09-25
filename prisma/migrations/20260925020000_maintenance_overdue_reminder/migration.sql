-- Track the one-time overdue maintenance reminder separately from the "due
-- soon" reminder. Previously both shared reminderSentAt, so a task reminded on
-- its due day (reminderSentAt > dueDate) never received its overdue reminder.

-- AlterTable
ALTER TABLE "MaintenanceTask" ADD COLUMN "overdueReminderSentAt" TIMESTAMP(3);

-- Backfill: a reminder claimed on or after the day following the due date was
-- the old overdue reminder, so do not send it a second time.
UPDATE "MaintenanceTask"
SET "overdueReminderSentAt" = "reminderSentAt"
WHERE "reminderSentAt" IS NOT NULL
  AND "reminderSentAt" >= "dueDate" + INTERVAL '1 day';
