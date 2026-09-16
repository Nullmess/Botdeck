// SQLite backup helpers used before Prisma migrations or legacy baselining.

import { configureDatabaseUrl } from "@/lib/database-url";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

function safeBackupReason(reason: string): string {
	return reason.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "migration";
}

function copySqliteSidecarIfPresent(source: string, target: string): void {
	try {
		if (existsSync(source) && statSync(source).isFile() && statSync(source).size > 0) copyFileSync(source, target);
	} catch (error) {
		console.warn("[botdeck:db] SQLite sidecar backup skipped", source, error instanceof Error ? error.message : error);
	}
}

function pruneOldBackups(directory: string, keep = 20): void {
	try {
		const backups = readdirSync(directory)
			.filter((name) => /^botdeck-.*\.db$/.test(name))
			.map((name) => ({ name, path: join(directory, name), mtimeMs: statSync(join(directory, name)).mtimeMs }))
			.sort((a, b) => b.mtimeMs - a.mtimeMs);
		for (const backup of backups.slice(keep)) {
			try { if (existsSync(`${backup.path}-wal`)) unlinkSync(`${backup.path}-wal`); } catch { /* ignore */ }
			try { if (existsSync(`${backup.path}-shm`)) unlinkSync(`${backup.path}-shm`); } catch { /* ignore */ }
			unlinkSync(backup.path);
		}
	} catch (error) {
		console.warn("[botdeck:db] Backup pruning skipped", error instanceof Error ? error.message : error);
	}
}

export function backupDatabaseBeforeMigration(reason: string): string | null {
	const database = configureDatabaseUrl();
	if (!database.path || !existsSync(database.path)) return null;

	try {
		const stats = statSync(database.path);
		if (!stats.isFile() || stats.size === 0) return null;

		const backupRoot = process.env.BOTDECK_DATA_DIR
			? join(process.env.BOTDECK_DATA_DIR, "backups", "database")
			: join(dirname(database.path), "backups");
		mkdirSync(backupRoot, { recursive: true });

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const backupPath = join(backupRoot, `botdeck-${timestamp}-${safeBackupReason(reason)}.db`);
		copyFileSync(database.path, backupPath);
		copySqliteSidecarIfPresent(`${database.path}-wal`, `${backupPath}-wal`);
		copySqliteSidecarIfPresent(`${database.path}-shm`, `${backupPath}-shm`);
		pruneOldBackups(backupRoot);
		console.info(`[botdeck:db] backup created path=${backupPath}`);
		return backupPath;
	} catch (error) {
		throw new Error(`Unable to create SQLite backup before migration: ${error instanceof Error ? error.message : String(error)}`);
	}
}
