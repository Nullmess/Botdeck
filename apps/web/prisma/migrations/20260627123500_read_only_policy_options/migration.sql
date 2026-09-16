-- Optional read-only policy families.
-- Slash Studio and automation/template blocking remain mandatory when readOnlyMode is enabled.

ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockMessages" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockChannels" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockModeration" BOOLEAN NOT NULL DEFAULT false;
