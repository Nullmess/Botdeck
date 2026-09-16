import { useState, type MouseEvent as ReactMouseEvent } from "react";
import type { ChannelSummary, ClientCommand } from "@botdeck/shared";
import { dmGuildId, type UiLanguage, type UiText } from "@/features/workspace/core";
import type { ChannelContextMenuState } from "@/components/botdeck-app-chat-widgets";

type PushToast = (message: string, tone: "success" | "error" | "warning" | "info") => void;

type UseChannelActionsOptions = {
	activeBotId: string | null;
	activeGuildId: string | null;
	activeChannels: ChannelSummary[];
	activeBotChannelsLocked: boolean;
	language: UiLanguage;
	text: UiText;
	sendSocketCommand: (command: ClientCommand) => boolean;
	pushToast: PushToast;
};

export function useChannelActions({
	activeBotId,
	activeGuildId,
	activeChannels,
	activeBotChannelsLocked,
	language,
	text,
	sendSocketCommand,
	pushToast
}: UseChannelActionsOptions) {
	const [channelContextMenu, setChannelContextMenu] = useState<ChannelContextMenuState | null>(null);
	const [channelDeleteTarget, setChannelDeleteTarget] = useState<ChannelSummary | null>(null);
	const [channelRecreateTarget, setChannelRecreateTarget] = useState<ChannelSummary | null>(null);
	const [channelRecreateReason, setChannelRecreateReason] = useState("");
	const [channelRecreateConfirmation, setChannelRecreateConfirmation] = useState("");

	const canManageChannelsInGuild = Boolean(activeChannels.some((channel) => channel.permissions?.manageChannels));

	const openChannelContextMenu = (event: ReactMouseEvent<HTMLElement>, channel: ChannelSummary | null) => {
		if (!channel || activeGuildId === dmGuildId) return;
		event.preventDefault();
		event.stopPropagation();
		setChannelContextMenu({ channel, x: event.clientX, y: event.clientY });
	};

	const requestDeleteChannel = (channel: ChannelSummary) => {
		setChannelContextMenu(null);
		if (activeBotChannelsLocked) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}
		if (!canManageChannelsInGuild) {
			pushToast(language === "fr" ? "Permission Gérer les salons requise." : "Manage Channels permission required.", "error");
			return;
		}
		setChannelDeleteTarget(channel);
	};

	const requestRecreatePurgeChannel = (channel: ChannelSummary) => {
		setChannelContextMenu(null);
		if (activeBotChannelsLocked) {
			pushToast(text.readOnlyModeWriteBlocked, "warning");
			return;
		}
		if (!canManageChannelsInGuild) {
			pushToast(language === "fr" ? "Permission Gérer les salons requise." : "Manage Channels permission required.", "error");
			return;
		}
		if (channel.type === "category" || channel.type === "thread" || channel.type === "dm") {
			pushToast(language === "fr" ? "Ce type de salon n’est pas encore pris en charge." : "This channel type is not supported yet.", "error");
			return;
		}
		setChannelRecreateTarget(channel);
		setChannelRecreateReason("");
		setChannelRecreateConfirmation("");
	};

	const recreatePurgeGuildChannel = () => {
		if (!channelRecreateTarget || !activeBotId || !activeGuildId || activeGuildId === dmGuildId) return;
		const sent = sendSocketCommand({
			type: "channel.recreatePurge",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			guildId: activeGuildId,
			channelId: channelRecreateTarget.id,
			reason: channelRecreateReason,
			transcript: false,
			finishMessage: false,
			confirmation: channelRecreateConfirmation
		} satisfies ClientCommand);
		if (sent) pushToast(language === "fr" ? "Réinitialisation du salon en cours..." : "Channel recreation purge running...", "info");
		setChannelRecreateTarget(null);
	};

	const deleteGuildChannel = () => {
		if (!channelDeleteTarget || !activeBotId || !activeGuildId || activeGuildId === dmGuildId) return;
		const sent = sendSocketCommand({
			type: "channel.delete",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			guildId: activeGuildId,
			channelId: channelDeleteTarget.id
		} satisfies ClientCommand);
		if (sent) pushToast(channelDeleteTarget.type === "category" ? (language === "fr" ? "Suppression de la catégorie..." : "Deleting category...") : (language === "fr" ? "Suppression du salon..." : "Deleting channel..."), "info");
		setChannelDeleteTarget(null);
	};

	return {
		channelContextMenu,
		setChannelContextMenu,
		channelDeleteTarget,
		setChannelDeleteTarget,
		channelRecreateTarget,
		setChannelRecreateTarget,
		channelRecreateReason,
		setChannelRecreateReason,
		channelRecreateConfirmation,
		setChannelRecreateConfirmation,
		canManageChannelsInGuild,
		openChannelContextMenu,
		requestDeleteChannel,
		requestRecreatePurgeChannel,
		recreatePurgeGuildChannel,
		deleteGuildChannel
	};
}
