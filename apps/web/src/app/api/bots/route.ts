// API bots locale

export const dynamic = "force-dynamic";

import { getControlPlane } from "@/server/control-plane";
import { appendAuditLog } from "@/server/audit-log";
import { assertLocalApiRequest, localSecurityErrorResponse } from "@/server/local-api-security";
import { errorJson, okJson } from "@/server/api-response";
import { discordErrorUserMessage } from "@botdeck/shared";

// Normalise token.
function normalizeToken(value: string): string {
	return value.trim().replace(/^["']|["']$/g, "").replace(/^Bot\s+/i, "");
}

// Réponse HTTP légère.
export async function GET() {
	const plane = getControlPlane();
	const status = await plane.getStatus();
	return okJson({ bots: status.bots });
}

// Route POST bots.
export async function POST(request: Request) {
	try {
		assertLocalApiRequest(request, "bot.add");
	} catch (error) {
		return localSecurityErrorResponse(error, "Ajout du bot refusé.");
	}
	const body = (await request.json().catch(() => null)) as {
		name?: string;
		token?: string;
		readOnlyMode?: boolean;
		commandStudioDisabled?: boolean;
		readOnlyBlockMessages?: boolean;
		readOnlyBlockChannels?: boolean;
		readOnlyBlockModeration?: boolean;
	} | null;
	const token = body?.token ? normalizeToken(body.token) : "";
	const name = body?.name?.trim() || undefined;
	const readOnlyMode = body?.readOnlyMode === true || body?.commandStudioDisabled === true;
	const readOnlyOptions = {
		readOnlyMode,
		readOnlyBlockMessages: readOnlyMode && body?.readOnlyBlockMessages === true,
		readOnlyBlockChannels: readOnlyMode && body?.readOnlyBlockChannels === true,
		readOnlyBlockModeration: readOnlyMode && body?.readOnlyBlockModeration === true
	};

	if (!token) {
		return errorJson("Bot token is required.");
	}

	try {
		const plane = getControlPlane();
		const bot = await plane.addBot(token, name, readOnlyOptions);
		void appendAuditLog({ level: "info", action: "bot.add", message: "Bot added or refreshed.", context: { botId: bot.id, botName: bot.name, readOnlyMode } });
		return okJson({ bot });
	} catch (error) {
		return errorJson(discordErrorUserMessage(error, "bot.add"));
	}
}

// Route DELETE bots.
export async function DELETE(request: Request) {
	try {
		assertLocalApiRequest(request, "bot.remove");
	} catch (error) {
		return localSecurityErrorResponse(error, "Suppression du bot refusée.");
	}
	const body = (await request.json().catch(() => null)) as { botId?: string } | null;
	const botId = body?.botId?.trim();

	if (!botId) {
		return errorJson("Bot id is required.");
	}

	try {
		const plane = getControlPlane();
		await plane.removeBot(botId);
		void appendAuditLog({ level: "info", action: "bot.remove", message: "Bot removed from local storage.", context: { botId } });
		return okJson({});
	} catch (error) {
		return errorJson(discordErrorUserMessage(error, "bot.remove"));
	}
}
