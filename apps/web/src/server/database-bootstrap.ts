// Init SQLite/Prisma

import { configureDatabaseUrl } from "@/lib/database-url";
import { prisma } from "@/lib/prisma";
import { backupDatabaseBeforeMigration } from "./database-backups";
import { hasColumn, hasTable, listApplicationTables, listAppliedMigrations } from "./database-introspection";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

let bootstrapPromise: Promise<void> | null = null;

const ROLE_AUTOMATION_MAX_MESSAGES = 1_000_000;
const ROLE_AUTOMATION_MAX_VOICE_SECONDS = 1_000_000 * 60;
const ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS = 20_000 * 86_400;

// Prépare le dossier SQLite.
function ensureSqliteDirectoryExists(): void {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl?.startsWith("file:")) return;

	const sqlitePath = databaseUrl.slice("file:".length);
	if (!sqlitePath || sqlitePath.startsWith(":")) return;

	const normalizedPath = sqlitePath.replace(/\\/g, "/");
	if (normalizedPath.startsWith("./") || normalizedPath.startsWith("../")) return;

	mkdirSync(dirname(normalizedPath), { recursive: true });
}

// Localise le schema Prisma.
function schemaPath(): string {
	const projectRoot = process.env.BOTDECK_PROJECT_DIR;
	const candidates = [
		projectRoot ? join(projectRoot, "apps", "web", "prisma", "schema.prisma") : null,
		join(/* turbopackIgnore: true */ process.cwd(), "prisma", "schema.prisma"),
		join(/* turbopackIgnore: true */ process.cwd(), "apps", "web", "prisma", "schema.prisma")
	].filter(Boolean) as string[];
	const match = candidates.find((candidate) => existsSync(candidate));
	if (!match) throw new Error(`Unable to locate Prisma schema. Looked in: ${candidates.join(", ")}`);
	return match;
}

// Trouve le CLI Prisma.
function prismaCliPath(): string {
	const projectRoot = process.env.BOTDECK_PROJECT_DIR;
	const candidates = [
		projectRoot ? join(projectRoot, "node_modules", "prisma", "build", "index.js") : null,
		join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "prisma", "build", "index.js")
	].filter(Boolean) as string[];
	const match = candidates.find((candidate) => existsSync(candidate));
	if (!match) throw new Error(`Unable to locate Prisma CLI. Looked in: ${candidates.join(", ")}`);
	return match;
}

// Répare les anciennes valeurs Role Automation qui peuvent dépasser le type Int Prisma.
// SQLite accepte de très grands entiers, mais Prisma Int refuse de les lire.
async function sanitizeRoleAutomationStorage(): Promise<void> {
	try {
		if (!(await hasTable("GuildRoleAutomationRule"))) return;
		const hasMinMessages = await hasColumn("GuildRoleAutomationRule", "minMessages");
		const hasMinVoiceSeconds = await hasColumn("GuildRoleAutomationRule", "minVoiceSeconds");
		const hasMinMemberAgeSeconds = await hasColumn("GuildRoleAutomationRule", "minMemberAgeSeconds");
		if (hasMinMessages) {
			await prisma.$executeRawUnsafe(
				'UPDATE "GuildRoleAutomationRule" SET "minMessages" = NULL WHERE "minMessages" IS NOT NULL AND ("minMessages" < 0 OR "minMessages" > ?)',
				ROLE_AUTOMATION_MAX_MESSAGES
			);
		}
		if (hasMinVoiceSeconds) {
			await prisma.$executeRawUnsafe(
				'UPDATE "GuildRoleAutomationRule" SET "minVoiceSeconds" = NULL WHERE "minVoiceSeconds" IS NOT NULL AND ("minVoiceSeconds" < 0 OR "minVoiceSeconds" > ?)',
				ROLE_AUTOMATION_MAX_VOICE_SECONDS
			);
		}
		if (hasMinMemberAgeSeconds) {
			await prisma.$executeRawUnsafe(
				'UPDATE "GuildRoleAutomationRule" SET "minMemberAgeSeconds" = NULL WHERE "minMemberAgeSeconds" IS NOT NULL AND ("minMemberAgeSeconds" < 0 OR "minMemberAgeSeconds" > ?)',
				ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS
			);
		}
	} catch (error) {
		console.warn("[botdeck:db] Role automation storage cleanup skipped", error instanceof Error ? error.message : error);
	}
}

