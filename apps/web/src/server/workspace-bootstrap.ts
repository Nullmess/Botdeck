// Espace local au démarrage

import { prisma } from "@/lib/prisma";
import {
	createWorkspaceState,
	type BotAccountSummary,
	type ChannelSummary,
	type GuildSummary,
	type MessageSummary,
	type PresenceSnapshot,
	type UserSummary,
	type WorkspaceState
} from "@botdeck/shared";
import { ensureDatabaseReady } from "./database-bootstrap";

type GuildRow = Awaited<ReturnType<typeof prisma.guild.findMany>>[number];
type ChannelRow = Awaited<ReturnType<typeof prisma.channel.findMany>>[number];
type UserRow = Awaited<ReturnType<typeof prisma.user.findMany>>[number];
type MessageRow = Awaited<ReturnType<typeof prisma.message.findMany>>[number];
type PresenceRow = Awaited<ReturnType<typeof prisma.presence.findMany>>[number];
type BotAccountRow = Awaited<ReturnType<typeof prisma.botAccount.findMany>>[number];

const BOOTSTRAP_MESSAGE_LIMIT = Math.max(0, Math.min(2000, Number(process.env.BOTDECK_BOOTSTRAP_MESSAGE_LIMIT ?? 600) || 600));
const BOOTSTRAP_MESSAGES_PER_CHANNEL_LIMIT = Math.max(20, Math.min(120, Number(process.env.BOTDECK_BOOTSTRAP_MESSAGES_PER_CHANNEL_LIMIT ?? 80) || 80));

function parseJsonArray<T>(value: string | null): T[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

// Recharge l’état persistant.
export async function loadWorkspaceBootstrap(botAccountId?: string | null): Promise<WorkspaceState> {
	await ensureDatabaseReady();

	const snapshotWhere = botAccountId ? { botAccountId } : { botAccountId: "__no_selected_bot__" };
	const [guildRows, channelRows, userRows, messageRows, presenceRows, botRows] = (await Promise.all([
		prisma.guild.findMany({ where: snapshotWhere, orderBy: { updatedAt: "desc" } }),
		prisma.channel.findMany({ where: snapshotWhere, orderBy: { updatedAt: "desc" } }),
		prisma.user.findMany({ where: snapshotWhere, orderBy: { updatedAt: "desc" } }),
		prisma.message.findMany({ where: snapshotWhere, orderBy: { createdAt: "desc" }, take: BOOTSTRAP_MESSAGE_LIMIT }),
		prisma.presence.findMany({ where: snapshotWhere, orderBy: { updatedAt: "desc" } }),
		prisma.botAccount.findMany({ orderBy: { updatedAt: "desc" } })
	])) as [GuildRow[], ChannelRow[], UserRow[], MessageRow[], PresenceRow[], BotAccountRow[]];

	const guilds: GuildSummary[] = guildRows.map((guild) => ({
		id: guild.id,
		name: guild.name,
		iconUrl: guild.iconUrl,
		unreadCount: 0,
		mentionCount: 0,
		memberCount: undefined,
		approximatePresenceCount: undefined
	}));

	const channels = channelRows.reduce<Record<string, ChannelRow[]>>((acc, channel) => {
		(acc[channel.guildId] ??= []).push(channel);
		return acc;
	}, {});

	const usersById = Object.fromEntries(
		userRows.map((user) => [
			user.id,
			{
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl,
				bot: user.bot,
				status: "offline"
			} satisfies UserSummary
		])
	);

	const messagesByChannel = messageRows.reduce<Record<string, MessageRow[]>>((acc, message) => {
		(acc[message.channelId] ??= []).push(message);
		return acc;
	}, {});

	const presencesByUserId = Object.fromEntries(
		presenceRows.map((presence) => [
			presence.userId,
			{
				userId: presence.userId,
				status: presence.status as PresenceSnapshot["status"],
				activity: presence.activity,
				updatedAt: presence.updatedAt.toISOString()
			} satisfies PresenceSnapshot
		])
	);

	const bots: BotAccountSummary[] = botRows.map((bot) => ({
		id: bot.id,
		name: bot.name,
		discordUserId: bot.discordUserId,
		avatarUrl: bot.avatarUrl,
		enabled: bot.enabled,
		status: "offline",
		lastConnectedAt: bot.lastConnectedAt?.toISOString() ?? null,
		lastError: bot.lastError,
		readOnlyMode: (bot.readOnlyMode === true || bot.commandStudioDisabled === true),
		readOnlyBlockMessages: Boolean(bot.readOnlyBlockMessages),
		readOnlyBlockChannels: Boolean(bot.readOnlyBlockChannels),
		readOnlyBlockModeration: Boolean(bot.readOnlyBlockModeration),
		commandStudioDisabled: Boolean(bot.commandStudioDisabled || bot.readOnlyMode)
	}));

	return createWorkspaceState({
		connected: false,
		bots,
		selectedBotId: botAccountId ?? null,
		guilds,
		channelsByGuild: Object.fromEntries(
			Object.entries(channels).map(([guildId, rows]) => [
				guildId,
				rows.map((channel) => ({
					id: channel.id,
					guildId: channel.guildId,
					name: channel.name,
					type: channel.type as ChannelSummary["type"],
					topic: channel.topic,
					unreadCount: 0
				}))
			])
		),
		usersById,
		messagesByChannel: Object.fromEntries(
			Object.entries(messagesByChannel).map(([channelId, rows]) => [
				channelId,
				[...rows].slice(0, BOOTSTRAP_MESSAGES_PER_CHANNEL_LIMIT).reverse().map(
					(message) =>
						({
							id: message.id,
							channelId: message.channelId,
							authorId: message.authorId,
							authorTag: message.authorTag,
							authorAvatarUrl: message.authorAvatarUrl,
							content: message.content,
							createdAt: message.createdAt.toISOString(),
							editedAt: message.editedAt?.toISOString() ?? null,
							pinned: message.pinned,
							type: message.type ?? undefined,
							attachments: parseJsonArray(message.attachmentsJson),
							embeds: parseJsonArray(message.embedsJson),
							reactions: parseJsonArray(message.reactionsJson),
							replyToMessageId: message.replyToMessageId,
							system: message.system
						}) satisfies MessageSummary
				)
			])
		),
		presencesByUserId
	});
}
