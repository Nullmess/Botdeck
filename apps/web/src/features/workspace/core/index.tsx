"use client";

// Socle UI partagé


export {
	createWorkspaceState,
	botAccountIsReadOnly,
	type ApplicationCommandDraft,
	type ApplicationCommandRuntimeDefinition,
	type BotAccountSummary,
	type ChannelSummary,
	type MessageSummary,
	type WorkspaceState
} from "@botdeck/shared";

export { i18nText, uiText } from "./botdeck-app-i18n";
export { detectSystemLanguage, normalizeUiLanguage, readUiLanguage, uiLanguageStorageKey, writeUiLanguage } from "./botdeck-app-i18n";
export type { UiLanguage, UiText } from "./botdeck-app-i18n";

export type { ApplicationCommandsEvent, CommandStatusEvent, SyncQueueEvent, TransportEnvelope, WorkspaceReadyEvent } from "./botdeck-transport";
export { authenticatedWebSocketProtocols, authenticatedWebSocketUrl, browserWebSocketBaseUrl, useBotdeckTransport, workspaceReducer } from "./botdeck-transport";

export {
	allReactionEmojis,
	getVisibleMessageReactions,
	quickReactionEmojis,
	reactionEmojiIndex,
	reactionIdentityKey,
	reactionPickerHeight,
	reactionPickerMargin,
	reactionPickerWidth
} from "./botdeck-reactions";

export {
	cloneEmbedComposerPage,
	createEmbedComposerPage,
	defaultEmbedDraft,
	embedDraftPayloadsFromPages,
	embedDraftToPayload,
	embedHasContent,
	embedSummaryToPayload,
	hexColorToNumber,
	validateEmbedComposerPages,
	validateEmbedDraft
} from "./botdeck-embed-utils";
export type { EmbedComposerPageDraft, EmbedDraftField, EmbedDraftState, EmbedValidationResult } from "./botdeck-embed-utils";

export {
	botCustomStatusMaxLength,
	botEntryFadeDuration,
	botEntryMaximumDuration,
	botEntryMinimumDuration,
	botCustomStatusStorageKey,
	botCustomStatusStoragePrefix,
	botPresenceSettingKeys,
	botPresenceSettingsChanged,
	botSettingsStorageKey,
	botSettingsStoragePrefix,
	channelActivityStorageKey,
	channelActivityStoragePrefix,
	channelSidebarWidthStorageKey,
	clampChannelSidebarWidth,
	clearBestEffortBrowserCaches,
	clearBrowserBotCache,
	clearStoredSlashCommandDraft,
	defaultBotCustomStatus,
	defaultBotSettings,
	disableDiscordPresence,
	dismissedDmStorageKey,
	dismissedDmStoragePrefix,
	dismissedEphemeralMessagesStorageKey,
	dismissedEphemeralMessagesStoragePrefix,
	ephemeralMessageDismissKey,
	formatBotCustomStatus,
	isEphemeralMessage,
	maxChannelSidebarWidth,
	minChannelSidebarWidth,
	presenceLabels,
	readBotCustomStatus,
	readBotSettings,
	readChannelActivityState,
	readChannelSidebarWidth,
	readDismissedDmState,
	readDismissedEphemeralMessageState,
	readRetainedDms,
	readStoredSlashCommandDraft,
	retainedDmStorageKey,
	retainedDmStoragePrefix,
	slashCommandDraftStorageKey,
	slashCommandDraftStoragePrefix,
	writeBotCustomStatus,
	writeBotSettings,
	writeChannelActivityState,
	writeChannelSidebarWidth,
	writeDismissedDmState,
	writeDismissedEphemeralMessageState,
	writeRetainedDms,
	writeStoredSlashCommandDraft
} from "./botdeck-storage";
export type {
	ActivityChoice,
	ActivityPlatformChoice,
	BotCustomStatusState,
	BotSettingsState,
	ChannelActivityState,
	DismissedDmState,
	DismissedEphemeralMessageState,
	PresenceChoice,
	RetainedDmChannel
} from "./botdeck-storage";