// Vérifie le schéma messages.
async function hasMessageColumn(columnName: string): Promise<boolean> {
	return hasColumn("Message", columnName);
}

// Règle SQLite pour le desktop.
// Certains PRAGMA SQLite, comme journal_mode, renvoient une ligne de résultat.
// Prisma refuse ces statements via $executeRawUnsafe, donc on les applique
// par $queryRawUnsafe pour éviter un faux log d’erreur au démarrage.
async function applySqlitePragma(statement: string): Promise<void> {
	await prisma.$queryRawUnsafe(statement);
}

async function tuneSqliteConnection(): Promise<void> {
	try {
		await applySqlitePragma("PRAGMA journal_mode = WAL");
		await applySqlitePragma("PRAGMA synchronous = NORMAL");
		await applySqlitePragma("PRAGMA busy_timeout = 5000");
		await applySqlitePragma("PRAGMA temp_store = MEMORY");
	} catch (error) {
		console.warn("[botdeck:db] SQLite tuning skipped", error instanceof Error ? error.message : error);
	}
}

// Valide le schéma attendu.
async function hasExpectedSchema(): Promise<boolean> {
	const expected = ["authorTag", "authorAvatarUrl", "pinned", "type", "attachmentsJson", "embedsJson", "reactionsJson", "replyToMessageId", "system"];
	const messageColumns = await Promise.all(expected.map((column) => hasMessageColumn(column)));
	return messageColumns.every(Boolean)
		&& (await hasTable("ApplicationCommandDefinition"))
		&& (await hasTable("GuildWelcomeConfig"))
		&& (await hasColumn("GuildWelcomeConfig", "messageType"))
		&& (await hasColumn("GuildWelcomeConfig", "embedPagesJson"))
		&& (await hasTable("GuildGoodbyeConfig"))
		&& (await hasColumn("GuildGoodbyeConfig", "messageType"))
		&& (await hasColumn("GuildGoodbyeConfig", "embedPagesJson"))
		&& (await hasTable("GuildLogConfig"))
		&& (await hasColumn("GuildLogConfig", "eventConfigsJson"))
		&& (await hasTable("GuildRoleAutomationRule"))
		&& (await hasColumn("GuildRoleAutomationRule", "minMessages"))
		&& (await hasColumn("GuildRoleAutomationRule", "applyToExistingMembers"))
		&& (await hasTable("GuildMemberActivity"))
		&& (await hasColumn("GuildMemberActivity", "voiceSeconds"))
		&& (await hasTable("GuildVoiceSession"))
		&& (await hasColumn("GuildVoiceSession", "startedAt"))
		&& (await hasColumn("BotAccount", "commandStudioDisabled"))
		&& (await hasColumn("BotAccount", "readOnlyMode"))
		&& (await hasColumn("BotAccount", "readOnlyBlockMessages"))
		&& (await hasColumn("BotAccount", "readOnlyBlockChannels"))
		&& (await hasColumn("BotAccount", "readOnlyBlockModeration"));
}

// Dossier des migrations Prisma.
function migrationsPath(): string {
	return join(dirname(schemaPath()), "migrations");
}

// Liste les migrations locales disponibles.
function localMigrationNames(): string[] {
	const directory = migrationsPath();
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((name) => !name.startsWith(".") && existsSync(join(directory, name, "migration.sql")))
		.sort();
}

// Exécute Prisma CLI avec DATABASE_URL résolue.
function runPrismaCli(args: string[], action: string): void {
	const database = configureDatabaseUrl();
	console.info(`[botdeck:db] prisma ${action} source=${database.source} url=${database.url}`);
	execFileSync(process.execPath, [prismaCliPath(), ...args], {
		stdio: "inherit",
		env: {
			...process.env,
			DATABASE_URL: database.url,
			BOTDECK_DATABASE_PATH_RESOLVED: database.path ?? "",
			BOTDECK_DATABASE_SOURCE: database.source,
			NO_UPDATE_NOTIFIER: "1",
			PRISMA_HIDE_UPDATE_MESSAGE: "true"
		}
	});
}

// Applique les migrations Prisma versionnées.
function deployMigrations(): void {
	runPrismaCli(["migrate", "deploy", "--schema", schemaPath()], "migrate deploy");
}

