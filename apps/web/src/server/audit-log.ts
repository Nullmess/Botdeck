// Journal d'audit local persistant.

import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { botdeckDataDir } from "./tls-management";

export type AuditLevel = "debug" | "info" | "warning" | "error";

export type AuditEntry = {
	level: AuditLevel;
	action: string;
	message: string;
	context?: Record<string, unknown>;
};

const sensitiveKeyPattern = /(token|secret|password|authorization|auth|certificate|private|key|ciphertext|iv|tag)/i;
const maxStringLength = 500;

function auditDirectory(): string {
	return path.join(botdeckDataDir(), "audit");
}

export function auditLogPath(): string {
	return path.join(auditDirectory(), "security-audit.jsonl");
}

function sanitizeValue(value: unknown, depth = 0): unknown {
	if (depth > 4) return "[truncated]";
	if (typeof value === "string") {
		return value.length > maxStringLength ? `${value.slice(0, maxStringLength)}…` : value;
	}
	if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
	if (value instanceof Error) return { name: value.name, message: value.message };
	if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
	if (typeof value === "object" && value !== null) {
		const output: Record<string, unknown> = {};
		for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
			output[key] = sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeValue(nestedValue, depth + 1);
		}
		return output;
	}
	return String(value);
}

export async function appendAuditLog(entry: AuditEntry): Promise<void> {
	try {
		await mkdir(auditDirectory(), { recursive: true });
		const payload = {
			at: new Date().toISOString(),
			level: entry.level,
			action: entry.action,
			message: entry.message,
			context: sanitizeValue(entry.context ?? {})
		};
		await appendFile(auditLogPath(), `${JSON.stringify(payload)}\n`, { mode: 0o600 });
	} catch (error) {
		if (process.env.BOTDECK_DEBUG_AUDIT === "1") console.warn("[botdeck:audit] unable to write audit log", error);
	}
}
