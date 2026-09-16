// Statut TLS local.

export const dynamic = "force-dynamic";

import { noStoreJson } from "@/server/api-response";
import { readTlsConfig, tlsUrls } from "@/server/tls-management";

export const runtime = "nodejs";

export async function GET(request: Request) {
	const config = await readTlsConfig();
	const urls = tlsUrls(request, config);
	return noStoreJson({
		ok: true,
		configured: Boolean(config),
		mode: config?.mode ?? null,
		generated: config?.generated ?? false,
		fingerprint: config?.fingerprint ?? null,
		validFrom: config?.validFrom ?? null,
		validTo: config?.validTo ?? null,
		currentProtocol: new URL(request.url).protocol.replace(":", ""),
		httpUrl: urls.httpUrl,
		httpsUrl: urls.httpsUrl,
		httpPort: urls.httpPort,
		httpsPort: urls.httpsPort
	});
}
