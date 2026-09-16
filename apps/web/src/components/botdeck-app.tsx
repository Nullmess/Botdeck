"use client";

// Interface principale Botdeck


import {
	botAccountIsReadOnly,
	commandBlockedByReadOnlyPolicy,
	type ApplicationCommandDraft,
	type ApplicationCommandSummary,
	type BotAccountSummary,
	type ChannelSummary,
	type GuildAutomationConfig,
	type GuildAutomationKind,
	type GuildAutomationMessageConfig,
	type GuildRoleAutomationRuleConfig,
	type GuildMemberSummary,
	type ClientCommand,
	type EmbedPayload,
	type ForumPostSummary,
	type MessageAttachmentSummary,
	type MessageSummary,
	type RoleSummary,
	type WorkspaceState
} from "@botdeck/shared";
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { i18nText } from "@/features/workspace/core";
import { useAppToasts } from "@/features/workspace/hooks/use-app-toasts";
import { BotdeckAppStartupView } from "./botdeck-app-startup-view";
import { useChannelSidebarResize } from "@/features/workspace/hooks/use-channel-sidebar-resize";
import { useChannelDrag } from "@/features/workspace/hooks/use-channel-drag";
import { useMessageListScroll } from "@/features/workspace/hooks/use-message-list-scroll";
import { useMessageSearch } from "@/features/workspace/hooks/use-message-search";
import { useActiveWorkspaceView } from "@/features/workspace/hooks/use-active-workspace-view";
import { useChannelActions } from "@/features/workspace/hooks/use-channel-actions";
import { useMemberModerationActions } from "@/features/members/hooks/use-member-moderation-actions";
import { useAddBotModal } from "@/features/workspace/hooks/use-add-bot-modal";
import { BotdeckAppPanels } from "./botdeck-app-panels";
import { BotdeckUserPanel } from "./botdeck-user-panel";
import { BotdeckChatTopbar } from "./botdeck-chat-topbar";
import { BotdeckMessageRows } from "./botdeck-message-list";
import { BotdeckMessageComposer } from "./botdeck-message-composer";
import { BotdeckForumChannelView } from "./botdeck-forum-channel-view";
import { BotdeckChannelSidebar } from "./botdeck-channel-sidebar";
import { BotdeckProjectModal, BotdeckTlsModal } from "@/features/workspace/components/botdeck-launcher-views";

import {
	AppBadge,
	AppToast,
	ApplicationCommandBadge,
	BootstrapState,
	BotCustomStatusState,
	BotSettingsState,
	BotdeckLogo,
	ChannelActivityState,
	ComposerAttachment,
	ComposerFormat,
	ComposerMentionState,
	ComposerSelectionState,
	DismissedDmState,
	DismissedEphemeralMessageState,
	ExternalLinkPromptState,
	MediaPreviewState,
	MessageContextMenuState,
	MessageSearchGroup,
	PinIcon,
	PresenceChoice,
	ReactionPickerState,
	RetainedDmChannel,
	ServerMessageSearchState,
	SlashStudioContext,
	SlashSyncState,
	UiLanguage,
	UiText,
	botCustomStatusMaxLength,
	botEntryFadeDuration,
	botEntryMaximumDuration,
	botEntryMinimumDuration,
	botPresenceSettingsChanged,
	buildChannelCategoryGroups,
	channelCanAttach,
	channelCanDeleteMessage,
	channelCanEmbed,
	channelCanPinMessage,
	channelCanReact,
	channelCanSend,
	clearBestEffortBrowserCaches,
	clearUiSelection,
	defaultBotCustomStatus,
	defaultBotSettings,
	disableDiscordPresence,
	discordSnowflakeCreatedAt,
	displayMessageAuthor,
	displayUserName,
	dmGuildId,
	embedSummaryToPayload,
	ephemeralMessageDismissKey,
	extractInlineGifUrls,
	fallbackWorkspaceState,
	fetchJson,
	findComposerMention,
	firstLaunchPresentationWasSeen,
	clearFirstLaunchRedirectFlag,
	markFirstLaunchPresentationSeen,
	firstSelectableChannelId,
	formatBotCustomStatus,
	formatTime,
	getVisibleMessageReactions,
	handleExternalLinkClick,
	isChannelPinSystemMessage,
	isEphemeralMessage,
	isImageAttachment,
	isInlineGifEmbedForUrls,
	isSelectableChannel,
	maxComposerAttachmentSize,
	maxComposerAttachments,
	memberProfileKey,
	mentionedUserIds,
	messageKey,
	messageMentionsUser,
	messageSnippet,
	normalizeBootstrapState,
	presenceLabels,
	profileAccentFromId,
	quickReactionEmojis,
	reactionEmojiIndex,
	reactionIdentityKey,
	reactionPickerHeight,
	reactionPickerMargin,
	reactionPickerWidth,
	readBotCustomStatus,
	readBotSettings,
	readChannelActivityState,
	readChannelSidebarWidth,
	readDismissedDmState,
	readDismissedEphemeralMessageState,
	readFileAsBase64,
	readRetainedDms,
	readUiLanguage,
	renderMessageContent,
	resolveDmChannelUser,
	slashCommandDraftStorageKey,
	stripDiscriminator,
	stripInlineGifUrls,
	uiText,
	useBotdeckTransport,
	workspaceEntryIsReady,
	writeBotCustomStatus,
	writeBotSettings,
	writeChannelActivityState,
	writeDismissedDmState,
	writeDismissedEphemeralMessageState,
	writeRetainedDms,
	writeUiLanguage
} from "@/features/workspace/core";

import {
	BotHealthDashboardPanel,
	BotSettingsModal,
	ChannelMessagesSkeleton,
	ChannelPermissionsPanel,
	ChannelTypeIcon,
	ConfirmDeleteModal,
	EmbedComposerModal,
	EmbedPreview,
	ExternalLinkModal,
	MediaPreviewModal,
	MessageAttachmentView,
	MessageContextMenu,
	MessageSearchPanel,
	MoreIcon,
	ReplyIcon,
	SettingsIcon,
	SlashStudioEmbedEditor,
	SlashCommandDeleteModal,
	SlashCommandsPanel,
	SmileIcon,
	ToastStack,
	WorkspaceSkeleton,
	ensureCommandRuntime,
	isDiscordSnowflakeId,
	validateCommandDraft
} from "@/components/botdeck-app-widgets";

import { ServerSettingsPanel } from "@/features/server-settings/components/server-settings-panel";
import { serverLabels } from "@/features/server-settings/server-settings-text";
import { BotdeckHomePanel, MemberProfilePanel, TransitionOverlay } from "@/components/botdeck-shell-panels";

import { PinnedMessagesPanel } from "@/features/messages/components/pinned-messages-panel";
import { InlineGifPreview, ChannelContextMenu } from "@/components/botdeck-app-chat-widgets";
import { ChannelDeleteModal, ChannelRecreateModal } from "@/features/workspace/components/channel-modals";
import { GuildRail } from "@/features/workspace/components/guild-rail";
import { Button } from "@/components/ui/button";


