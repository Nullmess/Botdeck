// Validation des commandes navigateur du control-plane.

import { type ApplicationCommandDraft, type ClientCommand, type EmbedPayload } from "@botdeck/shared";
import { ActivityType } from "discord.js";
import { isRecord } from "./control-plane-primitives";

const ROLE_AUTOMATION_MAX_MESSAGES = 1000000;
const ROLE_AUTOMATION_MAX_VOICE_SECONDS = 1000000 * 60;
const ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS = 20000 * 86400;

// Chaîne non vide.
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

// Chaîne optionnelle.
export function isOptionalString(value: unknown): value is string | undefined {
	return value === undefined || typeof value === "string";
}

// Limite historique valide.
export function isHistoryLimit(value: unknown): value is number | undefined {
	return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

// Statut présence valide.
export function isPresenceStatus(value: unknown): value is "online" | "idle" | "dnd" | "offline" {
	return value === "online" || value === "idle" || value === "dnd" || value === "offline";
}

// Type activité valide.
export function isActivityType(value: unknown): value is "playing" | "streaming" | "listening" | "watching" | "competing" | "custom" {
	return value === "playing" || value === "streaming" || value === "listening" || value === "watching" || value === "competing" || value === "custom";
}

// Activité présence optionnelle.
export function isOptionalPresenceActivity(value: unknown): value is Extract<ClientCommand, { type: "presence.set" }>["activity"] {
	if (value === undefined || value === null) return true;
	if (!isRecord(value)) return false;
	return isActivityType(value.type) && isNonEmptyString(value.name) && value.name.length <= 128 && isOptionalString(value.state) && isOptionalString(value.url) && isOptionalString(value.emoji);
}

// Liste d’activités présence.
export function isOptionalPresenceActivities(value: unknown): value is Extract<ClientCommand, { type: "presence.set" }>["activities"] {
	if (value === undefined) return true;
	return Array.isArray(value) && value.length <= 2 && value.every((activity) => isOptionalPresenceActivity(activity) && activity !== null && activity !== undefined);
}

// Emoji statut vers Discord.
export function customStatusEmojiToDiscord(emoji: string | undefined): { name: string; id?: string } | undefined {
	const trimmed = emoji?.trim();
	if (!trimmed) return undefined;

	const customEmojiMatch = trimmed.match(/^<?a?:([A-Za-z0-9_]{2,32}):(\d{17,20})>?$/);
	if (customEmojiMatch) {
		return { name: customEmojiMatch[1], id: customEmojiMatch[2] };
	}

	const compactCustomEmojiMatch = trimmed.match(/^([A-Za-z0-9_]{2,32}):(\d{17,20})$/);
	if (compactCustomEmojiMatch) {
		return { name: compactCustomEmojiMatch[1], id: compactCustomEmojiMatch[2] };
	}

	return { name: trimmed };
}

// Payload brouillon commande.
export function isApplicationCommandDraftPayload(value: unknown): value is ApplicationCommandDraft {
	if (!isRecord(value)) return false;
	return (
		(value.scope === "global" || value.scope === "guild") &&
		(value.type === "chat_input" || value.type === "user" || value.type === "message") &&
		isNonEmptyString(value.name) &&
		typeof value.description === "string" &&
		(value.guildId === undefined || value.guildId === null || isNonEmptyString(value.guildId)) &&
		(value.options === undefined || Array.isArray(value.options))
	);
}

// Type activité vers Discord.
export function activityTypeToDiscord(type: "playing" | "streaming" | "listening" | "watching" | "competing" | "custom"): ActivityType {
	switch (type) {
		case "streaming":
			return ActivityType.Streaming;
		case "listening":
			return ActivityType.Listening;
		case "watching":
			return ActivityType.Watching;
		case "competing":
			return ActivityType.Competing;
		case "custom":
			return ActivityType.Custom;
		default:
			return ActivityType.Playing;
	}
}

// Fichier upload valide.
export function isUploadAttachment(value: unknown): value is { filename: string; contentType?: string | null; size: number; data: string } {
	if (!isRecord(value)) return false;
	return isNonEmptyString(value.filename) && typeof value.data === "string" && typeof value.size === "number" && Number.isFinite(value.size) && (value.contentType === undefined || value.contentType === null || typeof value.contentType === "string");
}

// Liste uploads valide.
export function isUploadAttachmentList(value: unknown): value is { filename: string; contentType?: string | null; size: number; data: string }[] | undefined {
	return value === undefined || (Array.isArray(value) && value.length <= 10 && value.every(isUploadAttachment));
}

// Longueur texte embed.
export function embedTextLength(embed: EmbedPayload): number {
	return (embed.title?.trim().length ?? 0) +
		(embed.description?.trim().length ?? 0) +
		(embed.author?.name.trim().length ?? 0) +
		(embed.footer?.text.trim().length ?? 0) +
		(embed.fields?.reduce((total, field) => total + field.name.trim().length + field.value.trim().length, 0) ?? 0);
}

// Payload embed valide.
export function isEmbedPayload(value: unknown): value is EmbedPayload {
	if (!isRecord(value)) return false;
	const fields = value.fields;
	const validShape = isOptionalString(value.title) &&
		isOptionalString(value.description) &&
		isOptionalString(value.url) &&
		(value.color === undefined || (typeof value.color === "number" && Number.isInteger(value.color) && value.color >= 0 && value.color <= 0xffffff)) &&
		isOptionalString(value.timestamp) &&
		(value.author === undefined || (isRecord(value.author) && isNonEmptyString(value.author.name) && value.author.name.trim().length <= 256 && isOptionalString(value.author.url) && isOptionalString(value.author.iconUrl))) &&
		(value.footer === undefined || (isRecord(value.footer) && isNonEmptyString(value.footer.text) && isOptionalString(value.footer.iconUrl))) &&
		isOptionalString(value.imageUrl) &&
		isOptionalString(value.thumbnailUrl) &&
		(fields === undefined || (Array.isArray(fields) && fields.length <= 25 && fields.every((field) => isRecord(field) && isNonEmptyString(field.name) && field.name.trim().length <= 256 && isNonEmptyString(field.value) && field.value.trim().length <= 1024 && (field.inline === undefined || typeof field.inline === "boolean"))));

	return validShape && embedTextLength(value) <= 6000;
}

// Liste embeds valide.
export function isEmbedPayloadList(value: unknown): value is EmbedPayload[] | undefined {
	return value === undefined || (Array.isArray(value) && value.length <= 10 && value.every(isEmbedPayload));
}

// Emoji réaction valide.
export function isReactionEmoji(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0 && value.length <= 120;
}

// Tags forum optionnels.
export function isOptionalForumTagIds(value: unknown): value is string[] | undefined {
	return value === undefined || (Array.isArray(value) && value.length <= 5 && value.every((item) => typeof item === "string" && item.trim().length > 0));
}

// Raison optionnelle valide.
export function isOptionalReason(value: unknown): value is string | undefined {
	return value === undefined || (typeof value === "string" && value.length <= 512);
}

// Date ISO ou null.
export function isIsoStringOrNull(value: unknown): value is string | null {
	return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

// Délai suppression valide.
export function isOptionalDeleteMessageSeconds(value: unknown): value is number | undefined {
	return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 604800);
}

function isOptionalPositiveIntegerOrNull(value: unknown, max = Number.MAX_SAFE_INTEGER): boolean {
	if (value === undefined || value === null || value === "") return true;
	if (typeof value === "number") return Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= max;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return true;
		if (!/^\d+$/.test(trimmed)) return false;
		const parsed = Number.parseInt(trimmed, 10);
		return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= max;
	}
	return false;
}

