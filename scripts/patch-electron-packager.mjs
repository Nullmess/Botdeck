// Patch unzip packager (Impact réduit aux màj).

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const unzipModule = path.join(root, "node_modules", "@electron", "packager", "dist", "unzip.js");

if (!fs.existsSync(unzipModule)) {
	process.exit(0);
}

const patched = `import { spawnSync } from 'node:child_process';

// Extrait l’archive Electron.
export async function extractElectronZip(zipPath, targetDir) {
    const result = spawnSync('unzip', ['-q', '-o', zipPath, '-d', targetDir], {
        stdio: 'inherit'
    });
    if (result.error?.code === 'ENOENT') {
        throw new Error('The \`unzip\` command is required to package Electron apps in this Node version.');
    }
    if (result.status !== 0) {
        throw new Error(\`Failed to extract Electron from \${zipPath}\`);
    }
}
//# sourceMappingURL=unzip.js.map
`;

const current = fs.readFileSync(unzipModule, "utf8");

if (current !== patched) {
	fs.writeFileSync(unzipModule, patched);
}
