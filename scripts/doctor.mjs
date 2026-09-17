// Diagnostic local de l'environnement Botdeck.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
const notes = [];

function parseVersion(value) {
	const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
	return match ? match.slice(1).map(Number) : null;
}

function compare(a, b) {
	for (let i = 0; i < 3; i += 1) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return 0;
}

const nodeVersion = parseVersion(process.versions.node);
if (!nodeVersion || compare(nodeVersion, [22, 16, 0]) < 0 || compare(nodeVersion, [25, 0, 0]) >= 0) {
	failures.push(`Node ${process.versions.node} is unsupported; use >=22.16.0 <25 (24.17.0 recommended).`);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmResult = spawnSync(npmCommand, ["--version"], { encoding: "utf8", shell: false });
if (npmResult.error || npmResult.status !== 0) {
	failures.push("npm is not available in PATH.");
} else {
	const npmVersion = parseVersion(npmResult.stdout.trim());
	if (!npmVersion || compare(npmVersion, [10, 0, 0]) < 0 || compare(npmVersion, [12, 0, 0]) >= 0) {
		failures.push(`npm ${npmResult.stdout.trim()} is unsupported; use >=10 <12.`);
	}
}

for (const [label, file] of [
	["TypeScript", "node_modules/typescript/bin/tsc"],
	["Next.js", "node_modules/next/package.json"],
	["Prisma", "node_modules/prisma/package.json"],
	["Electron", "node_modules/electron/package.json"]
]) {
	if (!existsSync(path.join(root, file))) failures.push(`${label} is missing. Run 'npm ci' from the repository root.`);
}

if (process.platform === "linux") {
	let distro = "Linux";
	try {
		const osRelease = readFileSync("/etc/os-release", "utf8");
		const id = osRelease.match(/^ID=(.+)$/m)?.[1]?.replaceAll('"', "");
		const pretty = osRelease.match(/^PRETTY_NAME=(.+)$/m)?.[1]?.replaceAll('"', "");
		distro = pretty || id || distro;
	} catch {}
	notes.push(`Linux detected: ${distro}. Botdeck does not depend on a distro-specific package manager.`);

	const electronPath = path.join(root, "node_modules", "electron", "dist", "electron");
	if (existsSync(electronPath)) {
		const ldd = spawnSync("ldd", [electronPath], { encoding: "utf8", shell: false });
		if (!ldd.error && ldd.status === 0) {
			const missing = `${ldd.stdout}\n${ldd.stderr}`.split(/\r?\n/).filter((line) => line.includes("not found"));
			if (missing.length) {
				failures.push(`Electron has missing system libraries:\n${missing.map((line) => `  ${line.trim()}`).join("\n")}`);
			}
		}
	}
}

for (const note of notes) console.log(`- ${note}`);

if (failures.length) {
	console.error("Botdeck doctor found problems:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log(`Botdeck doctor passed (Node ${process.versions.node}).`);