// Racine interactive: transport + état.
// Read-only modal policy fields are handled in useAddBotModal: readOnlyBlockMessages, readOnlyBlockChannels, readOnlyBlockModeration.
export default function BotdeckApp() {
	const [language, setLanguage] = useState<UiLanguage>("fr");
	const text = uiText[language];
	const [bootstrap, setBootstrap] = useState<BootstrapState | null>(null);
	const [bootReady, setBootReady] = useState(false);
	const [firstLaunchPresentationReady, setFirstLaunchPresentationReady] = useState(false);
	const [firstLaunchPresentationOpen, setFirstLaunchPresentationOpen] = useState(false);
	const [draft, setDraft] = useState("");
	const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null);
	const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
	const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
	const [switchingBotId, setSwitchingBotId] = useState<string | null>(null);
	const [switchingBotSnapshot, setSwitchingBotSnapshot] = useState<BotAccountSummary | null>(null);
	const [entryOverlayClosing, setEntryOverlayClosing] = useState(false);
	const [exitingBot, setExitingBot] = useState(false);
	const [botdeckHomeOpen, setBotdeckHomeOpen] = useState(false);
	const [channelDrawerOpen, setChannelDrawerOpen] = useState(false);
	const [pendingDmUserId, setPendingDmUserId] = useState<string | null>(null);
	const [memberSearch, setMemberSearch] = useState("");
	const [retainedDms, setRetainedDms] = useState<RetainedDmChannel[]>([]);
	const [dismissedDms, setDismissedDms] = useState<DismissedDmState>({});
	const [dismissedEphemeralMessages, setDismissedEphemeralMessages] = useState<DismissedEphemeralMessageState>({});
	const [channelActivity, setChannelActivity] = useState<ChannelActivityState>({});
	const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
	const [botDeleteTarget, setBotDeleteTarget] = useState<BotAccountSummary | null>(null);
	const [botDeleteBusy, setBotDeleteBusy] = useState(false);
	const [syncingChannelId, setSyncingChannelId] = useState<string | null>(null);
	const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
	const [presenceStatus, setPresenceStatus] = useState<PresenceChoice>("online");
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
	const [guildAutomationOverrides, setGuildAutomationOverrides] = useState<Record<string, GuildAutomationConfig>>({});
	const [botSettings, setBotSettings] = useState<BotSettingsState>(defaultBotSettings);
	const [botCustomStatus, setBotCustomStatus] = useState<BotCustomStatusState>(defaultBotCustomStatus);
	const [botCustomStatusDirty, setBotCustomStatusDirty] = useState(false);
	const [settingsDirty, setSettingsDirty] = useState(false);
	const [replyTarget, setReplyTarget] = useState<MessageSummary | null>(null);
	const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
	const [attachmentBusy, setAttachmentBusy] = useState(false);
	const [draggingFiles, setDraggingFiles] = useState(false);
	const [pinsPanelOpen, setPinsPanelOpen] = useState(false);
	const [permissionsPanelOpen, setPermissionsPanelOpen] = useState(false);
	const [slashCommandsOpen, setSlashCommandsOpen] = useState(false);
	const [botDashboardOpen, setBotDashboardOpen] = useState(false);
	const [slashCommandsLoading, setSlashCommandsLoading] = useState(false);
	const [slashCommands, setSlashCommands] = useState<{ globalCommands: ApplicationCommandSummary[]; guildCommands: ApplicationCommandSummary[]; partialError?: string | null }>({ globalCommands: [], guildCommands: [] });
	const [slashCommandSyncState, setSlashCommandSyncState] = useState<SlashSyncState>({ status: "idle", message: null, commandId: null, updatedAt: null });
	const [slashStudioContext, setSlashStudioContext] = useState<SlashStudioContext>({ source: "server", guildId: null, guildName: null, label: "Serveur" });
	const [slashCommandDeleteTarget, setSlashCommandDeleteTarget] = useState<ApplicationCommandSummary | null>(null);
	const [messageSearchOpen, setMessageSearchOpen] = useState(false);
	const [messageSearch, setMessageSearch] = useState("");
	const [forumSearch, setForumSearch] = useState("");
	const [forumCreating, setForumCreating] = useState(false);
	const [forumDraftTitle, setForumDraftTitle] = useState("");
	const [forumDraftContent, setForumDraftContent] = useState("");
	const [forumDraftTagIds, setForumDraftTagIds] = useState<string[]>([]);
	const [syncingForumId, setSyncingForumId] = useState<string | null>(null);
	const [memberPanelTarget, setMemberPanelTarget] = useState<{ guildId: string; userId: string } | null>(null);
	const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
	const [reactionPicker, setReactionPicker] = useState<ReactionPickerState | null>(null);
	const [reactionSearch, setReactionSearch] = useState("");
	const [hiddenBotOnlyReactionKeys, setHiddenBotOnlyReactionKeys] = useState<Set<string>>(() => new Set());
	const [composerSelection, setComposerSelection] = useState<ComposerSelectionState | null>(null);
	const [composerMention, setComposerMention] = useState<ComposerMentionState | null>(null);
	const [composerMentionIndex, setComposerMentionIndex] = useState(0);
	const [externalLinkPrompt, setExternalLinkPrompt] = useState<ExternalLinkPromptState | null>(null);
	const [projectInfoOpen, setProjectInfoOpen] = useState(false);
	const [tlsSettingsOpen, setTlsSettingsOpen] = useState(false);
	const [messageContextMenu, setMessageContextMenu] = useState<MessageContextMenuState | null>(null);
	const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);
	const [embedModalOpen, setEmbedModalOpen] = useState(false);
	const [channelSidebarWidth, setChannelSidebarWidth] = useState(258);
	const { toasts, pushToast } = useAppToasts();
	const [, startNavTransition] = useTransition();
	const lastSyncQueueToastRef = useRef<string | null>(null);
	const lastErrorLogToastRef = useRef<string | null>(null);
	const seenMessageIdsRef = useRef<Map<string, Set<string>>>(new Map());
	const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const botEntryStartedAtRef = useRef(0);
	const pendingAutoSlashLoadRef = useRef<{ requestId: string; key: string } | null>(null);
	const loadedAutoSlashLoadKeyRef = useRef<string | null>(null);
	const pendingSlashWriteRef = useRef<{ requestId: string; commandId: string | null; name: string; action: "create" | "update" | "delete" } | null>(null);

	const promptExternalLink = (url: string, label = url) => setExternalLinkPrompt({ url, label });
	const closeFirstLaunchPresentation = () => {
		markFirstLaunchPresentationSeen();
		setFirstLaunchPresentationOpen(false);
	};
	const updateLanguage = (nextLanguage: UiLanguage) => {
		setLanguage(nextLanguage);
		writeUiLanguage(nextLanguage);
	};

	useEffect(() => {
		const preferredLanguage = readUiLanguage();
		setLanguage(preferredLanguage);
		document.documentElement.lang = preferredLanguage;
	}, []);

	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);

	useEffect(() => {
		setChannelSidebarWidth(readChannelSidebarWidth());
	}, []);


	useEffect(() => {
		setFirstLaunchPresentationOpen(!firstLaunchPresentationWasSeen());
		clearFirstLaunchRedirectFlag();
		setFirstLaunchPresentationReady(true);
	}, []);

	useEffect(() => {
		let mounted = true;
		const timer = window.setTimeout(() => {
			if (mounted) setBootReady(true);
		}, 3000);

		fetchJson<unknown>("/api/bootstrap")
			.then((data) => {
				if (!mounted) return;
				const normalized = normalizeBootstrapState(data);
				setBootstrap({ ...normalized, workspace: clearUiSelection(normalized.workspace) });
				setSelectedBotId(null);
				setBotdeckHomeOpen(false);
				setSelectedGuildId(null);
				setSelectedChannelId(null);
			})
			.catch((error) => {
				if (!mounted) return;
				pushToast(error instanceof Error ? error.message : text.failedLoadWorkspace, "error");
			});

		return () => {
			mounted = false;
			window.clearTimeout(timer);
		};
	}, [text.failedLoadWorkspace]);

	const activeWorkspace = bootstrap?.workspace ?? fallbackWorkspaceState;
	const transport = useBotdeckTransport(bootReady && Boolean(bootstrap?.wsAuthToken), activeWorkspace, bootstrap?.wsAuthToken ?? null, bootstrap?.wsUrl ?? null);
	const workspace = transport.workspace;
	const forumPostsByChannel = workspace.forumPostsByChannel ?? {};
	const status = transport.status;
	const socketRef = transport.socketRef;
	const lastCommandEvent = transport.lastCommandEvent;
	const lastWorkspaceReadyEvent = transport.lastWorkspaceReadyEvent;
	const lastApplicationCommandsEvent = transport.lastApplicationCommandsEvent;
	const lastSyncQueueEvent = transport.lastSyncQueueEvent;

	useEffect(() => {
		if (!workspace.selectedGuildId) return;
		setSelectedGuildId(workspace.selectedGuildId);
	}, [workspace.selectedGuildId]);

	useEffect(() => {
		if (!workspace.selectedChannelId) return;
		setSelectedChannelId(workspace.selectedChannelId);
	}, [workspace.selectedChannelId]);

	useEffect(() => {
		const lastError = [...workspace.logs].reverse().find((log) => log.level === "error");
		if (!lastError || lastErrorLogToastRef.current === lastError.id) return;
		lastErrorLogToastRef.current = lastError.id;
		const detail = typeof lastError.context?.error === "string" ? lastError.context.error : lastError.message;
		pushToast(detail, "error");
	}, [workspace.logs]);

	useEffect(() => {
		if (!lastCommandEvent) return;
		if (lastCommandEvent.command === "guild.automation.update" || lastCommandEvent.command === "guild.automation.remove" || lastCommandEvent.command === "guild.automation.fetch" || lastCommandEvent.command === "guild.automation.test" || lastCommandEvent.command.startsWith("guild.roleAutomation.")) {
			setGuildAutomationOverrides({});
		}
		const commandSuccessMessages: Record<string, string> = {
			"channel.move": language === "fr" ? "Salon déplacé." : "Channel moved.",
			"guild.profile.update": language === "fr" ? "Profil du serveur mis à jour." : "Server profile updated.",
			"guild.role.create": language === "fr" ? "Rôle créé." : "Role created.",
			"guild.role.update": language === "fr" ? "Rôle mis à jour sur Discord." : "Role updated on Discord.",
			"guild.role.delete": language === "fr" ? "Rôle supprimé." : "Role deleted.",
			"guild.roles.fetch": language === "fr" ? "Rôles actualisés." : "Roles refreshed.",
			"guild.automation.fetch": language === "fr" ? "Automatisations actualisées." : "Automations refreshed.",
			"guild.automation.update": language === "fr" ? "Automatisation enregistrée." : "Automation saved.",
			"guild.automation.remove": language === "fr" ? "Automatisation désactivée." : "Automation disabled.",
			"guild.automation.test": language === "fr" ? "Message de test envoyé." : "Test message sent.",
			"guild.roleAutomation.upsert": language === "fr" ? "Rôle automatique enregistré." : "Role automation saved.",
			"guild.roleAutomation.delete": language === "fr" ? "Rôle automatique supprimé." : "Role automation deleted.",
			"guild.roleAutomation.test": language === "fr" ? "Rôles automatiques vérifiés." : "Role automation checked.",
			"guild.roleAutomation.sync": language === "fr" ? "Rôles automatiques synchronisés." : "Role automation synced."
		};
		if (lastCommandEvent.command !== "message.send" && !(lastCommandEvent.command in commandSuccessMessages)) return;
		if (lastCommandEvent.type === "command.completed") {
			const message = commandSuccessMessages[lastCommandEvent.command];
			if (message) pushToast(message, "success");
			return;
		}
		pushToast(lastCommandEvent.message, "error");
	}, [language, lastCommandEvent]);

	useEffect(() => {
		if (!lastSyncQueueEvent) return;
		const toastKey = `${lastSyncQueueEvent.actionId}:${lastSyncQueueEvent.status}:${lastSyncQueueEvent.updatedAt}`;
		if (lastSyncQueueToastRef.current === toastKey) return;
		lastSyncQueueToastRef.current = toastKey;

		const syncLabel = lastSyncQueueEvent.label?.trim() || "Action Discord";
		const detail = lastSyncQueueEvent.message?.trim();
		const message = lastSyncQueueEvent.status === "queued"
			? `${syncLabel} · ${language === "fr" ? "en attente de synchronisation" : "waiting for sync"}`
			: lastSyncQueueEvent.status === "running"
				? `${syncLabel} · ${language === "fr" ? "synchronisation en cours" : "sync in progress"}`
				: lastSyncQueueEvent.status === "completed"
					? `${syncLabel} · ${language === "fr" ? "synchronisé" : "synced"}`
					: `${syncLabel} · ${language === "fr" ? "échec" : "failed"}${detail ? ` : ${detail}` : ""}`;
		const tone: AppToast["tone"] = lastSyncQueueEvent.status === "completed"
			? "success"
			: lastSyncQueueEvent.status === "failed"
				? "error"
				: "info";
		pushToast(message, tone);
	}, [lastSyncQueueEvent]);

	useEffect(() => {
		const closeFloatingUi = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			if (!target.closest(".reactionPickerWrap") && !target.closest(".reactionPicker")) setReactionPicker(null);
			if (!target.closest(".presenceMenu") && !target.closest(".userAvatarButton")) setPresenceMenuOpen(false);
		};
		window.addEventListener("mousedown", closeFloatingUi);
		return () => window.removeEventListener("mousedown", closeFloatingUi);
	}, []);

	const visibleBots = workspace.bots;
	const transitionBot = switchingBotId ? visibleBots.find((bot) => bot.id === switchingBotId) ?? switchingBotSnapshot : null;

	const activeBotId = selectedBotId;
	const {
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
		visibleForumPosts,
		activeForumCanCreate,
		activeForumCanManage,
		activeChannelCanAttach,
		activeChannelCanEmbed,
		performanceMode,
		activeMessages,
		activeMessageById,
		activePinnedMessages
	} = useActiveWorkspaceView({
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
	});

	const {
		messageSearchGroups,
		messageSearchUsersById,
		messageSearchResultCount,
		serverMessageSearch
	} = useMessageSearch({
		activeBotId,
		activeGuildId,
		activeChannels,
		workspace,
		messageSearch,
		messageSearchOpen,
		performanceMode
	});

	const activeBot = visibleBots.find((bot) => bot.id === activeBotId) ?? null;
	const activeBotReadOnly = botAccountIsReadOnly(activeBot);
	const activeBotReadOnlyCommandBlocked = (type: ClientCommand["type"]) => commandBlockedByReadOnlyPolicy(activeBot, type);
	const activeBotMessagesLocked = activeBotReadOnlyCommandBlocked("message.send");
	const activeBotChannelsLocked = activeBotReadOnlyCommandBlocked("channel.recreatePurge");
	const activeBotModerationLocked = activeBotReadOnlyCommandBlocked("member.kick");
	const activeBotUserId = activeBot?.discordUserId ?? workspace.botClientId;
	const hasActiveBot = Boolean(activeBotId);
	const isDmView = activeGuildId === dmGuildId;

	useEffect(() => {
		if (!switchingBotId || selectedBotId !== switchingBotId || status !== "connected" || entryOverlayClosing) return;
		if (!visibleBots.some((bot) => bot.id === switchingBotId)) return;
		if (!lastWorkspaceReadyEvent || Date.parse(lastWorkspaceReadyEvent.readyAt) < botEntryStartedAtRef.current) return;
		if (!workspaceEntryIsReady(workspace, lastWorkspaceReadyEvent, switchingBotId)) return;

		const elapsed = Date.now() - botEntryStartedAtRef.current;
		const timer = window.setTimeout(() => {
			setEntryOverlayClosing(true);
			window.setTimeout(() => {
				setSwitchingBotId(null);
				setSwitchingBotSnapshot(null);
				setEntryOverlayClosing(false);
			}, botEntryFadeDuration);
		}, Math.max(0, botEntryMinimumDuration - elapsed));

		return () => window.clearTimeout(timer);
	}, [entryOverlayClosing, lastWorkspaceReadyEvent, selectedBotId, status, switchingBotId, workspace, workspace.bots]);

	useEffect(() => {
		if (!switchingBotId || entryOverlayClosing) return;
		const timer = window.setTimeout(() => {
			setEntryOverlayClosing(true);
			window.setTimeout(() => {
				setSwitchingBotId(null);
				setSwitchingBotSnapshot(null);
				setEntryOverlayClosing(false);
			}, botEntryFadeDuration);
		}, botEntryMaximumDuration);
		return () => window.clearTimeout(timer);
	}, [entryOverlayClosing, switchingBotId]);

	const activeChannelGroups = buildChannelCategoryGroups(activeChannels, (channel) => channel.type !== "category" && channel.type !== "dm");
	const activeVoiceStates = activeGuildId ? workspace.voiceByGuildId[activeGuildId] ?? [] : [];
	const selectedMemberProfile = memberPanelTarget ? workspace.memberProfilesByKey[memberProfileKey(memberPanelTarget.guildId, memberPanelTarget.userId)] ?? null : null;
	const activeChannelDmUser = activeChannel?.type === "dm" ? resolveDmChannelUser(activeChannel, workspace, activeBotUserId) : null;
	const channelIsSyncing = Boolean(activeChannel?.id && syncingChannelId === activeChannel.id);
	const { latestMessageByUserId, latestMessageByChannelId } = useMemo(() => {
		const byUserId = new Map<string, string>();
		const byChannelId = new Map<string, string>();
		for (const [channelId, messages] of Object.entries(workspace.messagesByChannel)) {
			const latestMessage = messages[messages.length - 1];
			if (!latestMessage) continue;
			byChannelId.set(channelId, latestMessage.createdAt);
			for (const message of messages) {
				const currentLatest = byUserId.get(message.authorId);
				if (!currentLatest || Date.parse(message.createdAt) > Date.parse(currentLatest)) {
					byUserId.set(message.authorId, message.createdAt);
				}
			}
		}
		return { latestMessageByUserId: byUserId, latestMessageByChannelId: byChannelId };
	}, [workspace.messagesByChannel]);
	const globalMembers = useMemo(
		() => Object.values(workspace.usersById)
			.filter((user) => user.id !== activeBot?.discordUserId && !user.bot)
			.sort((left, right) => {
				const leftLast = latestMessageByUserId.get(left.id);
				const rightLast = latestMessageByUserId.get(right.id);
				if (leftLast || rightLast) return Date.parse(rightLast ?? "0") - Date.parse(leftLast ?? "0");
				const leftPresence = workspace.presencesByUserId[left.id]?.status ?? left.status ?? "offline";
				const rightPresence = workspace.presencesByUserId[right.id]?.status ?? right.status ?? "offline";
				const presenceRank: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };
				return (presenceRank[leftPresence] ?? 4) - (presenceRank[rightPresence] ?? 4) || (left.displayName ?? left.username).localeCompare(right.displayName ?? right.username);
			}),
		[activeBot?.discordUserId, latestMessageByUserId, workspace.presencesByUserId, workspace.usersById]
	);
	const activeBotAsUser: WorkspaceState["usersById"][string] | null = activeBotUserId
		? workspace.usersById[activeBotUserId] ?? {
			id: activeBotUserId,
			username: stripDiscriminator(activeBot?.name ?? "Bot"),
			displayName: stripDiscriminator(activeBot?.name ?? "Bot"),
			avatarUrl: activeBot?.avatarUrl ?? null,
			bot: true,
			status: presenceStatus
		}
		: null;
	const activeChannelMembers = useMemo(() => {
		if (botdeckHomeOpen || !activeChannel) return globalMembers;
		const membersById = new Map<string, WorkspaceState["usersById"][string]>();
		const addUser = (user: WorkspaceState["usersById"][string] | null | undefined) => {
			if (user) membersById.set(user.id, user);
		};
		addUser(activeBotAsUser);
		if (activeChannel.type === "dm") {
			addUser(activeChannelDmUser);
			return Array.from(membersById.values()).sort((left, right) => {
				if (left.id === activeBotUserId) return 1;
				if (right.id === activeBotUserId) return -1;
				return displayUserName(left).localeCompare(displayUserName(right));
			});
		}
		for (const state of activeVoiceStates) {
			if (state.channelId === activeChannel.id) addUser(workspace.usersById[state.userId]);
		}
		for (const message of activeMessages) {
			addUser(workspace.usersById[message.authorId]);
			for (const userId of mentionedUserIds(message.content)) {
				addUser(workspace.usersById[userId]);
			}
		}
		return Array.from(membersById.values()).sort((left, right) => {
			if (left.id === activeBotUserId) return 1;
			if (right.id === activeBotUserId) return -1;
			const leftLast = latestMessageByUserId.get(left.id);
			const rightLast = latestMessageByUserId.get(right.id);
			if (leftLast || rightLast) return Date.parse(rightLast ?? "0") - Date.parse(leftLast ?? "0");
			return displayUserName(left).localeCompare(displayUserName(right));
		});
	}, [activeBotAsUser, activeBotUserId, activeChannel, activeChannelDmUser, activeMessages, activeVoiceStates, botdeckHomeOpen, globalMembers, latestMessageByUserId, workspace.usersById]);
	const composerMentionQuery = composerMention?.query.trim().toLowerCase() ?? "";
	const composerMentionSuggestions = composerMention
		? activeChannelMembers
			.filter((user) => `${user.displayName ?? ""} ${user.username}`.toLowerCase().includes(composerMentionQuery))
			.filter((user) => activeChannel?.type === "dm" || user.id !== activeBotUserId)
			.slice(0, 8)
		: [];
	const dmChannels = retainedDmChannels.map((channel) => ({
		channel,
		guild: { id: dmGuildId, name: text.directMessages, iconUrl: null, unreadCount: 0, mentionCount: 0 }
	}));
	const recoverableDmThreads = dmChannels.sort((left, right) => Date.parse(latestMessageByChannelId.get(right.channel.id) ?? "0") - Date.parse(latestMessageByChannelId.get(left.channel.id) ?? "0"));
	const recoverableThreads = recoverableDmThreads;
	const guildActivityById = Object.fromEntries(
		workspace.guilds.map((guild) => {
			const totals = (workspace.channelsByGuild[guild.id] ?? []).reduce(
				(acc, channel) => {
					const activity = channelActivity[channel.id];
					return {
						unreadCount: acc.unreadCount + (activity?.unreadCount ?? channel.unreadCount ?? 0),
						mentionCount: acc.mentionCount + (activity?.mentionCount ?? channel.mentionCount ?? 0)
					};
				},
				{ unreadCount: 0, mentionCount: 0 }
			);
			return [guild.id, totals];
		})
	);
	const totalDmUnread = retainedDmChannels.reduce((total, channel) => total + (channelActivity[channel.id]?.unreadCount ?? 0), 0);
	const totalDmMentions = retainedDmChannels.reduce((total, channel) => total + (channelActivity[channel.id]?.mentionCount ?? 0), 0);

	useEffect(() => {
		seenMessageIdsRef.current.clear();
		if (!activeBotId) {
			setRetainedDms([]);
			setDismissedDms({});
			setDismissedEphemeralMessages({});
			setChannelActivity({});
			setBotSettings(defaultBotSettings);
			setBotCustomStatus(defaultBotCustomStatus);
			setBotCustomStatusDirty(false);
			setPresenceStatus(defaultBotSettings.status);
			setSettingsDirty(false);
			return;
		}

		const settings = readBotSettings(activeBotId);
		setRetainedDms(readRetainedDms(activeBotId));
		setDismissedDms(readDismissedDmState(activeBotId));
		setDismissedEphemeralMessages(readDismissedEphemeralMessageState(activeBotId));
		setChannelActivity(readChannelActivityState(activeBotId));
		setBotSettings(settings);
		setBotCustomStatus(readBotCustomStatus(activeBotId));
		setBotCustomStatusDirty(false);
		setPresenceStatus(settings.status);
		setSettingsDirty(false);
	}, [activeBotId]);

	useEffect(() => {
		if (!activeBotId) return;

		setRetainedDms((current) => {
			const next = current.filter((channel) => workspaceDmChannelIds.has(channel.id));
			if (next.length === current.length) return current;
			writeRetainedDms(activeBotId, next);
			return next;
		});

		setChannelActivity((current) => {
			let changed = false;
			const next: ChannelActivityState = {};
			for (const [channelId, activity] of Object.entries(current)) {
				const isDmActivity = channelId.startsWith("@me-") || channelId.startsWith("dm-") || selectedGuildId === dmGuildId;
				if (!isDmActivity || workspaceDmChannelIds.has(channelId)) {
					next[channelId] = activity;
				} else {
					changed = true;
				}
			}
			if (!changed) return current;
			writeChannelActivityState(activeBotId, next);
			return next;
		});
	}, [activeBotId, selectedGuildId, workspaceDmChannelIds]);

	const persistChannelActivity = (updater: (current: ChannelActivityState) => ChannelActivityState) => {
		if (!activeBotId) return;
		setChannelActivity((current) => {
			const next = updater(current);
			writeChannelActivityState(activeBotId, next);
			return next;
		});
	};

	const persistDismissedDms = (updater: (current: DismissedDmState) => DismissedDmState) => {
		if (!activeBotId) return;
		setDismissedDms((current) => {
			const next = updater(current);
			writeDismissedDmState(activeBotId, next);
			return next;
		});
	};

	const dismissEphemeralMessage = (message: MessageSummary) => {
		if (!activeBotId) return;
		const key = ephemeralMessageDismissKey(message);
		setDismissedEphemeralMessages((current) => {
			const next = { ...current, [key]: new Date().toISOString() };
			writeDismissedEphemeralMessageState(activeBotId, next);
			return next;
		});
	};

	const persistBotSettings = (next: BotSettingsState) => {
		setBotSettings(next);
		if (activeBotId) writeBotSettings(activeBotId, next);
	};

	const updateBotSettingsDraft = (next: BotSettingsState) => {
		const presenceChanged = botPresenceSettingsChanged(botSettings, next);
		setBotSettings(next);
		setSettingsDirty(true);

		if (presenceChanged && (botCustomStatus.enabled || botCustomStatus.text.trim())) {
			setBotCustomStatus(defaultBotCustomStatus);
			setBotCustomStatusDirty(true);
		}
	};

	const cancelBotSettingsChanges = () => {
		if (!activeBotId) return;
		setBotSettings(readBotSettings(activeBotId));
		setBotCustomStatus(readBotCustomStatus(activeBotId));
		setBotCustomStatusDirty(false);
		setSettingsDirty(false);
	};

	const updateBotCustomStatusDraft = (next: BotCustomStatusState) => {
		const text = next.text.slice(0, botCustomStatusMaxLength);
		const hasCustomStatus = Boolean(next.enabled && text.trim());
		setBotCustomStatus({
			enabled: hasCustomStatus,
			emoji: "",
			text
		});
		setBotCustomStatusDirty(true);

		if (hasCustomStatus && botSettings.activityEnabled) {
			setBotSettings(disableDiscordPresence(botSettings));
			setSettingsDirty(true);
		}
	};

	const cancelBotCustomStatusChanges = () => {
		if (!activeBotId) return;
		setBotCustomStatus(readBotCustomStatus(activeBotId));
		setBotCustomStatusDirty(false);
	};

	const buildCustomStatusActivity = (status: BotCustomStatusState): Extract<ClientCommand, { type: "presence.set" }>["activity"] => {
		const state = status.text.trim().slice(0, botCustomStatusMaxLength);
		if (!status.enabled || !state) return null;
		return {
			type: "custom",
			name: state,
			state
		};
	};

	const buildPresenceActivity = (settings: BotSettingsState): Extract<ClientCommand, { type: "presence.set" }>["activity"] => {
		if (!settings.activityEnabled) return null;
		const name = settings.activityName.trim();
		if (!name) return null;
		const activityUrl = settings.activityType === "streaming" ? settings.activityUrl.trim() : "";
		return {
			type: settings.activityType,
			name,
			state: settings.activityState.trim() || undefined,
			url: activityUrl || undefined
		};
	};

	const buildPresenceActivities = (settings: BotSettingsState, customStatus: BotCustomStatusState): NonNullable<Extract<ClientCommand, { type: "presence.set" }>["activities"]> => {
		const mainActivity = buildPresenceActivity(settings);
		if (mainActivity) return [mainActivity];

		const customActivity = buildCustomStatusActivity(customStatus);
		return customActivity ? [customActivity] : [];
	};

	const sendPresenceSettings = (settings: BotSettingsState, status: PresenceChoice, customStatus: BotCustomStatusState = botCustomStatus): boolean => {
		if (!activeBotId) return false;
		const activities = buildPresenceActivities(settings, customStatus);
		return sendSocketCommand({
			type: "presence.set",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			status,
			activity: activities[0] ?? null,
			activities
		} satisfies ClientCommand);
	};

	const applyBotCustomStatus = () => {
		if (!activeBotId) return;
		const next = {
			...botCustomStatus,
			enabled: Boolean(botCustomStatus.enabled && botCustomStatus.text.trim()),
			emoji: "",
			text: botCustomStatus.text.trim().slice(0, botCustomStatusMaxLength)
		};
		const settingsForPresence = next.enabled ? disableDiscordPresence(botSettings) : botSettings;

		setBotCustomStatus(next);
		writeBotCustomStatus(activeBotId, next);
		setBotCustomStatusDirty(false);

		if (settingsForPresence !== botSettings) {
			persistBotSettings(settingsForPresence);
			setSettingsDirty(false);
		}

		sendPresenceSettings(settingsForPresence, presenceStatus, next);
		pushToast(text.botSettingsApplied, "success");
	};

	useEffect(() => {
		if (!activeBotId || !workspace.guilds.length) return;
		if (botdeckHomeOpen || selectedGuildId === dmGuildId) return;
		const selectedGuildStillExists = selectedGuildId ? workspace.guilds.some((guild) => guild.id === selectedGuildId) : false;
		const nextGuildId = selectedGuildStillExists ? selectedGuildId : workspace.guilds[0]?.id ?? null;
		if (!nextGuildId) return;

		setSelectedGuildId(nextGuildId);
		const guildChannels = workspace.channelsByGuild[nextGuildId] ?? [];
		const selectedChannelStillExists = selectedChannelId
			? guildChannels.some((channel) => channel.id === selectedChannelId) || selectedForumPost?.post.guildId === nextGuildId
			: false;
		if (!selectedChannelStillExists) {
			setSelectedChannelId(firstSelectableChannelId(guildChannels));
		}
	}, [activeBotId, botdeckHomeOpen, selectedChannelId, selectedForumPost, selectedGuildId, workspace.channelsByGuild, workspace.guilds]);

	useEffect(() => {
		if (!activeBotId || !workspaceDmChannels.length) return;
		setRetainedDms((current) => {
			const missing = workspaceDmChannels.filter((channel) => {
				if (current.some((retained) => retained.id === channel.id)) return false;
				const dismissedAt = dismissedDms[channel.id];
				if (!dismissedAt) return true;
				const latestMessageAt = workspace.messagesByChannel[channel.id]?.at(-1)?.createdAt;
				return Boolean(latestMessageAt && Date.parse(latestMessageAt) > Date.parse(dismissedAt));
			});
			if (!missing.length) return current;
			const next = [
				...missing.map((channel) => ({
					...channel,
					retainedAt: workspace.messagesByChannel[channel.id]?.at(-1)?.createdAt ?? new Date().toISOString()
				})),
				...current
			];
			writeRetainedDms(activeBotId, next);
			return next;
		});
	}, [activeBotId, dismissedDms, workspace.messagesByChannel, workspaceDmChannels]);

	useEffect(() => {
		if (!bootReady || !activeBotId) return;
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify({ type: "bot.select", requestId: crypto.randomUUID(), botId: activeBotId } satisfies ClientCommand));
	}, [bootReady, activeBotId, socketRef]);

	useEffect(() => {
		if (!bootReady || !activeChannel?.id) return;
		if (activeChannel.type === "voice" || activeChannel.type === "forum") return;
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		setSyncingChannelId(activeChannel.id);
		socket.send(
			JSON.stringify({
				type: "channel.sync",
				requestId: crypto.randomUUID(),
				botId: activeBotId ?? undefined,
				channelId: activeChannel.id,
				limit: performanceMode ? 60 : 100
			} satisfies ClientCommand)
		);
	}, [bootReady, activeBotId, activeChannel?.id, activeChannel?.type, performanceMode, socketRef]);

	useEffect(() => {
		if (!bootReady || !activeBotId || !activeChannel?.id || activeChannel.type !== "forum") return;
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		setSyncingForumId(activeChannel.id);
		socket.send(JSON.stringify({
			type: "forum.posts.fetch",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			forumId: activeChannel.id,
			includeArchived: true
		} satisfies ClientCommand));
	}, [bootReady, activeBotId, activeChannel?.id, activeChannel?.type, performanceMode, socketRef]);

	useEffect(() => {
		if (!syncingForumId) return;
		if (forumPostsByChannel[syncingForumId]) {
			setSyncingForumId(null);
			return;
		}
		const timer = window.setTimeout(() => setSyncingForumId(null), 1800);
		return () => window.clearTimeout(timer);
	}, [syncingForumId, forumPostsByChannel]);

	useEffect(() => {
		if (activeChannel?.type !== "forum") {
			setForumCreating(false);
			setForumSearch("");
			setForumDraftTitle("");
			setForumDraftContent("");
			setForumDraftTagIds([]);
		}
	}, [activeChannel?.id, activeChannel?.type]);

	useEffect(() => {
		if (!syncingChannelId) return;
		if (workspace.messagesByChannel[syncingChannelId]) {
			setSyncingChannelId(null);
			return;
		}
		const timer = window.setTimeout(() => setSyncingChannelId(null), 1800);
		return () => window.clearTimeout(timer);
	}, [syncingChannelId, workspace.messagesByChannel]);

	useEffect(() => {
		if (!pendingDmUserId || !activeBotId) return;
		const channel = (workspace.channelsByGuild[dmGuildId] ?? []).find((item) => item.topic === `user:${pendingDmUserId}`);
		if (!channel) return;
		setRetainedDms((current) => {
			const next = [{ ...channel, retainedAt: new Date().toISOString() }, ...current.filter((item) => item.id !== channel.id)];
			writeRetainedDms(activeBotId, next);
			return next;
		});
		persistDismissedDms((current) => {
			if (!current[channel.id]) return current;
			const next = { ...current };
			delete next[channel.id];
			return next;
		});
		setBotdeckHomeOpen(false);
		setSelectedGuildId(dmGuildId);
		setSelectedChannelId(channel.id);
		setSyncingChannelId(channel.id);
		setPendingDmUserId(null);
	}, [activeBotId, pendingDmUserId, workspace.channelsByGuild]);

	useEffect(() => {
		if (!activeBotId || !activeBot) return;
		const botUserId = activeBot.discordUserId ?? workspace.botClientId;
		const increments: ChannelActivityState = {};

		for (const [channelId, messages] of Object.entries(workspace.messagesByChannel)) {
			const seen = seenMessageIdsRef.current.get(channelId);
			if (!seen) {
				seenMessageIdsRef.current.set(channelId, new Set(messages.map((message) => message.id)));
				continue;
			}

			let incomingCount = 0;
			let mentionCount = 0;
			for (const message of messages) {
				if (seen.has(message.id)) continue;
				seen.add(message.id);
				if (message.authorId === botUserId) continue;
				incomingCount += 1;
				if (messageMentionsUser(message, botUserId)) mentionCount += 1;
			}

			if (incomingCount > 0 && selectedChannelId !== channelId) {
				increments[channelId] = { unreadCount: incomingCount, mentionCount };
			}
		}

		if (Object.keys(increments).length) {
			persistChannelActivity((current) => {
				const next = { ...current };
				for (const [channelId, counts] of Object.entries(increments)) {
					const currentCounts = next[channelId] ?? { unreadCount: 0, mentionCount: 0 };
					next[channelId] = {
						unreadCount: currentCounts.unreadCount + counts.unreadCount,
						mentionCount: currentCounts.mentionCount + counts.mentionCount
					};
				}
				return next;
			});
		}
	}, [activeBot, activeBotId, selectedChannelId, workspace.botClientId, workspace.messagesByChannel]);

	useEffect(() => {
		if (!activeBotId || !selectedChannelId) return;
		persistChannelActivity((current) => {
			if (!current[selectedChannelId]) return current;
			const next = { ...current };
			delete next[selectedChannelId];
			return next;
		});
	}, [activeBotId, selectedChannelId]);

	const {
		messageListRef,
		messageListAtBottom,
		setMessageListAtBottom,
		scrollMessageListToBottom,
		updateMessageListBottomState
	} = useMessageListScroll({
		activeBotId,
		activeChannel,
		activeMessages,
		channelIsSyncing,
		botdeckHomeOpen,
		pendingScrollMessageId,
		setPendingScrollMessageId
	});

	useEffect(() => {
		if (replyTarget && replyTarget.channelId !== activeChannel?.id) {
			setReplyTarget(null);
		}
	}, [activeChannel?.id, replyTarget]);

	useEffect(() => {
		if (!pendingDmUserId) return;
		const timer = window.setTimeout(() => {
			setPendingDmUserId(null);
			pushToast(text.couldNotOpenDm, "warning");
		}, 8000);
		return () => window.clearTimeout(timer);
	}, [pendingDmUserId, text.couldNotOpenDm]);

	const refreshBootstrap = async (preferredBotId?: string | null) => {
		const data = normalizeBootstrapState(await fetchJson<unknown>("/api/bootstrap"));
		const workspaceBotId = preferredBotId && data.bots.some((bot) => bot.id === preferredBotId) ? preferredBotId : null;
		const initialGuild = workspaceBotId ? data.workspace.selectedGuildId ?? data.workspace.guilds[0]?.id ?? null : null;
		const bootstrapState = workspaceBotId ? data : { ...data, workspace: clearUiSelection(data.workspace) };

		setBootstrap(bootstrapState);
		setSelectedBotId(workspaceBotId);
		setBotdeckHomeOpen(Boolean(workspaceBotId));
		setSelectedGuildId(initialGuild);
		setSelectedChannelId(
			workspaceBotId ? data.workspace.selectedChannelId ?? (initialGuild ? firstSelectableChannelId(data.workspace.channelsByGuild[initialGuild] ?? []) : null) : null
		);
		return data;
	};

	const { botModal, openAddBot } = useAddBotModal({
		text,
		visibleBots,
		botEntryStartedAtRef,
		startNavTransition,
		setSwitchingBotSnapshot,
		setEntryOverlayClosing,
		setSwitchingBotId,
		setSelectedBotId,
		setBotdeckHomeOpen,
		setSelectedGuildId,
		setSelectedChannelId,
		setSyncingChannelId,
		pushToast,
		refreshBootstrap,
		promptExternalLink
	});


	const externalLinkModal = externalLinkPrompt ? (
		<ExternalLinkModal
			prompt={externalLinkPrompt}
			onCancel={() => setExternalLinkPrompt(null)}
			text={text}
		/>
	) : null;

	const projectInfoModal = projectInfoOpen ? (
		<BotdeckProjectModal
			language={language}
			onClose={() => setProjectInfoOpen(false)}
			onExternalLink={promptExternalLink}
		/>
	) : null;

	const tlsSettingsModal = tlsSettingsOpen ? (
		<BotdeckTlsModal
			language={language}
			onClose={() => setTlsSettingsOpen(false)}
		/>
	) : null;

	const selectBot = (botId: string) => {
		const targetBot = visibleBots.find((bot) => bot.id === botId) ?? null;
		setSwitchingBotSnapshot(targetBot);
		botEntryStartedAtRef.current = Date.now();
		setEntryOverlayClosing(false);
		setSwitchingBotId(botId);
		startNavTransition(() => {
			setSelectedBotId(botId);
			setBotdeckHomeOpen(true);
			setSelectedGuildId(null);
			setSelectedChannelId(null);
			setSyncingChannelId(null);
		});
		const socket = socketRef.current;
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: "bot.select", requestId: crypto.randomUUID(), botId } satisfies ClientCommand));
		} else {
			void refreshBootstrap(botId);
		}
	};

	const exitBot = () => {
		if (!selectedBotId) {
			setSelectedGuildId(null);
			setSelectedChannelId(null);
			return;
		}
		setExitingBot(true);
		window.setTimeout(() => {
			setSelectedBotId(null);
			setBotdeckHomeOpen(false);
			setSelectedGuildId(null);
			setSelectedChannelId(null);
			setExitingBot(false);
		}, 280);
	};

	const confirmRemoveBot = (bot: BotAccountSummary) => {
		setBotDeleteTarget(bot);
	};

	const deleteBot = async () => {
		if (!botDeleteTarget) return;
		setBotDeleteBusy(true);
		try {
			const deletedBotId = botDeleteTarget.id;
			await fetchJson<{ ok: boolean }>("/api/bots", {
				method: "DELETE",
				body: JSON.stringify({ botId: deletedBotId })
			});
			await clearBestEffortBrowserCaches(deletedBotId);
			setRetainedDms([]);
			setDismissedDms({});
			setDismissedEphemeralMessages({});
			setChannelActivity({});
			setBotSettings(defaultBotSettings);
			setSettingsDirty(false);
			setReplyTarget(null);
			setComposerAttachments([]);
			setPendingDmUserId(null);
			setSelectedBotId(null);
			setBotdeckHomeOpen(false);
			setSelectedGuildId(null);
			setSelectedChannelId(null);
			pushToast(text.botRemoved, "success");
			setBotDeleteTarget(null);
			await refreshBootstrap(null);
		} catch (error) {
			pushToast(error instanceof Error ? error.message : text.failedRemoveBot, "error");
		} finally {
			setBotDeleteBusy(false);
		}
	};

	const selectGuild = (guildId: string) => {
		if (!activeBotId) return;
		setBotdeckHomeOpen(false);
		setChannelDrawerOpen(true);
		startNavTransition(() => {
			setSelectedGuildId(guildId);
			setSelectedChannelId(firstSelectableChannelId(workspace.channelsByGuild[guildId] ?? []));
		});
	};

	const selectChannel = (channelId: string) => {
		if (!activeBotId) return;
		setBotdeckHomeOpen(false);
		setChannelDrawerOpen(false);
		setSyncingChannelId(channelId);
		startNavTransition(() => setSelectedChannelId(channelId));
	};

	const openBotdeckHome = () => {
		if (!activeBotId) return;
		setBotdeckHomeOpen(true);
		setChannelDrawerOpen(true);
		setSelectedGuildId(null);
		setSelectedChannelId(null);
		setSyncingChannelId(null);
	};

	const openRecoverableThread = (guildId: string, channelId: string) => {
		if (!activeBotId) return;

		if (guildId === dmGuildId) {
			const workspaceDm = workspaceDmChannels.find((channel) => channel.id === channelId);
			if (!workspaceDm) {
				setRetainedDms((current) => {
					const next = current.filter((channel) => channel.id !== channelId);
					writeRetainedDms(activeBotId, next);
					return next;
				});
				pushToast(text.couldNotOpenDm, "error");
				return;
			}

			setRetainedDms((current) => {
				const target = current.find((channel) => channel.id === channelId) ?? workspaceDm;
				const next = [{ ...target, retainedAt: new Date().toISOString() }, ...current.filter((channel) => channel.id !== channelId)];
				writeRetainedDms(activeBotId, next);
				return next;
			});

			persistDismissedDms((current) => {
				if (!current[channelId]) return current;
				const next = { ...current };
				delete next[channelId];
				return next;
			});
		}

		setBotdeckHomeOpen(false);
		setChannelDrawerOpen(false);
		setSelectedGuildId(guildId);
		setSyncingChannelId(channelId);
		startNavTransition(() => setSelectedChannelId(channelId));
	};

	const openMemberThread = (userId: string) => {
		if (!activeBotId) return;
		const existingThread = retainedDmChannels.find((channel) => channel.topic === `user:${userId}`);
		if (existingThread) {
			openRecoverableThread(dmGuildId, existingThread.id);
			return;
		}

		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			pushToast(text.botTransportOffline, "error");
			return;
		}

		setPendingDmUserId(userId);
		socket.send(
			JSON.stringify({
				type: "dm.open",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				userId,
				limit: performanceMode ? 60 : 100
			} satisfies ClientCommand)
		);
	};

	const closeRetainedDm = (channelId: string) => {
		if (!activeBotId) return;
		const latestMessageAt = workspace.messagesByChannel[channelId]?.at(-1)?.createdAt ?? new Date().toISOString();
		setRetainedDms((current) => {
			const next = current.filter((channel) => channel.id !== channelId);
			writeRetainedDms(activeBotId, next);
			return next;
		});
		persistDismissedDms((current) => {
			return { ...current, [channelId]: latestMessageAt };
		});
		if (selectedGuildId === dmGuildId && selectedChannelId === channelId) {
			const nextChannel = retainedDms.find((channel) => channel.id !== channelId);
			if (nextChannel) {
				setSelectedChannelId(nextChannel.id);
			} else {
				setBotdeckHomeOpen(true);
				setSelectedGuildId(null);
				setSelectedChannelId(null);
			}
		}
		persistChannelActivity((current) => {
			if (!current[channelId]) return current;
			const next = { ...current };
			delete next[channelId];
			return next;
		});
	};

	const updatePresence = (nextStatus: PresenceChoice) => {
		setPresenceStatus(nextStatus);
		setBotSettings((current) => {
			const next = { ...current, status: nextStatus };
			if (activeBotId) writeBotSettings(activeBotId, next);
			return next;
		});
		setPresenceMenuOpen(false);
		sendPresenceSettings({ ...botSettings, status: nextStatus }, nextStatus);
	};

	const sendSocketCommand = (command: ClientCommand): boolean => {
		if (activeBotReadOnlyCommandBlocked(command.type)) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return false;
		}
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			pushToast(text.botTransportOffline, "error");
			return false;
		}
		socket.send(JSON.stringify(command));
		return true;
	};

	const requestApplicationCommands = (guildId: string | null, openPanel = false, allGuilds = false, options?: { botId?: string; auto?: boolean; autoKey?: string; reason?: "autoload" | "manual-refresh" | "profile" }) => {
		const targetBotId = options?.botId ?? activeBotId;
		if (!targetBotId) return null;
		if (openPanel) {
			setSlashCommandsOpen(true);
			setSlashCommandsLoading(true);
		}
		setSlashCommandSyncState({ status: "syncing", message: text.discordSyncing, commandId: null, updatedAt: null });
		const requestId = crypto.randomUUID();
		const sent = sendSocketCommand({
			type: "applicationCommands.fetch",
			requestId,
			botId: targetBotId,
			guildId: allGuilds ? null : guildId,
			allGuilds,
			readOnly: true,
			reason: options?.reason ?? (options?.auto ? "autoload" : "manual-refresh")
		} satisfies ClientCommand);
		if (sent && options?.auto && options.autoKey) pendingAutoSlashLoadRef.current = { requestId, key: options.autoKey };
		if (!sent) setSlashCommandSyncState({ status: "error", message: text.botTransportOffline, commandId: null, updatedAt: new Date().toISOString() });
		return sent ? requestId : null;
	};

	const buildSlashStudioContext = (): SlashStudioContext => {
		if (botdeckHomeOpen) {
			return { source: "home", guildId: null, guildName: null, label: "Botdeck Home", allGuilds: true };
		}
		if (activeChannel?.type === "dm") {
			const memberName = activeChannelDmUser ? displayUserName(activeChannelDmUser) : activeChannel.name;
			return { source: "member", guildId: null, guildName: null, label: `DM / membre: ${memberName}`, allGuilds: true };
		}
		return {
			source: "server",
			guildId: activeGuildId && activeGuildId !== dmGuildId ? activeGuildId : null,
			guildName: activeGuild?.name ?? null,
			label: activeGuild?.name ? `${text.server}: ${activeGuild.name}` : text.currentServer
		};
	};

	const openSlashStudio = () => {
		if (activeBotReadOnly) {
			pushToast(text.slashStudioDisabledToast, "warning");
			return;
		}
		const context = buildSlashStudioContext();
		setSlashStudioContext(context);
		requestApplicationCommands(context.guildId, true, Boolean(context.allGuilds), { reason: "manual-refresh" });
	};

	const fetchSlashCommands = () => {
		requestApplicationCommands(slashStudioContext.guildId, true, Boolean(slashStudioContext.allGuilds), { reason: "manual-refresh" });
	};

	useEffect(() => {
		loadedAutoSlashLoadKeyRef.current = null;
		pendingAutoSlashLoadRef.current = null;
		setSlashCommands({ globalCommands: [], guildCommands: [], partialError: null });
	}, [activeBotId]);

	// Commandes Discord chargées à l’ouverture.

	const deleteSlashCommand = (command: ApplicationCommandSummary) => {
		if (!activeBotId) return;
		setSlashCommandDeleteTarget(null);
		const requestId = crypto.randomUUID();
		pendingSlashWriteRef.current = { requestId, commandId: command.id, name: command.name, action: "delete" };
		setSlashCommandSyncState({
			status: "syncing",
			message: language === "fr" ? `Suppression de /${command.name} sur Discord…` : `Deleting /${command.name} on Discord…`,
			commandId: command.id,
			updatedAt: null
		});
		const sent = sendSocketCommand({
			type: "applicationCommand.delete",
			requestId,
			botId: activeBotId,
			commandId: command.id,
			scope: command.scope,
			guildId: command.guildId ?? null,
			apply: true
		} satisfies ClientCommand);
		if (sent) {
			setSlashCommandsLoading(true);
		} else {
			pendingSlashWriteRef.current = null;
			setSlashCommandSyncState({ status: "error", message: text.botTransportOffline, commandId: command.id, updatedAt: new Date().toISOString() });
		}
	};

	const saveSlashCommand = (draft: ApplicationCommandDraft, commandId?: string | null): boolean => {
		if (!activeBotId) return false;
		const normalizedDraft: ApplicationCommandDraft = ensureCommandRuntime({
			...draft,
			guildId: draft.scope === "guild" ? (isDiscordSnowflakeId(draft.guildId) ? draft.guildId : isDiscordSnowflakeId(activeGuildId) ? activeGuildId : null) : null
		});
		const validationErrors = validateCommandDraft(normalizedDraft);
		if (validationErrors.length > 0) {
			pushToast(validationErrors[0], "error");
			return false;
		}
		const requestId = crypto.randomUUID();
		pendingSlashWriteRef.current = { requestId, commandId: commandId ?? null, name: normalizedDraft.name, action: commandId ? "update" : "create" };
		setSlashCommandSyncState({
			status: "syncing",
			message: language === "fr"
				? `${commandId ? "Mise à jour" : "Création"} de /${normalizedDraft.name} sur Discord…`
				: `${commandId ? "Updating" : "Creating"} /${normalizedDraft.name} on Discord…`,
			commandId: commandId ?? null,
			updatedAt: null
		});
		const sent = commandId
			? sendSocketCommand({ type: "applicationCommand.update", requestId, botId: activeBotId, commandId, draft: normalizedDraft, apply: true } satisfies ClientCommand)
			: sendSocketCommand({ type: "applicationCommand.create", requestId, botId: activeBotId, draft: normalizedDraft, apply: true } satisfies ClientCommand);
		if (sent) {
			setSlashCommandsLoading(true);
			pushToast(text.discordSyncQueued, "info");
		} else {
			pendingSlashWriteRef.current = null;
			setSlashCommandSyncState({ status: "error", message: text.botTransportOffline, commandId: commandId ?? null, updatedAt: new Date().toISOString() });
		}
		return sent;
	};

	useEffect(() => {
		if (!lastApplicationCommandsEvent) return;
		if (lastApplicationCommandsEvent.type === "applicationCommands.list") {
			if (lastApplicationCommandsEvent.botId !== activeBotId) return;
			if (pendingAutoSlashLoadRef.current) {
				loadedAutoSlashLoadKeyRef.current = pendingAutoSlashLoadRef.current.key;
				pendingAutoSlashLoadRef.current = null;
			}
			setSlashCommands({
				globalCommands: lastApplicationCommandsEvent.globalCommands,
				guildCommands: lastApplicationCommandsEvent.guildCommands,
				partialError: lastApplicationCommandsEvent.partialError ?? null
			});
			setSlashCommandsLoading(false);
			setSlashCommandSyncState({
				status: lastApplicationCommandsEvent.partialError ? "error" : "synced",
				message: lastApplicationCommandsEvent.partialError ?? text.discordListSynced,
				commandId: null,
				updatedAt: new Date().toISOString()
			});
			if (lastApplicationCommandsEvent.partialError) pushToast(lastApplicationCommandsEvent.partialError, "warning");
		}
		if (lastApplicationCommandsEvent.type === "applicationCommand.created" || lastApplicationCommandsEvent.type === "applicationCommand.updated") {
			if (lastApplicationCommandsEvent.botId !== activeBotId) return;
			const received = lastApplicationCommandsEvent.command;
			setSlashCommands((current) => {
				const replace = (items: ApplicationCommandSummary[]) => [received, ...items.filter((item) => item.id !== received.id)].sort((left, right) => left.name.localeCompare(right.name));
				return {
					...current,
					globalCommands: received.scope === "global" ? replace(current.globalCommands) : current.globalCommands,
					guildCommands: received.scope === "guild" ? replace(current.guildCommands) : current.guildCommands
				};
			});
			setSlashCommandsLoading(false);
			pendingSlashWriteRef.current = null;
			setSlashCommandSyncState({
				status: "synced",
				message: language === "fr" ? `/${received.name} est synchronisée avec Discord.` : `/${received.name} is synced with Discord.`,
				commandId: received.id,
				updatedAt: new Date().toISOString()
			});
			pushToast(lastApplicationCommandsEvent.type === "applicationCommand.created" ? text.commandCreated : text.commandUpdated, "success");
			requestApplicationCommands(slashStudioContext.guildId, false, Boolean(slashStudioContext.allGuilds), { reason: "manual-refresh" });
		}
		if (lastApplicationCommandsEvent.type === "applicationCommand.deleted") {
			if (lastApplicationCommandsEvent.botId !== activeBotId) return;
			setSlashCommands((current) => ({
				...current,
				globalCommands: current.globalCommands.filter((command) => command.id !== lastApplicationCommandsEvent.commandId),
				guildCommands: current.guildCommands.filter((command) => command.id !== lastApplicationCommandsEvent.commandId)
			}));
			setSlashCommandsLoading(false);
			pendingSlashWriteRef.current = null;
			setSlashCommandSyncState({ status: "synced", message: i18nText("Commande supprimée et liste locale mise à jour."), commandId: lastApplicationCommandsEvent.commandId, updatedAt: new Date().toISOString() });
			pushToast(text.commandDeleted, "success");
		}
	}, [activeBotId, lastApplicationCommandsEvent, text.commandCreated, text.commandDeleted, text.commandUpdated]);

	useEffect(() => {
		if (!lastCommandEvent) return;
		if (lastCommandEvent.command === "applicationCommands.fetch" && lastCommandEvent.type === "command.failed") {
			if (pendingAutoSlashLoadRef.current?.requestId === lastCommandEvent.requestId) pendingAutoSlashLoadRef.current = null;
			setSlashCommandsLoading(false);
			setSlashCommandSyncState({ status: "error", message: lastCommandEvent.message || text.failedLoadCommands, commandId: null, updatedAt: new Date().toISOString() });
			pushToast(lastCommandEvent.message || text.failedLoadCommands, "error");
		}
		if ((lastCommandEvent.command === "applicationCommand.create" || lastCommandEvent.command === "applicationCommand.update") && lastCommandEvent.type === "command.failed") {
			setSlashCommandsLoading(false);
			pendingSlashWriteRef.current = null;
			setSlashCommandSyncState({ status: "error", message: lastCommandEvent.message || text.failedSaveCommand, commandId: null, updatedAt: new Date().toISOString() });
			pushToast(lastCommandEvent.message || text.failedSaveCommand, "error");
		}
		if (lastCommandEvent.command === "applicationCommand.delete" && lastCommandEvent.type === "command.failed") {
			setSlashCommandsLoading(false);
			pendingSlashWriteRef.current = null;
			setSlashCommandSyncState({ status: "error", message: lastCommandEvent.message || text.failedDeleteCommand, commandId: null, updatedAt: new Date().toISOString() });
			pushToast(lastCommandEvent.message || text.failedDeleteCommand, "error");
		}
	}, [lastCommandEvent, text.failedDeleteCommand, text.failedLoadCommands, text.failedSaveCommand]);

	const showMemberProfile = (guildId: string, userId: string) => {
		setMemberPanelTarget({ guildId, userId });
		// Profil: pas de préchargement commandes.
		if (!activeBotId) return;
		if (guildId === dmGuildId) {
			sendSocketCommand({
				type: "user.profile",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				userId
			} satisfies ClientCommand);
			return;
		}
		sendSocketCommand({
			type: "member.profile",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			guildId,
			userId
		} satisfies ClientCommand);
	};

	const openMemberProfile = (guildId: string | null, userId: string) => {
		if (!guildId || guildId === dmGuildId || activeChannel?.type === "dm") {
			showMemberProfile(dmGuildId, userId);
			return;
		}
		showMemberProfile(guildId, userId);
	};

	const sendMemberCommand = (command: ClientCommand) => {
		if (sendSocketCommand(command) && command.type !== "member.profile" && "userId" in command && "guildId" in command) {
			window.setTimeout(() => {
				if (!activeBotId) return;
				sendSocketCommand({
					type: "member.profile",
					requestId: crypto.randomUUID(),
					botId: activeBotId,
					guildId: command.guildId,
					userId: command.userId
				} satisfies ClientCommand);
			}, 900);
		}
	};

	const openAttachmentPreview = (attachment: MessageAttachmentSummary, kind: MediaPreviewState["kind"]) => {
		setMediaPreview({
			kind,
			url: attachment.url,
			filename: attachment.filename,
			contentType: attachment.contentType,
			size: attachment.size
		});
	};

	const applyBotSettings = () => {
		if (!activeBotId) return;
		const settingsToPersist = { ...botSettings, status: presenceStatus };
		const customStatusToPersist = botCustomStatusDirty && !botCustomStatus.text.trim() ? defaultBotCustomStatus : botCustomStatus;

		persistBotSettings(settingsToPersist);
		setBotSettings(settingsToPersist);

		if (botCustomStatusDirty) {
			setBotCustomStatus(customStatusToPersist);
			writeBotCustomStatus(activeBotId, customStatusToPersist);
			setBotCustomStatusDirty(false);
		}

		if (sendPresenceSettings(settingsToPersist, presenceStatus, customStatusToPersist)) {
			pushToast(text.botSettingsApplied, "success");
			setSettingsDirty(false);
		}
	};

	const removeComposerAttachment = (id: string) => {
		setComposerAttachments((current) => {
			const target = current.find((attachment) => attachment.id === id);
			if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
			return current.filter((attachment) => attachment.id !== id);
		});
	};

	const clearComposerAttachments = () => {
		setComposerAttachments((current) => {
			for (const attachment of current) {
				if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
			}
			return [];
		});
	};

	const addComposerFiles = async (files: FileList | File[]) => {
		const nextFiles = Array.from(files);
		if (!nextFiles.length) return;
		if (composerAttachments.length + nextFiles.length > maxComposerAttachments) {
			pushToast(text.maxFilesPerMessage(maxComposerAttachments), "warning");
			return;
		}

		const oversized = nextFiles.find((file) => file.size > maxComposerAttachmentSize);
		if (oversized) {
			pushToast(text.fileTooLarge(oversized.name), "warning");
			return;
		}

		setAttachmentBusy(true);
		try {
			const prepared = await Promise.all(
				nextFiles.map(async (file) => ({
					id: crypto.randomUUID(),
					filename: file.name,
					contentType: file.type || null,
					size: file.size,
					data: await readFileAsBase64(file),
					previewUrl: isImageAttachment(file.type, file.name) ? URL.createObjectURL(file) : null
				}))
			);
			setComposerAttachments((current) => [...current, ...prepared]);
		} catch {
			pushToast(text.couldNotReadFile, "error");
		} finally {
			setAttachmentBusy(false);
		}
	};

	const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
		if (event.target.files) void addComposerFiles(event.target.files);
		event.target.value = "";
	};

	const updateComposerMention = (value = draft, caret = composerInputRef.current?.selectionStart ?? value.length) => {
		const mention = findComposerMention(value, caret);
		setComposerMention(mention);
		setComposerMentionIndex(0);
	};

	const updateComposerSelection = () => {
		const input = composerInputRef.current;
		if (!input || document.activeElement !== input || input.selectionStart === input.selectionEnd) {
			setComposerSelection(null);
			if (input && document.activeElement === input) updateComposerMention(draft, input.selectionStart);
			return;
		}
		setComposerSelection({ start: input.selectionStart, end: input.selectionEnd });
		setComposerMention(null);
	};

	const insertComposerMention = (user: WorkspaceState["usersById"][string]) => {
		if (!composerMention) return;
		const input = composerInputRef.current;
		const replacement = `<@${user.id}> `;
		const nextDraft = `${draft.slice(0, composerMention.start)}${replacement}${draft.slice(composerMention.end)}`;
		const nextCaret = composerMention.start + replacement.length;
		setDraft(nextDraft);
		setComposerMention(null);
		setComposerMentionIndex(0);
		window.setTimeout(() => {
			input?.focus();
			input?.setSelectionRange(nextCaret, nextCaret);
		}, 0);
	};

	const formatSelectedDraft = (format: ComposerFormat) => {
		const input = composerInputRef.current;
		const selection = composerSelection ?? (input && input.selectionStart !== input.selectionEnd ? { start: input.selectionStart, end: input.selectionEnd } : null);
		if (!input || !selection) return;

		const selected = draft.slice(selection.start, selection.end);
		const transforms: Record<Exclude<ComposerFormat, "codeBlock" | "quote">, [string, string]> = {
			bold: ["**", "**"],
			italic: ["*", "*"],
			underline: ["__", "__"],
			strike: ["~~", "~~"],
			inlineCode: ["`", "`"],
			spoiler: ["||", "||"]
		};
		let replacement: string;
		if (format === "codeBlock") {
			replacement = `\`\`\`\n${selected}\n\`\`\``;
		} else if (format === "quote") {
			replacement = selected
				.split("\n")
				.map((line) => `> ${line}`)
				.join("\n");
		} else {
			const [before, after] = transforms[format];
			replacement = `${before}${selected}${after}`;
		}
		const nextDraft = `${draft.slice(0, selection.start)}${replacement}${draft.slice(selection.end)}`;
		setDraft(nextDraft);
		setComposerSelection(null);
		window.setTimeout(() => {
			input.focus();
			input.setSelectionRange(selection.start, selection.start + replacement.length);
		}, 0);
	};

	const submitMessage = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		sendDraftMessage();
	};

	const sendDraftMessage = () => {
		const content = draft.trim();
		if ((!content && !composerAttachments.length) || !activeChannel?.id || content.length > 2000 || !activeBotId || attachmentBusy) return;
		if (activeBotReadOnlyCommandBlocked("message.send")) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}

		if (!channelCanSend(activeChannel)) {
			pushToast(text.channelPermissionSendBlocked, "error");
			return;
		}

		if (composerAttachments.length && !channelCanAttach(activeChannel)) {
			pushToast(text.channelPermissionAttachBlocked, "error");
			return;
		}

		const socket = socketRef.current;
		if (socket && socket.readyState === WebSocket.OPEN) {
			const requestId = crypto.randomUUID();
			socket.send(
				JSON.stringify({
					type: "message.send",
					requestId,
					botId: activeBotId,
					channelId: activeChannel.id,
					content,
					attachments: composerAttachments.map((attachment) => ({
						filename: attachment.filename,
						contentType: attachment.contentType,
						size: attachment.size,
						data: attachment.data
					})),
					replyToMessageId: replyTarget?.channelId === activeChannel.id ? replyTarget.id : undefined
				} satisfies ClientCommand)
			);
			setDraft("");
			setReplyTarget(null);
			clearComposerAttachments();
		}
	};


	const openForumPost = (post: ForumPostSummary) => {
		setSelectedGuildId(post.guildId);
		setSelectedChannelId(post.id);
		setBotdeckHomeOpen(false);
		setChannelDrawerOpen(false);
	};

	const createForumPost = () => {
		if (!activeBotId || !activeChannel || activeChannel.type !== "forum") return;
		const title = forumDraftTitle.trim();
		const content = forumDraftContent.trim();
		if (!title || !content) {
			pushToast(language === "fr" ? "Titre et description requis." : "Title and description are required.", "warning");
			return;
		}
		const sent = sendSocketCommand({
			type: "forum.post.create",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			forumId: activeChannel.id,
			title,
			content,
			tagIds: forumDraftTagIds
		} satisfies ClientCommand);
		if (sent) {
			setForumDraftTitle("");
			setForumDraftContent("");
			setForumDraftTagIds([]);
			setForumCreating(false);
			pushToast(language === "fr" ? "Création du post en cours..." : "Creating forum post...", "info");
		}
	};

	const refreshForumPosts = () => {
		if (!activeBotId || !activeChannel || activeChannel.type !== "forum") return;
		setSyncingForumId(activeChannel.id);
		sendSocketCommand({ type: "forum.posts.fetch", requestId: crypto.randomUUID(), botId: activeBotId, forumId: activeChannel.id, includeArchived: true } satisfies ClientCommand);
	};

	const sendForumPostCommand = (type: "forum.post.delete" | "forum.post.archive" | "forum.post.lock", post: ForumPostSummary, value?: boolean) => {
		if (!activeBotId) return;
		if (type === "forum.post.delete" && !window.confirm(language === "fr" ? `Supprimer le post “${post.name}” ?` : `Delete post “${post.name}”?`)) return;
		const command = type === "forum.post.delete"
			? { type, requestId: crypto.randomUUID(), botId: activeBotId, threadId: post.id }
			: type === "forum.post.archive"
				? { type, requestId: crypto.randomUUID(), botId: activeBotId, threadId: post.id, archived: Boolean(value) }
				: { type, requestId: crypto.randomUUID(), botId: activeBotId, threadId: post.id, locked: Boolean(value) };
		sendSocketCommand(command as ClientCommand);
	};

	const sendEmbedMessage = (embedsInput: EmbedPayload | EmbedPayload[], content = "") => {
		if (!activeChannel?.id || activeChannel.type === "voice" || !activeBotId) return;
		if (activeBotReadOnlyCommandBlocked("message.send")) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}

		if (!channelCanEmbed(activeChannel)) {
			pushToast(text.channelPermissionEmbedBlocked, "error");
			return;
		}

		const embeds = (Array.isArray(embedsInput) ? embedsInput : [embedsInput]).filter(Boolean).slice(0, 10);
		if (!embeds.length) {
			pushToast(text.embedRequiresContent, "error");
			return;
		}

		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			pushToast(text.botTransportOffline, "error");
			return;
		}
		const requestId = crypto.randomUUID();
		socket.send(
			JSON.stringify({
				type: "message.send",
				requestId,
				botId: activeBotId,
				channelId: activeChannel.id,
				content: content.trim(),
				embeds,
				embedPagination: embeds.length > 1,
				replyToMessageId: replyTarget?.channelId === activeChannel.id ? replyTarget.id : undefined
			} satisfies ClientCommand)
		);
		setReplyTarget(null);
		setEmbedModalOpen(false);
	};

	const handleMessageListDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.types.includes("Files") || botdeckHomeOpen || !activeChannel || activeChannel.type === "voice" || activeBotMessagesLocked) return;
		event.preventDefault();
		setDraggingFiles(true);
	};

	const handleMessageListDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!event.dataTransfer.files.length) return;
		event.preventDefault();
		setDraggingFiles(false);
		if (activeBotMessagesLocked) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}
		void addComposerFiles(event.dataTransfer.files);
		window.setTimeout(() => composerInputRef.current?.focus(), 0);
	};

	const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (composerMention && composerMentionSuggestions.length) {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setComposerMentionIndex((current) => (current + 1) % composerMentionSuggestions.length);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setComposerMentionIndex((current) => (current - 1 + composerMentionSuggestions.length) % composerMentionSuggestions.length);
				return;
			}
			if (event.key === "Enter" || event.key === "Tab") {
				event.preventDefault();
				insertComposerMention(composerMentionSuggestions[composerMentionIndex] ?? composerMentionSuggestions[0]);
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				setComposerMention(null);
				return;
			}
		}
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		sendDraftMessage();
	};

	const copyToClipboard = async (value: string, label: string) => {
		try {
			await navigator.clipboard.writeText(value);
			pushToast(text.copied(label), "success");
		} catch {
			pushToast(text.couldNotCopy(label), "error");
		}
	};

	const deleteMessage = (message: MessageSummary) => {
		if (!activeBotId) return;
		if (activeBotReadOnlyCommandBlocked("message.delete")) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}

		if (!channelCanDeleteMessage(activeChannel, message, activeBotUserId)) {
			pushToast(activeChannel?.type === "dm" ? text.messageDeleteBlocked : text.channelPermissionManageBlocked, "error");
			return;
		}

		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			pushToast(text.botTransportOffline, "error");
			return;
		}
		socket.send(
			JSON.stringify({
				type: "message.delete",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				channelId: message.channelId,
				messageId: message.id
			} satisfies ClientCommand)
		);
		setMessageContextMenu(null);
	};

	const toggleMessagePin = (message: MessageSummary, forcedPinned?: boolean) => {
		if (!activeBotId) return;
		if (activeBotReadOnlyCommandBlocked("message.pin")) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}

		if (!channelCanPinMessage(activeChannel)) {
			pushToast(text.channelPermissionManageBlocked, "error");
			return;
		}

		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			pushToast(text.botTransportOffline, "error");
			return;
		}
		socket.send(
			JSON.stringify({
				type: "message.pin",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				channelId: message.channelId,
				messageId: message.id,
				pinned: forcedPinned ?? !message.pinned
			} satisfies ClientCommand)
		);
		setMessageContextMenu(null);
	};

	const openReactionPicker = (messageId: string, anchor: HTMLElement) => {
		setReactionSearch("");
		setReactionPicker((current) => {
			if (current?.messageId === messageId) return null;
			const rect = anchor.getBoundingClientRect();
			const viewportWidth = window.innerWidth || document.documentElement.clientWidth || reactionPickerWidth;
			const viewportHeight = window.innerHeight || document.documentElement.clientHeight || reactionPickerHeight;
			const pickerWidth = Math.min(reactionPickerWidth, Math.max(240, viewportWidth - reactionPickerMargin * 2));
			const pickerHeight = Math.min(reactionPickerHeight, Math.max(260, viewportHeight - reactionPickerMargin * 2));
			const maxX = Math.max(reactionPickerMargin, viewportWidth - pickerWidth - reactionPickerMargin);
			const maxY = Math.max(reactionPickerMargin, viewportHeight - pickerHeight - reactionPickerMargin);
			const x = Math.min(Math.max(rect.right - pickerWidth, reactionPickerMargin), maxX);
			const belowY = rect.bottom + 8;
			const aboveY = rect.top - pickerHeight - 8;
			const y = belowY + pickerHeight <= viewportHeight - reactionPickerMargin
				? belowY
				: Math.min(Math.max(aboveY, reactionPickerMargin), maxY);
			return { messageId, x, y };
		});
	};

	const setMessageReaction = (message: MessageSummary, emoji: string, remove = false) => {
		if (!activeBotId) return;
		if (activeBotReadOnlyCommandBlocked("message.react")) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}

		if (isEphemeralMessage(message)) {
			setReactionPicker(null);
			pushToast(text.ephemeralReactionBlocked, "error");
			return;
		}

		if (!channelCanReact(activeChannel)) {
			pushToast(text.channelPermissionReactBlocked, "error");
			return;
		}

		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			pushToast(text.botTransportOffline, "error");
			return;
		}
		const reactionKey = reactionIdentityKey(message.id, emoji);
		setHiddenBotOnlyReactionKeys((current) => {
			const next = new Set(current);
			if (remove) {
				next.add(reactionKey);
			} else {
				next.delete(reactionKey);
			}
			return next;
		});
		socket.send(
			JSON.stringify({
				type: remove ? "message.unreact" : "message.react",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				channelId: message.channelId,
				messageId: message.id,
				emoji
			} satisfies ClientCommand)
		);
		setReactionPicker(null);
	};

	const openMessageSearchPanel = () => {
		if (!activeChannel?.id || activeChannel.type === "voice" || activeChannel.type === "forum") return;
		setPinsPanelOpen(false);
		setMessageSearchOpen((current) => !current);
	};

	const openPinsPanel = () => {
		if (!activeChannel?.id || activeChannel.type === "voice") return;
		setMessageSearchOpen(false);
		const opening = !pinsPanelOpen;
		setPinsPanelOpen(opening);
		if (!opening) return;
		const socket = socketRef.current;
		if (!activeBotId || !socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(
			JSON.stringify({
				type: "channel.pins",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				channelId: activeChannel.id
			} satisfies ClientCommand)
		);
	};

	const jumpToMessage = (message: MessageSummary) => {
		setPinsPanelOpen(false);
		setMessageSearchOpen(false);
		setPendingScrollMessageId(message.id);
		if (activeMessages.some((item) => item.id === message.id)) return;

		const socket = socketRef.current;
		if (!activeBotId || !socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(
			JSON.stringify({
				type: "message.context",
				requestId: crypto.randomUUID(),
				botId: activeBotId,
				channelId: message.channelId,
				messageId: message.id,
				limit: 80
			} satisfies ClientCommand)
		);
	};

	const toggleCategory = (categoryId: string) => {
		setCollapsedCategories((current) => ({ ...current, [categoryId]: !current[categoryId] }));
	};

	const { channelContextMenu, setChannelContextMenu, channelDeleteTarget, setChannelDeleteTarget, channelRecreateTarget, setChannelRecreateTarget, channelRecreateReason, setChannelRecreateReason, channelRecreateConfirmation, setChannelRecreateConfirmation, canManageChannelsInGuild, openChannelContextMenu, requestDeleteChannel, requestRecreatePurgeChannel, recreatePurgeGuildChannel, deleteGuildChannel } = useChannelActions({ activeBotId, activeGuildId, activeChannels, activeBotChannelsLocked, language, text, sendSocketCommand, pushToast });

	const { channelDragSource, channelDropTarget, channelDragAllowed, beginChannelDrag, updateChannelDropTarget, finishChannelDrop, cancelChannelDrag, channelDropClass } = useChannelDrag({ activeBotId, activeGuildId, canManageChannelsInGuild, language, sendSocketCommand, pushToast });

	const {
		memberContextMenu,
		setMemberContextMenu,
		memberModerationTarget,
		memberModerationReason,
		setMemberModerationReason,
		openMemberContextMenu,
		requestMemberModeration,
		cancelMemberModeration,
		submitMemberModeration
	} = useMemberModerationActions({
		activeBotId,
		workspace,
		onCloseMenus: () => {
			setMessageContextMenu(null);
			setChannelContextMenu(null);
			setReactionPicker(null);
		},
		onCommand: sendMemberCommand
	});

	const startChannelSidebarResize = useChannelSidebarResize(channelSidebarWidth, setChannelSidebarWidth);

	if (!bootReady || !bootstrap || !firstLaunchPresentationReady) {
		return <BotdeckAppStartupView mode="loading" text={text} language={language} toasts={toasts} botModal={botModal} externalLinkModal={externalLinkModal} projectInfoModal={projectInfoModal} tlsSettingsModal={tlsSettingsModal} />;
	}

	if (firstLaunchPresentationOpen) {
		return <BotdeckAppStartupView mode="firstLaunch" text={text} language={language} toasts={toasts} botModal={botModal} externalLinkModal={externalLinkModal} projectInfoModal={projectInfoModal} tlsSettingsModal={tlsSettingsModal} onLanguageChange={updateLanguage} onCloseFirstLaunch={closeFirstLaunchPresentation} onExternalLink={promptExternalLink} />;
	}

	if (!visibleBots.length || !hasActiveBot) {
		return (
			<BotdeckAppStartupView
				mode="launcher"
				bots={hasActiveBot ? [] : visibleBots}
				text={text}
				language={language}
				toasts={toasts}
				botModal={botModal}
				externalLinkModal={externalLinkModal}
				projectInfoModal={projectInfoModal}
				tlsSettingsModal={tlsSettingsModal}
				switchingBotId={switchingBotId}
				transitionBot={transitionBot}
				entryOverlayClosing={entryOverlayClosing}
				botDeleteTarget={hasActiveBot ? null : botDeleteTarget}
				botDeleteBusy={botDeleteBusy}
				onSelectBot={selectBot}
				onOpenAddBot={openAddBot}
				onRemoveBot={confirmRemoveBot}
				onOpenProjectInfo={() => setProjectInfoOpen(true)}
				onOpenTlsSettings={() => setTlsSettingsOpen(true)}
				onLanguageChange={updateLanguage}
				onCancelDeleteBot={() => setBotDeleteTarget(null)}
				onConfirmDeleteBot={deleteBot}
			/>
		);
	}

	return (
		<main className={`clientShell${exitingBot ? " isLeaving" : ""}`} style={{ "--channel-sidebar-width": `${channelSidebarWidth}px` } as CSSProperties}>
			<GuildRail
				text={text}
				botdeckHomeOpen={botdeckHomeOpen}
				totalDmUnread={totalDmUnread}
				totalDmMentions={totalDmMentions}
				guilds={workspace.guilds}
				guildActivityById={guildActivityById}
				activeGuildId={activeGuildId}
				onOpenHome={openBotdeckHome}
				onSelectGuild={selectGuild}
			/>

			{channelDrawerOpen ? (
				<Button variant="unstyled" className="mobileChannelBackdrop" type="button" aria-label={text.closeChannels} onClick={() => setChannelDrawerOpen(false)} />
			) : null}

			<BotdeckChannelSidebar
				activeBotId={activeBotId}
				activeBotUserId={activeBotUserId}
				activeChannel={activeChannel}
				activeChannelGroups={activeChannelGroups}
				activeChannels={activeChannels}
				activeGuildId={activeGuildId}
				activeGuildLabel={activeGuildLabel}
				activeVoiceStates={activeVoiceStates}
				canOpenServerSettings={canOpenServerSettings}
				channelActivity={channelActivity}
				channelDrawerOpen={channelDrawerOpen}
				channelDragSource={channelDragSource}
				channelDropTarget={channelDropTarget}
				collapsedCategories={collapsedCategories}
				isDmView={isDmView}
				recoverableDmThreads={recoverableDmThreads}
				selectedForumPost={selectedForumPost}
				syncingChannelId={syncingChannelId}
				text={text}
				workspace={workspace}
				botdeckHomeOpen={botdeckHomeOpen}
				onBeginChannelDrag={beginChannelDrag}
				onCancelChannelDrag={cancelChannelDrag}
				onChannelDragAllowed={channelDragAllowed}
				onChannelDropClass={channelDropClass}
				onCloseDrawer={() => setChannelDrawerOpen(false)}
				onCloseRetainedDm={closeRetainedDm}
				onFinishChannelDrop={finishChannelDrop}
				onOpenChannelContextMenu={openChannelContextMenu}
				onOpenForumPost={openForumPost}
				onOpenMemberProfile={openMemberProfile}
				onOpenMemberContextMenu={openMemberContextMenu}
				onOpenRecoverableThread={openRecoverableThread}
				onOpenServerSettings={() => setServerSettingsOpen(true)}
				onSelectChannel={selectChannel}
				onStartResize={startChannelSidebarResize}
				onToggleCategory={toggleCategory}
				onUpdateChannelDropTarget={updateChannelDropTarget}
			/>

			<BotdeckUserPanel
				activeBot={activeBot}
				activeBotId={activeBotId}
				activeBotUserId={activeBotUserId}
				activeGuildId={activeGuildId}
				botCustomStatus={botCustomStatus}
				language={language}
				open={presenceMenuOpen}
				presenceStatus={presenceStatus}
				setBotSettings={setBotSettings}
				setOpen={setPresenceMenuOpen}
				setSettingsDirty={setSettingsDirty}
				setSettingsOpen={setSettingsOpen}
				text={text}
				onOpenMemberProfile={openMemberProfile}
				onUpdatePresence={updatePresence}
			/>

			<section className="chatPane">
				<BotdeckChatTopbar
					activeBotId={activeBotId}
					activeBotReadOnly={activeBotReadOnly}
					activeChannel={activeChannel}
					botDashboardOpen={botDashboardOpen}
					botdeckHomeOpen={botdeckHomeOpen}
					messageSearchOpen={messageSearchOpen}
					permissionsPanelOpen={permissionsPanelOpen}
					pinsPanelOpen={pinsPanelOpen}
					slashCommandsOpen={slashCommandsOpen}
					title={botdeckHomeOpen ? "Botdeck" : activeChannelDmUser ? displayUserName(activeChannelDmUser) : activeChannel?.name ?? text.selectChannel}
					subtitle={
						botdeckHomeOpen
							? `${text.memberCount(globalMembers.length)} · ${text.threadCount(recoverableThreads.length)}`
							: `${activeChannel?.type === "dm" ? text.privateMessages : activeGuildLabel ? `${activeGuildLabel} · ` : ""}${channelIsSyncing ? text.loadingHistory : activeChannel?.topic ?? text.cachedMessages(activeMessages.length)}`
					}
					text={text}
					onExitBot={exitBot}
					onOpenBotDashboard={() => setBotDashboardOpen(true)}
					onOpenChannelDrawer={() => setChannelDrawerOpen(true)}
					onOpenMessageSearch={openMessageSearchPanel}
					onOpenPermissions={() => setPermissionsPanelOpen(true)}
					onOpenPins={openPinsPanel}
					onOpenSlashStudio={openSlashStudio}
				/>

				<div
					ref={messageListRef}
					className={`messageList${draggingFiles ? " isDraggingFiles" : ""}`}
					role="log"
					aria-live="polite"
					onDragOver={handleMessageListDragOver}
					onDragLeave={() => setDraggingFiles(false)}
					onDrop={handleMessageListDrop}
					onScroll={updateMessageListBottomState}
				>
					{botdeckHomeOpen ? (
						<BotdeckHomePanel
							members={globalMembers}
							presences={workspace.presencesByUserId}
							latestMessageByUserId={latestMessageByUserId}
							search={memberSearch}
							onSearchChange={setMemberSearch}
							onOpenMember={openMemberThread}
							text={text}
						/>
					) : !activeBotId ? (
						<article className="emptyState emptyStateLarge">
							<h3>{text.selectBotTitle}</h3>
							<p>{text.selectBotHelp}</p>
						</article>
					) : !workspace.guilds.length ? (
						<WorkspaceSkeleton variant="workspace" />
					) : activeChannel?.type === "forum" ? (
						<BotdeckForumChannelView
							activeBotChannelsLocked={activeBotChannelsLocked}
							activeChannel={activeChannel}
							activeForumCanCreate={activeForumCanCreate}
							activeForumCanManage={activeForumCanManage}
							activeForumPosts={activeForumPosts}
							forumCreating={forumCreating}
							forumDraftContent={forumDraftContent}
							forumDraftTagIds={forumDraftTagIds}
							forumDraftTitle={forumDraftTitle}
							forumSearch={forumSearch}
							language={language}
							syncingForumId={syncingForumId}
							text={text}
							visibleForumPosts={visibleForumPosts}
							onCreateForumPost={createForumPost}
							onForumCreatingChange={setForumCreating}
							onForumDraftContentChange={setForumDraftContent}
							onForumDraftTagIdsChange={setForumDraftTagIds}
							onForumDraftTitleChange={setForumDraftTitle}
							onForumSearchChange={setForumSearch}
							onOpenForumPost={openForumPost}
							onRefreshForumPosts={refreshForumPosts}
							onSendForumPostCommand={sendForumPostCommand}
						/>
					) : channelIsSyncing && !activeMessages.length ? (
						<ChannelMessagesSkeleton />
					) : activeMessages.length ? (
						<BotdeckMessageRows
							activeBot={activeBot}
							activeBotMessagesLocked={activeBotMessagesLocked}
							activeBotUserId={activeBotUserId}
							activeGuildId={activeGuildId}
							activeMessageById={activeMessageById}
							hiddenBotOnlyReactionKeys={hiddenBotOnlyReactionKeys}
							language={language}
							messages={activeMessages}
							reactionPicker={reactionPicker}
							reactionSearch={reactionSearch}
							setMediaPreview={setMediaPreview}
							setMessageContextMenu={setMessageContextMenu}
							setReactionPicker={setReactionPicker}
							setReactionSearch={setReactionSearch}
							setReplyTarget={setReplyTarget}
							text={text}
							usersById={workspace.usersById}
							onDismissEphemeralMessage={dismissEphemeralMessage}
							onOpenAttachmentPreview={openAttachmentPreview}
							onOpenMemberProfile={openMemberProfile}
							onOpenMemberContextMenu={openMemberContextMenu}
							onOpenPinsPanel={openPinsPanel}
							onOpenReactionPicker={openReactionPicker}
							onPromptExternalLink={promptExternalLink}
							onSetMessageReaction={setMessageReaction}
						/>
					) : (
						<article className="emptyState">
							<h3>{text.noHistory}</h3>
							<p>{text.noHistoryHelp}</p>
						</article>
					)}
				</div>
				{!botdeckHomeOpen && activeChannel && activeChannel.type !== "voice" && !messageListAtBottom ? (
					<Button variant="unstyled" className="recentMessagesButton" type="button" onClick={() => scrollMessageListToBottom("smooth", 4)}>
						<span aria-hidden="true">↓</span>
						{text.viewRecentMessages}
					</Button>
				) : null}

				<BotdeckMessageComposer
					activeBot={activeBot}
					activeBotId={activeBotId}
					activeBotMessagesLocked={activeBotMessagesLocked}
					activeChannel={activeChannel}
					activeChannelCanAttach={activeChannelCanAttach}
					activeChannelCanEmbed={activeChannelCanEmbed}
					activeChannelCanSend={activeChannelCanSend}
					attachmentBusy={attachmentBusy}
					botdeckHomeOpen={botdeckHomeOpen}
					composerAttachments={composerAttachments}
					composerInputRef={composerInputRef}
					composerMention={composerMention}
					composerMentionIndex={composerMentionIndex}
					composerMentionSuggestions={composerMentionSuggestions}
					composerSelection={composerSelection}
					draft={draft}
					fileInputRef={fileInputRef}
					handleComposerKeyDown={handleComposerKeyDown}
					handleFileInputChange={handleFileInputChange}
					insertComposerMention={insertComposerMention}
					formatSelectedDraft={formatSelectedDraft}
					removeComposerAttachment={removeComposerAttachment}
					replyTarget={replyTarget}
					setDraft={setDraft}
					setEmbedModalOpen={setEmbedModalOpen}
					setReplyTarget={setReplyTarget}
					submitMessage={submitMessage}
					text={text}
					updateComposerMention={updateComposerMention}
					updateComposerSelection={updateComposerSelection}
					workspace={workspace}
				/>
			</section>
			<BotdeckAppPanels
				botModal={botModal}
				serverSettingsOpen={serverSettingsOpen}
				activeGuild={activeGuild}
				activeChannels={activeChannels}
				workspace={workspace}
				guildAutomationOverrides={guildAutomationOverrides}
				activeBotId={activeBotId}
				activeBotReadOnly={activeBotReadOnly}
				pushToast={pushToast}
				text={text}
				sendSocketCommand={sendSocketCommand}
				setServerSettingsOpen={setServerSettingsOpen}
				settingsOpen={settingsOpen}
				botSettings={botSettings}
				settingsDirty={settingsDirty}
				updateBotSettingsDraft={updateBotSettingsDraft}
				cancelBotSettingsChanges={cancelBotSettingsChanges}
				setSettingsOpen={setSettingsOpen}
				applyBotSettings={applyBotSettings}
				language={language}
				activeBot={activeBot}
				activeGuildId={activeGuildId}
				pinsPanelOpen={pinsPanelOpen}
				activeChannel={activeChannel}
				activeChannelDmUser={activeChannelDmUser}
				activePinnedMessages={activePinnedMessages}
				messageSearchUsersById={messageSearchUsersById}
				setPinsPanelOpen={setPinsPanelOpen}
				jumpToMessage={jumpToMessage}
				toggleMessagePin={toggleMessagePin}
				permissionsPanelOpen={permissionsPanelOpen}
				setPermissionsPanelOpen={setPermissionsPanelOpen}
				slashCommandsOpen={slashCommandsOpen}
				slashCommands={slashCommands}
				slashCommandsLoading={slashCommandsLoading}
				slashStudioContext={slashStudioContext}
				setSlashCommandsOpen={setSlashCommandsOpen}
				fetchSlashCommands={fetchSlashCommands}
				saveSlashCommand={saveSlashCommand}
				setSlashCommandDeleteTarget={setSlashCommandDeleteTarget}
				slashCommandSyncState={slashCommandSyncState}
				slashCommandDeleteTarget={slashCommandDeleteTarget}
				deleteSlashCommand={deleteSlashCommand}
				botDashboardOpen={botDashboardOpen}
				setBotDashboardOpen={setBotDashboardOpen}
				activeBotUserId={activeBotUserId}
				status={status}
				botCustomStatus={botCustomStatus}
				messageSearchOpen={messageSearchOpen}
				activeGuildLabel={activeGuildLabel}
				messageSearch={messageSearch}
				setMessageSearch={setMessageSearch}
				messageSearchGroups={messageSearchGroups}
				messageSearchResultCount={messageSearchResultCount}
				serverMessageSearch={serverMessageSearch}
				setMessageSearchOpen={setMessageSearchOpen}
				channelContextMenu={channelContextMenu}
				canManageChannelsInGuild={canManageChannelsInGuild}
				readOnlyLocked={activeBotChannelsLocked}
				setChannelContextMenu={setChannelContextMenu}
				copyToClipboard={copyToClipboard}
				requestDeleteChannel={requestDeleteChannel}
				requestRecreatePurgeChannel={requestRecreatePurgeChannel}
				channelRecreateTarget={channelRecreateTarget}
				channelRecreateReason={channelRecreateReason}
				channelRecreateConfirmation={channelRecreateConfirmation}
				setChannelRecreateReason={setChannelRecreateReason}
				setChannelRecreateConfirmation={setChannelRecreateConfirmation}
				setChannelRecreateTarget={setChannelRecreateTarget}
				recreatePurgeGuildChannel={recreatePurgeGuildChannel}
				channelDeleteTarget={channelDeleteTarget}
				setChannelDeleteTarget={setChannelDeleteTarget}
				deleteGuildChannel={deleteGuildChannel}
				memberContextMenu={memberContextMenu}
				setMemberContextMenu={setMemberContextMenu}
				openMemberContextMenu={openMemberContextMenu}
				memberModerationTarget={memberModerationTarget}
				memberModerationReason={memberModerationReason}
				setMemberModerationReason={setMemberModerationReason}
				requestMemberModeration={requestMemberModeration}
				cancelMemberModeration={cancelMemberModeration}
				submitMemberModeration={submitMemberModeration}
				messageContextMenu={messageContextMenu}
				setMessageContextMenu={setMessageContextMenu}
				activeBotMessagesLocked={activeBotMessagesLocked}
				openMemberProfile={openMemberProfile}
				setReplyTarget={setReplyTarget}
				composerInputRef={composerInputRef}
				deleteMessage={deleteMessage}
				externalLinkModal={externalLinkModal}
				botDeleteTarget={botDeleteTarget}
				botDeleteBusy={botDeleteBusy}
				setBotDeleteTarget={setBotDeleteTarget}
				deleteBot={deleteBot}
				memberPanelTarget={memberPanelTarget}
				selectedMemberProfile={selectedMemberProfile}
				setMemberPanelTarget={setMemberPanelTarget}
				activeBotModerationLocked={activeBotModerationLocked}
				botCustomStatusDirty={botCustomStatusDirty}
				updateBotCustomStatusDraft={updateBotCustomStatusDraft}
				cancelBotCustomStatusChanges={cancelBotCustomStatusChanges}
				applyBotCustomStatus={applyBotCustomStatus}
				sendMemberCommand={sendMemberCommand}
				showMemberProfile={showMemberProfile}
				openMemberThread={openMemberThread}
				mediaPreview={mediaPreview}
				setMediaPreview={setMediaPreview}
				setExternalLinkPrompt={setExternalLinkPrompt}
				embedModalOpen={embedModalOpen}
				setEmbedModalOpen={setEmbedModalOpen}
				sendEmbedMessage={sendEmbedMessage}
			/>

			{switchingBotId ? (
				<TransitionOverlay
					bot={transitionBot}
					fallbackName={text.loadingServers}
					closing={entryOverlayClosing}
					text={text}
				/>
			) : null}

			<ToastStack toasts={toasts} />
		</main>
	);
}

