import { type ChannelSummary, type MessageSummary, type WorkspaceState } from "@botdeck/shared";
import type { WorkspaceReadyEvent } from "./botdeck-transport";

export const dmGuildId = "__botdeck_dm__";

export type ChannelCategoryGroup = {
	id: string;
	label: string;
	category: ChannelSummary | null;
	channels: ChannelSummary[];
};


// Retrouve l’utilisateur du MP.
export function resolveDmChannelUser(channel: ChannelSummary, workspace: WorkspaceState, botUserId?: string | null): WorkspaceState["usersById"][string] | null {
	// DM: interlocuteur reconstruit.
	const topicUser = Object.values(workspace.usersById).find((user) => channel.topic === `user:${user.id}`) ?? null;
	if (topicUser && topicUser.id !== botUserId) return topicUser;

	const messages = workspace.messagesByChannel[channel.id] ?? [];
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const user = workspace.usersById[messages[index].authorId];
		if (user && user.id !== botUserId && !user.bot) return user;
	}

	return topicUser && topicUser.id !== botUserId ? topicUser : null;
}

// Détecte un salon sélectionnable.
export function isSelectableChannel(channel: ChannelSummary): boolean {
	return channel.type !== "category";
}

// Premier salon sélectionnable.
export function firstSelectableChannelId(channels: ChannelSummary[]): string | null {
	return channels.find(isSelectableChannel)?.id ?? null;
}

// Droit d’écrire au salon.
export function channelCanSend(channel: ChannelSummary | null): boolean {
	if (!channel || channel.type === "voice" || channel.type === "category" || channel.type === "forum") return false;
	if (!channel.permissions) return true;
	if (channel.type === "thread") return channel.permissions.viewChannel && channel.permissions.sendMessagesInThreads;
	return channel.permissions.viewChannel && channel.permissions.sendMessages;
}

// Droit d’ajouter des fichiers.
export function channelCanAttach(channel: ChannelSummary | null): boolean {
	if (!channelCanSend(channel)) return false;
	return channel?.permissions?.attachFiles ?? true;
}

// Droit d’envoyer des embeds.
export function channelCanEmbed(channel: ChannelSummary | null): boolean {
	if (!channelCanSend(channel)) return false;
	return channel?.permissions?.embedLinks ?? true;
}

// Droit d’ajouter des réactions.
export function channelCanReact(channel: ChannelSummary | null): boolean {
	if (!channel || channel.type === "voice" || channel.type === "category") return false;
	return channel.permissions?.addReactions ?? true;
}

// Droit de gérer les messages.
export function channelCanManageMessages(channel: ChannelSummary | null): boolean {
	if (!channel || channel.type === "voice" || channel.type === "category" || channel.type === "dm") return false;
	return channel.permissions?.manageMessages ?? true;
}

// Droit d’épingler un message.
export function channelCanPinMessage(channel: ChannelSummary | null): boolean {
	if (!channel || channel.type === "voice" || channel.type === "category" || channel.type === "forum") return false;
	if (channel.type === "dm") return true;
	return channelCanManageMessages(channel);
}

// Droit de supprimer un message.
export function channelCanDeleteMessage(channel: ChannelSummary | null, message: MessageSummary, botUserId?: string | null): boolean {
	if (!channel || channel.type === "voice" || channel.type === "category") return false;
	if (botUserId && message.authorId === botUserId) return true;
	return channelCanManageMessages(channel);
}

// Tri stable des salons.
export function compareChannelSummaries(left: ChannelSummary, right: ChannelSummary): number {
	return (left.sortIndex ?? left.position ?? 0) - (right.sortIndex ?? right.position ?? 0) || (left.position ?? 0) - (right.position ?? 0) || left.id.localeCompare(right.id);
}

// Tri des salons racine.
export function compareTopLevelChannels(left: ChannelSummary, right: ChannelSummary): number {
	return compareChannelSummaries(left, right);
}

// Priorité d’affichage salon.
export function channelTypeRank(channel: ChannelSummary): number {
	switch (channel.type) {
		case "category":
			return 0;
		case "text":
		case "forum":
		case "thread":
			return 1;
		case "voice":
			return 2;
		default:
			return 3;
	}
}

// Salons groupés par catégorie.
export function buildChannelCategoryGroups(channels: ChannelSummary[], includeChannel: (channel: ChannelSummary) => boolean): ChannelCategoryGroup[] {
	const categories = channels.filter((channel) => channel.type === "category").slice().sort(compareTopLevelChannels);
	const categoryById = new Map(categories.map((category) => [category.id, category]));
	const childrenByCategoryId = new Map<string, ChannelSummary[]>();
	const topLevelChannels: ChannelSummary[] = [];

	for (const channel of channels) {
		if (channel.type !== "category" && !includeChannel(channel)) continue;
		if (channel.type === "thread") continue;
		const parentId = channel.parentId ?? channel.categoryId ?? null;
		if (parentId && categoryById.has(parentId)) {
			const children = childrenByCategoryId.get(parentId) ?? [];
			children.push(channel);
			childrenByCategoryId.set(parentId, children);
			continue;
		}
		topLevelChannels.push(channel);
	}

	const groupsById = new Map<string, ChannelCategoryGroup>();
	for (const category of categories) {
		groupsById.set(category.id, {
			id: category.id,
			label: category.name,
			category,
			channels: (childrenByCategoryId.get(category.id) ?? []).slice().sort(compareChannelSummaries)
		});
	}

	return topLevelChannels.slice().sort(compareTopLevelChannels).map((item) => {
		if (item.type === "category") return groupsById.get(item.id) ?? null;
		return {
			id: `top-level:${item.id}`,
			label: "",
			category: null,
			channels: [item]
		};
	}).filter((group): group is ChannelCategoryGroup => Boolean(group));
}

// Espace prêt côté UI.
export function workspaceEntryIsReady(workspace: WorkspaceState, readyEvent: WorkspaceReadyEvent | null, botId: string | null): boolean {
	// Overlay: attend compteurs serveur.
	if (!botId || !readyEvent || readyEvent.botId !== botId) return false;
	if (workspace.selectedBotId !== botId) return false;
	if (workspace.guilds.length < readyEvent.guildCount) return false;

	const guildIdSet = new Set(workspace.guilds.map((guild) => guild.id));
	for (const guildId of readyEvent.guildIds) {
		if (!guildIdSet.has(guildId)) return false;
		if (!Object.prototype.hasOwnProperty.call(workspace.channelsByGuild, guildId)) return false;
	}

	const loadedChannelCount = readyEvent.guildIds.reduce((total, guildId) => total + (workspace.channelsByGuild[guildId]?.length ?? 0), 0);
	if (loadedChannelCount < readyEvent.channelCount) return false;

	return true;
}


// Indexe un profil par serveur.
export function memberProfileKey(guildId: string, userId: string): string {
	return `${guildId}:${userId}`;
}


