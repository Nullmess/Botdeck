// Port HTTPS local.

export const dynamic = "force-dynamic";

import { appendAuditLog } from "@/server/audit-log";
import { errorJson, errorMessage, noStoreJson } from "@/server/api-response";
import { assertLocalApiRequest, localSecurityErrorResponse } from "@/server/local-api-security";
import { assertHttpsPortAllowed, assertHttpsPortCanListen, normalizeHttpsPort, readTlsConfig, restartPayload, updateTlsPort } from "@/server/tls-management";

export const runtime = "nodejs";

export async function POST(request: Request) {
	try {
		assertLocalApiRequest(request, "tls.port");
	} catch (error) {
		return localSecurityErrorResponse(error, "Changement du port HTTPS refusé.");
	}
	try {
		const body = await request.json().catch(() => null) as { httpsPort?: unknown } | null;
		const httpsPort = normalizeHttpsPort(body?.httpsPort, 3443);
		assertHttpsPortAllowed(httpsPort);
		const current = await readTlsConfig();
		if (current?.httpsPort !== httpsPort) await assertHttpsPortCanListen(httpsPort);
		const config = await updateTlsPort(httpsPort, request);
		void appendAuditLog({ level: "info", action: "tls.port", message: "HTTPS port changed.", context: { httpsPort } });
		return noStoreJson(restartPayload(request, config));
	} catch (error) {
		return errorJson(errorMessage(error, "Changement du port HTTPS impossible."));
	}
}
