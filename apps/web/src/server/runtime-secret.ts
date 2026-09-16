// Secret local tokens

import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SECRET_FILE_NAME = "runtime.key";

// Nettoie un chemin optionnel.
function optionalPath(value: string | undefined): string | null {
	return value?.trim() ? resolve(/* turbopackIgnore: true */ value) : null;
}

// Liste les emplacements secret, du plus sûr au plus ancien.
function candidatePaths(): string[] {
	return [
		optionalPath(process.env.BOTDECK_RUNTIME_SECRET_PATH),
		process.env.BOTDECK_DATA_DIR ? resolve(/* turbopackIgnore: true */ process.env.BOTDECK_DATA_DIR, "secrets", SECRET_FILE_NAME) : null,
		resolve(/* turbopackIgnore: true */ process.cwd(), ".botdeck", SECRET_FILE_NAME),
		resolve(/* turbopackIgnore: true */ process.cwd(), "apps/web/.botdeck", SECRET_FILE_NAME)
	].filter(Boolean) as string[];
}

// Crée le dossier parent.
function ensureDirectory(filePath: string): void {
	mkdirSync(dirname(filePath), { recursive: true });
}

// Rend le fichier lisible uniquement par l’utilisateur quand l’OS le supporte.
function restrictSecretFile(filePath: string): void {
	try {
		chmodSync(filePath, 0o600);
	} catch {
		// Windows et certains FS peuvent ignorer chmod.
	}
}

// Copie l’ancien secret vers l’emplacement sûr si nécessaire.
function migrateSecretIfNeeded(candidates: string[]): void {
	const targetPath = candidates[0];
	if (!targetPath || existsSync(targetPath)) return;
	const legacyPath = candidates.slice(1).find((candidate) => existsSync(candidate));
	if (!legacyPath) return;
	ensureDirectory(targetPath);
	writeFileSync(targetPath, readFileSync(legacyPath, "utf8"), "utf8");
	restrictSecretFile(targetPath);
}

// Charge ou crée le secret local.
export function loadRuntimeSecret(): Buffer {
	const candidates = candidatePaths();
	migrateSecretIfNeeded(candidates);
	const existingPath = candidates.find((candidate) => existsSync(candidate));

	if (existingPath) {
		const encoded = readFileSync(existingPath, "utf8").trim();
		return Buffer.from(encoded, "base64");
	}

	const targetPath = candidates[0];
	const secret = randomBytes(32);
	ensureDirectory(targetPath);
	writeFileSync(targetPath, secret.toString("base64"), { encoding: "utf8", mode: 0o600 });
	restrictSecretFile(targetPath);
	return secret;
}
