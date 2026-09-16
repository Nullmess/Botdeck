// Protocole UI, SRV, WS.

import type {
	ApplicationCommandDraft,
	ApplicationCommandScope,
	ApplicationCommandSummary,
	ChannelSummary,
	EmbedPayload,
	ForumPostSummary,
	GuildAutomationKind,
	GuildAutomationMessageType,
	GuildAutomationConfig,
	GuildRoleAutomationConditionMode,
	GuildBanSummary,
	GuildInviteSummary,
	GuildMemberSummary,
	GuildSummary,
	MemberProfileSummary,
	MessageSummary,
	PresenceSnapshot,
	RoleSummary,
	UploadAttachmentPayload,
	UserSummary,
	VoiceStateSummary
} from "./models";

export type ClientEvent =
	| { type: "hello"; clientId: string; sentAt: string }
	| { type: "bot.select"; botId: string }
	| { type: "state.guilds"; guilds: GuildSummary[] }
	| { type: "state.channels"; guildId: string; channels: ChannelSummary[] }
	| { type: "state.messages"; channelId: string; messages: MessageSummary[] }
	| { type: "state.forumPosts"; forumId: string; posts: ForumPostSummary[] }
	| { type: "forumPost.created"; forumId: string; post: ForumPostSummary }
	| { type: "forumPost.updated"; forumId: string; post: ForumPostSummary }
	| { type: "forumPost.deleted"; forumId: string; postId: string }
	| { type: "state.pins"; channelId: string; messages: MessageSummary[] }
	| { type: "state.users"; users: UserSummary[] }
	| { type: "state.roles"; guildId: string; roles: RoleSummary[] }
	| { type: "state.members"; guildId: string; members: GuildMemberSummary[] }
	| { type: "state.guildInvites"; guildId: string; invites: GuildInviteSummary[] }
	| { type: "state.guildBans"; guildId: string; bans: GuildBanSummary[] }
	| { type: "state.guildAutomationConfig"; guildId: string; config: GuildAutomationConfig }
	| { type: "guild.updated"; guild: GuildSummary }
	| { type: "member.profile"; profile: MemberProfileSummary }
	| { type: "state.presences"; presences: PresenceSnapshot[] }
	| { type: "state.bots"; bots: import("./models").BotAccountSummary[] }
	| { type: "workspace.ready"; botId: string; readyAt: string; guildIds: string[]; guildCount: number; channelCount: number; userCount: number }
	| { type: "message.created"; message: MessageSummary }
	| { type: "message.updated"; message: MessageSummary }
	| { type: "message.deleted"; channelId: string; messageId: string }
	| { type: "command.completed"; requestId: string; command: ClientCommand["type"] }
	| { type: "command.failed"; requestId: string; command: ClientCommand["type"]; message: string }
	| { type: "presence.updated"; presence: PresenceSnapshot }
	| { type: "voice.updated"; state: VoiceStateSummary }
	| { type: "audit.log"; level: "debug" | "info" | "warn" | "error"; message: string; context?: Record<string, unknown> }
	| { type: "sync.queue"; botId: string; actionId: string; label: string; status: "queued" | "running" | "completed" | "failed"; pending: number; running: number; message?: string | null; updatedAt: string }
	| { type: "applicationCommands.list"; botId: string; guildId?: string | null; globalCommands: ApplicationCommandSummary[]; guildCommands: ApplicationCommandSummary[]; partialError?: string | null }
	| { type: "applicationCommand.created"; botId: string; command: ApplicationCommandSummary }
	| { type: "applicationCommand.updated"; botId: string; command: ApplicationCommandSummary }
	| { type: "applicationCommand.deleted"; botId: string; commandId: string; scope: ApplicationCommandScope; guildId?: string | null };

export interface ClientCommandBase {
	requestId: string;
}

