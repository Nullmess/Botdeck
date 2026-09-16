-- Promote the previous Slash Studio lock into an explicit global read-only mode.
-- Non-destructive: keep commandStudioDisabled as a legacy compatibility flag.

ALTER TABLE "BotAccount" ADD COLUMN "readOnlyMode" BOOLEAN NOT NULL DEFAULT false;

UPDATE "BotAccount"
SET "readOnlyMode" = true
WHERE "commandStudioDisabled" = true;
