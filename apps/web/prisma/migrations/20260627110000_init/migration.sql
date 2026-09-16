-- Initial Botdeck SQLite schema.
-- Runtime applies this through `prisma migrate deploy` only.
-- Runtime schema changes must stay versioned and non-destructive.

CREATE TABLE "BotAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tokenCiphertext" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenAuthTag" TEXT NOT NULL,
    "discordUserId" TEXT,
    "avatarUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "commandStudioDisabled" BOOLEAN NOT NULL DEFAULT false,
    "lastConnectedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Guild" (
    "botAccountId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "id"),
    CONSTRAINT "Guild_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Channel" (
    "botAccountId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "id"),
    CONSTRAINT "Channel_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Channel_botAccountId_guildId_fkey" FOREIGN KEY ("botAccountId", "guildId") REFERENCES "Guild" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "User" (
    "botAccountId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "id"),
    CONSTRAINT "User_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Message" (
    "botAccountId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorTag" TEXT,
    "authorAvatarUrl" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "type" INTEGER,
    "attachmentsJson" TEXT,
    "embedsJson" TEXT,
    "reactionsJson" TEXT,
    "replyToMessageId" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY ("botAccountId", "id"),
    CONSTRAINT "Message_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_botAccountId_channelId_fkey" FOREIGN KEY ("botAccountId", "channelId") REFERENCES "Channel" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_botAccountId_authorId_fkey" FOREIGN KEY ("botAccountId", "authorId") REFERENCES "User" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Presence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activity" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Presence_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Presence_botAccountId_userId_fkey" FOREIGN KEY ("botAccountId", "userId") REFERENCES "User" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ApplicationCommandDefinition" (
    "botAccountId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "guildId" TEXT,
    "name" TEXT NOT NULL,
    "draftJson" TEXT NOT NULL,
    "runtimeJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "commandId"),
    CONSTRAINT "ApplicationCommandDefinition_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuildWelcomeConfig" (
    "botAccountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'message',
    "messageTemplate" TEXT NOT NULL,
    "embedPagesJson" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "guildId"),
    CONSTRAINT "GuildWelcomeConfig_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuildGoodbyeConfig" (
    "botAccountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'message',
    "messageTemplate" TEXT NOT NULL,
    "embedPagesJson" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "guildId"),
    CONSTRAINT "GuildGoodbyeConfig_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuildLogConfig" (
    "botAccountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "eventConfigsJson" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "guildId"),
    CONSTRAINT "GuildLogConfig_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuildRoleAutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botAccountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditionMode" TEXT NOT NULL DEFAULT 'all',
    "minMessages" INTEGER,
    "minVoiceSeconds" INTEGER,
    "minMemberAgeSeconds" INTEGER,
    "removeWhenInvalid" BOOLEAN NOT NULL DEFAULT false,
    "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
    "applyToExistingMembers" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuildRoleAutomationRule_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuildMemberActivity" (
    "botAccountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" DATETIME,
    "lastMessageAt" DATETIME,
    "lastVoiceAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "guildId", "userId"),
    CONSTRAINT "GuildMemberActivity_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "GuildVoiceSession" (
    "botAccountId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("botAccountId", "guildId", "userId"),
    CONSTRAINT "GuildVoiceSession_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Guild_botAccountId_updatedAt_idx" ON "Guild"("botAccountId", "updatedAt");
CREATE INDEX "Channel_botAccountId_guildId_idx" ON "Channel"("botAccountId", "guildId");
CREATE INDEX "Channel_botAccountId_updatedAt_idx" ON "Channel"("botAccountId", "updatedAt");
CREATE INDEX "User_botAccountId_updatedAt_idx" ON "User"("botAccountId", "updatedAt");
CREATE INDEX "Message_botAccountId_channelId_createdAt_idx" ON "Message"("botAccountId", "channelId", "createdAt");
CREATE INDEX "Message_botAccountId_channelId_system_createdAt_idx" ON "Message"("botAccountId", "channelId", "system", "createdAt");
CREATE INDEX "Message_botAccountId_authorId_idx" ON "Message"("botAccountId", "authorId");
CREATE INDEX "Message_botAccountId_createdAt_idx" ON "Message"("botAccountId", "createdAt");
CREATE UNIQUE INDEX "Presence_botAccountId_userId_key" ON "Presence"("botAccountId", "userId");
CREATE INDEX "Presence_botAccountId_userId_idx" ON "Presence"("botAccountId", "userId");
CREATE INDEX "BotAccount_enabled_idx" ON "BotAccount"("enabled");
CREATE INDEX "ApplicationCommandDefinition_botAccountId_scope_guildId_idx" ON "ApplicationCommandDefinition"("botAccountId", "scope", "guildId");
CREATE INDEX "ApplicationCommandDefinition_botAccountId_name_idx" ON "ApplicationCommandDefinition"("botAccountId", "name");
CREATE INDEX "GuildWelcomeConfig_botAccountId_channelId_idx" ON "GuildWelcomeConfig"("botAccountId", "channelId");
CREATE INDEX "GuildGoodbyeConfig_botAccountId_channelId_idx" ON "GuildGoodbyeConfig"("botAccountId", "channelId");
CREATE INDEX "GuildLogConfig_botAccountId_channelId_idx" ON "GuildLogConfig"("botAccountId", "channelId");
CREATE INDEX "GuildRoleAutomationRule_botAccountId_guildId_idx" ON "GuildRoleAutomationRule"("botAccountId", "guildId");
CREATE INDEX "GuildRoleAutomationRule_botAccountId_guildId_roleId_idx" ON "GuildRoleAutomationRule"("botAccountId", "guildId", "roleId");
CREATE INDEX "GuildMemberActivity_botAccountId_guildId_idx" ON "GuildMemberActivity"("botAccountId", "guildId");
CREATE INDEX "GuildMemberActivity_botAccountId_guildId_updatedAt_idx" ON "GuildMemberActivity"("botAccountId", "guildId", "updatedAt");
CREATE INDEX "GuildVoiceSession_botAccountId_guildId_idx" ON "GuildVoiceSession"("botAccountId", "guildId");
