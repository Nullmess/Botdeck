// Modèles (Contrat stable hors Discord.js).

export type Snowflake = string;

export interface GuildSummary {
	id: Snowflake;
	name: string;
	description?: string | null;
	features?: string[];
	premiumTier?: number | null;
	iconUrl?: string | null;
	bannerUrl?: string | null;
	splashUrl?: string | null;
	ownerId?: Snowflake | null;
	memberCount?: number;
	approximatePresenceCount?: number;
	unreadCount: number;
	mentionCount: number;
}

export interface ChannelPermissionsSummary {
	createInstantInvite: boolean;
	kickMembers: boolean;
	banMembers: boolean;
	administrator: boolean;
	manageChannels: boolean;
	manageGuild: boolean;
	addReactions: boolean;
	viewAuditLog: boolean;
	prioritySpeaker: boolean;
	stream: boolean;
	viewChannel: boolean;
	sendMessages: boolean;
	sendTTSMessages: boolean;
	manageMessages: boolean;
	embedLinks: boolean;
	attachFiles: boolean;
	readMessageHistory: boolean;
	mentionEveryone: boolean;
	useExternalEmojis: boolean;
	viewGuildInsights: boolean;
	connect: boolean;
	speak: boolean;
	muteMembers: boolean;
	deafenMembers: boolean;
	moveMembers: boolean;
	useVAD: boolean;
	changeNickname: boolean;
	manageNicknames: boolean;
	manageRoles: boolean;
	manageWebhooks: boolean;
	manageEmojisAndStickers: boolean;
	manageGuildExpressions: boolean;
	useApplicationCommands: boolean;
	requestToSpeak: boolean;
	manageEvents: boolean;
	manageThreads: boolean;
	createPublicThreads: boolean;
	createPrivateThreads: boolean;
	useExternalStickers: boolean;
	sendMessagesInThreads: boolean;
	useEmbeddedActivities: boolean;
	moderateMembers: boolean;
	viewCreatorMonetizationAnalytics: boolean;
	useSoundboard: boolean;
	createGuildExpressions: boolean;
	createEvents: boolean;
	useExternalSounds: boolean;
	sendVoiceMessages: boolean;
	sendPolls: boolean;
	useExternalApps: boolean;
}

export interface ForumTagSummary {
	id: Snowflake;
	name: string;
	emoji?: string | null;
	moderated?: boolean;
}

export interface ForumPostSummary {
	id: Snowflake;
	forumId: Snowflake;
	guildId: Snowflake;
	name: string;
	ownerId?: Snowflake | null;
	createdAt?: string | null;
	lastMessageAt?: string | null;
	messageCount?: number | null;
	memberCount?: number | null;
	archived: boolean;
	locked: boolean;
	tagIds: Snowflake[];
}

export interface ChannelPermissionOverwriteSummary {
	id: Snowflake;
	type: "role" | "member" | "unknown";
	allow: string;
	deny: string;
}

export interface ChannelSummary {
	id: Snowflake;
	guildId: Snowflake;
	name: string;
	type: "category" | "text" | "voice" | "forum" | "thread" | "dm";
	topic?: string | null;
	parentId?: Snowflake | null;
	categoryId?: Snowflake | null;
	categoryName?: string | null;
	position?: number;
	sortIndex?: number;
	lastMessageAt?: string | null;
	memberCount?: number;
	unreadCount: number;
	mentionCount?: number;
	permissions?: ChannelPermissionsSummary;
	/** Base guild permissions for @everyone. Used by the UI permission simulator. */
	everyonePermissions?: string;
	permissionOverwrites?: ChannelPermissionOverwriteSummary[];
	availableTags?: ForumTagSummary[];
}


export type ApplicationCommandScope = "global" | "guild";

export type ApplicationCommandTypeSummary = "Chat Input" | "User" | "Message" | "Unknown";

export type ApplicationCommandDraftType = "chat_input" | "user" | "message";

export type ApplicationCommandOptionTypeSummary =
	| "sub_command"
	| "sub_command_group"
	| "string"
	| "integer"
	| "boolean"
	| "user"
	| "channel"
	| "role"
	| "mentionable"
	| "number"
	| "attachment";

