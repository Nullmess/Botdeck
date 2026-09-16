// Import d'un certificat TLS local.

export const dynamic = "force-dynamic";

import { appendAuditLog } from "@/server/audit-log";
import { errorJson, errorMessage, noStoreJson } from "@/server/api-response";
import { assertLocalApiRequest, localSecurityErrorResponse } from "@/server/local-api-security";
import { assertHttpsPortAllowed, assertHttpsPortCanListen, normalizeHttpsPort, requestHost, readTlsConfig, restartPayload, saveTlsPair } from "@/server/tls-management";

export const runtime = "nodejs";

async function fileText(value: FormDataEntryValue | null, label: string, maxBytes: number): Promise<string> {
	if (!value || typeof value === "string") throw new Error(`${label} manquant.`);
	if (value.size > maxBytes) throw new Error(`${label} trop volumineux.`);
	const text = await value.text();
	if (!text.trim()) throw new Error(`${label} vide.`);
	return text;
}

export async function POST(request: Request) {
	try {
		assertLocalApiRequest(request, "tls.import");
	} catch (error) {
		return localSecurityErrorResponse(error, "Import TLS refusé.");
	}
	try {
		const form = await request.formData();
		const certificate = await fileText(form.get("certificate"), "Certificat", 128 * 1024);
		const key = await fileText(form.get("key"), "Clé privée", 256 * 1024);
		const httpsPort = normalizeHttpsPort(form.get("httpsPort"), 3443);
		assertHttpsPortAllowed(httpsPort);
		const current = await readTlsConfig();
		if (current?.httpsPort !== httpsPort) await assertHttpsPortCanListen(httpsPort);
		const host = requestHost(request);
		const config = await saveTlsPair({ certificate, key, host, generated: false, mode: "https-only", httpsPort });
		void appendAuditLog({ level: "info", action: "tls.import", message: "TLS certificate imported.", context: { host, httpsPort, validTo: config.validTo } });
		return noStoreJson(restartPayload(request, config));
	} catch (error) {
		return errorJson(errorMessage(error, "Import TLS impossible."));
	}
}
