"use client";

import type { MutableRefObject, ReactNode } from "react";
import {
	dmGuildId,
	displayUserName,
	presenceLabels,
	slashCommandDraftStorageKey,
	stripDiscriminator
} from "@/features/workspace/core";
import {
	BotHealthDashboardPanel,
	BotSettingsModal,
	ChannelPermissionsPanel,
	ConfirmDeleteModal,
	EmbedComposerModal,
	MediaPreviewModal,
	MessageContextMenu,
	MessageSearchPanel,
	SlashCommandDeleteModal,
	SlashCommandsPanel
} from "@/components/botdeck-app-widgets";
import { ServerSettingsPanel } from "@/features/server-settings/components/server-settings-panel";
import { PinnedMessagesPanel } from "@/features/messages/components/pinned-messages-panel";
import { ChannelContextMenu } from "@/components/botdeck-app-chat-widgets";
import { ChannelDeleteModal, ChannelRecreateModal } from "@/features/workspace/components/channel-modals";
import { MemberProfilePanel } from "@/components/botdeck-shell-panels";
import { MemberContextMenu, MemberModerationModal } from "@/features/members/components/member-moderation-actions";

type BotdeckAppPanelsProps = {
	botModal: any;
	serverSettingsOpen: any;
	activeGuild: any;
	activeChannels: any;
	workspace: any;
	guildAutomationOverrides: any;
	activeBotId: any;
	activeBotReadOnly: any;
	pushToast: any;
	text: any;
	sendSocketCommand: any;
	setServerSettingsOpen: any;
	settingsOpen: any;
	botSettings: any;
	settingsDirty: any;
	updateBotSettingsDraft: any;
	cancelBotSettingsChanges: any;
	setSettingsOpen: any;
	applyBotSettings: any;
	language: any;
	activeBot: any;
	activeGuildId: any;
	pinsPanelOpen: any;
	activeChannel: any;
	activeChannelDmUser: any;
	activePinnedMessages: any;
	messageSearchUsersById: any;
	setPinsPanelOpen: any;
	jumpToMessage: any;
	toggleMessagePin: any;
	permissionsPanelOpen: any;
	setPermissionsPanelOpen: any;
	slashCommandsOpen: any;
	slashCommands: any;
	slashCommandsLoading: any;
	slashStudioContext: any;
	setSlashCommandsOpen: any;
	fetchSlashCommands: any;
	saveSlashCommand: any;
	setSlashCommandDeleteTarget: any;
	slashCommandSyncState: any;
	slashCommandDeleteTarget: any;
	deleteSlashCommand: any;
	botDashboardOpen: any;
	setBotDashboardOpen: any;
	activeBotUserId: any;
	status: any;
	botCustomStatus: any;
	messageSearchOpen: any;
	activeGuildLabel: any;
	messageSearch: any;
	setMessageSearch: any;
	messageSearchGroups: any;
	messageSearchResultCount: any;
	serverMessageSearch: any;
	setMessageSearchOpen: any;
	channelContextMenu: any;
	canManageChannelsInGuild: any;
	readOnlyLocked: any;
	setChannelContextMenu: any;
	copyToClipboard: any;
	requestDeleteChannel: any;
	requestRecreatePurgeChannel: any;
	channelRecreateTarget: any;
	channelRecreateReason: any;
	channelRecreateConfirmation: any;
	setChannelRecreateReason: any;
	setChannelRecreateConfirmation: any;
	setChannelRecreateTarget: any;
	recreatePurgeGuildChannel: any;
	channelDeleteTarget: any;
	setChannelDeleteTarget: any;
	deleteGuildChannel: any;
	memberContextMenu: any;
	setMemberContextMenu: any;
	openMemberContextMenu: any;
	memberModerationTarget: any;
	memberModerationReason: any;
	setMemberModerationReason: any;
	requestMemberModeration: any;
	cancelMemberModeration: any;
	submitMemberModeration: any;
	messageContextMenu: any;
	setMessageContextMenu: any;
	activeBotMessagesLocked: any;
	openMemberProfile: any;
	setReplyTarget: any;
	composerInputRef: any;
	deleteMessage: any;
	externalLinkModal: any;
	botDeleteTarget: any;
	botDeleteBusy: any;
	setBotDeleteTarget: any;
	deleteBot: any;
	memberPanelTarget: any;
	selectedMemberProfile: any;
	setMemberPanelTarget: any;
	activeBotModerationLocked: any;
	botCustomStatusDirty: any;
	updateBotCustomStatusDraft: any;
	cancelBotCustomStatusChanges: any;
	applyBotCustomStatus: any;
	sendMemberCommand: any;
	showMemberProfile: any;
	openMemberThread: any;
	mediaPreview: any;
	setMediaPreview: any;
	setExternalLinkPrompt: any;
	embedModalOpen: any;
	setEmbedModalOpen: any;
	sendEmbedMessage: any;
};

