// Génération automatique d'un certificat TLS local.

export const dynamic = "force-dynamic";

import { appendAuditLog } from "@/server/audit-log";
import { errorJson, errorMessage, noStoreJson } from "@/server/api-response";
import { assertLocalApiRequest, localSecurityErrorResponse } from "@/server/local-api-security";
import { assertHttpsPortAllowed, assertHttpsPortCanListen, generateLocalCertificate, normalizeHttpsPort, requestHost, readTlsConfig, restartPayload, saveTlsPair } from "@/server/tls-management";

export const runtime = "nodejs";

export async function POST(request: Request) {
	try {
		assertLocalApiRequest(request, "tls.generate");
	} catch (error) {
		return localSecurityErrorResponse(error, "Génération TLS refusée.");
	}
	try {
		const body = await request.json().catch(() => null) as { httpsPort?: unknown } | null;
		const httpsPort = normalizeHttpsPort(body?.httpsPort, 3443);
		assertHttpsPortAllowed(httpsPort);
		const current = await readTlsConfig();
		if (current?.httpsPort !== httpsPort) await assertHttpsPortCanListen(httpsPort);
		const host = requestHost(request);
		const pair = await generateLocalCertificate(host);
		const config = await saveTlsPair({ ...pair, host, generated: true, mode: "https-only", httpsPort });
		void appendAuditLog({ level: "info", action: "tls.generate", message: "Local TLS certificate generated.", context: { host, httpsPort, validTo: config.validTo } });
		return noStoreJson(restartPayload(request, config));
	} catch (error) {
		return noStoreJson({
			ok: false,
			message: errorMessage(error, "Génération TLS impossible."),
			hint: "La génération locale utilise le moteur crypto intégré. Vérifie surtout que le port HTTPS est libre."
		}, { status: 400 });
	}
}
