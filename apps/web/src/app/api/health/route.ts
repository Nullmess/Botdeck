// Sonde serveur locale

export const dynamic = "force-dynamic";

import { noStoreJson } from "@/server/api-response";

export async function GET() {
	return noStoreJson({
		ok: true,
		service: "botdeck-web",
		timestamp: new Date().toISOString()
	});
}