export type ApplicationCommandContextSummary = "guild" | "bot_dm" | "private_channel";
export type ApplicationCommandIntegrationTypeSummary = "guild_install" | "user_install";
export type ApplicationCommandLocalizationMap = Record<string, string>;

export interface ApplicationCommandChoiceSummary {
	name: string;
	value: string | number;
	nameLocalizations?: ApplicationCommandLocalizationMap | null;
}

export interface ApplicationCommandOptionSummary {
	name: string;
	description?: string | null;
	type: string;
	required?: boolean;
	optionCount?: number;
	options?: ApplicationCommandOptionSummary[];
	choices?: ApplicationCommandChoiceSummary[];
	autocomplete?: boolean;
	minValue?: number | null;
	maxValue?: number | null;
	minLength?: number | null;
	maxLength?: number | null;
	channelTypes?: number[];
	nameLocalizations?: ApplicationCommandLocalizationMap | null;
	descriptionLocalizations?: ApplicationCommandLocalizationMap | null;
}

export interface ApplicationCommandDraftOption {
	id: string;
	type: ApplicationCommandOptionTypeSummary;
	name: string;
	description: string;
	required: boolean;
	choices: ApplicationCommandChoiceSummary[];
	autocomplete: boolean;
	minValue?: number | null;
	maxValue?: number | null;
	minLength?: number | null;
	maxLength?: number | null;
	channelTypes: number[];
	nameLocalizations?: ApplicationCommandLocalizationMap | null;
	descriptionLocalizations?: ApplicationCommandLocalizationMap | null;
	options: ApplicationCommandDraftOption[];
}


export type ApplicationCommandRuntimeVisibility = "ephemeral" | "public";
export type ApplicationCommandRuntimeActionType =
	| "reply"
	| "send_embed"
	| "send_menu"
	| "show_modal"
	| "set_welcome_channel"
	| "set_goodbye_channel"
	| "set_logs_channel"
	| "role_automation"
	| "create_ticket_channel"
	| "role_menu"
	| "moderation";

export interface ApplicationCommandRuntimeAction {
	id: string;
	type: ApplicationCommandRuntimeActionType;
	label: string;
	content?: string | null;
	metadata?: Record<string, unknown> | null;
}

export interface ApplicationCommandRuntimeDefinition {
	version: 1;
	intent?: string | null;
	response: {
		content: string;
		visibility: ApplicationCommandRuntimeVisibility;
	};
	workflow: ApplicationCommandRuntimeAction[];
	variables?: string[];
}

export interface ApplicationCommandDraft {
	id?: Snowflake | null;
	scope: ApplicationCommandScope;
	guildId?: Snowflake | null;
	type: ApplicationCommandDraftType;
	name: string;
	description: string;
	nameLocalizations?: ApplicationCommandLocalizationMap | null;
	descriptionLocalizations?: ApplicationCommandLocalizationMap | null;
	options: ApplicationCommandDraftOption[];
	defaultMemberPermissions?: string | null;
	dmPermission?: boolean | null;
	nsfw?: boolean | null;
	contexts?: ApplicationCommandContextSummary[] | null;
	integrationTypes?: ApplicationCommandIntegrationTypeSummary[] | null;
	runtime?: ApplicationCommandRuntimeDefinition | null;
	raw?: Record<string, unknown> | null;
}

export interface ApplicationCommandSummary {
	id: Snowflake;
	applicationId?: Snowflake | null;
	guildId?: Snowflake | null;
	scope: ApplicationCommandScope;
	name: string;
	type: ApplicationCommandTypeSummary;
	description?: string | null;
	optionCount: number;
	options: ApplicationCommandOptionSummary[];
	version?: Snowflake | null;
	defaultMemberPermissions?: string | null;
	dmPermission?: boolean | null;
	nsfw?: boolean | null;
	contexts?: ApplicationCommandContextSummary[] | null;
	integrationTypes?: ApplicationCommandIntegrationTypeSummary[] | null;
	nameLocalizations?: ApplicationCommandLocalizationMap | null;
	descriptionLocalizations?: ApplicationCommandLocalizationMap | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	runtime?: ApplicationCommandRuntimeDefinition | null;
	raw: Record<string, unknown>;
}

