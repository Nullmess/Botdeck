// Dev complet (Arrêt Next + Electron).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const children = [];
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Nettoie les valeurs .env citées.
function unquoteEnvValue(value) {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

// Charge le .env racine sans dépendance.
function loadRootEnv(root) {
	const envPath = join(root, ".env");
	if (!existsSync(envPath)) return;

	for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("export ") && !trimmed.includes("=")) continue;

		const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
		const separatorIndex = normalized.indexOf("=");
		if (separatorIndex <= 0) continue;

		const key = normalized.slice(0, separatorIndex).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
		process.env[key] = unquoteEnvValue(normalized.slice(separatorIndex + 1));
	}
}

loadRootEnv(projectRoot);

// Lit un argument CLI nommé.
function readArgValue(...names) {
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

const devDataDir = process.env.BOTDECK_DATA_DIR || join(projectRoot, ".botdeck");

// Prépare DATABASE_URL pour le process.
function databaseEnv() {
	const databaseUrl = readArgValue("--database-url", "--db-url") || process.env.BOTDECK_DATABASE_URL;
	if (databaseUrl) return { BOTDECK_DATABASE_URL: databaseUrl, DATABASE_URL: databaseUrl };

	const databasePath = readArgValue("--database", "--database-path", "--db") || process.env.BOTDECK_DATABASE_PATH || join(devDataDir, "database", "botdeck.db");
	mkdirSync(dirname(databasePath), { recursive: true });
	return {
		BOTDECK_DATABASE_PATH: databasePath,
		DATABASE_URL: `file:${databasePath.replace(/\\/g, "/")}`
	};
}

// Lance le serveur Next local. Code 42 = redémarrage demandé après changement TLS.
function start() {
	const child = spawn(process.execPath, [
		join(projectRoot, "apps", "desktop", "botdeck-server.cjs"),
		"--dir", join(projectRoot, "apps", "web"),
		"--host", process.env.HOST || "127.0.0.1",
		"--port", process.env.PORT || "3000",
		"--dev", "true"
	], {
		stdio: "inherit",
		shell: false,
		env: {
			...process.env,
			...databaseEnv(),
			BOTDECK_PROJECT_DIR: projectRoot,
			BOTDECK_DATA_DIR: devDataDir,
			BOTDECK_RUNTIME_SECRET_PATH: join(devDataDir, "secrets", "runtime.key"),
			BOTDECK_ALLOW_SERVER_RESTART: "1"
		}
	});

	children.push(child);
	child.on("exit", (code, signal) => {
		const index = children.indexOf(child);
		if (index >= 0) children.splice(index, 1);
		if (code === 42 && !signal) {
			setTimeout(start, 500);
			return;
		}
		if (signal || code !== 0) {
			for (const proc of children) if (!proc.killed) proc.kill("SIGTERM");
			process.exit(code ?? 1);
		}
	});
}

start();

process.on("SIGINT", () => {
	for (const proc of children) if (!proc.killed) proc.kill("SIGINT");
	process.exit(130);
});

process.on("SIGTERM", () => {
	for (const proc of children) if (!proc.killed) proc.kill("SIGTERM");
	process.exit(143);
});
