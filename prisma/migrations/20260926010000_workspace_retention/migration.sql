-- Deletion timeline for lapsed (read-only) workspaces (#150): 30- and 7-day warnings, deletion after 90 days.
-- CreateTable
CREATE TABLE "WorkspaceRetention" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "readOnlySince" TIMESTAMP(3) NOT NULL,
    "warned30At" TIMESTAMP(3),
    "warned7At" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceRetention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRetention_ownerId_key" ON "WorkspaceRetention"("ownerId");

-- AddForeignKey
ALTER TABLE "WorkspaceRetention" ADD CONSTRAINT "WorkspaceRetention_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

