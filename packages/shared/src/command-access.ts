// Politique d’accès des commandes navigateur.
// Le mode lecture seule bloque toujours Slash Studio + modèles/automatisations.
// Les autres familles sont optionnelles et pilotées par les cases de l'interface.

import type { BotAccountSummary } from "./models";
import type { ClientCommand } from "./protocol";

export type ReadOnlyBlockKind = "slashStudio" | "automations" | "messages" | "channels" | "moderation";

export type BotReadOnlyPolicy = Pick<
	BotAccountSummary,
	| "readOnlyMode"
	| "commandStudioDisabled"
	| "readOnlyBlockMessages"
	| "readOnlyBlockChannels"
	| "readOnlyBlockModeration"
>;

export const READ_ONLY_SLASH_STUDIO_COMMAND_TYPES = [
	"applicationCommand.create",
	"applicationCommand.update",
	"applicationCommand.delete"
] as const satisfies readonly ClientCommand["type"][];

export const READ_ONLY_AUTOMATION_COMMAND_TYPES = [
	"guild.automation.update",
	"guild.automation.remove",
	"guild.automation.test",
	"guild.roleAutomation.upsert",
	"guild.roleAutomation.delete",
	"guild.roleAutomation.test",
	"guild.roleAutomation.sync"
] as const satisfies readonly ClientCommand["type"][];

export const READ_ONLY_MESSAGE_COMMAND_TYPES = [
	"message.send",
	"message.edit",
	"message.delete",
	"message.pin",
	"message.react",
	"message.unreact"
] as const satisfies readonly ClientCommand["type"][];

export const READ_ONLY_CHANNEL_COMMAND_TYPES = [
	"channel.move",
	"channel.delete",
	"channel.recreatePurge",
	"guild.invite.create",
	"guild.invite.delete",
	"forum.post.create",
	"forum.post.delete",
	"forum.post.archive",
	"forum.post.lock"
] as const satisfies readonly ClientCommand["type"][];

export const READ_ONLY_MODERATION_COMMAND_TYPES = [
	"guild.role.create",
	"guild.role.update",
	"guild.role.permissions.update",
	"guild.role.delete",
	"guild.ban.create",
	"guild.ban.delete",
	"member.timeout",
	"member.kick",
	"member.ban",
	"member.unban",
	"member.nick.set",
	"member.role.add",
	"member.role.remove",
	"voice.member.move"
] as const satisfies readonly ClientCommand["type"][];

const slashStudioTypes = new Set<ClientCommand["type"]>(READ_ONLY_SLASH_STUDIO_COMMAND_TYPES);
const automationTypes = new Set<ClientCommand["type"]>(READ_ONLY_AUTOMATION_COMMAND_TYPES);
const messageTypes = new Set<ClientCommand["type"]>(READ_ONLY_MESSAGE_COMMAND_TYPES);
const channelTypes = new Set<ClientCommand["type"]>(READ_ONLY_CHANNEL_COMMAND_TYPES);
const moderationTypes = new Set<ClientCommand["type"]>(READ_ONLY_MODERATION_COMMAND_TYPES);

export function botAccountIsReadOnly(bot: BotReadOnlyPolicy | null | undefined): boolean {
	return bot?.readOnlyMode === true || bot?.commandStudioDisabled === true;
}

export function getReadOnlyCommandBlockKind(bot: BotReadOnlyPolicy | null | undefined, type: ClientCommand["type"]): ReadOnlyBlockKind | null {
	if (!botAccountIsReadOnly(bot)) return null;
	if (slashStudioTypes.has(type)) return "slashStudio";
	if (automationTypes.has(type)) return "automations";
	if (bot?.readOnlyBlockMessages && messageTypes.has(type)) return "messages";
	if (bot?.readOnlyBlockChannels && channelTypes.has(type)) return "channels";
	if (bot?.readOnlyBlockModeration && moderationTypes.has(type)) return "moderation";
	return null;
}

export function commandBlockedByReadOnlyPolicy(bot: BotReadOnlyPolicy | null | undefined, type: ClientCommand["type"]): boolean {
	return getReadOnlyCommandBlockKind(bot, type) !== null;
}

// Compatibilité avec les anciens checks : indique seulement si une commande appartient à une famille potentiellement bloquable.
export function commandRequiresDiscordWrite(type: ClientCommand["type"]): boolean {
	return slashStudioTypes.has(type) || automationTypes.has(type) || messageTypes.has(type) || channelTypes.has(type) || moderationTypes.has(type);
}

export function readOnlyBlockKindLabel(kind: ReadOnlyBlockKind): string {
	switch (kind) {
		case "slashStudio":
			return "Slash Studio";
		case "automations":
			return "modèles et automatisations";
		case "messages":
			return "actions de messagerie";
		case "channels":
			return "gestion des salons et forums";
		case "moderation":
			return "modération et rôles";
	}
}
