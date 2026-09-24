-- Team deletion policy (docs/data-deletion-policy.md): a team cannot be deleted
-- while it still owns operational records. These foreign keys used ON DELETE
-- SET NULL, which silently moved team records into the team owner's personal
-- workspace. NO ACTION is checked at the end of the statement, so deleting the
-- team owner's account (which cascades both the team and the owner's records)
-- still succeeds, while deleting a team that still owns records is refused.

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_teamId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseRecord" DROP CONSTRAINT "ExpenseRecord_teamId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceTask" DROP CONSTRAINT "MaintenanceTask_teamId_fkey";

-- DropForeignKey
ALTER TABLE "SOPCategory" DROP CONSTRAINT "SOPCategory_teamId_fkey";

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_teamId_fkey";

-- DropForeignKey
ALTER TABLE "VendingMachine" DROP CONSTRAINT "VendingMachine_teamId_fkey";

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOPCategory" ADD CONSTRAINT "SOPCategory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendingMachine" ADD CONSTRAINT "VendingMachine_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- PasswordHistory rows belong to a user and are removed with it. Existing rows
-- for users that were already deleted are orphans and cannot satisfy the FK.
DELETE FROM "PasswordHistory" ph
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = ph."userId");

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
