// Vérifie que les dépendances de release sont stables et reproductibles.
// Objectif: pas de canary/preview, pas de ranges (^/~), lockfile aligné.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const allowedNonRegistrySpecs = [/^file:/, /^workspace:/, /^link:/];
const unstableTagPattern = /(?:canary|preview|alpha|beta|rc|experimental|snapshot|nightly)/i;
const rangePattern = /^[\^~<>*xX]|\s[-|]|\|\||latest$/;

async function readJson(path) {
	return JSON.parse(await readFile(join(root, path), "utf8"));
}

function checkDependencySet(packagePath, sectionName, deps = {}) {
	for (const [name, spec] of Object.entries(deps)) {
		if (allowedNonRegistrySpecs.some((rule) => rule.test(spec))) continue;
		if (rangePattern.test(spec)) failures.push(`${packagePath} ${sectionName}.${name}: version must be exact, got '${spec}'`);
		if (unstableTagPattern.test(spec)) failures.push(`${packagePath} ${sectionName}.${name}: unstable prerelease/tag is forbidden, got '${spec}'`);
		if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(spec)) failures.push(`${packagePath} ${sectionName}.${name}: unsupported dependency spec '${spec}'`);
	}
}

function checkManifest(packagePath, pkg) {
	for (const sectionName of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
		checkDependencySet(packagePath, sectionName, pkg[sectionName]);
	}
}

function packageEntry(lockfile, path) {
	const entry = lockfile.packages?.[path];
	if (!entry) failures.push(`package-lock.json: missing package entry '${path}'`);
	return entry;
}

function assertLockedVersion(lockfile, packageName, expectedVersion) {
	if (allowedNonRegistrySpecs.some((rule) => rule.test(expectedVersion))) return;
	const candidates = [`node_modules/${packageName}`, `apps/web/node_modules/${packageName}`];
	const found = candidates.map((path) => lockfile.packages?.[path]?.version).filter(Boolean);
	if (!found.includes(expectedVersion)) {
		failures.push(`package-lock.json: ${packageName} must lock ${expectedVersion}, found ${found.length ? found.join(", ") : "nothing"}`);
	}
}

const rootPkg = await readJson("package.json");
const webPkg = await readJson("apps/web/package.json");
const lockfile = await readJson("package-lock.json");

checkManifest("package.json", rootPkg);
checkManifest("apps/web/package.json", webPkg);


if (webPkg.dependencies?.next !== "16.2.9") failures.push("apps/web/package.json: Next must stay pinned to the stable release 16.2.9");
if (webPkg.dependencies?.react !== webPkg.dependencies?.["react-dom"]) failures.push("apps/web/package.json: react and react-dom versions must match");
if (rootPkg.devDependencies?.electron !== "42.5.0") failures.push("package.json: Electron must stay pinned to 42.5.0");

for (const scriptName of ["build-win", "build-lin", "build-mac"]) {
	const script = rootPkg.scripts?.[scriptName] || "";
	if (!script.includes(`--electron-version=${rootPkg.devDependencies?.electron}`)) {
		failures.push(`package.json scripts.${scriptName}: --electron-version must match devDependencies.electron`);
	}
}

const rootLockEntry = packageEntry(lockfile, "");
const webLockEntry = packageEntry(lockfile, "apps/web");
if (rootLockEntry) checkManifest("package-lock.json root package", rootLockEntry);
if (webLockEntry) checkManifest("package-lock.json apps/web package", webLockEntry);

for (const [name, version] of Object.entries(rootPkg.devDependencies || {})) assertLockedVersion(lockfile, name, version);
for (const [name, version] of Object.entries(webPkg.dependencies || {})) assertLockedVersion(lockfile, name, version);
for (const [name, version] of Object.entries(webPkg.devDependencies || {})) assertLockedVersion(lockfile, name, version);

const overrides = rootPkg.overrides || {};
if (overrides.postcss !== "8.5.15") failures.push("package.json overrides.postcss must pin the audited fixed version 8.5.15");
if (overrides["@electron/get"]?.undici !== "7.28.0") failures.push("package.json overrides.@electron/get.undici must pin 7.28.0");
if (overrides["discord.js"]?.undici !== "6.27.0") failures.push("package.json overrides.discord.js.undici must pin 6.27.0");
if (overrides["@discordjs/rest"]?.undici !== "6.27.0") failures.push("package.json overrides.@discordjs/rest.undici must pin 6.27.0");

if (lockfile.packages?.["node_modules/postcss"]?.version !== "8.5.15") failures.push("package-lock.json: postcss override must resolve to 8.5.15");
if (lockfile.packages?.["node_modules/@electron/get/node_modules/undici"]?.version && lockfile.packages["node_modules/@electron/get/node_modules/undici"].version !== "7.28.0") {
	failures.push("package-lock.json: @electron/get undici override must resolve to 7.28.0");
}
if (lockfile.packages?.["node_modules/undici"]?.version !== "7.28.0") failures.push("package-lock.json: root undici override must resolve to 7.28.0");
if (lockfile.packages?.["node_modules/discord.js/node_modules/undici"]?.version !== "6.27.0") failures.push("package-lock.json: discord.js undici override must resolve to 6.27.0");
if (lockfile.packages?.["node_modules/@discordjs/rest/node_modules/undici"]?.version !== "6.27.0") failures.push("package-lock.json: @discordjs/rest undici override must resolve to 6.27.0");

if (failures.length) {
	console.error("Dependency stability check failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log("Dependency stability check passed.");
