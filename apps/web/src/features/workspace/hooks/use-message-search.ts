import { useEffect, useMemo, useState } from "react";
import type { ChannelSummary, WorkspaceState } from "@botdeck/shared";
import { dmGuildId, isEphemeralMessage, isSelectableChannel, type MessageSearchGroup, type ServerMessageSearchState } from "@/features/workspace/core";
import { mergeMessageSearchGroups } from "@/components/botdeck-app-widgets";

type UseMessageSearchOptions = {
	activeBotId: string | null;
	activeGuildId: string | null;
	activeChannels: ChannelSummary[];
	workspace: WorkspaceState;
	messageSearch: string;
	messageSearchOpen: boolean;
	performanceMode: boolean;
};

const emptyServerMessageSearch: ServerMessageSearchState = {
	loading: false,
	groups: [],
	usersById: {},
	resultCount: 0,
	error: null,
	source: "local"
};

export function useMessageSearch({
	activeBotId,
	activeGuildId,
	activeChannels,
	workspace,
	messageSearch,
	messageSearchOpen,
	performanceMode
}: UseMessageSearchOptions) {
	const [debouncedMessageSearch, setDebouncedMessageSearch] = useState("");
	const [serverMessageSearch, setServerMessageSearch] = useState<ServerMessageSearchState>(emptyServerMessageSearch);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedMessageSearch(messageSearch), performanceMode ? 260 : 180);
		return () => window.clearTimeout(timer);
	}, [messageSearch, performanceMode]);

	const normalizedMessageSearch = debouncedMessageSearch.trim().toLowerCase();
	const searchableChannels = useMemo(
		() => activeBotId && activeGuildId ? activeChannels.filter(isSelectableChannel) : [],
		[activeBotId, activeGuildId, activeChannels]
	);
	const localMessageSearchGroups: MessageSearchGroup[] = useMemo(() => {
		if (!normalizedMessageSearch) return [];
		const groups: MessageSearchGroup[] = [];
		let remainingResults = performanceMode ? 80 : 220;
		for (const channel of searchableChannels) {
			if (remainingResults <= 0) break;
			const channelMessages = (workspace.messagesByChannel[channel.id] ?? [])
				.filter((message) => {
					if (message.system || isEphemeralMessage(message)) return false;
					const author = workspace.usersById[message.authorId];
					return `${message.content} ${message.authorTag ?? ""} ${author?.displayName ?? ""} ${author?.username ?? ""} ${message.attachments?.map((attachment) => attachment.filename).join(" ") ?? ""}`.toLowerCase().includes(normalizedMessageSearch);
				})
				.slice()
				.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
				.slice(0, remainingResults);
			if (channelMessages.length > 0) {
				groups.push({ channel, messages: channelMessages });
				remainingResults -= channelMessages.length;
			}
		}
		return groups;
	}, [normalizedMessageSearch, performanceMode, searchableChannels, workspace.messagesByChannel, workspace.usersById]);
	const messageSearchGroups = useMemo(
		() => mergeMessageSearchGroups(localMessageSearchGroups, serverMessageSearch.groups),
		[localMessageSearchGroups, serverMessageSearch.groups]
	);
	const messageSearchUsersById = useMemo(
		() => ({ ...workspace.usersById, ...serverMessageSearch.usersById }),
		[workspace.usersById, serverMessageSearch.usersById]
	);
	const messageSearchResultCount = useMemo(
		() => messageSearchGroups.reduce((count, group) => count + group.messages.length, 0),
		[messageSearchGroups]
	);

	useEffect(() => {
		const query = debouncedMessageSearch.trim();
		if (!messageSearchOpen || !activeBotId || !activeGuildId || activeGuildId === dmGuildId || query.length < 2) {
			setServerMessageSearch(emptyServerMessageSearch);
			return;
		}

		const controller = new AbortController();
		setServerMessageSearch((current) => ({ ...current, loading: true, error: null }));
		const timer = window.setTimeout(() => {
			const params = new URLSearchParams({ botId: activeBotId, guildId: activeGuildId, q: query, limit: "100" });
			fetch(`/api/search/messages?${params.toString()}`, { signal: controller.signal })
				.then((response) => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
				.then((payload: { groups?: MessageSearchGroup[]; usersById?: WorkspaceState["usersById"]; resultCount?: number }) => {
					setServerMessageSearch({
						loading: false,
						groups: Array.isArray(payload.groups) ? payload.groups : [],
						usersById: payload.usersById ?? {},
						resultCount: typeof payload.resultCount === "number" ? payload.resultCount : 0,
						error: null,
						source: "server"
					});
				})
				.catch((error) => {
					if (controller.signal.aborted) return;
					setServerMessageSearch({ loading: false, groups: [], usersById: {}, resultCount: 0, error: error instanceof Error ? error.message : "Recherche SQLite indisponible", source: "local" });
				});
		}, 220);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [activeBotId, activeGuildId, debouncedMessageSearch, messageSearchOpen]);

	return {
		messageSearchGroups,
		messageSearchUsersById,
		messageSearchResultCount,
		serverMessageSearch
	};
}
