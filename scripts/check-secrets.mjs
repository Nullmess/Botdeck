// Audit secrets avant publish (Exclusions: deps, builds, générés).

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();

const ignoredDirectories = new Set([
	".git",
	".next",
	".turbo",
	".cache",
	".botdeck",
	"bin",
	"build",
	"dist",
	"node_modules",
	"release"
]);

const ignoredFiles = new Set([
	"package-lock.json",
	"npm-shrinkwrap.json"
]);

const ignoredExtensions = new Set([
	".ico",
	".icns",
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".db",
	".sqlite",
	".wasm",
	".node"
]);

const secretPatterns = [
	{
		name: "Discord token",
		pattern: /\b(?:mfa\.[\w-]{20,}|[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{27,})\b/g
	},
	{
		name: "GitHub token",
		pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/g
	},
	{
		name: "Slack token",
		pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g
	},
	{
		name: "Private key",
		pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g
	}
];

// Lit l’extension normalisée.
function extensionOf(fileName) {
	const index = fileName.lastIndexOf(".");
	return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

// Ignore les chemins non pertinents.
function shouldSkipFile(filePath) {
	const fileName = filePath.split(/[\\/]/).at(-1) ?? filePath;
	return ignoredFiles.has(fileName) || ignoredExtensions.has(extensionOf(fileName));
}

// Parcourt les fichiers à auditer.
async function collectFiles(directory, files = []) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (ignoredDirectories.has(entry.name)) continue;
			await collectFiles(join(directory, entry.name), files);
			continue;
		}
		if (!entry.isFile()) continue;
		const filePath = join(directory, entry.name);
		if (!shouldSkipFile(filePath)) files.push(filePath);
	}
	return files;
}

// Localise une alerte dans le file.
function lineAndColumn(source, index) {
	const before = source.slice(0, index);
	const lines = before.split(/\r?\n/);
	return { line: lines.length, column: lines.at(-1).length + 1 };
}

const findings = [];

for (const filePath of await collectFiles(root)) {
	let source;
	try {
		source = await readFile(filePath, "utf8");
	} catch {
		continue;
	}

	for (const { name, pattern } of secretPatterns) {
		pattern.lastIndex = 0;
		for (const match of source.matchAll(pattern)) {
			const location = lineAndColumn(source, match.index ?? 0);
			findings.push({
				type: name,
				file: relative(root, filePath),
				...location
			});
		}
	}
}

if (findings.length) {
	console.error("Botdeck secret check failed:");
	for (const finding of findings) {
		console.error(`- ${finding.type} in ${finding.file}:${finding.line}:${finding.column}`);
	}
	console.error("Move secrets to an ignored .env file or rotate them if they were exposed.");
	process.exit(1);
}

console.log("Botdeck secret check passed.");
