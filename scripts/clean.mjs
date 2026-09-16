// Nettoyage local

import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

const exactTargets = [
	".botdeck",
	"release",
	"Botdeck-win32-x64",
	"Botdeck-linux-x64",
	"Botdeck-darwin-x64",
	".cache",
	"bin",
	"debug.log",
	"apps/web/AGENTS.md",
	"apps/web/CLAUDE.md",
	"apps/web/.next",
	"apps/web/.turbo",
	"apps/web/.botdeck",
	"apps/web/tsconfig.tsbuildinfo",
	"apps/web/prisma/dev.db",
	"packages/shared/dist",
	"packages/shared/tsconfig.tsbuildinfo",
];

const nodeModuleTargets = [
	"apps/web/node_modules",
	"packages/shared/node_modules",
	"node_modules"
];

const patternTargets = [
	{ dir: ".", test: (name) => name.endsWith(".log") },
	{ dir: "apps/web", test: (name) => name.endsWith(".log") },
	{ dir: "packages/shared", test: (name) => name.endsWith(".log") },
	{ dir: "apps/web/prisma", test: (name) => name.startsWith("dev.db-") },
	{ dir: "packages/shared", test: (name) => name.endsWith(".tsbuildinfo") },
];

// Supprime une cible sûre.
async function removePath(relativePath) {
	await rm(join(root, relativePath), { recursive: true, force: true });
	console.log(`removed ${relativePath}`);
}

// Supprime les fichiers filtrés.
async function removePattern({ dir, test }) {
	let entries;
	try {
		entries = await readdir(join(root, dir));
	} catch {
		return;
	}

	await Promise.all(entries.filter(test).map((entry) => removePath(dir === "." ? entry : join(dir, entry))));
}

for (const target of exactTargets) {
	await removePath(target);
}

for (const pattern of patternTargets) {
	await removePattern(pattern);
}


for (const target of nodeModuleTargets) {
	await removePath(target);
}
