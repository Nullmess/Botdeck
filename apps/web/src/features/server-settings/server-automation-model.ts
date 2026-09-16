// Modèle et helpers des automatisations serveur

import {
	type GuildAutomationConfig,
	type GuildAutomationMessageConfig,
	type GuildRoleAutomationRuleConfig
} from "@botdeck/shared";

import { type ServerSettingsText } from "@/features/server-settings/server-settings-text";

// Paramètres serveur.
export type ServerSettingsTab = "overview" | "members" | "invites" | "bans" | "automations" | "templates";
export type AutomationMessageDraft = { channelId: string; messageType: "message" | "embed"; messageTemplate: string; embedPagesJson: string };
export type AutomationLogsDraft = { channelId: string; eventConfigsJson: string };
export type AutomationModalTarget = { kind: "welcome" | "goodbye" | "logs"; title: string } | null;
export type RoleAutomationDraftRule = {
	id: string;
	roleId: string;
	enabled: boolean;
	conditionMode: "all" | "any";
	minMessages: string;
	minVoiceMinutes: string;
	minMemberAgeDays: string;
	removeWhenInvalid: boolean;
	ignoreBots: boolean;
	applyToExistingMembers: boolean;
};
export type RoleAutomationModalTarget = { rule: RoleAutomationDraftRule | null; index: number | null } | null;
export type LogEventKey = "message_edit" | "message_delete" | "channel_create" | "channel_update" | "channel_delete" | "channel_recreate_purge" | "member_ban" | "member_unban" | "member_kick";
export type LogEventDraft = { enabled: boolean; mode: "message" | "embed"; messageTemplate: string; embedPagesJson: string };
export type SimpleAutomationEmbedDraft = { title: string; description: string; color: string; imageUrl: string; thumbnailUrl: string; footerText: string };

export const ROLE_AUTOMATION_MAX_MESSAGES = 1000000;
export const ROLE_AUTOMATION_MAX_VOICE_MINUTES = 1000000;
export const ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS = 20000;

export const defaultWelcomeTemplate = "Bienvenue {user.mention} sur {guild.name} !";
export const defaultGoodbyeTemplate = "{user.displayName} a quitté {guild.name}.";
export const defaultLogEventConfigsJson = JSON.stringify({
	message_edit: { enabled: true, mode: "message", messageTemplate: "✉️ {event.name} par {actor.mention} dans {channel.mention}\nAvant: {message.before}\nAprès: {message.after}\nLien: {message.url}" },
	message_delete: { enabled: true, mode: "message", messageTemplate: "🗑️ {event.name} par {actor.mention} dans {channel.mention}\nAuteur: {target.mention}\nMessage: {message.before}" },
	channel_create: { enabled: true, mode: "message", messageTemplate: "🔨 {event.name} par {actor.mention}: {channel.mention} `{channel.name}`" },
	channel_update: { enabled: true, mode: "message", messageTemplate: "🛠️ {event.name} par {actor.mention}: {channel.mention} `{channel.name}`\nAvant: {channel.before}\nAprès: {channel.after}" },
	channel_delete: { enabled: true, mode: "message", messageTemplate: "🗑️ {event.name} par {actor.mention}: `{channel.name}` `{channel.id}`" },
	channel_recreate_purge: { enabled: true, mode: "message", messageTemplate: "🧹 {event.name} par {actor.mention}\nAncien: `{oldChannel.name}`\nNouveau: {newChannel.mention}\nRaison: {purge.reason}" },
	member_ban: { enabled: true, mode: "message", messageTemplate: "🔨 {target.mention} a été banni par {actor.mention}.\nRaison: {reason}" },
	member_unban: { enabled: true, mode: "message", messageTemplate: "✅ {target.mention} a été débanni par {actor.mention}.\nRaison: {reason}" },
	member_kick: { enabled: true, mode: "message", messageTemplate: "👢 {target.mention} a été expulsé par {actor.mention}.\nRaison: {reason}" }
}, null, 2);
export const logEventLabels: Record<LogEventKey, string> = {
	message_edit: "Message modifié",
	message_delete: "Message supprimé",
	channel_create: "Salon créé",
	channel_update: "Salon modifié",
	channel_delete: "Salon supprimé",
	channel_recreate_purge: "Salon réinitialisé",
	member_ban: "Membre banni",
	member_unban: "Membre débanni",
	member_kick: "Membre expulsé"
};
export const logEventKeys = Object.keys(logEventLabels) as LogEventKey[];
export const welcomeGoodbyeVariables = [
	"user.id",
	"user.mention",
	"user.name",
	"user.username",
	"user.displayName",
	"user.avatar",
	"user.avatarUrl",
	"guild.id",
	"guild.name",
	"guild.icon",
	"guild.iconUrl",
	"bot.id",
	"bot.name",
	"bot.username",
	"bot.mention",
	"bot.avatar",
	"bot.avatarUrl",
	"member.count",
	"member.joinedAt",
	"member.joinedDate",
	"member.joinedTime",
	"member.joinedRelative",
	"member.leftAt",
	"member.leftDate",
	"member.leftTime",
	"member.leftRelative",
	"channel.id",
	"channel.name",
	"channel.mention",
	"channel.type"
];
export const commonLogVariables = [
	"event.key", "event.name", "event.date",
	"guild.id", "guild.name", "guild.icon", "guild.iconUrl",
	"bot.id", "bot.name", "bot.username", "bot.mention", "bot.avatar", "bot.avatarUrl",
	"actor.id", "actor.mention", "actor.name", "actor.username", "actor.displayName", "actor.avatar", "actor.avatarUrl",
	"channel.id", "channel.name", "channel.mention", "channel.type"
];
export const moderationLogVariables = [
	...commonLogVariables,
	"target.id", "target.mention", "target.name", "target.username", "target.displayName", "target.avatar", "target.avatarUrl",
	"reason", "action", "action.key", "action.name", "action.emoji"
];
export const logEventVariables: Record<LogEventKey, string[]> = {
	message_edit: [...commonLogVariables, "target.id", "target.mention", "target.name", "target.username", "target.displayName", "target.avatar", "target.avatarUrl", "message.id", "message.url", "message.before", "message.after"],
	message_delete: [...commonLogVariables, "target.id", "target.mention", "target.name", "target.username", "target.displayName", "target.avatar", "target.avatarUrl", "message.id", "message.url", "message.before"],
	channel_create: commonLogVariables,
	channel_update: [...commonLogVariables, "channel.before", "channel.after"],
	channel_delete: commonLogVariables,
	channel_recreate_purge: [...commonLogVariables, "oldChannel.id", "oldChannel.name", "oldChannel.type", "oldChannel.parentId", "oldChannel.position", "newChannel.id", "newChannel.name", "newChannel.mention", "newChannel.type", "newChannel.parentId", "newChannel.position", "purge.reason", "purge.status", "purge.startedAt", "purge.finishedAt", "purge.duration"],
	member_ban: moderationLogVariables,
	member_unban: moderationLogVariables,
	member_kick: moderationLogVariables
};

