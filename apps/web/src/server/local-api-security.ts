// Protection des routes API locales sensibles.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { appendAuditLog } from "./audit-log";

const localApiToken = randomBytes(32).toString("base64url");
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export type LocalApiAction =
	| "bot.add"
	| "bot.remove"
	| "tls.generate"
	| "tls.import"
	| "tls.mode"
	| "tls.port";

const rateLimits: Record<LocalApiAction, { windowMs: number; max: number }> = {
	"bot.add": { windowMs: 60_000, max: 3 },
	"bot.remove": { windowMs: 30_000, max: 8 },
	"tls.generate": { windowMs: 10_000, max: 1 },
	"tls.import": { windowMs: 10_000, max: 2 },
	"tls.mode": { windowMs: 10_000, max: 4 },
	"tls.port": { windowMs: 10_000, max: 4 }
};

export function createBrowserLocalApiToken(): string {
	return localApiToken;
}

function normalizeHost(host: string): string {
	return host.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLoopbackHost(host: string): boolean {
	const normalized = normalizeHost(host);
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function originIsLocal(value: string | null): boolean {
	if (!value) return false;
	try {
		const origin = new URL(value);
		return (origin.protocol === "http:" || origin.protocol === "https:") && isLoopbackHost(origin.hostname);
	} catch {
		return false;
	}
}

function requestHostIsLocal(request: Request): boolean {
	const host = request.headers.get("host")?.split(":")[0] ?? "";
	return isLoopbackHost(host) || process.env.BOTDECK_ALLOW_NETWORK === "true";
}

function tokenMatches(candidate: string | null): boolean {
	if (!candidate) return false;
	const expected = Buffer.from(localApiToken, "utf8");
	const received = Buffer.from(candidate, "utf8");
	return expected.length === received.length && timingSafeEqual(expected, received);
}

function clientKey(request: Request): string {
	return [
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
		request.headers.get("x-real-ip"),
		request.headers.get("host"),
		"local"
	].find(Boolean) ?? "local";
}

export function rateLimitLocalAction(request: Request, action: LocalApiAction): void {
	const limit = rateLimits[action];
	const now = Date.now();
	const key = `${action}:${clientKey(request)}`;
	const bucket = rateLimitBuckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		rateLimitBuckets.set(key, { count: 1, resetAt: now + limit.windowMs });
		return;
	}
	bucket.count += 1;
	if (bucket.count > limit.max) {
		throw new Error("Action temporairement bloquée. Réessaie dans quelques secondes.");
	}
}

export function assertLocalApiRequest(request: Request, action: LocalApiAction): void {
	const method = request.method.toUpperCase();
	if (method !== "POST" && method !== "DELETE" && method !== "PUT" && method !== "PATCH") return;

	if (!requestHostIsLocal(request)) {
		throw new Error("Requête refusée: Botdeck accepte uniquement les actions locales.");
	}

	const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase() ?? "";
	if (secFetchSite === "cross-site") {
		void appendAuditLog({ level: "warning", action, message: "Blocked cross-site API request.", context: { secFetchSite } });
		throw new Error("Requête externe refusée.");
	}

	const origin = request.headers.get("origin");
	const referer = request.headers.get("referer");
	if (origin && !originIsLocal(origin)) {
		void appendAuditLog({ level: "warning", action, message: "Blocked API request with invalid origin.", context: { origin } });
		throw new Error("Origine non autorisée.");
	}
	if (!origin && referer && !originIsLocal(referer)) {
		void appendAuditLog({ level: "warning", action, message: "Blocked API request with invalid referer.", context: { referer } });
		throw new Error("Référent non autorisé.");
	}

	if (request.headers.get("x-botdeck-request") !== "1") {
		throw new Error("En-tête Botdeck manquant.");
	}
	if (!tokenMatches(request.headers.get("x-botdeck-local-token"))) {
		void appendAuditLog({ level: "warning", action, message: "Blocked API request with invalid local token." });
		throw new Error("Jeton local invalide.");
	}

	rateLimitLocalAction(request, action);
}

export function localSecurityErrorResponse(error: unknown, fallback: string, status = 403): Response {
	return Response.json(
		{ ok: false, message: error instanceof Error ? error.message : fallback },
		{ status, headers: { "Cache-Control": "no-store, max-age=0" } }
	);
}
