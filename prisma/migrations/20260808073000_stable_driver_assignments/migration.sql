ALTER TABLE "Vehicle" ADD COLUMN "assignedDriverId" TEXT;
ALTER TABLE "Delivery" ADD COLUMN "assignedDriverId" TEXT;

CREATE INDEX "Vehicle_assignedDriverId_idx" ON "Vehicle"("assignedDriverId");
CREATE INDEX "Delivery_assignedDriverId_idx" ON "Delivery"("assignedDriverId");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH candidates AS (
  SELECT v.id, MIN(u.id) AS "userId"
  FROM "Vehicle" v JOIN "User" u ON lower(trim(u.name)) = lower(trim(v.driver))
  WHERE v.driver IS NOT NULL AND EXISTS (SELECT 1 FROM "TeamMember" tm WHERE tm."teamId" = v."teamId" AND tm."userId" = u.id AND tm.status = 'ACCEPTED' AND tm.role = 'DRIVER')
  GROUP BY v.id HAVING COUNT(*) = 1
) UPDATE "Vehicle" v SET "assignedDriverId" = candidates."userId" FROM candidates WHERE v.id = candidates.id;

WITH candidates AS (
  SELECT d.id, MIN(u.id) AS "userId"
  FROM "Delivery" d JOIN "User" u ON lower(trim(u.name)) = lower(trim(d.driver))
  WHERE d.driver IS NOT NULL AND EXISTS (SELECT 1 FROM "TeamMember" tm WHERE tm."teamId" = d."teamId" AND tm."userId" = u.id AND tm.status = 'ACCEPTED' AND tm.role = 'DRIVER')
  GROUP BY d.id HAVING COUNT(*) = 1
) UPDATE "Delivery" d SET "assignedDriverId" = candidates."userId" FROM candidates WHERE d.id = candidates.id;