export { handleExternalLinkClick } from "./botdeck-event-handlers";
export type { ExternalLinkHandler } from "./botdeck-event-handlers";

export type SlashStudioContext = { source: "home" | "server" | "member"; guildId: string | null; guildName: string | null; label: string; allGuilds?: boolean };
export type SlashSyncState = { status: "idle" | "syncing" | "synced" | "error"; message: string | null; commandId: string | null; updatedAt: string | null };

export type AppToast = {
	id: string;
	message: string;
	tone: "info" | "success" | "warning" | "error";
	leaving: boolean;
};
export type MessageContextMenuState = {
	message: import("@botdeck/shared").MessageSummary;
	x: number;
	y: number;
};
export type ReactionPickerState = {
	messageId: string;
	x: number;
	y: number;
};
export type ExternalLinkPromptState = {
	url: string;
	label: string;
};
export type MediaPreviewState = {
	kind: "image" | "video";
	url: string;
	filename: string;
	contentType?: string | null;
	size?: number;
};
export type MessageSearchGroup = { channel: import("@botdeck/shared").ChannelSummary; messages: import("@botdeck/shared").MessageSummary[] };
export type ServerMessageSearchState = { loading: boolean; groups: MessageSearchGroup[]; usersById: import("@botdeck/shared").WorkspaceState["usersById"]; resultCount: number; error: string | null; source: "local" | "server" };

export {
	appendFirstLaunchRedirectFlag,
	clearFirstLaunchRedirectFlag,
	firstLaunchPresentationCookieName,
	firstLaunchPresentationRedirectFlag,
	firstLaunchPresentationStorageKey,
	firstLaunchPresentationWasSeen,
	markFirstLaunchPresentationSeen
} from "./botdeck-first-launch";

export {
	botdeckFetch,
	clearUiSelection,
	fallbackWorkspaceState,
	fetchJson,
	isBootstrapState,
	localApiHeaders,
	normalizeBootstrapState,
	normalizeWorkspaceState,
	setBrowserLocalApiToken
} from "./botdeck-bootstrap";
export type { BootstrapState } from "./botdeck-bootstrap";

export {
	buildChannelCategoryGroups,
	channelCanAttach,
	channelCanDeleteMessage,
	channelCanEmbed,
	channelCanManageMessages,
	channelCanPinMessage,
	channelCanReact,
	channelCanSend,
	channelTypeRank,
	compareChannelSummaries,
	compareTopLevelChannels,
	dmGuildId,
	firstSelectableChannelId,
	isSelectableChannel,
	memberProfileKey,
	resolveDmChannelUser,
	workspaceEntryIsReady
} from "./botdeck-channel-utils";
export type { ChannelCategoryGroup } from "./botdeck-channel-utils";

export {
	AppBadge,
	ApplicationCommandBadge,
	PinIcon,
	appIconPath,
	discordSnowflakeCreatedAt,
	displayMessageAuthor,
	displayUserName,
	formatTime,
	messageKey,
	profileAccentFromId,
	stripDiscriminator
} from "./botdeck-display-utils";

export {
	BotdeckLogo,
	channelPinnedMessageType,
	extractInlineGifUrls,
	findComposerMention,
	formatFileSize,
	isAudioAttachment,
	isChannelPinSystemMessage,
	isGifAttachment,
	isImageAttachment,
	isInlineGifEmbedForUrls,
	isInlineGifUrl,
	isVideoAttachment,
	linkPattern,
	markdownTokenPattern,
	maxComposerAttachmentSize,
	maxComposerAttachments,
	mentionPattern,
	mentionedUserIds,
	messageListIsAtBottom,
	messageSnippet,
	messageMentionsUser,
	needsInlineGifResolution,
	readFileAsBase64,
	renderInlineMarkdown,
	renderInlinePlainText,
	renderMarkdownToken,
	renderMessageContent,
	renderMessageLine,
	renderMessageTextContent,
	stripInlineGifUrls
} from "./botdeck-message-utils";
export type { ComposerAttachment, ComposerFormat, ComposerMentionState, ComposerSelectionState } from "./botdeck-message-utils";
