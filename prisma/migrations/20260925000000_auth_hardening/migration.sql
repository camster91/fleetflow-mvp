-- Session revocation: every issued JWT embeds this version. Existing tokens
-- without the claim are treated as version 0, so the default keeps current
-- sessions valid on deploy.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- TOTP replay protection: last accepted time step.
ALTER TABLE "User" ADD COLUMN "lastTotpStep" INTEGER;

-- Share links now store sha256(token) instead of the plaintext token. Existing
-- rows hold plaintext tokens that can never match a hash lookup, so remove them;
-- previously issued share links stop working and must be re-shared.
DELETE FROM "TaskShareLink";
