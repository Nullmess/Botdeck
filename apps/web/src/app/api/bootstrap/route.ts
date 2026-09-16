// Bootstrap UI

export const dynamic = "force-dynamic";

import { getControlPlane } from "@/server/control-plane";
import { createBrowserLocalApiToken } from "@/server/local-api-security";
import { errorJson, noStoreJson } from "@/server/api-response";
import { discordErrorUserMessage } from "@botdeck/shared";

// Réponse HTTP légère.
export async function GET(request: Request) {
	try {
		const plane = getControlPlane();
		const status = await plane.getStatus();
		return noStoreJson({
			workspace: status.workspace,
			bots: status.bots,
			wsAuthToken: plane.createBrowserAuthToken(),
			wsUrl: plane.createBrowserWebSocketUrl(request),
			localApiToken: createBrowserLocalApiToken()
		});
	} catch (error) {
		return errorJson(discordErrorUserMessage(error, "bootstrap"), 500);
	}
}
