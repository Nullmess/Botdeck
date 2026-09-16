// Exécution Windows desktop

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const runtimeVersion = process.env.BOTDECK_NODE_RUNTIME_VERSION || process.versions.node;
const nextVersion = JSON.parse(await fs.promises.readFile(path.join(root, "node_modules", "next", "package.json"), "utf8")).version;
const runtimeDir = path.join(root, "bin", "win32-x64");
const nodeExe = path.join(runtimeDir, "node.exe");
const cacheDir = path.join(root, ".cache", "node-runtime");
const zipBase = `node-v${runtimeVersion}-win-x64`;
const zipName = `${zipBase}.zip`;
const zipPath = path.join(cacheDir, zipName);
const zipUrl = `https://nodejs.org/dist/v${runtimeVersion}/${zipName}`;

const winPackages = [
	`@next/swc-win32-x64-msvc@${nextVersion}`,
	"@esbuild/win32-x64@0.28.0",
	"@img/sharp-win32-x64@0.34.5",
	"@img/sharp-libvips-win32-x64@1.2.4"
];

await fs.promises.mkdir(runtimeDir, { recursive: true });
await fs.promises.mkdir(cacheDir, { recursive: true });

if (!fs.existsSync(nodeExe)) {
	if (!fs.existsSync(zipPath)) {
		await download(zipUrl, zipPath);
	}

	const extractDir = path.join(cacheDir, `extract-${runtimeVersion}`);
	await fs.promises.rm(extractDir, { recursive: true, force: true });
	await fs.promises.mkdir(extractDir, { recursive: true });
	run("unzip", ["-q", "-o", zipPath, `${zipBase}/node.exe`, "-d", extractDir]);
	await fs.promises.copyFile(path.join(extractDir, zipBase, "node.exe"), nodeExe);
	await fs.promises.rm(extractDir, { recursive: true, force: true });
}

run("npm", [
	"install",
	"--force",
	"--no-save",
	"--package-lock=false",
	"--ignore-scripts",
	...winPackages
]);

run(process.execPath, [path.join(root, "node_modules", "@prisma", "engines", "dist", "scripts", "postinstall.js")], {
	PRISMA_CLI_BINARY_TARGETS: "windows"
});

run(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "generate", "--schema", path.join(root, "apps", "web", "prisma", "schema.prisma")], {
	PRISMA_CLI_BINARY_TARGETS: "windows"
});

// Exécute une commande contrôlée.
function run(command, args, env = {}) {
	const result = spawnSync(command, args, {
		cwd: root,
		env: {
			...process.env,
			...env
		},
		stdio: "inherit"
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
}

// Télécharge avec suivi simple.
function download(url, destination) {
	return new Promise((resolve, reject) => {
		const request = https.get(url, (response) => {
			if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
				response.resume();
				download(response.headers.location, destination).then(resolve, reject);
				return;
			}

			if (response.statusCode !== 200) {
				response.resume();
				reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
				return;
			}

			const file = fs.createWriteStream(destination);
			response.pipe(file);
			file.on("finish", () => file.close(resolve));
			file.on("error", reject);
		});

		request.on("error", reject);
	});
}
