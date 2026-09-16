import { useState, type MouseEvent } from "react";
import type { ClientCommand, GuildMemberSummary, WorkspaceState } from "@botdeck/shared";
import { dmGuildId, stripDiscriminator } from "@/features/workspace/core";

export type MemberModerationAction = "kick" | "ban";

export type MemberContextMenuState = {
	guildId: string;
	userId: string;
	displayName: string;
	x: number;
	y: number;
};

export type MemberModerationTarget = {
	action: MemberModerationAction;
	guildId: string;
	userId: string;
	displayName: string;
};

function memberDisplayName(member: GuildMemberSummary, workspace: WorkspaceState): string {
	const user = workspace.usersById[member.userId];
	return stripDiscriminator(member.displayName ?? user?.displayName ?? member.username ?? user?.username ?? member.userId);
}

export function useMemberModerationActions({
	activeBotId,
	workspace,
	onCloseMenus,
	onCommand
}: {
	activeBotId: string | null;
	workspace: WorkspaceState;
	onCloseMenus: () => void;
	onCommand: (command: ClientCommand) => void;
}) {
	const [memberContextMenu, setMemberContextMenu] = useState<MemberContextMenuState | null>(null);
	const [memberModerationTarget, setMemberModerationTarget] = useState<MemberModerationTarget | null>(null);
	const [memberModerationReason, setMemberModerationReason] = useState("");

	const findServerMember = (guildId: string | null, userId: string): GuildMemberSummary | null => {
		if (!guildId || guildId === dmGuildId) return null;
		return (workspace.membersByGuildId[guildId] ?? []).find((member) => member.userId === userId) ?? null;
	};

	const openMemberContextMenu = (event: MouseEvent<HTMLElement>, guildId: string | null, userId: string): boolean => {
		const member = findServerMember(guildId, userId);
		if (!member || !guildId) return false;
		event.preventDefault();
		event.stopPropagation();
		onCloseMenus();
		setMemberContextMenu({
			guildId,
			userId,
			displayName: memberDisplayName(member, workspace),
			x: event.clientX,
			y: event.clientY
		});
		return true;
	};

	const requestMemberModeration = (action: MemberModerationAction, target: { guildId: string; userId: string; displayName: string }) => {
		setMemberContextMenu(null);
		setMemberModerationReason("");
		setMemberModerationTarget({ action, guildId: target.guildId, userId: target.userId, displayName: target.displayName });
	};

	const cancelMemberModeration = () => {
		setMemberModerationTarget(null);
		setMemberModerationReason("");
	};

	const submitMemberModeration = () => {
		if (!activeBotId || !memberModerationTarget) return;
		const reason = memberModerationReason.trim() || undefined;
		const base = {
			requestId: crypto.randomUUID(),
			botId: activeBotId,
			guildId: memberModerationTarget.guildId,
			userId: memberModerationTarget.userId,
			reason
		};

		onCommand(
			memberModerationTarget.action === "kick"
				? ({ ...base, type: "member.kick" } satisfies ClientCommand)
				: ({ ...base, type: "member.ban", deleteMessageSeconds: 0 } satisfies ClientCommand)
		);
		cancelMemberModeration();
	};

	return {
		memberContextMenu,
		setMemberContextMenu,
		memberModerationTarget,
		memberModerationReason,
		setMemberModerationReason,
		openMemberContextMenu,
		requestMemberModeration,
		cancelMemberModeration,
		submitMemberModeration
	};
}