// Marque une base déjà compatible comme baseline Prisma Migrate.
function markMigrationsAsApplied(): void {
	for (const migrationName of localMigrationNames()) {
		runPrismaCli(["migrate", "resolve", "--schema", schemaPath(), "--applied", migrationName], `migrate resolve --applied ${migrationName}`);
	}
}

// Ajoute une colonne si elle manque. Uniquement additif, jamais destructif.
async function addColumnIfMissing(tableName: string, columnName: string, sql: string): Promise<void> {
	if (!(await hasTable(tableName)) || (await hasColumn(tableName, columnName))) return;
	await prisma.$executeRawUnsafe(sql);
}

// Répare les anciennes bases créées avant Prisma Migrate avec des opérations additives.
async function repairLegacySchemaAdditively(): Promise<void> {
	const statements = [
		`CREATE TABLE IF NOT EXISTS "BotAccount" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "tokenCiphertext" TEXT NOT NULL, "tokenIv" TEXT NOT NULL, "tokenAuthTag" TEXT NOT NULL, "discordUserId" TEXT, "avatarUrl" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "readOnlyMode" BOOLEAN NOT NULL DEFAULT false, "readOnlyBlockMessages" BOOLEAN NOT NULL DEFAULT false, "readOnlyBlockChannels" BOOLEAN NOT NULL DEFAULT false, "readOnlyBlockModeration" BOOLEAN NOT NULL DEFAULT false, "commandStudioDisabled" BOOLEAN NOT NULL DEFAULT false, "lastConnectedAt" DATETIME, "lastError" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS "Guild" ("botAccountId" TEXT NOT NULL, "id" TEXT NOT NULL, "name" TEXT NOT NULL, "iconUrl" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "id"), CONSTRAINT "Guild_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "Channel" ("botAccountId" TEXT NOT NULL, "id" TEXT NOT NULL, "guildId" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL, "topic" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "id"), CONSTRAINT "Channel_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Channel_botAccountId_guildId_fkey" FOREIGN KEY ("botAccountId", "guildId") REFERENCES "Guild" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "User" ("botAccountId" TEXT NOT NULL, "id" TEXT NOT NULL, "username" TEXT NOT NULL, "displayName" TEXT, "avatarUrl" TEXT, "bot" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "id"), CONSTRAINT "User_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "Message" ("botAccountId" TEXT NOT NULL, "id" TEXT NOT NULL, "channelId" TEXT NOT NULL, "authorId" TEXT NOT NULL, "authorTag" TEXT, "authorAvatarUrl" TEXT, "content" TEXT NOT NULL, "createdAt" DATETIME NOT NULL, "editedAt" DATETIME, "pinned" BOOLEAN NOT NULL DEFAULT false, "type" INTEGER, "attachmentsJson" TEXT, "embedsJson" TEXT, "reactionsJson" TEXT, "replyToMessageId" TEXT, "system" BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY ("botAccountId", "id"), CONSTRAINT "Message_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Message_botAccountId_channelId_fkey" FOREIGN KEY ("botAccountId", "channelId") REFERENCES "Channel" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Message_botAccountId_authorId_fkey" FOREIGN KEY ("botAccountId", "authorId") REFERENCES "User" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "Presence" ("id" TEXT NOT NULL PRIMARY KEY, "botAccountId" TEXT NOT NULL, "userId" TEXT NOT NULL, "status" TEXT NOT NULL, "activity" TEXT, "updatedAt" DATETIME NOT NULL, CONSTRAINT "Presence_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Presence_botAccountId_userId_fkey" FOREIGN KEY ("botAccountId", "userId") REFERENCES "User" ("botAccountId", "id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "ApplicationCommandDefinition" ("botAccountId" TEXT NOT NULL, "commandId" TEXT NOT NULL, "scope" TEXT NOT NULL, "guildId" TEXT, "name" TEXT NOT NULL, "draftJson" TEXT NOT NULL, "runtimeJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "commandId"), CONSTRAINT "ApplicationCommandDefinition_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "GuildWelcomeConfig" ("botAccountId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "channelId" TEXT NOT NULL, "messageType" TEXT NOT NULL DEFAULT 'message', "messageTemplate" TEXT NOT NULL, "embedPagesJson" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "guildId"), CONSTRAINT "GuildWelcomeConfig_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "GuildGoodbyeConfig" ("botAccountId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "channelId" TEXT NOT NULL, "messageType" TEXT NOT NULL DEFAULT 'message', "messageTemplate" TEXT NOT NULL, "embedPagesJson" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "guildId"), CONSTRAINT "GuildGoodbyeConfig_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "GuildLogConfig" ("botAccountId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "channelId" TEXT NOT NULL, "eventConfigsJson" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "guildId"), CONSTRAINT "GuildLogConfig_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "GuildRoleAutomationRule" ("id" TEXT NOT NULL PRIMARY KEY, "botAccountId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "roleId" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT true, "conditionMode" TEXT NOT NULL DEFAULT 'all', "minMessages" INTEGER, "minVoiceSeconds" INTEGER, "minMemberAgeSeconds" INTEGER, "removeWhenInvalid" BOOLEAN NOT NULL DEFAULT false, "ignoreBots" BOOLEAN NOT NULL DEFAULT true, "applyToExistingMembers" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "GuildRoleAutomationRule_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "GuildMemberActivity" ("botAccountId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "userId" TEXT NOT NULL, "messageCount" INTEGER NOT NULL DEFAULT 0, "voiceSeconds" INTEGER NOT NULL DEFAULT 0, "joinedAt" DATETIME, "lastMessageAt" DATETIME, "lastVoiceAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "guildId", "userId"), CONSTRAINT "GuildMemberActivity_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE TABLE IF NOT EXISTS "GuildVoiceSession" ("botAccountId" TEXT NOT NULL, "guildId" TEXT NOT NULL, "userId" TEXT NOT NULL, "channelId" TEXT NOT NULL, "startedAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL, PRIMARY KEY ("botAccountId", "guildId", "userId"), CONSTRAINT "GuildVoiceSession_botAccountId_fkey" FOREIGN KEY ("botAccountId") REFERENCES "BotAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
		`CREATE INDEX IF NOT EXISTS "Guild_botAccountId_updatedAt_idx" ON "Guild"("botAccountId", "updatedAt")`,
		`CREATE INDEX IF NOT EXISTS "Channel_botAccountId_guildId_idx" ON "Channel"("botAccountId", "guildId")`,
		`CREATE INDEX IF NOT EXISTS "Channel_botAccountId_updatedAt_idx" ON "Channel"("botAccountId", "updatedAt")`,
		`CREATE INDEX IF NOT EXISTS "User_botAccountId_updatedAt_idx" ON "User"("botAccountId", "updatedAt")`,
		`CREATE INDEX IF NOT EXISTS "Message_botAccountId_channelId_createdAt_idx" ON "Message"("botAccountId", "channelId", "createdAt")`,
		`CREATE INDEX IF NOT EXISTS "Message_botAccountId_channelId_system_createdAt_idx" ON "Message"("botAccountId", "channelId", "system", "createdAt")`,
		`CREATE INDEX IF NOT EXISTS "Message_botAccountId_authorId_idx" ON "Message"("botAccountId", "authorId")`,
		`CREATE INDEX IF NOT EXISTS "Message_botAccountId_createdAt_idx" ON "Message"("botAccountId", "createdAt")`,
		`CREATE UNIQUE INDEX IF NOT EXISTS "Presence_botAccountId_userId_key" ON "Presence"("botAccountId", "userId")`,
		`CREATE INDEX IF NOT EXISTS "Presence_botAccountId_userId_idx" ON "Presence"("botAccountId", "userId")`,
		`CREATE INDEX IF NOT EXISTS "BotAccount_enabled_idx" ON "BotAccount"("enabled")`,
		`CREATE INDEX IF NOT EXISTS "ApplicationCommandDefinition_botAccountId_scope_guildId_idx" ON "ApplicationCommandDefinition"("botAccountId", "scope", "guildId")`,
		`CREATE INDEX IF NOT EXISTS "ApplicationCommandDefinition_botAccountId_name_idx" ON "ApplicationCommandDefinition"("botAccountId", "name")`,
		`CREATE INDEX IF NOT EXISTS "GuildWelcomeConfig_botAccountId_channelId_idx" ON "GuildWelcomeConfig"("botAccountId", "channelId")`,
		`CREATE INDEX IF NOT EXISTS "GuildGoodbyeConfig_botAccountId_channelId_idx" ON "GuildGoodbyeConfig"("botAccountId", "channelId")`,
		`CREATE INDEX IF NOT EXISTS "GuildLogConfig_botAccountId_channelId_idx" ON "GuildLogConfig"("botAccountId", "channelId")`,
		`CREATE INDEX IF NOT EXISTS "GuildRoleAutomationRule_botAccountId_guildId_idx" ON "GuildRoleAutomationRule"("botAccountId", "guildId")`,
		`CREATE INDEX IF NOT EXISTS "GuildRoleAutomationRule_botAccountId_guildId_roleId_idx" ON "GuildRoleAutomationRule"("botAccountId", "guildId", "roleId")`,
		`CREATE INDEX IF NOT EXISTS "GuildMemberActivity_botAccountId_guildId_idx" ON "GuildMemberActivity"("botAccountId", "guildId")`,
		`CREATE INDEX IF NOT EXISTS "GuildMemberActivity_botAccountId_guildId_updatedAt_idx" ON "GuildMemberActivity"("botAccountId", "guildId", "updatedAt")`,
		`CREATE INDEX IF NOT EXISTS "GuildVoiceSession_botAccountId_guildId_idx" ON "GuildVoiceSession"("botAccountId", "guildId")`
	];

	for (const statement of statements) await prisma.$executeRawUnsafe(statement);
	await addColumnIfMissing("BotAccount", "commandStudioDisabled", `ALTER TABLE "BotAccount" ADD COLUMN "commandStudioDisabled" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("BotAccount", "readOnlyMode", `ALTER TABLE "BotAccount" ADD COLUMN "readOnlyMode" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("BotAccount", "readOnlyBlockMessages", `ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockMessages" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("BotAccount", "readOnlyBlockChannels", `ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockChannels" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("BotAccount", "readOnlyBlockModeration", `ALTER TABLE "BotAccount" ADD COLUMN "readOnlyBlockModeration" BOOLEAN NOT NULL DEFAULT false`);
	try {
		await prisma.$executeRawUnsafe(`UPDATE "BotAccount" SET "readOnlyMode" = true WHERE "commandStudioDisabled" = true`);
	} catch (error) {
		console.warn("[botdeck:db] read-only legacy sync skipped", error instanceof Error ? error.message : error);
	}
	await addColumnIfMissing("Message", "authorTag", `ALTER TABLE "Message" ADD COLUMN "authorTag" TEXT`);
	await addColumnIfMissing("Message", "authorAvatarUrl", `ALTER TABLE "Message" ADD COLUMN "authorAvatarUrl" TEXT`);
	await addColumnIfMissing("Message", "pinned", `ALTER TABLE "Message" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("Message", "type", `ALTER TABLE "Message" ADD COLUMN "type" INTEGER`);
	await addColumnIfMissing("Message", "attachmentsJson", `ALTER TABLE "Message" ADD COLUMN "attachmentsJson" TEXT`);
	await addColumnIfMissing("Message", "embedsJson", `ALTER TABLE "Message" ADD COLUMN "embedsJson" TEXT`);
	await addColumnIfMissing("Message", "reactionsJson", `ALTER TABLE "Message" ADD COLUMN "reactionsJson" TEXT`);
	await addColumnIfMissing("Message", "replyToMessageId", `ALTER TABLE "Message" ADD COLUMN "replyToMessageId" TEXT`);
	await addColumnIfMissing("Message", "system", `ALTER TABLE "Message" ADD COLUMN "system" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("GuildWelcomeConfig", "messageType", `ALTER TABLE "GuildWelcomeConfig" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'message'`);
	await addColumnIfMissing("GuildWelcomeConfig", "embedPagesJson", `ALTER TABLE "GuildWelcomeConfig" ADD COLUMN "embedPagesJson" TEXT`);
	await addColumnIfMissing("GuildGoodbyeConfig", "messageType", `ALTER TABLE "GuildGoodbyeConfig" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'message'`);
	await addColumnIfMissing("GuildGoodbyeConfig", "embedPagesJson", `ALTER TABLE "GuildGoodbyeConfig" ADD COLUMN "embedPagesJson" TEXT`);
	await addColumnIfMissing("GuildLogConfig", "eventConfigsJson", `ALTER TABLE "GuildLogConfig" ADD COLUMN "eventConfigsJson" TEXT`);
	await addColumnIfMissing("GuildRoleAutomationRule", "minMessages", `ALTER TABLE "GuildRoleAutomationRule" ADD COLUMN "minMessages" INTEGER`);
	await addColumnIfMissing("GuildRoleAutomationRule", "minVoiceSeconds", `ALTER TABLE "GuildRoleAutomationRule" ADD COLUMN "minVoiceSeconds" INTEGER`);
	await addColumnIfMissing("GuildRoleAutomationRule", "minMemberAgeSeconds", `ALTER TABLE "GuildRoleAutomationRule" ADD COLUMN "minMemberAgeSeconds" INTEGER`);
	await addColumnIfMissing("GuildRoleAutomationRule", "removeWhenInvalid", `ALTER TABLE "GuildRoleAutomationRule" ADD COLUMN "removeWhenInvalid" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("GuildRoleAutomationRule", "ignoreBots", `ALTER TABLE "GuildRoleAutomationRule" ADD COLUMN "ignoreBots" BOOLEAN NOT NULL DEFAULT true`);
	await addColumnIfMissing("GuildRoleAutomationRule", "applyToExistingMembers", `ALTER TABLE "GuildRoleAutomationRule" ADD COLUMN "applyToExistingMembers" BOOLEAN NOT NULL DEFAULT false`);
	await addColumnIfMissing("GuildMemberActivity", "messageCount", `ALTER TABLE "GuildMemberActivity" ADD COLUMN "messageCount" INTEGER NOT NULL DEFAULT 0`);
	await addColumnIfMissing("GuildMemberActivity", "voiceSeconds", `ALTER TABLE "GuildMemberActivity" ADD COLUMN "voiceSeconds" INTEGER NOT NULL DEFAULT 0`);
	await addColumnIfMissing("GuildMemberActivity", "joinedAt", `ALTER TABLE "GuildMemberActivity" ADD COLUMN "joinedAt" DATETIME`);
	await addColumnIfMissing("GuildMemberActivity", "lastMessageAt", `ALTER TABLE "GuildMemberActivity" ADD COLUMN "lastMessageAt" DATETIME`);
	await addColumnIfMissing("GuildMemberActivity", "lastVoiceAt", `ALTER TABLE "GuildMemberActivity" ADD COLUMN "lastVoiceAt" DATETIME`);
	await addColumnIfMissing("GuildVoiceSession", "startedAt", `ALTER TABLE "GuildVoiceSession" ADD COLUMN "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
}

// Prépare les migrations sans opération destructrice.
async function migrateDatabaseIfNeeded(): Promise<void> {
	const migrations = localMigrationNames();
	if (migrations.length === 0) throw new Error("No Prisma migrations found. Refusing to mutate the database without versioned migrations.");

	const schemaIsReady = await hasExpectedSchema();
	const hasMigrationTable = await hasTable("_prisma_migrations");
	const applicationTables = await listApplicationTables();

	if (hasMigrationTable) {
		const applied = await listAppliedMigrations();
		const pending = migrations.filter((migration) => !applied.has(migration));
		if (pending.length === 0 && schemaIsReady) return;
		if (pending.length > 0) backupDatabaseBeforeMigration("migrate-deploy");
		await prisma.$disconnect();
		deployMigrations();
		return;
	}

	if (applicationTables.length === 0) {
		await prisma.$disconnect();
		deployMigrations();
		return;
	}

	backupDatabaseBeforeMigration(schemaIsReady ? "baseline" : "legacy-additive-repair");

	if (!schemaIsReady) {
		await repairLegacySchemaAdditively();
		if (!(await hasExpectedSchema())) {
			throw new Error("Legacy database schema could not be repaired additively. Backup was created and destructive schema sync is disabled.");
		}
	}

	await prisma.$disconnect();
	markMigrationsAsApplied();
}

// Prépare la base avant usage.
export function ensureDatabaseReady(): Promise<void> {
	if (bootstrapPromise) return bootstrapPromise;

	bootstrapPromise = (async () => {
		const database = configureDatabaseUrl();
		ensureSqliteDirectoryExists();
		console.info(`[botdeck:db] runtime source=${database.source} url=${database.url}`);
		await tuneSqliteConnection();
		await migrateDatabaseIfNeeded();
		await sanitizeRoleAutomationStorage();
	})().catch((error) => {
		bootstrapPromise = null;
		throw error;
	});

	return bootstrapPromise;
}
