// Commandes espaces travail (.env racine chargé).

import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = process.cwd();
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

const scriptName = process.argv[2];

if (!scriptName) {
	console.error("Missing script name.");
	process.exit(1);
}

const packages = [
	"packages/shared",
	"apps/web"
];

for (const pkg of packages) {
	const manifestPath = `${projectRoot}/${pkg}/package.json`;
	const manifest = require(manifestPath);
	if (!manifest.scripts || !manifest.scripts[scriptName]) continue;

	const result = spawnSync("npm", ["--prefix", pkg, "run", scriptName], {
		stdio: "inherit",
		shell: false,
		env: {
			...process.env,
			BOTDECK_PROJECT_DIR: projectRoot,
			NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1"
		}
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

process.exit(0);