export type ClientCommand =
	| (ClientCommandBase & { type: "bot.select"; botId: string })
	| (ClientCommandBase & { type: "message.send"; botId?: string; channelId: string; content: string; replyToMessageId?: string; attachments?: UploadAttachmentPayload[]; embeds?: EmbedPayload[]; embedPagination?: boolean })
	| (ClientCommandBase & { type: "message.edit"; botId?: string; channelId: string; messageId: string; content: string })
	| (ClientCommandBase & { type: "message.delete"; botId?: string; channelId: string; messageId: string })
	| (ClientCommandBase & { type: "message.pin"; botId?: string; channelId: string; messageId: string; pinned: boolean })
	| (ClientCommandBase & { type: "message.react"; botId?: string; channelId: string; messageId: string; emoji: string })
	| (ClientCommandBase & { type: "message.unreact"; botId?: string; channelId: string; messageId: string; emoji: string })
	| (ClientCommandBase & { type: "channel.sync"; botId?: string; channelId: string; limit?: number })
	| (ClientCommandBase & { type: "channel.pins"; botId?: string; channelId: string })
	| (ClientCommandBase & { type: "channel.move"; botId?: string; guildId: string; channelId: string; targetId: string | null; placement: "before" | "after" | "inside" })
	| (ClientCommandBase & { type: "channel.delete"; botId?: string; guildId: string; channelId: string })
	| (ClientCommandBase & { type: "channel.recreatePurge"; botId?: string; guildId: string; channelId: string; reason?: string; transcript?: boolean; finishMessage?: boolean; confirmation: string })
	| (ClientCommandBase & { type: "guild.profile.update"; botId?: string; guildId: string; name?: string; description?: string | null; iconDataUrl?: string | null })
	| (ClientCommandBase & { type: "guild.members.fetch"; botId?: string; guildId: string })
	| (ClientCommandBase & { type: "guild.roles.fetch"; botId?: string; guildId: string })
	| (ClientCommandBase & { type: "guild.invites.fetch"; botId?: string; guildId: string })
	| (ClientCommandBase & { type: "guild.invite.delete"; botId?: string; guildId: string; code: string })
	| (ClientCommandBase & { type: "guild.invite.create"; botId?: string; guildId: string; channelId: string; maxAge?: number; maxUses?: number; temporary?: boolean; unique?: boolean; reason?: string })
	| (ClientCommandBase & { type: "guild.bans.fetch"; botId?: string; guildId: string })
	| (ClientCommandBase & { type: "guild.ban.create"; botId?: string; guildId: string; userId: string; reason?: string; deleteMessageSeconds?: number })
	| (ClientCommandBase & { type: "guild.ban.delete"; botId?: string; guildId: string; userId: string; reason?: string })
	| (ClientCommandBase & { type: "guild.automation.fetch"; botId?: string; guildId: string })
	| (ClientCommandBase & {
		type: "guild.automation.update";
		botId?: string;
		guildId: string;
		kind: GuildAutomationKind;
		channelId: string;
		messageType?: GuildAutomationMessageType;
		messageTemplate?: string;
		embedPagesJson?: string | null;
		eventConfigsJson?: string | null;
	})
	| (ClientCommandBase & { type: "guild.automation.remove"; botId?: string; guildId: string; kind: GuildAutomationKind })
	| (ClientCommandBase & { type: "guild.automation.test"; botId?: string; guildId: string; kind: GuildAutomationKind })
	| (ClientCommandBase & {
		type: "guild.roleAutomation.upsert";
		botId?: string;
		guildId: string;
		ruleId?: string | null;
		roleId: string;
		enabled: boolean;
		conditionMode: GuildRoleAutomationConditionMode;
		minMessages?: number | null;
		minVoiceSeconds?: number | null;
		minMemberAgeSeconds?: number | null;
		removeWhenInvalid: boolean;
		ignoreBots: boolean;
		applyToExistingMembers: boolean;
	})
	| (ClientCommandBase & { type: "guild.roleAutomation.delete"; botId?: string; guildId: string; ruleId: string })
	| (ClientCommandBase & { type: "guild.roleAutomation.test"; botId?: string; guildId: string; ruleId?: string | null })
	| (ClientCommandBase & { type: "guild.roleAutomation.sync"; botId?: string; guildId: string })
	| (ClientCommandBase & { type: "guild.role.create"; botId?: string; guildId: string; name: string; color?: string | null; permissions?: string; hoist?: boolean; mentionable?: boolean })
	| (ClientCommandBase & { type: "guild.role.update"; botId?: string; guildId: string; roleId: string; name?: string; color?: string | null; permissions?: string; hoist?: boolean; mentionable?: boolean })
	| (ClientCommandBase & { type: "guild.role.permissions.update"; botId?: string; guildId: string; roleId: string; permissions: string })
	| (ClientCommandBase & { type: "guild.role.delete"; botId?: string; guildId: string; roleId: string })
	| (ClientCommandBase & { type: "forum.posts.fetch"; botId?: string; forumId: string; includeArchived?: boolean })
	| (ClientCommandBase & { type: "forum.post.create"; botId?: string; forumId: string; title: string; content: string; tagIds?: string[] })
	| (ClientCommandBase & { type: "forum.post.delete"; botId?: string; threadId: string })
	| (ClientCommandBase & { type: "forum.post.archive"; botId?: string; threadId: string; archived: boolean })
	| (ClientCommandBase & { type: "forum.post.lock"; botId?: string; threadId: string; locked: boolean })
	| (ClientCommandBase & { type: "message.context"; botId?: string; channelId: string; messageId: string; limit?: number })
	| (ClientCommandBase & { type: "dm.open"; botId?: string; userId: string; limit?: number })
	| (ClientCommandBase & {
		type: "presence.set";
		botId?: string;
		status: "online" | "idle" | "dnd" | "offline";
		activity?: {
			type: "playing" | "streaming" | "listening" | "watching" | "competing" | "custom";
			name: string;
			state?: string;
			url?: string;
			emoji?: string;
		} | null;
		activities?: {
			type: "playing" | "streaming" | "listening" | "watching" | "competing" | "custom";
			name: string;
			state?: string;
			url?: string;
			emoji?: string;
		}[];
	})
	| (ClientCommandBase & { type: "user.profile"; botId?: string; userId: string })
	| (ClientCommandBase & { type: "member.profile"; botId?: string; guildId: string; userId: string })
	| (ClientCommandBase & { type: "member.timeout"; botId?: string; guildId: string; userId: string; until: string | null; reason?: string })
	| (ClientCommandBase & { type: "member.kick"; botId?: string; guildId: string; userId: string; reason?: string })
	| (ClientCommandBase & { type: "member.ban"; botId?: string; guildId: string; userId: string; reason?: string; deleteMessageSeconds?: number })
	| (ClientCommandBase & { type: "member.unban"; botId?: string; guildId: string; userId: string; reason?: string })
	| (ClientCommandBase & { type: "member.nick.set"; botId?: string; guildId: string; userId: string; nickname: string | null })
	| (ClientCommandBase & { type: "member.role.add"; botId?: string; guildId: string; userId: string; roleId: string })
	| (ClientCommandBase & { type: "member.role.remove"; botId?: string; guildId: string; userId: string; roleId: string })
	| (ClientCommandBase & { type: "voice.member.move"; botId?: string; guildId: string; userId: string; channelId: string | null })
	| (ClientCommandBase & { type: "applicationCommands.fetch"; botId?: string; guildId?: string | null; allGuilds?: boolean; readOnly?: true; reason?: "autoload" | "manual-refresh" | "profile" })
	| (ClientCommandBase & { type: "applicationCommand.create"; botId?: string; draft: ApplicationCommandDraft; apply: true })
	| (ClientCommandBase & { type: "applicationCommand.update"; botId?: string; commandId: string; draft: ApplicationCommandDraft; apply: true })
	| (ClientCommandBase & { type: "applicationCommand.delete"; botId?: string; commandId: string; scope: ApplicationCommandScope; guildId?: string | null; apply: true })
	| (ClientCommandBase & { type: "ping" });
