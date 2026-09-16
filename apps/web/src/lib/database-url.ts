// URL SQLite Prisma

import { isAbsolute, join, resolve } from "node:path";

export type DatabaseConfig = {
	url: string;
	path: string | null;
	source: "argument-url" | "env-url" | "argument-path" | "env-path" | "data-dir-default" | "project-default";
};

// Normalise un chemin SQLite.
function normalizeSqlitePath(filePath: string): string {
	return resolve(/* turbopackIgnore: true */ filePath).replace(/\\/g, "/");
}

// Construit l’URL Prisma SQLite.
function toPrismaSqliteUrl(filePath: string): string {
	return `file:${normalizeSqlitePath(filePath)}`;
}

// Lit un argument CLI nommé.
function readArgValue(...names: string[]): string | null {
	for (const name of names) {
		const exactIndex = process.argv.indexOf(name);
		if (exactIndex >= 0) {
			const value = process.argv[exactIndex + 1];
			if (value && !value.startsWith("--")) return value;
		}

		const prefix = `${name}=`;
		const inline = process.argv.find((arg) => arg.startsWith(prefix));
		if (inline) return inline.slice(prefix.length);
	}

	return null;
}

// Remonte jusqu’à la racine.
function findProjectRoot(): string {
	return resolve(/* turbopackIgnore: true */ process.env.BOTDECK_PROJECT_DIR ?? process.cwd());
}

// Relit un chemin depuis DATABASE_URL.
function sqlitePathFromUrl(url: string): string | null {
	if (!url.startsWith("file:")) return null;
	const rawPath = url.slice("file:".length);
	if (!rawPath || rawPath.startsWith(":")) return null;
	return isAbsolute(rawPath) ? rawPath : resolve(/* turbopackIgnore: true */ findProjectRoot(), rawPath);
}

// Expose l’origine DB au runtime.
function markDatabaseSource(filePath: string, source: DatabaseConfig["source"]): string {
	const absolutePath = resolve(/* turbopackIgnore: true */ filePath);
	process.env.BOTDECK_DATABASE_SOURCE = source;
	process.env.BOTDECK_DATABASE_PATH_RESOLVED = absolutePath;
	return absolutePath;
}

// Résout la configuration SQLite.
function resolveDatabaseConfig(): DatabaseConfig {
	const argUrl = readArgValue("--database-url", "--db-url");
	if (argUrl) {
		const sqlitePath = sqlitePathFromUrl(argUrl);
		const markedPath = sqlitePath ? markDatabaseSource(sqlitePath, "argument-url") : null;
		return { url: markedPath ? toPrismaSqliteUrl(markedPath) : argUrl, path: markedPath, source: "argument-url" };
	}

	if (process.env.BOTDECK_DATABASE_URL) {
		const sqlitePath = sqlitePathFromUrl(process.env.BOTDECK_DATABASE_URL);
		const markedPath = sqlitePath ? markDatabaseSource(sqlitePath, "env-url") : null;
		return { url: markedPath ? toPrismaSqliteUrl(markedPath) : process.env.BOTDECK_DATABASE_URL, path: markedPath, source: "env-url" };
	}

	const argPath = readArgValue("--database", "--database-path", "--db");
	if (argPath) {
		const markedPath = markDatabaseSource(argPath, "argument-path");
		return { url: toPrismaSqliteUrl(markedPath), path: markedPath, source: "argument-path" };
	}

	const envPath = process.env.BOTDECK_DATABASE_PATH ?? process.env.BOTDECK_DATABASE_DIR;
	if (envPath) {
		const filePath = process.env.BOTDECK_DATABASE_DIR && !process.env.BOTDECK_DATABASE_PATH ? join(envPath, "botdeck.db") : envPath;
		const markedPath = markDatabaseSource(filePath, "env-path");
		return { url: toPrismaSqliteUrl(markedPath), path: markedPath, source: "env-path" };
	}

	if (process.env.BOTDECK_DATA_DIR) {
		const defaultPath = join(process.env.BOTDECK_DATA_DIR, "database", "botdeck.db");
		const markedPath = markDatabaseSource(defaultPath, "data-dir-default");
		return { url: toPrismaSqliteUrl(markedPath), path: markedPath, source: "data-dir-default" };
	}

	const defaultPath = join(findProjectRoot(), ".botdeck", "database", "botdeck.db");
	const markedPath = markDatabaseSource(defaultPath, "project-default");
	return { url: toPrismaSqliteUrl(markedPath), path: markedPath, source: "project-default" };
}

// Installe DATABASE_URL proprement.
export function configureDatabaseUrl(): DatabaseConfig {
	const config = resolveDatabaseConfig();
	// DATABASE_URL forcée.
	// Évite ancien .env en lecture seule.
	process.env.DATABASE_URL = config.url;
	if (config.path) process.env.BOTDECK_DATABASE_PATH_RESOLVED = config.path;
	process.env.BOTDECK_DATABASE_SOURCE = config.source;
	return config;
}
