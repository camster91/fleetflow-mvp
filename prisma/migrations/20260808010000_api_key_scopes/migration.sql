ALTER TABLE "ApiKey"
    ADD COLUMN "scopes" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "ApiKey_key_idx";

CREATE TABLE "ApiRateLimit" (
    "keyId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("keyId", "bucketStart")
);

CREATE INDEX "ApiRateLimit_bucketStart_idx"
    ON "ApiRateLimit"("bucketStart");
