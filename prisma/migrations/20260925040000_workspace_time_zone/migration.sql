-- Per-workspace IANA time zone so server-side "today" (overdue checks,
-- maintenance reminders, dashboards) follows the fleet's local calendar day.
-- Team workspaces use Team.timeZone; personal workspaces use User.timeZone.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Toronto';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'America/Toronto';
