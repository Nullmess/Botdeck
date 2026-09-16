import type { ChannelSummary, ClientCommand } from "@botdeck/shared";
import { useState, type DragEvent } from "react";
import { dmGuildId, type UiLanguage } from "@/features/workspace/core";

export type ChannelDropPlacement = "before" | "after" | "inside";

export type ChannelDropTarget = {
	targetId: string | null;
	placement: ChannelDropPlacement;
};

export type UseChannelDragOptions = {
	activeBotId: string | null;
	activeGuildId: string | null;
	canManageChannelsInGuild: boolean;
	language: UiLanguage;
	sendSocketCommand: (command: ClientCommand) => boolean;
	pushToast: (message: string, tone: "success" | "error" | "info" | "warning") => void;
};

export function useChannelDrag({ activeBotId, activeGuildId, canManageChannelsInGuild, language, sendSocketCommand, pushToast }: UseChannelDragOptions) {
	const [channelDragSource, setChannelDragSource] = useState<ChannelSummary | null>(null);
	const [channelDropTarget, setChannelDropTarget] = useState<ChannelDropTarget | null>(null);

	const channelDragAllowed = (channel: ChannelSummary): boolean => {
		return Boolean(activeBotId && activeGuildId && activeGuildId !== dmGuildId && canManageChannelsInGuild && channel.type !== "dm" && channel.type !== "thread");
	};

	const beginChannelDrag = (event: DragEvent<HTMLElement>, channel: ChannelSummary) => {
		if (!channelDragAllowed(channel)) {
			event.preventDefault();
			return;
		}
		setChannelDragSource(channel);
		setChannelDropTarget(null);
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", channel.id);
	};

	const updateChannelDropTarget = (event: DragEvent<HTMLElement>, target: ChannelSummary | null) => {
		if (target) event.stopPropagation();
		if (!channelDragSource || !channelDragAllowed(channelDragSource)) return;
		if (target && target.id === channelDragSource.id) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
		if (!target) {
			setChannelDropTarget((current) => current?.targetId === null && current.placement === "after" ? current : { targetId: null, placement: "after" });
			return;
		}
		const rect = event.currentTarget.getBoundingClientRect();
		const offset = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
		const canDropInside = target.type === "category" && channelDragSource.type !== "category";
		const placement = canDropInside && offset > 0.25 && offset < 0.75 ? "inside" : offset < 0.5 ? "before" : "after";
		setChannelDropTarget((current) => current?.targetId === target.id && current.placement === placement ? current : { targetId: target.id, placement });
	};

	const finishChannelDrop = (event: DragEvent<HTMLElement>, target: ChannelSummary | null) => {
		event.preventDefault();
		if (target) event.stopPropagation();
		if (!channelDragSource || !activeBotId || !activeGuildId || activeGuildId === dmGuildId) {
			setChannelDragSource(null);
			setChannelDropTarget(null);
			return;
		}
		const drop = channelDropTarget ?? (target ? { targetId: target.id, placement: "after" as const } : { targetId: null, placement: "after" as const });
		if (drop.targetId === channelDragSource.id) {
			setChannelDragSource(null);
			setChannelDropTarget(null);
			return;
		}
		const sent = sendSocketCommand({
			type: "channel.move",
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			guildId: activeGuildId,
			channelId: channelDragSource.id,
			targetId: drop.targetId,
			placement: drop.placement
		} satisfies ClientCommand);
		if (sent) pushToast(language === "fr" ? "Déplacement du salon en cours..." : "Moving channel...", "info");
		setChannelDragSource(null);
		setChannelDropTarget(null);
	};

	const cancelChannelDrag = () => {
		setChannelDragSource(null);
		setChannelDropTarget(null);
	};

	const channelDropClass = (targetId: string | null, placement: ChannelDropPlacement) => {
		return channelDropTarget?.targetId === targetId && channelDropTarget.placement === placement ? ` isDrop${placement[0].toUpperCase()}${placement.slice(1)}` : "";
	};

	return {
		channelDragSource,
		channelDropTarget,
		channelDragAllowed,
		beginChannelDrag,
		updateChannelDropTarget,
		finishChannelDrop,
		cancelChannelDrag,
		channelDropClass
	};
}
