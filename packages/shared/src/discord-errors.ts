// Erreurs Discord lisibles.

export type DiscordErrorSeverity = "info" | "warning" | "error";

export interface NormalizedDiscordError {
	code: string;
	userMessage: string;
	technicalMessage: string;
	retryable: boolean;
	severity: DiscordErrorSeverity;
	action?: string | null;
}

const codeMessages: Record<string, Omit<NormalizedDiscordError, "technicalMessage" | "action">> = {
	"401": { code: "401", userMessage: "Discord refuse cette action : le token du bot est invalide ou expiré.", retryable: false, severity: "error" },
	"403": { code: "403", userMessage: "Discord refuse cette action : le bot n'a pas le droit d'accéder à cette ressource.", retryable: false, severity: "error" },
	"429": { code: "429", userMessage: "Discord ralentit les requêtes : trop d'actions envoyées trop vite. Réessaie dans quelques secondes.", retryable: true, severity: "warning" },
	"50013": { code: "50013", userMessage: "Discord refuse cette action : permission manquante pour le bot.", retryable: false, severity: "error" },
	"50035": { code: "50035", userMessage: "Discord refuse cette action : les données envoyées sont invalides.", retryable: false, severity: "error" },
	"10003": { code: "10003", userMessage: "Discord ne trouve plus ce salon. Il a peut-être été supprimé ou le bot n'y a plus accès.", retryable: false, severity: "warning" },
	"10008": { code: "10008", userMessage: "Discord ne trouve plus ce message. Il a peut-être été supprimé.", retryable: false, severity: "warning" },
	"10063": { code: "10063", userMessage: "Discord ne trouve plus cette commande slash. Elle a peut-être été supprimée côté Discord.", retryable: false, severity: "warning" },
	"readonly_database": { code: "readonly_database", userMessage: "Botdeck ne peut pas écrire dans la base locale. Vérifie les permissions du fichier SQLite ou relance l'app depuis un dossier écrivable.", retryable: false, severity: "error" },
	"missing_access": { code: "missing_access", userMessage: "Discord refuse cette action : le bot n'a pas accès à la ressource demandée.", retryable: false, severity: "error" },
	"missing_permissions": { code: "missing_permissions", userMessage: "Discord refuse cette action : il manque des permissions au bot.", retryable: false, severity: "error" },
	"message_content_intent": { code: "message_content_intent", userMessage: "Le contenu des messages est incomplet : active l'intent Message Content dans le portail Discord Developer.", retryable: false, severity: "warning" },
	"network": { code: "network", userMessage: "La connexion à Discord a échoué. Vérifie internet, VPN/proxy ou pare-feu, puis réessaie.", retryable: true, severity: "warning" },
	"unknown": { code: "unknown", userMessage: "Une erreur Discord inconnue s'est produite.", retryable: false, severity: "error" }
};

// Extrait une chaîne sûre.
function readString(value: unknown, key: string): string | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	return typeof record[key] === "string" ? record[key] : null;
}

// Extrait un code Discord.
function readCode(value: unknown): string | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const candidates = [record.code, record.status, record.statusCode, readString(record.rawError, "code")];
	for (const candidate of candidates) {
		if (typeof candidate === "number" || typeof candidate === "bigint") return String(candidate);
		if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
	}
	return null;
}

// Rend l’erreur Discord exploitable.
export function normalizeDiscordError(error: unknown, action?: string | null): NormalizedDiscordError {
	const directMessage = error instanceof Error ? error.message : typeof error === "string" ? error : null;
	const nestedMessage = readString(error, "message") ?? readString((error as { rawError?: unknown } | null)?.rawError, "message");
	const technicalMessage = directMessage ?? nestedMessage ?? "Unknown Discord failure";
	const lower = technicalMessage.toLowerCase();
	const exactCode = readCode(error);
	const inferredCode = exactCode
		?? (/readonly database|attempt to write a readonly database/.test(lower) ? "readonly_database" : null)
		?? (/missing access/.test(lower) ? "missing_access" : null)
		?? (/missing permissions/.test(lower) ? "missing_permissions" : null)
		?? (/message content intent|privileged intent|content intent/.test(lower) ? "message_content_intent" : null)
		?? (/rate.?limit|too many requests/.test(lower) ? "429" : null)
		?? (/connect timeout|connection timeout|timeout|network|econnreset|socket|temporar|fetch failed|undici/.test(lower) ? "network" : null)
		?? (/unauthorized|invalid token/.test(lower) ? "401" : null)
		?? (/forbidden/.test(lower) ? "403" : null)
		?? (/invalid form body/.test(lower) ? "50035" : null)
		?? (/unknown channel/.test(lower) ? "10003" : null)
		?? (/unknown message/.test(lower) ? "10008" : null)
		?? (/unknown application command/.test(lower) ? "10063" : null)
		?? "unknown";
	const preset = codeMessages[inferredCode] ?? codeMessages.unknown;
	return {
		...preset,
		technicalMessage,
		action: action ?? null
	};
}

// Produit le mess utilisateur.
export function discordErrorUserMessage(error: unknown, action?: string | null): string {
	const normalized = normalizeDiscordError(error, action);
	if (normalized.code === "network") return normalized.userMessage;
	return normalized.technicalMessage && normalized.code !== "unknown"
		? `${normalized.userMessage} (${normalized.code})`
		: `${normalized.userMessage} ${normalized.technicalMessage}`.trim();
}
