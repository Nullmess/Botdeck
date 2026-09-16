// Chiffrement tokens Discord

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface TokenSecretRecord {
	ciphertext: string;
	iv: string;
	authTag: string;
}

// Chiffre un token Discord.
export function encryptToken(value: string, key: Buffer): TokenSecretRecord {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
	return {
		ciphertext: encrypted.toString("base64"),
		iv: iv.toString("base64"),
		authTag: cipher.getAuthTag().toString("base64")
	};
}

// Déchiffre un token stocké.
export function decryptToken(record: TokenSecretRecord, key: Buffer): string {
	const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
	decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(record.ciphertext, "base64")),
		decipher.final()
	]);
	return decrypted.toString("utf8");
}
