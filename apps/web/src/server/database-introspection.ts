// SQLite schema introspection helpers used by the Prisma bootstrap.

import { prisma } from "@/lib/prisma";

export type SqliteTableRow = { name: string };
export type SqliteColumnRow = { name: string };
export type PrismaMigrationRow = { migration_name: string };

function quoteSqliteIdentifier(identifier: string): string {
	return identifier.replace(/'/g, "''");
}

export async function hasTable(tableName: string): Promise<boolean> {
	try {
		const rows = await prisma.$queryRawUnsafe<SqliteTableRow[]>(
			"SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
			tableName
		);
		return rows.length > 0;
	} catch {
		return false;
	}
}

export async function hasColumn(tableName: string, columnName: string): Promise<boolean> {
	try {
		const rows = await prisma.$queryRawUnsafe<SqliteColumnRow[]>(`PRAGMA table_info('${quoteSqliteIdentifier(tableName)}')`);
		return rows.some((row) => row.name === columnName);
	} catch {
		return false;
	}
}

export async function listApplicationTables(): Promise<string[]> {
	try {
		const rows = await prisma.$queryRawUnsafe<SqliteTableRow[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
		return rows.map((row) => row.name).filter((name) => name !== "_prisma_migrations");
	} catch {
		return [];
	}
}

export async function listAppliedMigrations(): Promise<Set<string>> {
	if (!(await hasTable("_prisma_migrations"))) return new Set<string>();
	const rows = await prisma.$queryRawUnsafe<PrismaMigrationRow[]>("SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL");
	return new Set(rows.map((row) => row.migration_name));
}