export interface UserSummary {
	id: Snowflake;
	username: string;
	displayName?: string | null;
	avatarUrl?: string | null;
	bannerUrl?: string | null;
	avatarDecorationUrl?: string | null;
	bot: boolean;
	supportsApplicationCommands?: boolean;
	status?: "online" | "idle" | "dnd" | "offline";
}

export interface RoleSummary {
	id: Snowflake;
	guildId: Snowflake;
	name: string;
	color?: number | null;
	colorHex?: string | null;
	position: number;
	managed: boolean;
	editable?: boolean;
	hoist?: boolean;
	mentionable?: boolean;
	permissions?: string;
}

export interface GuildInviteSummary {
	guildId: Snowflake;
	code: string;
	url: string;
	channelId?: Snowflake | null;
	channelName?: string | null;
	inviterId?: Snowflake | null;
	inviterName?: string | null;
	uses?: number | null;
	maxUses?: number | null;
	maxAge?: number | null;
	temporary?: boolean;
	createdAt?: string | null;
	expiresAt?: string | null;
}

export interface GuildBanSummary {
	guildId: Snowflake;
	userId: Snowflake;
	username: string;
	displayName?: string | null;
	avatarUrl?: string | null;
	bot: boolean;
	reason?: string | null;
}



export interface GuildMemberSummary {
	guildId: Snowflake;
	userId: Snowflake;
	username: string;
	displayName?: string | null;
	avatarUrl?: string | null;
	bot: boolean;
	roleIds: Snowflake[];
	joinedAt?: string | null;
	timeoutUntil?: string | null;
	inviteCode?: string | null;
}

export type GuildAutomationMessageType = "message" | "embed";
export type GuildAutomationKind = "welcome" | "goodbye" | "logs";
export type GuildRoleAutomationConditionMode = "all" | "any";

export interface GuildAutomationMessageConfig {
	guildId: Snowflake;
	channelId: Snowflake;
	messageType: GuildAutomationMessageType;
	messageTemplate: string;
	embedPagesJson?: string | null;
	enabled: boolean;
}

export interface GuildAutomationLogConfig {
	guildId: Snowflake;
	channelId: Snowflake;
	eventConfigsJson?: string | null;
	enabled: boolean;
}

export interface GuildRoleAutomationRuleConfig {
	id: string;
	guildId: Snowflake;
	roleId: Snowflake;
	enabled: boolean;
	conditionMode: GuildRoleAutomationConditionMode;
	minMessages?: number | null;
	minVoiceSeconds?: number | null;
	minMemberAgeSeconds?: number | null;
	removeWhenInvalid: boolean;
	ignoreBots: boolean;
	applyToExistingMembers: boolean;
	createdAt?: string | null;
	updatedAt?: string | null;
}

export interface GuildRoleAutomationConfig {
	guildId: Snowflake;
	rules: GuildRoleAutomationRuleConfig[];
}

export interface GuildAutomationConfig {
	guildId: Snowflake;
	welcome?: GuildAutomationMessageConfig | null;
	goodbye?: GuildAutomationMessageConfig | null;
	logs?: GuildAutomationLogConfig | null;
	roleAutomation?: GuildRoleAutomationConfig | null;
}


export interface MutualGuildSummary {
	id: Snowflake;
	name: string;
	iconUrl?: string | null;
}

export interface MemberProfileSummary {
	guildId: Snowflake;
	userId: Snowflake;
	username: string;
	displayName?: string | null;
	avatarUrl?: string | null;
	bannerUrl?: string | null;
	avatarDecorationUrl?: string | null;
	bot: boolean;
	supportsApplicationCommands?: boolean;
	roleIds: Snowflake[];
	joinedAt?: string | null;
	timeoutUntil?: string | null;
	voiceChannelId?: Snowflake | null;
	serverMuted?: boolean;
	serverDeafened?: boolean;
	mutualGuilds?: MutualGuildSummary[];
}

