// Recherche SRV messages

import { prisma } from "@/lib/prisma";
import type { ChannelSummary, MessageSummary, UserSummary } from "@botdeck/shared";

export const maxMessageSearchLimit = 100;

export type MessageSearchRequest = {
	botId: string | null | undefined;
	guildId: string | null | undefined;
	query: string;
	from: string;
	inChannel: string;
	hasFile: boolean;
	sort: "asc" | "desc";
	limit: number;
};

// Analyse search operators.
export function parseSearchOperators(rawQuery: string): { query: string; operators: Map<string, string> } {
	const query = rawQuery.replace(/\b(from|in|has):(\"[^\"]+\"|\S+)/gi, " ").replace(/\s+/g, " ").trim();
	const operators = new Map<string, string>();
	for (const match of rawQuery.matchAll(/\b(from|in|has):(\"[^\"]+\"|\S+)/gi)) {
		operators.set(match[1].toLowerCase(), match[2].replace(/^\"|\"$/g, "").trim());
	}
	return { query, operators };
}

export function parseJsonArray<T>(value: string | null | undefined): T[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? parsed as T[] : [];
	} catch {
		return [];
	}
}

// Message depuis ligne SQL.
export function messageFromRow(row: Record<string, unknown>): MessageSummary {
	return {
		id: String(row.id),
		channelId: String(row.channelId),
		authorId: String(row.authorId),
		authorTag: typeof row.authorTag === "string" ? row.authorTag : null,
		authorAvatarUrl: typeof row.authorAvatarUrl === "string" ? row.authorAvatarUrl : null,
		content: typeof row.content === "string" ? row.content : "",
		createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
		editedAt: row.editedAt instanceof Date ? row.editedAt.toISOString() : row.editedAt ? String(row.editedAt) : null,
		pinned: Boolean(row.pinned),
		type: typeof row.type === "number" ? row.type : undefined,
		attachments: parseJsonArray(row.attachmentsJson as string | null),
		embeds: parseJsonArray(row.embedsJson as string | null),
		reactions: parseJsonArray(row.reactionsJson as string | null),
		replyToMessageId: typeof row.replyToMessageId === "string" ? row.replyToMessageId : null,
		system: Boolean(row.system)
	};
}

// Salon depuis ligne SQL.
export function channelFromRow(row: Record<string, unknown>): ChannelSummary {
	const rawType = typeof row.type === "string" ? row.type : "text";
	const type = rawType === "category" || rawType === "voice" || rawType === "forum" || rawType === "thread" || rawType === "dm" ? rawType : "text";
	return {
		id: String(row.id),
		guildId: String(row.guildId),
		name: typeof row.name === "string" ? row.name : "salon",
		type,
		topic: typeof row.topic === "string" ? row.topic : null,
		unreadCount: 0,
		mentionCount: 0
	};
}

// Utilisateur depuis ligne SQL.
export function userFromRow(row: Record<string, unknown>): UserSummary {
	return {
		id: String(row.id),
		username: typeof row.username === "string" ? row.username : "unknown",
		displayName: typeof row.displayName === "string" ? row.displayName : null,
		avatarUrl: typeof row.avatarUrl === "string" ? row.avatarUrl : null,
		bot: Boolean(row.bot)
	};
}

// Recherche messages stockés.
export async function searchStoredMessages(request: MessageSearchRequest): Promise<{ groups: { channel: ChannelSummary; messages: MessageSummary[] }[]; usersById: Record<string, UserSummary>; resultCount: number; partialError?: string }> {
	const botId = request.botId?.trim();
	const guildId = request.guildId?.trim();
	const query = request.query.trim();
	const from = request.from.trim().toLowerCase();
	const inChannel = request.inChannel.trim().toLowerCase();
	const limit = Math.max(1, Math.min(maxMessageSearchLimit, request.limit));

	if (!botId || !guildId) return { groups: [], usersById: {}, resultCount: 0, partialError: "botId and guildId are required" };
	if (!query && !from && !inChannel && !request.hasFile) return { groups: [], usersById: {}, resultCount: 0 };

	const db = prisma as unknown as {
		message: { findMany(args: unknown): Promise<Record<string, unknown>[]> };
		channel: { findMany(args: unknown): Promise<Record<string, unknown>[]> };
		user: { findMany(args: unknown): Promise<Record<string, unknown>[]> };
	};

	const channels = await db.channel.findMany({
		where: {
			botAccountId: botId,
			guildId,
			...(inChannel ? { name: { contains: inChannel } } : {})
		}
	});
	const channelById = new Map(channels.map((row) => [String(row.id), channelFromRow(row)]));
	if (!channelById.size) return { groups: [], usersById: {}, resultCount: 0 };

	const andFilters: unknown[] = [];
	if (query) andFilters.push({ OR: [{ content: { contains: query } }, { authorTag: { contains: query } }, { attachmentsJson: { contains: query } }] });
	if (from) andFilters.push({ OR: [{ authorTag: { contains: from } }, { author: { username: { contains: from } } }, { author: { displayName: { contains: from } } }] });
	if (request.hasFile) andFilters.push({ attachmentsJson: { not: null } });

	const messages = await db.message.findMany({
		where: {
			botAccountId: botId,
			channelId: { in: Array.from(channelById.keys()) },
			system: false,
			...(andFilters.length ? { AND: andFilters } : {})
		},
		orderBy: { createdAt: request.sort },
		take: limit
	});

	const userIds = Array.from(new Set(messages.map((message) => String(message.authorId))));
	const users = userIds.length ? await db.user.findMany({ where: { botAccountId: botId, id: { in: userIds } } }) : [];
	const usersById = Object.fromEntries(users.map((row) => [String(row.id), userFromRow(row)]));
	const grouped = new Map<string, MessageSummary[]>();
	for (const row of messages) {
		const message = messageFromRow(row);
		if (request.hasFile && !(message.attachments?.length ?? 0)) continue;
		grouped.set(message.channelId, [...(grouped.get(message.channelId) ?? []), message]);
	}

	const groups = Array.from(grouped.entries())
		.map(([channelId, groupMessages]) => ({ channel: channelById.get(channelId), messages: groupMessages }))
		.filter((group): group is { channel: ChannelSummary; messages: MessageSummary[] } => Boolean(group.channel));

	return { groups, usersById, resultCount: groups.reduce((total, group) => total + group.messages.length, 0) };
}
