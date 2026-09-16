// Mode HTTP/HTTPS local.

export const dynamic = "force-dynamic";

import { appendAuditLog } from "@/server/audit-log";
import { errorJson, errorMessage, noStoreJson } from "@/server/api-response";
import { assertLocalApiRequest, localSecurityErrorResponse } from "@/server/local-api-security";
import { restartPayload, updateTlsMode, type BotdeckTlsMode } from "@/server/tls-management";

export const runtime = "nodejs";

function normalizeMode(value: unknown): BotdeckTlsMode | null {
	return value === "dual" || value === "https-only" ? value : null;
}

export async function POST(request: Request) {
	try {
		assertLocalApiRequest(request, "tls.mode");
	} catch (error) {
		return localSecurityErrorResponse(error, "Changement TLS refusé.");
	}
	try {
		const body = await request.json().catch(() => null) as { mode?: unknown } | null;
		const mode = normalizeMode(body?.mode);
		if (!mode) throw new Error("Mode TLS invalide.");
		const config = await updateTlsMode(mode, request);
		void appendAuditLog({ level: "info", action: "tls.mode", message: "TLS mode changed.", context: { mode } });
		return noStoreJson(restartPayload(request, config));
	} catch (error) {
		return errorJson(errorMessage(error, "Changement TLS impossible."));
	}
}
