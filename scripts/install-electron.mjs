// Install Electron contrôlée (Téléchargement si manquant)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { downloadArtifact } from "@electron/get";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const electronDir = path.join(root, "node_modules", "electron");
const electronPackage = require(path.join(electronDir, "package.json"));

const platform = process.env.ELECTRON_INSTALL_PLATFORM || process.env.npm_config_platform || process.platform;
const arch = process.env.ELECTRON_INSTALL_ARCH || process.env.npm_config_arch || process.arch;
const executablePath = getPlatformPath(platform);
const distPath = path.join(electronDir, "dist");

if (isInstalled()) {
	process.exit(0);
}

const zipPath = await downloadArtifact({
	version: electronPackage.version,
	artifactName: "electron",
	force: process.env.force_no_cache === "true",
	cacheRoot: process.env.electron_config_cache,
	checksums:
		process.env.electron_use_remote_checksums || process.env.npm_config_electron_use_remote_checksums
			? undefined
			: require(path.join(electronDir, "checksums.json")),
	platform,
	arch
});

await fs.promises.rm(distPath, { recursive: true, force: true });
await fs.promises.mkdir(distPath, { recursive: true });
unzip(zipPath, distPath);
await fs.promises.writeFile(path.join(electronDir, "path.txt"), executablePath);

// Vérif l’installation locale.
function isInstalled() {
	try {
		const version = fs.readFileSync(path.join(distPath, "version"), "utf8").replace(/^v/, "").trim();
		const pathTxt = fs.readFileSync(path.join(electronDir, "path.txt"), "utf8").trim();
		return version === electronPackage.version && pathTxt === executablePath && fs.existsSync(path.join(distPath, executablePath));
	} catch {
		return false;
	}
}

// Décompresse sans shell exotique.
function unzip(zipPath, targetDir) {
	const result = spawnSync("unzip", ["-q", "-o", zipPath, "-d", targetDir], {
		stdio: "inherit"
	});

	if (result.error?.code === "ENOENT") {
		throw new Error("The `unzip` command is required to install Electron in this Node version.");
	}

	if (result.status !== 0) {
		throw new Error(`Failed to extract Electron from ${zipPath}.`);
	}
}

// Calcule le dossier Electron cible.
function getPlatformPath(targetPlatform) {
	switch (targetPlatform || os.platform()) {
		case "mas":
		case "darwin":
			return "Electron.app/Contents/MacOS/Electron";
		case "freebsd":
		case "openbsd":
		case "linux":
			return "electron";
		case "win32":
			return "electron.exe";
		default:
			throw new Error(`Electron builds are not available on platform: ${targetPlatform}`);
	}
}
