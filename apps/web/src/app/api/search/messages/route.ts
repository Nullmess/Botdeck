// Recherche messages SQLite

export const dynamic = "force-dynamic";

import { noStoreJson } from "@/server/api-response";
import { maxMessageSearchLimit, parseSearchOperators, searchStoredMessages } from "@/server/search/message-search-service";
import { NextRequest } from "next/server";

// Réponse HTTP légère.
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const rawQuery = searchParams.get("q")?.trim() ?? "";
	const { query, operators } = parseSearchOperators(rawQuery);
	const hasOperator = searchParams.get("has") ?? operators.get("has") ?? "";
	const result = await searchStoredMessages({
		botId: searchParams.get("botId"),
		guildId: searchParams.get("guildId"),
		query,
		from: searchParams.get("from") ?? operators.get("from") ?? "",
		inChannel: searchParams.get("in") ?? operators.get("in") ?? "",
		hasFile: hasOperator === "file",
		sort: searchParams.get("sort") === "oldest" ? "asc" : "desc",
		limit: Math.max(1, Math.min(maxMessageSearchLimit, Number(searchParams.get("limit") ?? 60) || 60))
	});
	return noStoreJson(result, { status: result.partialError ? 400 : 200 });
}