export function BotdeckAppPanels(props: BotdeckAppPanelsProps) {
	const {
		botModal,
		serverSettingsOpen,
		activeGuild,
		activeChannels,
		workspace,
		guildAutomationOverrides,
		activeBotId,
		activeBotReadOnly,
		pushToast,
		text,
		sendSocketCommand,
		setServerSettingsOpen,
		settingsOpen,
		botSettings,
		settingsDirty,
		updateBotSettingsDraft,
		cancelBotSettingsChanges,
		setSettingsOpen,
		applyBotSettings,
		language,
		activeBot,
		activeGuildId,
		pinsPanelOpen,
		activeChannel,
		activeChannelDmUser,
		activePinnedMessages,
		messageSearchUsersById,
		setPinsPanelOpen,
		jumpToMessage,
		toggleMessagePin,
		permissionsPanelOpen,
		setPermissionsPanelOpen,
		slashCommandsOpen,
		slashCommands,
		slashCommandsLoading,
		slashStudioContext,
		setSlashCommandsOpen,
		fetchSlashCommands,
		saveSlashCommand,
		setSlashCommandDeleteTarget,
		slashCommandSyncState,
		slashCommandDeleteTarget,
		deleteSlashCommand,
		botDashboardOpen,
		setBotDashboardOpen,
		activeBotUserId,
		status,
		botCustomStatus,
		messageSearchOpen,
		activeGuildLabel,
		messageSearch,
		setMessageSearch,
		messageSearchGroups,
		messageSearchResultCount,
		serverMessageSearch,
		setMessageSearchOpen,
		channelContextMenu,
		canManageChannelsInGuild,
		readOnlyLocked,
		setChannelContextMenu,
		copyToClipboard,
		requestDeleteChannel,
		requestRecreatePurgeChannel,
		channelRecreateTarget,
		channelRecreateReason,
		channelRecreateConfirmation,
		setChannelRecreateReason,
		setChannelRecreateConfirmation,
		setChannelRecreateTarget,
		recreatePurgeGuildChannel,
		channelDeleteTarget,
		setChannelDeleteTarget,
		deleteGuildChannel,
		memberContextMenu,
		setMemberContextMenu,
		openMemberContextMenu,
		memberModerationTarget,
		memberModerationReason,
		setMemberModerationReason,
		requestMemberModeration,
		cancelMemberModeration,
		submitMemberModeration,
		messageContextMenu,
		setMessageContextMenu,
		activeBotMessagesLocked,
		openMemberProfile,
		setReplyTarget,
		composerInputRef,
		deleteMessage,
		externalLinkModal,
		botDeleteTarget,
		botDeleteBusy,
		setBotDeleteTarget,
		deleteBot,
		memberPanelTarget,
		selectedMemberProfile,
		setMemberPanelTarget,
		activeBotModerationLocked,
		botCustomStatusDirty,
		updateBotCustomStatusDraft,
		cancelBotCustomStatusChanges,
		applyBotCustomStatus,
		sendMemberCommand,
		showMemberProfile,
		openMemberThread,
		mediaPreview,
		setMediaPreview,
		setExternalLinkPrompt,
		embedModalOpen,
		setEmbedModalOpen,
		sendEmbedMessage
	} = props;

	return (
		<>
			{botModal}

			{serverSettingsOpen && activeGuild ? (
				<ServerSettingsPanel
					guild={activeGuild}
					channels={activeChannels}
					roles={workspace.rolesByGuildId[activeGuild.id] ?? []}
					members={workspace.membersByGuildId[activeGuild.id] ?? []}
					invites={workspace.invitesByGuildId[activeGuild.id] ?? []}
					bans={workspace.bansByGuildId[activeGuild.id] ?? []}
					config={guildAutomationOverrides[activeGuild.id] ?? workspace.guildAutomationConfigsByGuildId[activeGuild.id] ?? null}
					botId={activeBotId}
					readOnly={activeBotReadOnly}
					onCommand={(command) => {
						const isServerAutomationWrite = command.type === "guild.automation.update"
							|| command.type === "guild.automation.remove"
							|| command.type === "guild.automation.test"
							|| command.type === "guild.roleAutomation.upsert"
							|| command.type === "guild.roleAutomation.delete"
							|| command.type === "guild.roleAutomation.test"
							|| command.type === "guild.roleAutomation.sync";
						if (activeBotReadOnly && isServerAutomationWrite) {
							pushToast(text.slashStudioDisabledToast, "warning");
							return;
						}
						// Les automatisations serveur sont confirmées par la file Discord.
						sendSocketCommand(command);
					}}
					onToast={(message, tone) => pushToast(message, tone)}
						text={text}
					onOpenMemberContextMenu={openMemberContextMenu}
					onClose={() => setServerSettingsOpen(false)}
				/>
			) : null}

			{settingsOpen ? (
				<BotSettingsModal
					settings={botSettings}
					dirty={settingsDirty}
					onChange={updateBotSettingsDraft}
					onCancelChanges={cancelBotSettingsChanges}
					onClose={() => {
						cancelBotSettingsChanges();
						setSettingsOpen(false);
					}}
					onApply={applyBotSettings}
					language={language}
					text={text}
					bot={activeBot}
					guilds={workspace.guilds}
					activeGuildId={activeGuildId}
				/>
			) : null}

			{pinsPanelOpen && activeChannel ? (
				<PinnedMessagesPanel
					channelName={activeChannelDmUser ? displayUserName(activeChannelDmUser) : activeChannel.name}
					messages={activePinnedMessages}
					usersById={messageSearchUsersById}
					onClose={() => setPinsPanelOpen(false)}
					onJump={jumpToMessage}
					onUnpin={(message) => toggleMessagePin(message, false)}
					text={text}
				/>
			) : null}

			{permissionsPanelOpen && activeChannel ? (
				<ChannelPermissionsPanel
					channel={activeChannel}
					roles={activeChannel.guildId ? workspace.rolesByGuildId[activeChannel.guildId] ?? [] : []}
					members={activeChannel.guildId ? workspace.membersByGuildId[activeChannel.guildId] ?? [] : []}
					text={text}
					onClose={() => setPermissionsPanelOpen(false)}
				/>
			) : null}

			{slashCommandsOpen ? (
				<SlashCommandsPanel
					commands={slashCommands}
					loading={slashCommandsLoading}
					guildName={slashStudioContext.guildName}
					context={slashStudioContext}
					text={text}
					guildId={slashStudioContext.guildId}
					serverAutomationConfig={slashStudioContext.guildId ? workspace.guildAutomationConfigsByGuildId[slashStudioContext.guildId] ?? null : null}
					onClose={() => setSlashCommandsOpen(false)}
					onRefresh={fetchSlashCommands}
					onSave={saveSlashCommand}
					onDelete={setSlashCommandDeleteTarget}
					syncState={slashCommandSyncState}
					draftStorageKey={activeBotId ? slashCommandDraftStorageKey(activeBotId, slashStudioContext.guildId) : null}
				/>
			) : null}

			{slashCommandDeleteTarget ? (
				<SlashCommandDeleteModal command={slashCommandDeleteTarget} text={text} onCancel={() => setSlashCommandDeleteTarget(null)} onConfirm={() => deleteSlashCommand(slashCommandDeleteTarget)} />
			) : null}

			{botDashboardOpen ? (
				<BotHealthDashboardPanel
					workspace={workspace}
					activeBot={activeBot}
					activeBotUserId={activeBotUserId ?? null}
					connectionStatus={status}
					botSettings={botSettings}
					botCustomStatus={botCustomStatus}
					slashCommands={slashCommands}
					text={text}
					onClose={() => setBotDashboardOpen(false)}
				/>
			) : null}


			{messageSearchOpen && activeChannel ? (
				<MessageSearchPanel
					channelName={activeGuildLabel ?? (activeChannelDmUser ? displayUserName(activeChannelDmUser) : activeChannel.name)}
					query={messageSearch}
					onQueryChange={setMessageSearch}
					groups={messageSearchGroups}
					resultCount={messageSearchResultCount}
					usersById={messageSearchUsersById}
					loading={serverMessageSearch.loading}
					error={serverMessageSearch.error}
					source={serverMessageSearch.source}
					onClose={() => setMessageSearchOpen(false)}
					onJump={jumpToMessage}
					text={text}
				/>
			) : null}

			{channelContextMenu ? (
				<ChannelContextMenu
					menu={channelContextMenu}
					canManage={canManageChannelsInGuild}
					readOnlyLocked={readOnlyLocked}
					language={language}
					onClose={() => setChannelContextMenu(null)}
					onCopyId={() => {
						if (channelContextMenu.channel) void copyToClipboard(channelContextMenu.channel.id, channelContextMenu.channel.type === "category" ? (language === "fr" ? "ID de la catégorie" : "category ID") : (language === "fr" ? "ID du salon" : "channel ID"));
						setChannelContextMenu(null);
					}}
					onDelete={() => {
						if (channelContextMenu.channel) requestDeleteChannel(channelContextMenu.channel);
					}}
					onRecreatePurge={() => {
						if (channelContextMenu.channel) requestRecreatePurgeChannel(channelContextMenu.channel);
					}}
				/>
			) : null}


			{channelRecreateTarget ? (
				<ChannelRecreateModal
					target={channelRecreateTarget}
					language={language}
					text={text}
					reason={channelRecreateReason}
					confirmation={channelRecreateConfirmation}
					onReasonChange={setChannelRecreateReason}
					onConfirmationChange={setChannelRecreateConfirmation}
					onClose={() => setChannelRecreateTarget(null)}
					onConfirm={recreatePurgeGuildChannel}
				/>
			) : null}

			{channelDeleteTarget ? (
				<ChannelDeleteModal
					target={channelDeleteTarget}
					language={language}
					text={text}
					onClose={() => setChannelDeleteTarget(null)}
					onConfirm={deleteGuildChannel}
				/>
			) : null}

			{memberContextMenu ? (
				<MemberContextMenu
					menu={memberContextMenu}
					canModerate={Boolean(activeBotId)}
					readOnlyLocked={activeBotModerationLocked}
					onClose={() => setMemberContextMenu(null)}
					onProfile={() => {
						openMemberProfile(memberContextMenu.guildId, memberContextMenu.userId);
						setMemberContextMenu(null);
					}}
					onKick={() => requestMemberModeration("kick", memberContextMenu)}
					onBan={() => requestMemberModeration("ban", memberContextMenu)}
					onCopyUserId={() => {
						void copyToClipboard(memberContextMenu.userId, text.userId);
						setMemberContextMenu(null);
					}}
					text={text}
				/>
			) : null}

			{messageContextMenu ? (
				<MessageContextMenu
					menu={messageContextMenu}
					author={workspace.usersById[messageContextMenu.message.authorId]}
					messagesLocked={activeBotMessagesLocked}
					onClose={() => setMessageContextMenu(null)}
					onProfile={() => {
						openMemberProfile(activeGuildId, messageContextMenu.message.authorId);
						setMessageContextMenu(null);
					}}
					onReply={() => {
						if (activeBotMessagesLocked) {
							pushToast(text.readOnlyModeWriteBlocked, "warning");
							return;
						}
						setReplyTarget(messageContextMenu.message);
						setMessageContextMenu(null);
						window.setTimeout(() => composerInputRef.current?.focus(), 0);
					}}
					onPinToggle={() => toggleMessagePin(messageContextMenu.message)}
					onDelete={() => deleteMessage(messageContextMenu.message)}
					onCopyMessageId={() => {
						void copyToClipboard(messageContextMenu.message.id, text.messageId);
						setMessageContextMenu(null);
					}}
					onCopyUserId={() => {
						void copyToClipboard(messageContextMenu.message.authorId, text.userId);
						setMessageContextMenu(null);
					}}
					text={text}
				/>
			) : null}

			{externalLinkModal}

			{botDeleteTarget ? (
				<ConfirmDeleteModal
					botName={stripDiscriminator(botDeleteTarget.name)}
					loading={botDeleteBusy}
					onCancel={() => {
						if (!botDeleteBusy) setBotDeleteTarget(null);
					}}
					onConfirm={deleteBot}
					text={text}
				/>
			) : null}

			{memberPanelTarget ? (
				<MemberProfilePanel
					target={memberPanelTarget}
					profile={selectedMemberProfile}
					fallbackUser={workspace.usersById[memberPanelTarget.userId]}
					roles={workspace.rolesByGuildId[memberPanelTarget.guildId] ?? []}
					voiceChannels={memberPanelTarget.guildId === dmGuildId ? [] : workspace.channelsByGuild[memberPanelTarget.guildId]?.filter((channel: any) => channel.type === "voice") ?? []}
					guildName={memberPanelTarget.guildId === dmGuildId ? null : workspace.guilds.find((guild: any) => guild.id === memberPanelTarget.guildId)?.name ?? null}
					presenceStatus={workspace.presencesByUserId[memberPanelTarget.userId]?.status ?? workspace.usersById[memberPanelTarget.userId]?.status ?? "offline"}
					presenceLabel={(presenceLabels as any)[language][workspace.presencesByUserId[memberPanelTarget.userId]?.status ?? workspace.usersById[memberPanelTarget.userId]?.status ?? "offline"]}
					activeBotId={activeBotId}
					activeBotUserId={activeBotUserId ?? null}
					activeBotCommandCount={slashCommands.globalCommands.length + slashCommands.guildCommands.length}
					moderationLocked={activeBotModerationLocked}
					botCustomStatus={botCustomStatus}
					botCustomStatusDirty={botCustomStatusDirty}
					onBotCustomStatusChange={updateBotCustomStatusDraft}
					onCancelBotCustomStatus={cancelBotCustomStatusChanges}
					onApplyBotCustomStatus={applyBotCustomStatus}
					allGuilds={workspace.guilds}
					allProfiles={workspace.memberProfilesByKey}
					onClose={() => setMemberPanelTarget(null)}
					onCommand={sendMemberCommand}
					onRequestModeration={requestMemberModeration}
					onSwitchProfile={showMemberProfile}
					onOpenDm={openMemberThread}
					text={text}
				/>
			) : null}

			{memberModerationTarget ? (
				<MemberModerationModal
					target={memberModerationTarget}
					reason={memberModerationReason}
					setReason={setMemberModerationReason}
					onCancel={cancelMemberModeration}
					onConfirm={submitMemberModeration}
					text={text}
				/>
			) : null}

			{mediaPreview ? (
				<MediaPreviewModal
					media={mediaPreview}
					onClose={() => setMediaPreview(null)}
					onExternalLink={(url, label) => setExternalLinkPrompt({ url, label: label ?? url })}
					text={text}
				/>
			) : null}

			{embedModalOpen ? (
				<EmbedComposerModal
					onClose={() => setEmbedModalOpen(false)}
					onSend={sendEmbedMessage}
					text={text}
				/>
			) : null}
		</>
	);
}
