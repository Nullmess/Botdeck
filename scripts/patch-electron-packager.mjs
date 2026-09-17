// Patch d’extraction du packager Electron (sans dépendance système `unzip`).

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const unzipModule = path.join(root, "node_modules", "@electron", "packager", "dist", "unzip.js");

if (!fs.existsSync(unzipModule)) {
	process.exit(0);
}

const patched = `import extractZip from '@electron-internal/extract-zip';

// Extrait l’archive Electron avec l’extracteur Node fourni avec Botdeck.
export async function extractElectronZip(zipPath, targetDir) {
    await extractZip(zipPath, { dir: targetDir });
}
//# sourceMappingURL=unzip.js.map
`;

const current = fs.readFileSync(unzipModule, "utf8");

if (current !== patched) {
	fs.writeFileSync(unzipModule, patched);
}