function isOptionalBoolean(value: unknown): boolean {
	return value === undefined || typeof value === "boolean";
}

function isInviteMaxAge(value: unknown): boolean {
	return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 604800);
}

function isInviteMaxUses(value: unknown): boolean {
	return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100);
}

// Enveloppe commande valide.
export function isCommandEnvelope(payload: unknown): payload is ClientCommand {
	if (!isRecord(payload) || !isNonEmptyString(payload.requestId) || !isNonEmptyString(payload.type)) return false;

	switch (payload.type) {
		case "ping":
			return true;
		case "bot.select":
			return isNonEmptyString(payload.botId);
		case "channel.sync":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && isHistoryLimit(payload.limit);
		case "channel.pins":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId);
		case "channel.move":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.channelId) && (payload.targetId === null || isNonEmptyString(payload.targetId)) && ["before", "after", "inside"].includes(String(payload.placement));
		case "channel.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.channelId);
		case "channel.recreatePurge":
			return isOptionalString(payload.botId)
				&& isNonEmptyString(payload.guildId)
				&& isNonEmptyString(payload.channelId)
				&& typeof payload.confirmation === "string"
				&& (payload.reason === undefined || typeof payload.reason === "string")
				&& isOptionalBoolean(payload.transcript)
				&& isOptionalBoolean(payload.finishMessage);
		case "forum.posts.fetch":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.forumId) && (payload.includeArchived === undefined || typeof payload.includeArchived === "boolean");
		case "forum.post.create":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.forumId) && isNonEmptyString(payload.title) && isNonEmptyString(payload.content) && isOptionalForumTagIds(payload.tagIds);
		case "forum.post.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.threadId);
		case "forum.post.archive":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.threadId) && typeof payload.archived === "boolean";
		case "forum.post.lock":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.threadId) && typeof payload.locked === "boolean";
		case "message.context":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && isNonEmptyString(payload.messageId) && isHistoryLimit(payload.limit);
		case "dm.open":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.userId) && isHistoryLimit(payload.limit);
		case "message.send":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && typeof payload.content === "string" && (payload.content.trim().length > 0 || (Array.isArray(payload.attachments) && payload.attachments.length > 0) || (Array.isArray(payload.embeds) && payload.embeds.length > 0)) && isOptionalString(payload.replyToMessageId) && isUploadAttachmentList(payload.attachments) && isEmbedPayloadList(payload.embeds) && (payload.embedPagination === undefined || typeof payload.embedPagination === "boolean");
		case "message.edit":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && isNonEmptyString(payload.messageId) && typeof payload.content === "string" && payload.content.trim().length > 0;
		case "message.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && isNonEmptyString(payload.messageId);
		case "message.pin":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && isNonEmptyString(payload.messageId) && typeof payload.pinned === "boolean";
		case "message.react":
		case "message.unreact":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.channelId) && isNonEmptyString(payload.messageId) && isReactionEmoji(payload.emoji);
		case "presence.set":
			return isOptionalString(payload.botId) && isPresenceStatus(payload.status) && isOptionalPresenceActivity(payload.activity) && isOptionalPresenceActivities(payload.activities);
		case "user.profile":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.userId);
		case "member.profile":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId);
		case "member.timeout":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isIsoStringOrNull(payload.until) && isOptionalReason(payload.reason);
		case "member.kick":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isOptionalReason(payload.reason);
		case "member.ban":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isOptionalReason(payload.reason) && isOptionalDeleteMessageSeconds(payload.deleteMessageSeconds);
		case "member.unban":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isOptionalReason(payload.reason);
		case "member.role.add":
		case "member.role.remove":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isNonEmptyString(payload.roleId);
		case "voice.member.move":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && (payload.channelId === null || isNonEmptyString(payload.channelId));

		case "guild.profile.update":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isOptionalString(payload.name) && (payload.description === undefined || payload.description === null || typeof payload.description === "string") && (payload.iconDataUrl === undefined || payload.iconDataUrl === null || typeof payload.iconDataUrl === "string");
		case "guild.members.fetch":
		case "guild.roles.fetch":
		case "guild.invites.fetch":
		case "guild.bans.fetch":
		case "guild.automation.fetch":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId);
		case "guild.invite.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.code);
		case "guild.invite.create":
			return isOptionalString(payload.botId)
				&& isNonEmptyString(payload.guildId)
				&& isNonEmptyString(payload.channelId)
				&& isInviteMaxAge(payload.maxAge)
				&& isInviteMaxUses(payload.maxUses)
				&& isOptionalBoolean(payload.temporary)
				&& isOptionalBoolean(payload.unique)
				&& isOptionalReason(payload.reason);
		case "guild.ban.create":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isOptionalReason(payload.reason) && isOptionalDeleteMessageSeconds(payload.deleteMessageSeconds);
		case "guild.ban.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.userId) && isOptionalReason(payload.reason);
		case "guild.automation.update":
			return isOptionalString(payload.botId)
				&& isNonEmptyString(payload.guildId)
				&& ["welcome", "goodbye", "logs"].includes(String(payload.kind))
				// Un channelId vide est valide ici : il permet de sauvegarder un modèle
				// welcome/goodbye/logs sans armer l'automatisation sur un salon.
				&& typeof payload.channelId === "string"
				&& (payload.messageType === undefined || payload.messageType === "message" || payload.messageType === "embed")
				&& (payload.messageTemplate === undefined || typeof payload.messageTemplate === "string")
				&& (payload.embedPagesJson === undefined || payload.embedPagesJson === null || typeof payload.embedPagesJson === "string")
				&& (payload.eventConfigsJson === undefined || payload.eventConfigsJson === null || typeof payload.eventConfigsJson === "string");
		case "guild.automation.remove":
		case "guild.automation.test":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && ["welcome", "goodbye", "logs"].includes(String(payload.kind));
		case "guild.roleAutomation.upsert":
			return isOptionalString(payload.botId)
				&& isNonEmptyString(payload.guildId)
				&& (payload.ruleId === undefined || payload.ruleId === null || isNonEmptyString(payload.ruleId))
				&& isNonEmptyString(payload.roleId)
				&& isOptionalBoolean(payload.enabled)
				&& (payload.conditionMode === undefined || payload.conditionMode === "all" || payload.conditionMode === "any")
				&& isOptionalPositiveIntegerOrNull(payload.minMessages, ROLE_AUTOMATION_MAX_MESSAGES)
				&& isOptionalPositiveIntegerOrNull(payload.minVoiceSeconds, ROLE_AUTOMATION_MAX_VOICE_SECONDS)
				&& isOptionalPositiveIntegerOrNull(payload.minMemberAgeSeconds, ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS)
				&& isOptionalBoolean(payload.removeWhenInvalid)
				&& isOptionalBoolean(payload.ignoreBots)
				&& isOptionalBoolean(payload.applyToExistingMembers);
		case "guild.roleAutomation.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.ruleId);
		case "guild.roleAutomation.test":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && (payload.ruleId === undefined || payload.ruleId === null || isNonEmptyString(payload.ruleId));
		case "guild.roleAutomation.sync":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId);
		case "guild.role.create":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.name) && (payload.color === undefined || payload.color === null || typeof payload.color === "string") && (payload.permissions === undefined || typeof payload.permissions === "string") && (payload.hoist === undefined || typeof payload.hoist === "boolean") && (payload.mentionable === undefined || typeof payload.mentionable === "boolean");
		case "guild.role.update":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.roleId) && (payload.name === undefined || typeof payload.name === "string") && (payload.color === undefined || payload.color === null || typeof payload.color === "string") && (payload.permissions === undefined || typeof payload.permissions === "string") && (payload.hoist === undefined || typeof payload.hoist === "boolean") && (payload.mentionable === undefined || typeof payload.mentionable === "boolean");
		case "guild.role.permissions.update":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.roleId) && typeof payload.permissions === "string";
		case "guild.role.delete":
			return isOptionalString(payload.botId) && isNonEmptyString(payload.guildId) && isNonEmptyString(payload.roleId);

		case "applicationCommands.fetch":
			return isOptionalString(payload.botId) &&
				(payload.guildId === undefined || payload.guildId === null || isNonEmptyString(payload.guildId)) &&
				(payload.allGuilds === undefined || typeof payload.allGuilds === "boolean") &&
				(payload.readOnly === undefined || payload.readOnly === true) &&
				(payload.reason === undefined || payload.reason === "autoload" || payload.reason === "manual-refresh" || payload.reason === "profile");

		case "applicationCommand.create":
			return isOptionalString(payload.botId) && payload.apply === true && isApplicationCommandDraftPayload(payload.draft);

		case "applicationCommand.update":
			return (
				isOptionalString(payload.botId) &&
				payload.apply === true &&
				isNonEmptyString(payload.commandId) &&
				isApplicationCommandDraftPayload(payload.draft)
			);

		case "applicationCommand.delete":
			return isOptionalString(payload.botId) && payload.apply === true && isNonEmptyString(payload.commandId) && (payload.scope === "global" || payload.scope === "guild") && (payload.guildId === undefined || payload.guildId === null || isNonEmptyString(payload.guildId));

		default:
			return false;
	}
}

