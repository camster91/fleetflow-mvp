CREATE TABLE "TaskShareLink" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "token"     TEXT NOT NULL UNIQUE,
  "taskId"    TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt"    DATETIME,
  CONSTRAINT "TaskShareLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MaintenanceTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskShareLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaskShareLink_token_idx" ON "TaskShareLink"("token");
CREATE INDEX "TaskShareLink_taskId_idx" ON "TaskShareLink"("taskId");
