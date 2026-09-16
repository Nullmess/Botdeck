// Réducteur espace travail

import type {
	ChannelSummary,
	GuildSummary,
	ForumPostSummary,
	GuildInviteSummary,
	GuildMemberSummary,
	MessageSummary,
	WorkspaceLogEntry,
	WorkspaceState
} from "./models";
import type { ClientEvent } from "./protocol";

const MAX_MESSAGES_PER_CHANNEL = 120;
const MAX_LOG_ENTRIES = 250;

function trim<T>(items: T[], max: number): T[] {
	return items.length > max ? items.slice(items.length - max) : items;
}

// Choisit un salon de repli.
function selectFirstChannel(channelsByGuild: Record<string, ChannelSummary[]>, guildId: string | null): string | null {
	if (!guildId) return null;
	return channelsByGuild[guildId]?.find((channel) => channel.type !== "category")?.id ?? null;
}

// Produit un id de log local.
function nextLogId(): string {
	return `log_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

// État init minimal.
export function createWorkspaceState(partial: Partial<WorkspaceState> = {}): WorkspaceState {
	return {
		connected: false,
		botClientId: null,
		selectedBotId: null,
		selectedGuildId: null,
		selectedChannelId: null,
		lastSyncAt: null,
		bots: [],
		guilds: [],
		channelsByGuild: {},
		messagesByChannel: {},
		pinnedMessagesByChannel: {},
		usersById: {},
		rolesByGuildId: {},
		membersByGuildId: {},
		invitesByGuildId: {},
		bansByGuildId: {},
		guildAutomationConfigsByGuildId: {},
		memberProfilesByKey: {},
		presencesByUserId: {},
		voiceByGuildId: {},
		forumPostsByChannel: {},
		logs: [],
		...partial
	};
}

// Indexe un profil par serveur.
function memberProfileKey(guildId: string, userId: string): string {
	return `${guildId}:${userId}`;
}

// Fusionne les serveurs reçus.
function upsertGuilds(state: WorkspaceState, guilds: GuildSummary[]): WorkspaceState {
	const selectedGuildId = state.selectedGuildId && guilds.some((guild) => guild.id === state.selectedGuildId)
		? state.selectedGuildId
		: guilds[0]?.id ?? null;
	const selectedChannelId = selectFirstChannel(state.channelsByGuild, selectedGuildId);

	return {
		...state,
		guilds,
		selectedGuildId,
		selectedChannelId
	};
}

// Fusionne les salons du serveur.
function upsertChannels(state: WorkspaceState, guildId: string, channels: ChannelSummary[]): WorkspaceState {
	const channelsByGuild = { ...state.channelsByGuild, [guildId]: channels };
	const selectedGuildId = state.selectedGuildId ?? guildId;
	const selectedChannelId =
		state.selectedGuildId === guildId && state.selectedChannelId && channels.some((channel) => channel.id === state.selectedChannelId)
			? state.selectedChannelId
			: selectFirstChannel(channelsByGuild, selectedGuildId);

	return {
		...state,
		channelsByGuild,
		selectedGuildId,
		selectedChannelId
	};
}

// Fusionne l’historique sans doublons.
function upsertMessages(state: WorkspaceState, channelId: string, messages: MessageSummary[]): WorkspaceState {
	return {
		...state,
		messagesByChannel: {
			...state.messagesByChannel,
			[channelId]: trim(messages, MAX_MESSAGES_PER_CHANNEL)
		},
		selectedChannelId: state.selectedChannelId ?? channelId
	};
}


// Remplace les posts d’un forum.
function upsertGuildInvites(state: WorkspaceState, guildId: string, invites: GuildInviteSummary[]): WorkspaceState {
	return {
		...state,
		invitesByGuildId: {
			...state.invitesByGuildId,
			[guildId]: invites
		}
	};
}

function upsertGuildResource<T>(state: WorkspaceState, key: "bansByGuildId", guildId: string, items: T[]): WorkspaceState {
	return {
		...state,
		[key]: {
			...state[key],
			[guildId]: items
		}
	};
}

function upsertForumPosts(state: WorkspaceState, forumId: string, posts: ForumPostSummary[]): WorkspaceState {
	return {
		...state,
		forumPostsByChannel: {
			...state.forumPostsByChannel,
			[forumId]: posts
		}
	};
}

// Ajoute/met à jour un post forum.
function upsertForumPost(state: WorkspaceState, forumId: string, post: ForumPostSummary): WorkspaceState {
	const current = state.forumPostsByChannel[forumId] ?? [];
	const next = current.some((item) => item.id === post.id)
		? current.map((item) => (item.id === post.id ? post : item))
		: [post, ...current];
	return upsertForumPosts(state, forumId, next.sort((a, b) => Date.parse(b.lastMessageAt ?? b.createdAt ?? "0") - Date.parse(a.lastMessageAt ?? a.createdAt ?? "0")));
}

// Retire un post forum.
function removeForumPost(state: WorkspaceState, forumId: string, postId: string): WorkspaceState {
	const current = state.forumPostsByChannel[forumId] ?? [];
	return upsertForumPosts(state, forumId, current.filter((post) => post.id !== postId));
}

// Remplace les messages épinglés.
function upsertPinnedMessages(state: WorkspaceState, channelId: string, messages: MessageSummary[]): WorkspaceState {
	return {
		...state,
		pinnedMessagesByChannel: {
			...state.pinnedMessagesByChannel,
			[channelId]: messages
		}
	};
}

// Ajoute un message live.
function appendMessage(state: WorkspaceState, message: MessageSummary): WorkspaceState {
	const currentMessages = state.messagesByChannel[message.channelId] ?? [];
	const nextMessages = trim(
		currentMessages.some((item) => item.id === message.id)
			? currentMessages.map((item) => (item.id === message.id ? message : item))
			: [...currentMessages, message],
		MAX_MESSAGES_PER_CHANNEL
	);

	return {
		...state,
		messagesByChannel: {
			...state.messagesByChannel,
			[message.channelId]: nextMessages
		},
		selectedChannelId: state.selectedChannelId ?? message.channelId
	};
}

// Met à jour un message connu.
function updateMessage(state: WorkspaceState, message: MessageSummary): WorkspaceState {
	const currentMessages = state.messagesByChannel[message.channelId] ?? [];
	const nextMessages = trim(
		currentMessages.some((item) => item.id === message.id)
			? currentMessages.map((item) => (item.id === message.id ? message : item))
			: [...currentMessages, message],
		MAX_MESSAGES_PER_CHANNEL
	);

	const currentPins = state.pinnedMessagesByChannel[message.channelId];
	const nextPins = currentPins
		? message.pinned
			? currentPins.some((item) => item.id === message.id)
				? currentPins.map((item) => (item.id === message.id ? message : item))
				: [message, ...currentPins]
			: currentPins.filter((item) => item.id !== message.id)
		: undefined;

	return {
		...state,
		messagesByChannel: {
			...state.messagesByChannel,
			[message.channelId]: nextMessages
		},
		pinnedMessagesByChannel: nextPins
			? {
				...state.pinnedMessagesByChannel,
				[message.channelId]: nextPins
			}
			: state.pinnedMessagesByChannel
	};
}

// Ajoute une entrée journalisée.
function pushLog(state: WorkspaceState, entry: Omit<WorkspaceLogEntry, "id" | "timestamp">): WorkspaceState {
	return {
		...state,
		logs: trim(
			[...state.logs, { ...entry, id: nextLogId(), timestamp: new Date().toISOString() }],
			MAX_LOG_ENTRIES
		)
	};
}

// Entrée événements live.
export function applyWorkspaceEvent(state: WorkspaceState, event: ClientEvent): WorkspaceState {
	switch (event.type) {
		case "hello":
			return {
				...state,
				connected: true,
				botClientId: event.clientId,
				lastSyncAt: event.sentAt
			};
		case "bot.select":
			return {
				...state,
				selectedBotId: event.botId
			};
		case "state.guilds":
			return upsertGuilds(state, event.guilds);
		case "state.channels":
			return upsertChannels(state, event.guildId, event.channels);
		case "state.messages":
			return upsertMessages(state, event.channelId, event.messages);
		case "state.forumPosts":
			return upsertForumPosts(state, event.forumId, event.posts);
		case "forumPost.created":
		case "forumPost.updated":
			return upsertForumPost(state, event.forumId, event.post);
		case "forumPost.deleted":
			return removeForumPost(state, event.forumId, event.postId);
		case "state.pins":
			return upsertPinnedMessages(state, event.channelId, event.messages);
		case "state.bots":
			return {
				...state,
				bots: event.bots,
				selectedBotId: state.selectedBotId && event.bots.some((bot) => bot.id === state.selectedBotId) ? state.selectedBotId : null
			};
		case "workspace.ready":
			return {
				...state,
				lastSyncAt: event.readyAt
			};
		case "state.users":
			return {
				...state,
				usersById: {
					...state.usersById,
					...Object.fromEntries(event.users.map((user) => [user.id, user]))
				}
			};
		case "state.roles":
			return {
				...state,
				rolesByGuildId: {
					...state.rolesByGuildId,
					[event.guildId]: event.roles
				}
			};
		case "state.members":
			return {
				...state,
				membersByGuildId: {
					...state.membersByGuildId,
					[event.guildId]: event.members
				},
				usersById: {
					...state.usersById,
					...Object.fromEntries(event.members.map((member) => [member.userId, { id: member.userId, username: member.username, displayName: member.displayName, avatarUrl: member.avatarUrl, bot: member.bot }]))
				}
			};
		case "state.guildInvites":
			return upsertGuildInvites(state, event.guildId, event.invites);
		case "state.guildBans":
			return upsertGuildResource(state, "bansByGuildId", event.guildId, event.bans);
		case "state.guildAutomationConfig":
			return {
				...state,
				guildAutomationConfigsByGuildId: {
					...state.guildAutomationConfigsByGuildId,
					[event.guildId]: event.config
				}
			};
		case "guild.updated":
			return {
				...state,
				guilds: state.guilds.map((guild) => guild.id === event.guild.id ? { ...guild, ...event.guild } : guild)
			};
		case "member.profile": {
			const existingProfile = state.memberProfilesByKey[memberProfileKey(event.profile.guildId, event.profile.userId)];
			return {
				...state,
				memberProfilesByKey: {
					...state.memberProfilesByKey,
					[memberProfileKey(event.profile.guildId, event.profile.userId)]: {
						...existingProfile,
						...event.profile
					}
				},
				usersById: {
					...state.usersById,
					[event.profile.userId]: {
						id: event.profile.userId,
						username: event.profile.username,
						displayName: event.profile.displayName,
						avatarUrl: event.profile.avatarUrl,
						bot: event.profile.bot
					}
				}
			};
		}
		case "state.presences":
			return {
				...state,
				presencesByUserId: {
					...state.presencesByUserId,
					...Object.fromEntries(event.presences.map((presence) => [presence.userId, presence]))
				}
			};
		case "message.created":
			return appendMessage(state, event.message);
		case "message.updated":
			return updateMessage(state, event.message);
		case "message.deleted": {
			const currentMessages = state.messagesByChannel[event.channelId] ?? [];
			const currentPins = state.pinnedMessagesByChannel[event.channelId] ?? [];
			return {
				...state,
				messagesByChannel: {
					...state.messagesByChannel,
					[event.channelId]: currentMessages.filter((message) => message.id !== event.messageId)
				},
				pinnedMessagesByChannel: {
					...state.pinnedMessagesByChannel,
					[event.channelId]: currentPins.filter((message) => message.id !== event.messageId)
				}
			};
		}
		case "presence.updated":
			return {
				...state,
				presencesByUserId: {
					...state.presencesByUserId,
					[event.presence.userId]: event.presence
				}
			};
		case "voice.updated":
			return {
				...state,
				voiceByGuildId: {
					...state.voiceByGuildId,
					[event.state.guildId]: trim(
						[
							...((state.voiceByGuildId[event.state.guildId] ?? []).filter((item) => item.userId !== event.state.userId)),
							event.state
						],
						100
					)
				}
			};
		case "audit.log":
			return pushLog(state, {
				level: event.level,
				message: event.message,
				context: event.context
			});
		default:
			return state;
	}
}
