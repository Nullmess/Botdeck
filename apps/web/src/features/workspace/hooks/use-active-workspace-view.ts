import { useMemo } from "react";
import type { ChannelSummary, ForumPostSummary, WorkspaceState } from "@botdeck/shared";
import type { BotSettingsState, ChannelActivityState, DismissedEphemeralMessageState, RetainedDmChannel, UiText } from "@/features/workspace/core";
import {
	channelCanAttach,
	channelCanEmbed,
	channelCanSend,
	dmGuildId,
	ephemeralMessageDismissKey,
	isEphemeralMessage,
	isSelectableChannel
} from "@/features/workspace/core";

export type ActiveWorkspaceViewInput = {
	activeBotId: string | null;
	botdeckHomeOpen: boolean;
	selectedGuildId: string | null;
	selectedChannelId: string | null;
	workspace: WorkspaceState;
	text: UiText;
	retainedDms: RetainedDmChannel[];
	channelActivity: ChannelActivityState;
	forumPostsByChannel: Record<string, ForumPostSummary[]>;
	forumSearch: string;
	botSettings: BotSettingsState;
	dismissedEphemeralMessages: DismissedEphemeralMessageState;
};

export function useActiveWorkspaceView({
	activeBotId,
	botdeckHomeOpen,
	selectedGuildId,
	selectedChannelId,
	workspace,
	text,
	retainedDms,
	channelActivity,
	forumPostsByChannel,
	forumSearch,
	botSettings,
	dismissedEphemeralMessages
}: ActiveWorkspaceViewInput) {
	const activeGuildId = activeBotId && !botdeckHomeOpen ? selectedGuildId ?? workspace.guilds[0]?.id ?? null : null;
	const activeGuild = activeBotId && activeGuildId ? workspace.guilds.find((guild) => guild.id === activeGuildId) ?? null : null;
	const activeGuildLabel = activeGuildId === dmGuildId ? text.directMessages : activeGuild?.name ?? null;
	const canOpenServerSettings = Boolean(activeBotId && activeGuild && activeGuildId !== dmGuildId && !botdeckHomeOpen);
	const workspaceDmChannels = workspace.channelsByGuild[dmGuildId] ?? [];
	const workspaceDmChannelIds = useMemo(
		() => new Set(workspaceDmChannels.map((channel) => channel.id)),
		[workspaceDmChannels]
	);

	const retainedDmChannels = useMemo(() => retainedDms
		.map((retained) => workspaceDmChannels.find((channel) => channel.id === retained.id) ?? null)
		.filter((channel): channel is RetainedDmChannel => Boolean(channel))
		.sort((left, right) => {
			if (selectedGuildId === dmGuildId) {
				if (left.id === selectedChannelId) return -1;
				if (right.id === selectedChannelId) return 1;
			}
			const unreadDelta = (channelActivity[right.id]?.unreadCount ?? 0) - (channelActivity[left.id]?.unreadCount ?? 0);
			if (unreadDelta !== 0) return unreadDelta;
			return Date.parse((right as RetainedDmChannel).retainedAt ?? "0") - Date.parse((left as RetainedDmChannel).retainedAt ?? "0");
		}), [channelActivity, retainedDms, selectedChannelId, selectedGuildId, workspaceDmChannels]);

	const activeChannels = useMemo(
		() => activeBotId && activeGuildId ? (activeGuildId === dmGuildId ? retainedDmChannels : workspace.channelsByGuild[activeGuildId] ?? []) : [],
		[activeBotId, activeGuildId, retainedDmChannels, workspace.channelsByGuild]
	);

	const selectedForumPost = useMemo(() => {
		if (!selectedChannelId || !activeGuildId) return null;
		for (const [forumId, posts] of Object.entries(forumPostsByChannel) as [string, ForumPostSummary[]][]) {
			const post = posts.find((item) => item.id === selectedChannelId);
			if (!post || post.guildId !== activeGuildId) continue;
			const parentForum = activeChannels.find((channel) => channel.id === forumId) ?? null;
			return { forumId, post, parentForum };
		}
		return null;
	}, [activeChannels, activeGuildId, forumPostsByChannel, selectedChannelId]);

	const activeChannel = useMemo(() => {
		if (!activeBotId) return null;
		const direct = activeChannels.find((channel) => channel.id === selectedChannelId) ?? null;
		if (direct) return direct;
		if (selectedForumPost) return {
			id: selectedForumPost.post.id,
			guildId: selectedForumPost.post.guildId,
			name: selectedForumPost.post.name,
			type: "thread" as const,
			parentId: selectedForumPost.forumId,
			categoryId: selectedForumPost.parentForum?.categoryId ?? null,
			categoryName: selectedForumPost.parentForum?.categoryName ?? null,
			lastMessageAt: selectedForumPost.post.lastMessageAt ?? selectedForumPost.post.createdAt ?? null,
			unreadCount: 0,
			permissions: selectedForumPost.parentForum?.permissions
		} satisfies ChannelSummary;
		return activeChannels.find(isSelectableChannel) ?? null;
	}, [activeBotId, activeChannels, selectedChannelId, selectedForumPost]);

	const activeChannelCanSend = channelCanSend(activeChannel);
	const activeForumPosts = activeChannel?.type === "forum" ? forumPostsByChannel[activeChannel.id] ?? [] : [];
	const activeForumPostQuery = forumSearch.trim().toLowerCase();
	const visibleForumPosts = activeForumPostQuery
		? activeForumPosts.filter((post) => post.name.toLowerCase().includes(activeForumPostQuery))
		: activeForumPosts;
	const activeForumCanCreate = Boolean(activeChannel?.type === "forum" && (activeChannel.permissions?.createPublicThreads ?? true) && (activeChannel.permissions?.sendMessagesInThreads ?? true));
	const activeForumCanManage = Boolean(activeChannel?.type === "forum" && (activeChannel.permissions?.manageThreads ?? true));
	const activeChannelCanAttach = channelCanAttach(activeChannel);
	const activeChannelCanEmbed = channelCanEmbed(activeChannel);
	const performanceMode = botSettings.performanceMode;
	const activeMessageDisplayLimit = performanceMode ? 80 : 120;

	const rawActiveMessages = activeBotId && activeChannel ? workspace.messagesByChannel[activeChannel.id] ?? [] : [];
	const activeMessages = useMemo(
		() => {
			const visible = rawActiveMessages.filter((message) => !isEphemeralMessage(message) || !dismissedEphemeralMessages[ephemeralMessageDismissKey(message)]);
			return visible.length > activeMessageDisplayLimit ? visible.slice(-activeMessageDisplayLimit) : visible;
		},
		[activeMessageDisplayLimit, rawActiveMessages, dismissedEphemeralMessages]
	);
	const activeMessageById = useMemo(
		() => new Map(activeMessages.map((message) => [message.id, message] as const)),
		[activeMessages]
	);
	const activePinnedMessages = useMemo(
		() => activeChannel ? workspace.pinnedMessagesByChannel[activeChannel.id] ?? activeMessages.filter((message) => message.pinned).reverse() : [],
		[activeChannel, activeMessages, workspace.pinnedMessagesByChannel]
	);

	return {
		activeGuildId,
		activeGuild,
		activeGuildLabel,
		canOpenServerSettings,
		workspaceDmChannels,
		workspaceDmChannelIds,
		retainedDmChannels,
		activeChannels,
		selectedForumPost,
		activeChannel,
		activeChannelCanSend,
		activeForumPosts,
		activeForumPostQuery,
		visibleForumPosts,
		activeForumCanCreate,
		activeForumCanManage,
		activeChannelCanAttach,
		activeChannelCanEmbed,
		performanceMode,
		activeMessageDisplayLimit,
		rawActiveMessages,
		activeMessages,
		activeMessageById,
		activePinnedMessages
	};
}
