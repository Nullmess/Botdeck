// Sécurité locale du WebSocket Botdeck.

import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

const DEFAULT_WS_PORT = "3001";
const TOKEN_BYTES = 32;
export type WebSocketAuthFailureReason =
	| "missing-token"
	| "invalid-token"
	| "missing-origin"
	| "invalid-origin"
	| "invalid-url"
	| "non-local-listen-host";

export type WebSocketAuthResult =
	| { ok: true }
	| { ok: false; reason: WebSocketAuthFailureReason; message: string };

// Token navigateur local, généré à chaque démarrage du serveur.
const browserWebSocketToken = randomBytes(TOKEN_BYTES).toString("base64url");

function normalizeHost(value: string): string {
	return value.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLoopbackHost(value: string): boolean {
	const host = normalizeHost(value);
	return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function parseBooleanEnv(value: string | undefined): boolean {
	return value === "1" || value?.toLowerCase() === "true" || value?.toLowerCase() === "yes";
}

// Refuse l’écoute publique par défaut.
export function validateWebSocketListenHost(host: string): WebSocketAuthResult {
	if (isLoopbackHost(host)) return { ok: true };
	if (parseBooleanEnv(process.env.BOTDECK_WS_ALLOW_NON_LOCAL)) return { ok: true };
	return {
		ok: false,
		reason: "non-local-listen-host",
		message: `Refusing to expose Botdeck WebSocket on ${host}. Use 127.0.0.1 or set BOTDECK_WS_ALLOW_NON_LOCAL=1 deliberately.`
	};
}

// Donne au frontend légitime le token à placer dans l’URL WebSocket.
export function createBrowserWebSocketAuthToken(): string {
	return browserWebSocketToken;
}

function authTokenFromProtocolHeader(value: string | string[] | undefined): string | null {
	const protocols = (Array.isArray(value) ? value.join(",") : value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
	const botdeckIndex = protocols.indexOf("botdeck");
	if (botdeckIndex >= 0) return protocols[botdeckIndex + 1] ?? null;
	for (const protocol of protocols) {
		if (protocol.startsWith("botdeck-")) return protocol.slice("botdeck-".length);
	}
	return null;
}

function tokenMatches(candidate: string | null): boolean {
	if (!candidate) return false;
	const expected = Buffer.from(browserWebSocketToken, "utf8");
	const received = Buffer.from(candidate, "utf8");
	return expected.length === received.length && timingSafeEqual(expected, received);
}

function requestUrl(request: IncomingMessage): URL | null {
	try {
		return new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${DEFAULT_WS_PORT}`}`);
	} catch {
		return null;
	}
}

function originIsAllowed(origin: string | undefined): boolean {
	if (!origin) return parseBooleanEnv(process.env.BOTDECK_WS_ALLOW_MISSING_ORIGIN);

	let parsed: URL;
	try {
		parsed = new URL(origin);
	} catch {
		return false;
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
	if (!isLoopbackHost(parsed.hostname)) return false;

	const allowedOrigins = process.env.BOTDECK_WS_ALLOWED_ORIGINS
		?.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

	if (!allowedOrigins || allowedOrigins.length === 0) return true;
	return allowedOrigins.includes(parsed.origin);
}

// Validation handshake: token obligatoire + origine locale autorisée.
export function validateWebSocketClient(request: IncomingMessage, origin: string | undefined): WebSocketAuthResult {
	const url = requestUrl(request);
	if (!url) {
		return { ok: false, reason: "invalid-url", message: "Invalid WebSocket request URL." };
	}

	if (!origin && !parseBooleanEnv(process.env.BOTDECK_WS_ALLOW_MISSING_ORIGIN)) {
		return { ok: false, reason: "missing-origin", message: "Missing WebSocket Origin header." };
	}

	if (!originIsAllowed(origin)) {
		return { ok: false, reason: "invalid-origin", message: "WebSocket origin is not allowed." };
	}

	const token = url.searchParams.get("auth") ?? authTokenFromProtocolHeader(request.headers["sec-websocket-protocol"]);
	if (!token) {
		return { ok: false, reason: "missing-token", message: "Missing WebSocket auth token." };
	}

	if (!tokenMatches(token)) {
		return { ok: false, reason: "invalid-token", message: "Invalid WebSocket auth token." };
	}

	return { ok: true };
}
