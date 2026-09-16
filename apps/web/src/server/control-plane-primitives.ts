// Primitives partagées du control-plane.

import { discordErrorUserMessage } from "@botdeck/shared";

// Horodatage ISO homogène.
export function now(): string {
	return new Date().toISOString();
}

// Nettoie le token Discord.
export function normalizeBotToken(token: string): string {
	return token.trim().replace(/^["']|["']$/g, "").replace(/^Bot\s+/i, "");
}

// Détecte une commande supprimée.
export function isUnknownApplicationCommandError(error: unknown): boolean {
	if (!isRecord(error)) return false;
	const code = error.code;
	const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
	return code === 10063 || message.includes("unknown application command");
}

// Traduit l’échec côté UI.
export function browserCommandFailureMessage(error: unknown, action?: string | null): string {
	return discordErrorUserMessage(error, action);
}

// Parse sans exception remontée.
export function safeJsonParse(value: string): unknown {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return null;
	}
}

// Filtre les objets simples.
export function isRecord(payload: unknown): payload is Record<string, unknown> {
	return typeof payload === "object" && payload !== null;
}

