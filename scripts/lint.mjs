// Lint léger sans dépendance externe.
// Il bloque les patterns dangereux et les oublis structurels que les tests unitaires ne couvrent pas.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
	".git",
	".next",
	".turbo",
	".cache",
	"node_modules",
	"release",
	"Botdeck-win32-x64",
	"Botdeck-linux-x64",
	"Botdeck-darwin-x64"
]);
const checkedExtensions = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx", ".css"]);
const skippedFiles = new Set([
	"scripts/lint.mjs",
	"tests/quality-gates.test.mjs",
	"scripts/check.mjs"
]);

function extensionOf(path) {
	const match = /\.[^.\/]+$/.exec(path);
	return match ? match[0] : "";
}

async function walk(relativeDir = ".") {
	const absoluteDir = join(root, relativeDir);
	const entries = await readdir(absoluteDir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const relativePath = join(relativeDir, entry.name).replaceAll("\\", "/").replace(/^\.\//, "");
		if (entry.isDirectory()) {
			if (!ignoredDirs.has(entry.name)) files.push(...await walk(relativePath));
			continue;
		}
		if (checkedExtensions.has(extensionOf(entry.name)) && !skippedFiles.has(relativePath)) files.push(relativePath);
	}
	return files;
}

const forbidden = [
	{ label: "Prisma data-loss flag", test: (source) => source.includes("--accept-data-loss") },
	{ label: "Runtime prisma db push", test: (source) => /prisma\s+db\s+push/.test(source) || /db push/.test(source) },
	{ label: "eval usage", test: (source) => /\beval\s*\(/.test(source) },
	{ label: "new Function usage", test: (source) => /\bnew\s+Function\s*\(/.test(source) },
	{ label: "React dangerouslySetInnerHTML", test: (source) => /dangerouslySetInnerHTML/.test(source) },
	{ label: "untyped BotSession this context", test: (source) => /this\s*:\s*any/.test(source) }
];

const failures = [];
for (const file of await walk()) {
	const source = await readFile(join(root, file), "utf8");
	for (const rule of forbidden) {
		if (rule.test(source)) failures.push(`${file}: ${rule.label}`);
	}

}

const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const script of ["lint", "test", "typecheck", "check", "check:static", "check:secrets", "check:deps"]) {
	if (!rootPackage.scripts?.[script]) failures.push(`package.json: missing npm script '${script}'`);
}

const desktopMain = await readFile(join(root, "apps/desktop/main.js"), "utf8");
if (!/app\.getPath\("userData"\)/.test(desktopMain)) failures.push("apps/desktop/main.js: desktop storage must use app.getPath(\"userData\")");

const controlPlane = await readFile(join(root, "apps/web/src/server/control-plane.ts"), "utf8");
if (!/verifyClient/.test(controlPlane) || !/validateWebSocketClient/.test(controlPlane)) {
	failures.push("apps/web/src/server/control-plane.ts: WebSocket upgrade must be authenticated");
}
if (!/assertBotWriteAccessEnabled/.test(controlPlane) || !/getReadOnlyCommandBlockKind/.test(controlPlane)) {
	failures.push("apps/web/src/server/control-plane.ts: read-only mode must enforce policy options server-side");
}

const componentSource = await readFile(join(root, "apps/web/src/components/botdeck-app.tsx"), "utf8");
if (/activeBot\?\.commandStudioDisabled/.test(componentSource)) {
	failures.push("apps/web/src/components/botdeck-app.tsx: UI must use readOnlyMode helper, not legacy commandStudioDisabled directly");
}

const rootPackageText = await readFile(join(root, "package.json"), "utf8");
const webPackageText = await readFile(join(root, "apps/web/package.json"), "utf8");
if (/"next"\s*:\s*"[^^~<>]*canary/i.test(webPackageText) || /"next"\s*:\s*"[\^~<>]/.test(webPackageText)) {
	failures.push("apps/web/package.json: Next must be pinned to a stable exact version");
}

if (failures.length) {
	console.error("Botdeck lint failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}

console.log("Botdeck lint passed.");