export interface MessageSummary {
	id: Snowflake;
	channelId: Snowflake;
	authorId: Snowflake;
	authorTag?: string | null;
	authorAvatarUrl?: string | null;
	content: string;
	createdAt: string;
	editedAt?: string | null;
	pinned?: boolean;
	type?: number;
	attachments?: MessageAttachmentSummary[];
	embeds?: MessageEmbedSummary[];
	reactions?: MessageReactionSummary[];
	replyToMessageId?: Snowflake | null;
	system?: boolean;
	flags?: number;
	ephemeral?: boolean;
}

export interface MessageAttachmentSummary {
	id: Snowflake;
	filename: string;
	url: string;
	contentType?: string | null;
	size: number;
}

export interface UploadAttachmentPayload {
	filename: string;
	contentType?: string | null;
	size: number;
	data: string;
}

export interface EmbedFieldPayload {
	name: string;
	value: string;
	inline?: boolean;
}

export interface EmbedPayload {
	title?: string;
	description?: string;
	url?: string;
	color?: number;
	timestamp?: string;
	author?: {
		name: string;
		url?: string;
		iconUrl?: string;
	};
	footer?: {
		text: string;
		iconUrl?: string;
	};
	imageUrl?: string;
	thumbnailUrl?: string;
	fields?: EmbedFieldPayload[];
}

export interface MessageEmbedSummary {
	title?: string | null;
	description?: string | null;
	url?: string | null;
	color?: number | null;
	timestamp?: string | null;
	authorName?: string | null;
	authorUrl?: string | null;
	authorIconUrl?: string | null;
	footerText?: string | null;
	footerIconUrl?: string | null;
	imageUrl?: string | null;
	thumbnailUrl?: string | null;
	provider?: string | null;
	fields?: EmbedFieldPayload[];
}

export interface MessageReactionSummary {
	emoji: string;
	label: string;
	count: number;
	me: boolean;
}

export interface PresenceSnapshot {
	userId: Snowflake;
	status: "online" | "idle" | "dnd" | "offline";
	activity?: string | null;
	updatedAt: string;
}

export interface VoiceStateSummary {
	userId: Snowflake;
	guildId: Snowflake;
	channelId?: Snowflake | null;
	selfMuted: boolean;
	selfDeafened: boolean;
	serverMuted: boolean;
	serverDeafened: boolean;
	sessionId?: Snowflake | null;
}

export interface WorkspaceLogEntry {
	id: string;
	level: "debug" | "info" | "warn" | "error";
	message: string;
	context?: Record<string, unknown>;
	timestamp: string;
}

export interface WorkspaceState {
	connected: boolean;
	botClientId: string | null;
	selectedBotId: string | null;
	selectedGuildId: string | null;
	selectedChannelId: string | null;
	lastSyncAt: string | null;
	bots: BotAccountSummary[];
	guilds: GuildSummary[];
	channelsByGuild: Record<string, ChannelSummary[]>;
	messagesByChannel: Record<string, MessageSummary[]>;
	pinnedMessagesByChannel: Record<string, MessageSummary[]>;
	usersById: Record<string, UserSummary>;
	rolesByGuildId: Record<string, RoleSummary[]>;
	membersByGuildId: Record<string, GuildMemberSummary[]>;
	invitesByGuildId: Record<string, GuildInviteSummary[]>;
	bansByGuildId: Record<string, GuildBanSummary[]>;
	guildAutomationConfigsByGuildId: Record<string, GuildAutomationConfig>;
	memberProfilesByKey: Record<string, MemberProfileSummary>;
	presencesByUserId: Record<string, PresenceSnapshot>;
	voiceByGuildId: Record<string, VoiceStateSummary[]>;
	forumPostsByChannel: Record<string, ForumPostSummary[]>;
	logs: WorkspaceLogEntry[];
}

export interface BotAccountSummary {
	id: string;
	name: string;
	discordUserId?: string | null;
	avatarUrl?: string | null;
	enabled: boolean;
	status: "offline" | "connecting" | "online" | "error";
	lastConnectedAt?: string | null;
	lastError?: string | null;
	readOnlyMode?: boolean;
	readOnlyBlockMessages?: boolean;
	readOnlyBlockChannels?: boolean;
	readOnlyBlockModeration?: boolean;
	/** @deprecated Use readOnlyMode. Kept for older local databases and UI migrations. */
	commandStudioDisabled?: boolean;
}
