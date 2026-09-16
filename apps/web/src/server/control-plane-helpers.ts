// Helpers modèles Discord

import {
	type ApplicationCommandDraft,
	type ApplicationCommandDraftOption,
	type ApplicationCommandOptionSummary,
	type ApplicationCommandRuntimeDefinition,
	type ApplicationCommandScope,
	type ApplicationCommandSummary,
	type ChannelPermissionsSummary,
	type ChannelSummary,
	type ClientCommand,
	type EmbedPayload,
	type ForumPostSummary,
	type ForumTagSummary,
	type GuildBanSummary,
	type GuildInviteSummary,
	type GuildMemberSummary,
	type GuildSummary,
	type MemberProfileSummary,
	type MessageSummary,
	type PresenceSnapshot,
	type RoleSummary,
	type UserSummary,
	type VoiceStateSummary,
	type WorkspaceState
} from "@botdeck/shared";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, type ApplicationCommand, type Guild, type GuildBan, type GuildBasedChannel, type GuildMember, type Interaction, type Invite, type Message, type Role, type ThreadChannel, type User, type VoiceState } from "discord.js";
import { browserCommandFailureMessage, isRecord, isUnknownApplicationCommandError, normalizeBotToken, now, safeJsonParse } from "./control-plane-primitives";
export { browserCommandFailureMessage, isRecord, isUnknownApplicationCommandError, normalizeBotToken, now, safeJsonParse } from "./control-plane-primitives";
export { isNonEmptyString, isOptionalString, isHistoryLimit, isPresenceStatus, isActivityType, isOptionalPresenceActivity, isOptionalPresenceActivities, customStatusEmojiToDiscord, isApplicationCommandDraftPayload, activityTypeToDiscord, isUploadAttachment, isUploadAttachmentList, embedTextLength, isEmbedPayload, isEmbedPayloadList, isReactionEmoji, isOptionalForumTagIds, isOptionalReason, isIsoStringOrNull, isOptionalDeleteMessageSeconds, isCommandEnvelope } from "./control-plane-command-validation";

export type CommandEnvelope = ClientCommand;
export type SnapshotEnvelope = { type: "snapshot"; state: WorkspaceState };
// Garde-fous mémoires Discord.
export const DM_GUILD_ID = "__botdeck_dm__";
export const MESSAGE_CACHE_CHANNEL_LIMIT = 250;
export const MESSAGE_CACHE_PER_CHANNEL_LIMIT = 120;
export const WARMUP_HISTORY_LIMIT = 40;
export const WARMUP_CHANNEL_CONCURRENCY = 3;
export const WARMUP_GUILD_CONCURRENCY = 2;
export const STARTUP_WARMUP_ENABLED = process.env.BOTDECK_STARTUP_WARMUP === "1";
export const STARTUP_SESSION_CONCURRENCY = 3;
export const DATABASE_WRITE_CONCURRENCY = 1;
export const DATABASE_WRITE_BATCH_SIZE = 25;
export const EMBED_MESSAGE_PAGE_TTL_MS = 24 * 60 * 60 * 1000;

export interface BotAccountRow {
	id: string;
	name: string;
	tokenCiphertext: string;
	tokenIv: string;
	tokenAuthTag: string;
	discordUserId: string | null;
	avatarUrl: string | null;
	enabled: boolean;
	readOnlyMode: boolean;
	readOnlyBlockMessages: boolean;
	readOnlyBlockChannels: boolean;
	readOnlyBlockModeration: boolean;
	commandStudioDisabled: boolean;
	lastConnectedAt: Date | null;
	lastError: string | null;
}

export type BotAccountUpdatePatch = {
	name?: string;
	discordUserId?: string | null;
	avatarUrl?: string | null;
	lastConnectedAt?: Date | null;
	lastError?: string | null;
};

// Relit le runtime embarqué.
export function readBotdeckRuntime(value: unknown): ApplicationCommandRuntimeDefinition | null {
	if (!isRecord(value)) return null;
	const response = isRecord(value.response) ? value.response : null;
	if (!response || typeof response.content !== "string") return null;
	const visibility = response.visibility === "public" ? "public" : "ephemeral";
	const workflow = Array.isArray(value.workflow)
		? value.workflow.filter(isRecord).map((item, index) => ({
			id: typeof item.id === "string" ? item.id : `step-${index + 1}`,
			type: typeof item.type === "string" ? item.type as ApplicationCommandRuntimeDefinition["workflow"][number]["type"] : "reply",
			label: typeof item.label === "string" ? item.label : "Action",
			content: typeof item.content === "string" ? item.content : null,
			metadata: isRecord(item.metadata) ? item.metadata : null
		}))
		: [];
	return {
		version: 1,
		intent: typeof value.intent === "string" ? value.intent : null,
		response: { content: response.content, visibility },
		workflow,
		variables: Array.isArray(value.variables) ? value.variables.filter((item): item is string => typeof item === "string") : []
	};
}

// Prépare les métadonnées Discord.
export function runtimeMetadata(runtime: ApplicationCommandRuntimeDefinition): Record<string, unknown> {
	const metadata = runtime.workflow[0]?.metadata;
	return isRecord(metadata) ? metadata : {};
}

// Déduit le type de réponse.
export function runtimeResponseMode(runtime: ApplicationCommandRuntimeDefinition): "message" | "embed" | "menu" | "modal" | "welcome" | "goodbye" | "logs" | "autorole" | "ban" | "unban" | "kick" {
	const metadata = runtimeMetadata(runtime);
	return metadata.responseMode === "embed" || metadata.responseMode === "menu" || metadata.responseMode === "modal" || metadata.responseMode === "welcome" || metadata.responseMode === "goodbye" || metadata.responseMode === "logs" || metadata.responseMode === "autorole" || metadata.responseMode === "ban" || metadata.responseMode === "unban" || metadata.responseMode === "kick" ? metadata.responseMode : "message";
}

// Déduit le mode d’exécution.
export function runtimeExecutionMode(runtime: ApplicationCommandRuntimeDefinition | null | undefined): "prefix" | null {
	if (!runtime) return null;
	const metadata = runtimeMetadata(runtime);
	return metadata.executionMode === "prefix" ? "prefix" : null;
}

// Lit le préfixe configuré.
export function runtimePrefix(runtime: ApplicationCommandRuntimeDefinition | null | undefined): string {
	if (!runtime) return "&";
	const metadata = runtimeMetadata(runtime);
	return typeof metadata.prefix === "string" && metadata.prefix.length > 0 ? metadata.prefix : "&";
}

// Identifie une commande préfixe.
export function isPrefixCommandDraft(draft: ApplicationCommandDraft): boolean {
	return runtimeExecutionMode(readBotdeckRuntime(draft.runtime)) === "prefix";
}

// Stabilise l’id local préfixe.
export function localPrefixCommandId(scope: ApplicationCommandScope, guildId: string | null | undefined, name: string): string {
	return `local-prefix:${scope}:${guildId || "global"}:${name.trim().toLowerCase()}`;
}

// Convertit une commande stockée.
export function storedCommandDefinitionToSummary(row: { commandId: string; scope: string; guildId: string | null; name: string; draftJson: string; runtimeJson: string; createdAt?: Date | null; updatedAt?: Date | null }): ApplicationCommandSummary | null {
	const draft = safeJsonParse(row.draftJson);
	const runtime = readBotdeckRuntime(safeJsonParse(row.runtimeJson));
	if (!isRecord(draft) || runtimeExecutionMode(runtime) !== "prefix") return null;
	const scope = row.scope === "guild" ? "guild" : "global";
	const raw = { botdeckRuntime: runtime, botdeckDraft: draft, localOnly: true, prefix: runtimePrefix(runtime) };
	return {
		id: row.commandId,
		applicationId: null,
		guildId: scope === "guild" ? row.guildId : null,
		scope,
		name: typeof draft.name === "string" ? draft.name : row.name,
		type: "Chat Input",
		description: typeof draft.description === "string" && draft.description.trim().length > 0 ? draft.description : "Commande texte à préfixe",
		optionCount: Array.isArray((draft as { options?: unknown }).options) ? ((draft as { options: unknown[] }).options.length) : 0,
		options: [],
		version: null,
		defaultMemberPermissions: typeof (draft as { defaultMemberPermissions?: unknown }).defaultMemberPermissions === "string" ? (draft as { defaultMemberPermissions: string }).defaultMemberPermissions : null,
		dmPermission: typeof (draft as { dmPermission?: unknown }).dmPermission === "boolean" ? (draft as { dmPermission: boolean }).dmPermission : null,
		nsfw: typeof (draft as { nsfw?: unknown }).nsfw === "boolean" ? (draft as { nsfw: boolean }).nsfw : null,
		contexts: Array.isArray((draft as { contexts?: unknown }).contexts) ? (draft as { contexts: ApplicationCommandSummary["contexts"] }).contexts : null,
		integrationTypes: Array.isArray((draft as { integrationTypes?: unknown }).integrationTypes) ? (draft as { integrationTypes: ApplicationCommandSummary["integrationTypes"] }).integrationTypes : null,
		nameLocalizations: null,
		descriptionLocalizations: null,
		createdAt: row.createdAt ? row.createdAt.toISOString() : null,
		updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
		runtime,
		raw
	};
}

// Normalise la couleur embed.
export function colorFromRuntime(value: unknown): number {
	if (typeof value !== "string") return 0x5865f2;
	const normalized = value.trim().replace(/^#/, "");
	const parsed = Number.parseInt(normalized, 16);
	return Number.isFinite(parsed) ? parsed : 0x5865f2;
}

// Nettoie un embed runtime.
export function trimRuntimeEmbed(embed: {
	title: string;
	description: string;
	color: number;
	author?: { name: string; icon_url?: string };
	footer?: { text: string; icon_url?: string };
	image?: { url: string };
	thumbnail?: { url: string };
	fields: Array<{ name: string; value: string; inline: boolean }>;
}) {
	const lengthOf = () =>
		embed.title.length +
		embed.description.length +
		(embed.author?.name.length ?? 0) +
		(embed.footer?.text.length ?? 0) +
		embed.fields.reduce((total, field) => total + field.name.length + field.value.length, 0);
	while (lengthOf() > 6000 && embed.fields.length > 0) embed.fields.pop();
	const remaining = 6000 - (lengthOf() - embed.description.length);
	if (remaining < embed.description.length) embed.description = embed.description.slice(0, Math.max(0, remaining));
	return embed;
}

// Construit les pages embed.
export function runtimeEmbedPages(runtime: ApplicationCommandRuntimeDefinition, fallbackContent: string) {
	const metadata = runtimeMetadata(runtime);
	const pages = Array.isArray(metadata.embedPages) ? metadata.embedPages : [];
	const normalized = pages.slice(0, 10).map((item, index) => {
		const page = isRecord(item) ? item : {};
		const fields = Array.isArray(page.fields)
			? page.fields.slice(0, 25).filter(isRecord).map((field) => ({
				name: typeof field.name === "string" && field.name.trim() ? field.name.slice(0, 256) : "Champ",
				value: typeof field.value === "string" && field.value.trim() ? field.value.slice(0, 1024) : "Valeur",
				inline: field.inline === true
			}))
			: [];
		return trimRuntimeEmbed({
			title: typeof page.title === "string" && page.title.trim() ? page.title.slice(0, 256) : `Page ${index + 1}`,
			description: typeof page.description === "string" && page.description.trim() ? page.description.slice(0, 4096) : fallbackContent || " ",
			color: colorFromRuntime(page.color),
				author: typeof page.author === "string" && page.author.trim() ? {
					name: page.author.slice(0, 256),
					...(typeof page.authorIconUrl === "string" && page.authorIconUrl.trim() ? { icon_url: page.authorIconUrl.trim().slice(0, 2048) } : {})
				} : undefined,
				footer: typeof page.footer === "string" && page.footer.trim() ? {
					text: page.footer.slice(0, 2048),
					...(typeof page.footerIconUrl === "string" && page.footerIconUrl.trim() ? { icon_url: page.footerIconUrl.trim().slice(0, 2048) } : {})
				} : undefined,
				image: typeof page.imageUrl === "string" && page.imageUrl.trim() ? { url: page.imageUrl.trim() } : undefined,
				thumbnail: typeof page.thumbnailUrl === "string" && page.thumbnailUrl.trim() ? { url: page.thumbnailUrl.trim() } : undefined,
				fields
		});
	});
	if (normalized.length) return normalized;
	return [trimRuntimeEmbed({
		title: typeof metadata.embedTitle === "string" && metadata.embedTitle.trim() ? metadata.embedTitle.trim().slice(0, 256) : "Réponse",
		description: fallbackContent || " ",
		color: colorFromRuntime(metadata.embedColor),
		fields: []
	})];
}

export type RuntimeEmbedPage = ReturnType<typeof runtimeEmbedPages>[number];
export type MessageEmbedPageCacheEntry = {
	expiresAt: number;
	content: string;
	embeds: Record<string, unknown>[];
};

// Fabrique la page message.
export function messageEmbedPagePayload(content: string, embeds: Record<string, unknown>[], pageIndex = 0, customIdPrefix?: string) {
	const safeIndex = embeds.length ? Math.max(0, Math.min(embeds.length - 1, pageIndex)) : 0;
	const components = embeds.length > 1 && customIdPrefix
		? [new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`${customIdPrefix}:${Math.max(0, safeIndex - 1)}`)
				.setLabel("Précédent")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("⬅️")
				.setDisabled(safeIndex === 0),
			new ButtonBuilder()
				.setCustomId(`${customIdPrefix}:${Math.min(embeds.length - 1, safeIndex + 1)}`)
				.setLabel("Suivant")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("➡️")
				.setDisabled(safeIndex === embeds.length - 1)
		)]
		: undefined;
	return {
		content: content.trim() || undefined,
		embeds: embeds.length ? [embeds[safeIndex]] : undefined,
		components
	};
}

// Fabrique la page runtime.
export function runtimeEmbedPagePayload(embeds: RuntimeEmbedPage[], pageIndex = 0, customIdPrefix?: string) {
	const safeIndex = embeds.length ? Math.max(0, Math.min(embeds.length - 1, pageIndex)) : 0;
	const components = embeds.length > 1 && customIdPrefix
		? [new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`${customIdPrefix}:${Math.max(0, safeIndex - 1)}`)
				.setLabel("Précédent")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("⬅️")
				.setDisabled(safeIndex === 0),
			new ButtonBuilder()
				.setCustomId(`${customIdPrefix}:${Math.min(embeds.length - 1, safeIndex + 1)}`)
				.setLabel("Suivant")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji("➡️")
				.setDisabled(safeIndex === embeds.length - 1)
		)]
		: undefined;
	return {
		content: undefined,
		embeds: embeds.length ? [embeds[safeIndex]] : undefined,
		components
	};
}

export type RuntimeModalResponse = {
	kind: "message" | "embed";
	label: string;
	searchText: string;
	cardSearchText: string;
	pageSearchTexts: string[];
	content: string;
	embedPages: ReturnType<typeof runtimeEmbedPages>;
};

export type RuntimeModalResponseMatch = {
	response: RuntimeModalResponse;
	pageIndex: number;
};

// Normalise modal search.
export function normalizeModalSearch(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

// Texte indexé de la modale.
export function modalSearchTextFromChunks(chunks: string[]): string {
	return normalizeModalSearch(chunks.join(" ").replace(/\{[^}]+\}/g, " "));
}

// Texte indexé page embed.
export function modalEmbedPageSearchText(page: ReturnType<typeof runtimeEmbedPages>[number]): string {
	return modalSearchTextFromChunks([
		page.title,
		page.description,
		page.author?.name ?? "",
		page.footer?.text ?? "",
		...page.fields.flatMap((field) => [field.name, field.value])
	]);
}

// Morceaux indexés réponse modale.
export function modalResponseSearchParts(response: { label?: unknown; searchTerms?: unknown; content?: unknown }, embedPages: ReturnType<typeof runtimeEmbedPages>) {
	const cardSearchText = modalSearchTextFromChunks([
		typeof response.label === "string" ? response.label : "",
		typeof response.searchTerms === "string" ? response.searchTerms : "",
		typeof response.content === "string" ? response.content : ""
	]);
	const pageSearchTexts = embedPages.map((page) => modalEmbedPageSearchText(page));
	return {
		cardSearchText,
		pageSearchTexts,
		searchText: [cardSearchText, ...pageSearchTexts].filter(Boolean).join(" ").trim()
	};
}

// Filtre réponse modale par recherche.
export function modalResponseMatchForQuery(response: RuntimeModalResponse, query: string): RuntimeModalResponseMatch | null {
	const needle = normalizeModalSearch(query);
	if (!needle) return null;
	if (response.kind === "embed") {
		const pageIndex = response.pageSearchTexts.findIndex((searchText) => searchText.includes(needle));
		if (pageIndex >= 0) return { response, pageIndex };
	}
	if (response.cardSearchText.includes(needle) || response.searchText.includes(needle)) return { response, pageIndex: 0 };
	return null;
}

// Réponses modales runtime.
export function runtimeModalResponses(runtime: ApplicationCommandRuntimeDefinition): RuntimeModalResponse[] {
	const metadata = runtimeMetadata(runtime);
	const rawResponses = Array.isArray(metadata.modalResponses) ? metadata.modalResponses : [];
	return rawResponses.slice(0, 5).filter(isRecord).map((response, index) => {
		const kind = response.kind === "embed" ? "embed" : "message";
		const content = typeof response.content === "string" ? response.content : "";
		const embedRuntime = {
			...runtime,
			workflow: [{
				...(runtime.workflow[0] ?? { id: "modal-response", type: "reply", label: "Répondre" }),
				metadata: { embedPages: Array.isArray(response.embedPages) ? response.embedPages : [] }
			}],
			response: { ...runtime.response, content }
		};
		const embedPages = kind === "embed" ? runtimeEmbedPages(embedRuntime, content || " ") : [];
		const label = typeof response.label === "string" && response.label.trim() ? response.label.trim() : `Réponse ${index + 1}`;
		const searchParts = modalResponseSearchParts({ ...response, label, content }, embedPages);
		return {
			kind,
			label,
			...searchParts,
			content,
			embedPages
		};
	});
}

// Modèle embed runtime.
export function templateRuntimeEmbed(embed: ReturnType<typeof runtimeEmbedPages>[number], values: Record<string, string>) {
	const authorIconUrl = embed.author?.icon_url ? fillRuntimeTemplateFromValues(embed.author.icon_url, values).trim() : "";
	const footerIconUrl = embed.footer?.icon_url ? fillRuntimeTemplateFromValues(embed.footer.icon_url, values).trim() : "";
	const imageUrl = embed.image?.url ? fillRuntimeTemplateFromValues(embed.image.url, values).trim() : "";
	const thumbnailUrl = embed.thumbnail?.url ? fillRuntimeTemplateFromValues(embed.thumbnail.url, values).trim() : "";
	return trimRuntimeEmbed({
		title: fillRuntimeTemplateFromValues(embed.title, values).slice(0, 256),
		description: fillRuntimeTemplateFromValues(embed.description, values).slice(0, 4096) || " ",
		color: embed.color,
		author: embed.author?.name ? {
			name: fillRuntimeTemplateFromValues(embed.author.name, values).slice(0, 256),
			...(authorIconUrl ? { icon_url: authorIconUrl.slice(0, 2048) } : {})
		} : undefined,
		footer: embed.footer?.text ? {
			text: fillRuntimeTemplateFromValues(embed.footer.text, values).slice(0, 2048),
			...(footerIconUrl ? { icon_url: footerIconUrl.slice(0, 2048) } : {})
		} : undefined,
		image: imageUrl ? { url: imageUrl.slice(0, 2048) } : undefined,
		thumbnail: thumbnailUrl ? { url: thumbnailUrl.slice(0, 2048) } : undefined,
		fields: embed.fields.map((field) => ({
			name: fillRuntimeTemplateFromValues(field.name, values).slice(0, 256) || "Champ",
			value: fillRuntimeTemplateFromValues(field.value, values).slice(0, 1024) || "Valeur",
			inline: field.inline === true
		}))
	});
}

// Embeds de réponse modale.
export function runtimeModalResponseEmbeds(response: RuntimeModalResponse, values: Record<string, string>) {
	return response.kind === "embed"
		? response.embedPages.slice(0, 10).map((embed) => templateRuntimeEmbed(embed, values))
		: [];
}

// Charge utile réponse modale.
export function runtimeModalResponsePayload(response: RuntimeModalResponse, values: Record<string, string>, customIdPrefix?: string, pageIndex = 0) {
	if (response.kind === "embed") {
		return runtimeEmbedPagePayload(runtimeModalResponseEmbeds(response, values), pageIndex, customIdPrefix);
	}
	return { content: fillRuntimeTemplateFromValues(response.content || "Reçu.", values).slice(0, 2000), embeds: undefined, components: undefined };
}

// Runtime de repli commande.
export function fallbackRuntimeForCommand(commandName: string): ApplicationCommandRuntimeDefinition {
	const normalizedName = commandName.toLowerCase();
	const content = normalizedName === "ping"
		? "Pong"
		: `Commande /${commandName} exécutée.`;
	return {
		version: 1,
		intent: `/${commandName}`,
		response: { content, visibility: "ephemeral" },
		workflow: [{ id: "reply", type: "reply", label: "Répondre", content }],
		variables: ["user.mention", "guild.name", "command.name"]
	};
}

// Remplit modèle depuis valeurs.
export function fillRuntimeTemplateFromValues(template: string, values: Record<string, string>): string {
	return Object.entries(values).reduce((content, [key, value]) => content.replaceAll(`{${key}}`, value), template);
}

// Remplit le modèle runtime.
export function fillRuntimeTemplate(template: string, interaction: Interaction): string {
	const commandName = "commandName" in interaction && typeof interaction.commandName === "string" ? interaction.commandName : "commande";
	let content = template
		.replaceAll("{command.name}", commandName)
		.replaceAll("{user.mention}", `<@${interaction.user.id}>`)
		.replaceAll("{user.id}", interaction.user.id)
		.replaceAll("{guild.id}", interaction.guildId ?? "")
		.replaceAll("{guild.name}", interaction.guild?.name ?? "DM");
	if (interaction.isChatInputCommand()) {
		for (const option of interaction.options.data) {
			const rawValue = option.value ?? option.user?.toString() ?? option.channel?.toString() ?? option.role?.toString() ?? "";
			content = content.replaceAll(`{${option.name}}`, String(rawValue));
		}
	}
	return content;
}

// Remplit le modèle message.
export function fillRuntimeTemplateForMessage(template: string, message: Message, commandName: string, args: string): string {
	return fillRuntimeTemplateFromValues(template, {
		"command.name": commandName,
		"user.mention": `<@${message.author.id}>`,
		"user.id": message.author.id,
		"guild.id": message.guildId ?? "",
		"guild.name": message.guild?.name ?? "DM",
		args
	});
}

// Charge réponse runtime.
export function runtimeReplyPayload(runtime: ApplicationCommandRuntimeDefinition, content: string, commandId?: string, pageIndex = 0) {
	const mode = runtimeResponseMode(runtime);
	const pages = mode === "embed" || mode === "menu" ? runtimeEmbedPages(runtime, content) : [];
	if (pages.length) {
		return runtimeEmbedPagePayload(pages, pageIndex, commandId ? `botdeck:embedpage:${commandId}` : undefined);
	}
	return { content, embeds: undefined, components: undefined };
}


// Message welcome par défaut.
export const DEFAULT_WELCOME_MESSAGE = "Bienvenue {user.mention} sur {guild.name} !";

// Remplit le modèle welcome d'un nouveau membre.
export function fillWelcomeTemplate(template: string, member: GuildMember): string {
	return fillRuntimeTemplateFromValues(template || DEFAULT_WELCOME_MESSAGE, welcomeTemplateValues(member));
}

// Template welcome configuré.
export function runtimeWelcomeMessage(runtime: ApplicationCommandRuntimeDefinition): string {
	const metadata = runtimeMetadata(runtime);
	return typeof metadata.welcomeMessage === "string" && metadata.welcomeMessage.trim() ? metadata.welcomeMessage : DEFAULT_WELCOME_MESSAGE;
}

export type WelcomeMessageType = "message" | "embed";

// Type du welcome configuré.
export function runtimeWelcomeMessageType(runtime: ApplicationCommandRuntimeDefinition): WelcomeMessageType {
	const metadata = runtimeMetadata(runtime);
	return metadata.welcomeMessageType === "embed" ? "embed" : "message";
}

// Pages embed welcome configurées.
export function runtimeWelcomeEmbedPages(runtime: ApplicationCommandRuntimeDefinition) {
	const metadata = runtimeMetadata(runtime);
	const embedRuntime: ApplicationCommandRuntimeDefinition = {
		...runtime,
		workflow: [{
			...(runtime.workflow[0] ?? { id: "welcome", type: "set_welcome_channel" as const, label: "Définir le salon welcome" }),
			metadata: { embedPages: Array.isArray(metadata.welcomeEmbedPages) ? metadata.welcomeEmbedPages : [] }
		}, ...runtime.workflow.slice(1)]
	};
	return runtimeEmbedPages(embedRuntime, runtimeWelcomeMessage(runtime));
}

// Valeurs disponibles dans le welcome.
export function welcomeTemplateValues(member: GuildMember): Record<string, string> {
	const botUser = member.client.user;
	const botAvatarUrl = botUser?.displayAvatarURL({ size: 512 }) ?? "";
	const botName = botUser?.username ?? "Bot";
	const guildIconUrl = member.guild.iconURL({ size: 512 }) ?? "";
	const joinedAt = member.joinedAt ?? new Date();
	const joinedDateTime = new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: "Europe/Paris"
	}).format(joinedAt);
	const joinedDate = new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "long",
		timeZone: "Europe/Paris"
	}).format(joinedAt);
	const joinedTime = new Intl.DateTimeFormat("fr-FR", {
		timeStyle: "short",
		timeZone: "Europe/Paris"
	}).format(joinedAt);
	const joinedRelative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" }).format(
		Math.round((joinedAt.getTime() - Date.now()) / 86_400_000),
		"day"
	);
	return {
		"user.mention": `<@${member.id}>`,
		"user.id": member.id,
		"user.name": member.user.username,
		"user.displayName": member.displayName,
		"user.avatar": member.user.displayAvatarURL({ size: 512 }),
		"user.avatarUrl": member.user.displayAvatarURL({ size: 512 }),
		"guild.id": member.guild.id,
		"guild.name": member.guild.name,
		"guild.icon": guildIconUrl,
		"guild.iconUrl": guildIconUrl,
		"bot.id": botUser?.id ?? "",
		"bot.name": botName,
		"bot.username": botName,
		"bot.mention": botUser ? `<@${botUser.id}>` : botName,
		"bot.avatar": botAvatarUrl,
		"bot.avatarUrl": botAvatarUrl,
		"member.count": String(member.guild.memberCount || ""),
		"member.joinedAt": joinedDateTime,
		"member.joinedDate": joinedDate,
		"member.joinedTime": joinedTime,
		"member.joinedRelative": joinedRelative
	};
}

// Normalise les pages embed welcome stockées.
export function storedWelcomeEmbedPages(embedPagesJson: string | null | undefined, fallbackContent = DEFAULT_WELCOME_MESSAGE) {
	const parsed = safeJsonParse(embedPagesJson ?? "[]");
	const runtime: ApplicationCommandRuntimeDefinition = {
		version: 1,
		response: { content: fallbackContent, visibility: "public" },
		workflow: [{ id: "welcome", type: "set_welcome_channel", label: "Welcome", metadata: { embedPages: Array.isArray(parsed) ? parsed : [] } }]
	};
	return runtimeEmbedPages(runtime, fallbackContent);
}

// Confirmation éphémère quand le salon welcome est défini ou changé.
export function runtimeWelcomeSetConfirmation(runtime: ApplicationCommandRuntimeDefinition, values: Record<string, string>): string {
	const content = runtime.response.content?.trim() || "Le salon welcome a été mis à jour: {channel.mention}.";
	return fillRuntimeTemplateFromValues(content, values);
}

// Confirmation éphémère quand le salon welcome est retiré avec la même commande.
export function runtimeWelcomeRemoveConfirmation(runtime: ApplicationCommandRuntimeDefinition, values: Record<string, string>): string {
	const metadata = runtimeMetadata(runtime);
	const content = typeof metadata.welcomeRemoveConfirmation === "string" && metadata.welcomeRemoveConfirmation.trim()
		? metadata.welcomeRemoveConfirmation
		: "Le salon welcome a été retiré pour {channel.mention}.";
	return fillRuntimeTemplateFromValues(content, values);
}



// Message goodbye par défaut.
export const DEFAULT_GOODBYE_MESSAGE = "{user.displayName} a quitté {guild.name}.";

// Valeurs disponibles dans le goodbye.
export function goodbyeTemplateValues(member: GuildMember): Record<string, string> {
	const values = welcomeTemplateValues(member);
	const leftAt = new Date();
	const leftDateTime = new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: "Europe/Paris"
	}).format(leftAt);
	const leftDate = new Intl.DateTimeFormat("fr-FR", {
		dateStyle: "long",
		timeZone: "Europe/Paris"
	}).format(leftAt);
	const leftTime = new Intl.DateTimeFormat("fr-FR", {
		timeStyle: "short",
		timeZone: "Europe/Paris"
	}).format(leftAt);
	return {
		...values,
		"member.leftAt": leftDateTime,
		"member.leftDate": leftDate,
		"member.leftTime": leftTime,
		"member.leftRelative": "à l’instant"
	};
}

// Remplit le modèle goodbye d'un membre qui quitte.
export function fillGoodbyeTemplate(template: string, member: GuildMember): string {
	return fillRuntimeTemplateFromValues(template || DEFAULT_GOODBYE_MESSAGE, goodbyeTemplateValues(member));
}

// Template goodbye configuré.
export function runtimeGoodbyeMessage(runtime: ApplicationCommandRuntimeDefinition): string {
	const metadata = runtimeMetadata(runtime);
	return typeof metadata.goodbyeMessage === "string" && metadata.goodbyeMessage.trim() ? metadata.goodbyeMessage : DEFAULT_GOODBYE_MESSAGE;
}

// Type du goodbye configuré.
export function runtimeGoodbyeMessageType(runtime: ApplicationCommandRuntimeDefinition): WelcomeMessageType {
	const metadata = runtimeMetadata(runtime);
	return metadata.goodbyeMessageType === "embed" ? "embed" : "message";
}

// Pages embed goodbye configurées.
export function runtimeGoodbyeEmbedPages(runtime: ApplicationCommandRuntimeDefinition) {
	const metadata = runtimeMetadata(runtime);
	const embedRuntime: ApplicationCommandRuntimeDefinition = {
		...runtime,
		workflow: [{
			...(runtime.workflow[0] ?? { id: "goodbye", type: "set_goodbye_channel" as const, label: "Définir le salon goodbye" }),
			metadata: { embedPages: Array.isArray(metadata.goodbyeEmbedPages) ? metadata.goodbyeEmbedPages : [] }
		}, ...runtime.workflow.slice(1)]
	};
	return runtimeEmbedPages(embedRuntime, runtimeGoodbyeMessage(runtime));
}

// Normalise les pages embed goodbye stockées.
export function storedGoodbyeEmbedPages(embedPagesJson: string | null | undefined, fallbackContent = DEFAULT_GOODBYE_MESSAGE) {
	const parsed = safeJsonParse(embedPagesJson ?? "[]");
	const runtime: ApplicationCommandRuntimeDefinition = {
		version: 1,
		response: { content: fallbackContent, visibility: "public" },
		workflow: [{ id: "goodbye", type: "set_goodbye_channel", label: "Goodbye", metadata: { embedPages: Array.isArray(parsed) ? parsed : [] } }]
	};
	return runtimeEmbedPages(runtime, fallbackContent);
}

// Confirmation éphémère quand le salon goodbye est défini ou changé.
export function runtimeGoodbyeSetConfirmation(runtime: ApplicationCommandRuntimeDefinition, values: Record<string, string>): string {
	const content = runtime.response.content?.trim() || "Le salon goodbye a été mis à jour: {channel.mention}.";
	return fillRuntimeTemplateFromValues(content, values);
}

// Confirmation éphémère quand le salon goodbye est retiré avec la même commande.
export function runtimeGoodbyeRemoveConfirmation(runtime: ApplicationCommandRuntimeDefinition, values: Record<string, string>): string {
	const metadata = runtimeMetadata(runtime);
	const content = typeof metadata.goodbyeRemoveConfirmation === "string" && metadata.goodbyeRemoveConfirmation.trim()
		? metadata.goodbyeRemoveConfirmation
		: "Le salon goodbye a été retiré pour {channel.mention}.";
	return fillRuntimeTemplateFromValues(content, values);
}

// Modale runtime.
export function runtimeModal(runtime: ApplicationCommandRuntimeDefinition, commandId: string) {
	const metadata = runtimeMetadata(runtime);
	const title = typeof metadata.modalTitle === "string" && metadata.modalTitle.trim() ? metadata.modalTitle.trim().slice(0, 45) : "Recherche";
	const field = typeof metadata.modalField === "string" && metadata.modalField.trim() ? metadata.modalField.trim().slice(0, 45) : "query";
	const input = new TextInputBuilder()
		.setCustomId(field)
		.setLabel(field)
		.setStyle(TextInputStyle.Short)
		.setRequired(true);
	return new ModalBuilder()
		.setCustomId(`botdeck:command:${commandId}`)
		.setTitle(title)
		.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}


// Flags message en bitfield.
export function messageFlagsBitfield(message: Message): number {
	const rawBitfield = message.flags?.bitfield;
	if (typeof rawBitfield === "bigint") return Number(rawBitfield);
	if (typeof rawBitfield === "number") return rawBitfield;
	return 0;
}

// Détecte un message éphémère.
export function messageIsEphemeral(message: Message): boolean {
	return (messageFlagsBitfield(message) & 64) === 64;
}

// Messages Discord sérialisables.
export function normalizeMessage(message: Message): MessageSummary {
	const flags = messageFlagsBitfield(message);
	return {
		id: message.id,
		channelId: message.channelId,
		authorId: message.author.id,
		authorTag: message.author.tag,
		authorAvatarUrl: message.author.displayAvatarURL({ extension: "png", size: 128 }),
		content: message.content,
		createdAt: message.createdAt.toISOString(),
		editedAt: message.editedAt?.toISOString() ?? null,
		pinned: message.pinned,
		attachments: message.attachments.map((attachment) => ({
			id: attachment.id,
			filename: attachment.name ?? "attachment",
			url: attachment.url,
			contentType: attachment.contentType,
			size: attachment.size
		})),
		reactions: message.reactions.cache.map((reaction) => ({
			emoji: reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name ?? reaction.emoji.toString(),
			label: reaction.emoji.toString(),
			count: reaction.count,
			me: reaction.me
		})),
		embeds: message.embeds.map((embed) => ({
			title: embed.title ?? null,
			description: embed.description ?? null,
			url: embed.url ?? null,
			color: embed.color ?? null,
			timestamp: embed.timestamp ?? null,
			authorName: embed.author?.name ?? null,
			authorUrl: embed.author?.url ?? null,
			authorIconUrl: embed.author?.iconURL ?? null,
			footerText: embed.footer?.text ?? null,
			footerIconUrl: embed.footer?.iconURL ?? null,
			imageUrl: embed.image?.url ?? null,
			thumbnailUrl: embed.thumbnail?.url ?? null,
			provider: embed.provider?.name ?? null,
			fields: embed.fields.map((field) => ({ name: field.name, value: field.value, inline: field.inline }))
		})),
		replyToMessageId: message.reference?.messageId ?? null,
		system: message.system,
		type: message.type,
		flags,
		ephemeral: messageIsEphemeral(message)
	};
}

// Récupère la réponse interaction.
export async function fetchInteractionReplyMessage(interaction: Interaction): Promise<Message | null> {
	if (!("fetchReply" in interaction) || typeof interaction.fetchReply !== "function") return null;
	const reply = await interaction.fetchReply().catch(() => null);
	return reply && "author" in reply ? (reply as Message) : null;
}

// Compare réaction et emoji.
export function reactionMatchesEmoji(reactionEmoji: string, emoji: string): boolean {
	if (reactionEmoji === emoji) return true;
	const customEmojiId = emoji.includes(":") ? emoji.split(":").pop() : null;
	return Boolean(customEmojiId && reactionEmoji.endsWith(`:${customEmojiId}`));
}

// Retrait réaction du bot.
export function removeOwnReactionFromSummary(summary: MessageSummary, emoji: string, previousCount: number): MessageSummary {
	return {
		...summary,
		reactions: (summary.reactions ?? [])
			.map((reaction) => {
				if (!reactionMatchesEmoji(reaction.emoji, emoji)) return reaction;
				const nextCount = Math.max(0, Math.min(reaction.count, previousCount) - 1);
				return { ...reaction, count: nextCount, me: false };
			})
			.filter((reaction) => reaction.count > 0)
	};
}

// Convertit vers embed Discord.
export function toDiscordEmbed(embed: EmbedPayload): Record<string, unknown> {
	const payload = {
		title: embed.title,
		description: embed.description,
		url: embed.url,
		color: embed.color,
		timestamp: embed.timestamp,
		author: embed.author ? cleanUndefined({ name: embed.author.name, url: embed.author.url, icon_url: embed.author.iconUrl }) : undefined,
		footer: embed.footer ? cleanUndefined({ text: embed.footer.text, icon_url: embed.footer.iconUrl }) : undefined,
		image: embed.imageUrl ? { url: embed.imageUrl } : undefined,
		thumbnail: embed.thumbnailUrl ? { url: embed.thumbnailUrl } : undefined,
		fields: embed.fields
	};
	return cleanUndefined(payload);
}

export function cleanUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null));
}

// Résout direct message peer.
export function resolveDirectMessagePeer(message: Message): User | null {
	const channel = message.channel;
	if (channel?.isDMBased() && "recipient" in channel) {
		return channel.recipient ?? null;
	}
	return message.author.id === message.client.user?.id ? null : message.author;
}

// Permissions complètes MP.
export function fullDmPermissions(): ChannelPermissionsSummary {
	return {
		createInstantInvite: false,
		kickMembers: false,
		banMembers: false,
		administrator: false,
		manageChannels: false,
		manageGuild: false,
		addReactions: true,
		viewAuditLog: false,
		prioritySpeaker: false,
		stream: false,
		viewChannel: true,
		sendMessages: true,
		sendTTSMessages: false,
		manageMessages: false,
		embedLinks: true,
		attachFiles: true,
		readMessageHistory: true,
		mentionEveryone: false,
		useExternalEmojis: true,
		viewGuildInsights: false,
		connect: false,
		speak: false,
		muteMembers: false,
		deafenMembers: false,
		moveMembers: false,
		useVAD: false,
		changeNickname: false,
		manageNicknames: false,
		manageRoles: false,
		manageWebhooks: false,
		manageEmojisAndStickers: false,
		manageGuildExpressions: false,
		useApplicationCommands: false,
		requestToSpeak: false,
		manageEvents: false,
		manageThreads: false,
		createPublicThreads: false,
		createPrivateThreads: false,
		useExternalStickers: true,
		sendMessagesInThreads: false,
		useEmbeddedActivities: false,
		moderateMembers: false,
		viewCreatorMonetizationAnalytics: false,
		useSoundboard: false,
		createGuildExpressions: false,
		createEvents: false,
		useExternalSounds: false,
		sendVoiceMessages: true,
		sendPolls: false,
		useExternalApps: false
	};
}

// Normalise direct message channel.
export function normalizeDirectMessageChannel(channelId: string, user: User, lastMessageAt?: string | null): ChannelSummary {
	return {
		id: channelId,
		guildId: DM_GUILD_ID,
		name: user.globalName ?? user.username,
		type: "dm",
		topic: `user:${user.id}`,
		lastMessageAt: lastMessageAt ?? null,
		unreadCount: 0,
		permissions: fullDmPermissions()
	};
}

// Normalise direct message user.
export function normalizeDirectMessageUser(user: User): UserSummary {
	return {
		id: user.id,
		username: user.username,
		displayName: user.globalName ?? null,
		avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
		bot: user.bot,
		status: "offline"
	};
}

// Normalise guild.
export function normalizeGuild(guild: Guild): GuildSummary {
	const onlineMembers = guild.members.cache.filter((member) => member.presence && member.presence.status !== "offline");
	return {
		id: guild.id,
		name: guild.name,
		description: guild.description ?? null,
		features: [...guild.features],
		premiumTier: typeof guild.premiumTier === "number" ? guild.premiumTier : null,
		iconUrl: guild.iconURL({ extension: resolvePreferredAssetExtension(guild.icon), size: 128 }),
		bannerUrl: guild.bannerURL({ extension: resolvePreferredAssetExtension(guild.banner), size: 512 }),
		splashUrl: guild.splashURL({ extension: resolvePreferredAssetExtension(guild.splash), size: 512 }),
		ownerId: guild.ownerId ?? null,
		memberCount: guild.memberCount,
		approximatePresenceCount: onlineMembers.size,
		unreadCount: 0,
		mentionCount: 0
	};
}

// Mappe channel type.
export function mapChannelType(channel: GuildBasedChannel): ChannelSummary["type"] {
	switch (channel.type) {
		case ChannelType.GuildCategory:
			return "category";
		case ChannelType.GuildVoice:
		case ChannelType.GuildStageVoice:
			return "voice";
		case ChannelType.GuildForum:
			return "forum";
		case ChannelType.GuildPublicThread:
		case ChannelType.GuildPrivateThread:
			return "thread";
		default:
			return "text";
	}
}

// Position salon Discord.
export function channelPosition(channel: GuildBasedChannel): number {
	if ("rawPosition" in channel && typeof channel.rawPosition === "number") return channel.rawPosition;
	if ("position" in channel && typeof channel.position === "number") return channel.position;
	return 0;
}

// Parent salon Discord.
export function channelParentId(channel: GuildBasedChannel): string | null {
	return "parentId" in channel ? channel.parentId ?? null : null;
}

// Résout channel category.
export function resolveChannelCategory(channel: GuildBasedChannel, channelsById: Map<string, GuildBasedChannel>): { categoryId: string | null; categoryName: string | null } {
	if (channel.type === ChannelType.GuildCategory) return { categoryId: null, categoryName: null };

	const parentId = channelParentId(channel);
	const parent = parentId ? channelsById.get(parentId) ?? null : null;
	if (parent?.type === ChannelType.GuildCategory) {
		return { categoryId: parent.id, categoryName: "name" in parent ? parent.name : null };
	}

	if (parent && "parentId" in parent && parent.parentId) {
		const grandParent = channelsById.get(parent.parentId) ?? null;
		if (grandParent?.type === ChannelType.GuildCategory) {
			return { categoryId: grandParent.id, categoryName: "name" in grandParent ? grandParent.name : null };
		}
	}

	if (channel.parent?.type === ChannelType.GuildCategory) {
		return { categoryId: channel.parent.id, categoryName: channel.parent.name };
	}

	return { categoryId: null, categoryName: null };
}

// Normalise role.
export function normalizeRole(guildId: string, role: Role): RoleSummary {
	return {
		id: role.id,
		guildId,
		name: role.name,
		color: role.color,
		colorHex: role.hexColor && role.hexColor !== "#000000" ? role.hexColor : null,
		position: role.position,
		managed: role.managed,
		editable: role.editable,
		hoist: role.hoist,
		mentionable: role.mentionable,
		permissions: role.permissions.bitfield.toString()
	};
}


function optionalCreatedAt(value: { createdAt?: Date | null }): string | null {
	return value.createdAt instanceof Date ? value.createdAt.toISOString() : null;
}

// Normalise un bannissement serveur.
export function normalizeGuildBan(guildId: string, ban: GuildBan): GuildBanSummary {
	return {
		guildId,
		userId: ban.user.id,
		username: ban.user.username,
		displayName: ban.user.globalName ?? null,
		avatarUrl: ban.user.displayAvatarURL({ extension: resolvePreferredAssetExtension(ban.user.avatar), size: 128 }),
		bot: ban.user.bot,
		reason: ban.reason ?? null
	};
}


// Normalise une invitation serveur.
export function normalizeGuildInvite(guildId: string, invite: Invite): GuildInviteSummary {
	const channel = invite.channel as { id?: string; name?: string | null } | null;
	const inviter = invite.inviter as { id?: string; username?: string; displayName?: string | null; tag?: string } | null;
	return {
		guildId,
		code: invite.code,
		url: invite.url ?? `https://discord.gg/${invite.code}`,
		channelId: channel?.id ?? null,
		channelName: channel?.name ?? null,
		inviterId: inviter?.id ?? null,
		inviterName: inviter?.displayName ?? inviter?.username ?? inviter?.tag ?? null,
		uses: invite.uses ?? null,
		maxUses: invite.maxUses ?? null,
		maxAge: invite.maxAge ?? null,
		temporary: invite.temporary ?? false,
		createdAt: invite.createdAt?.toISOString() ?? null,
		expiresAt: invite.expiresAt?.toISOString() ?? null
	};
}

// Normalise un membre dans la liste serveur.
export function normalizeGuildMember(member: GuildMember): GuildMemberSummary {
	return {
		guildId: member.guild.id,
		userId: member.user.id,
		username: member.user.username,
		displayName: member.displayName ?? null,
		avatarUrl: member.displayAvatarURL({ extension: resolvePreferredAssetExtension(member.avatar ?? member.user.avatar), size: 128 }),
		bot: member.user.bot,
		roleIds: member.roles.cache.filter((role) => role.id !== member.guild.id).map((role) => role.id),
		joinedAt: member.joinedAt?.toISOString() ?? null,
		timeoutUntil: member.communicationDisabledUntil?.toISOString() ?? null,
		inviteCode: null
	};
}

// Salons: permissions prêtes UI.
export function normalizeChannelPermissionOverwrites(channel: GuildBasedChannel): ChannelSummary["permissionOverwrites"] {
	const overwrites = Array.from((channel as GuildBasedChannel & { permissionOverwrites?: { cache?: { values?: () => Iterable<unknown> } } }).permissionOverwrites?.cache?.values?.() ?? []);
	if (overwrites.length === 0) return undefined;

	return overwrites.map((overwrite) => {
		const candidate = overwrite as { id?: string; type?: number | string; allow?: { bitfield?: bigint | number | string }; deny?: { bitfield?: bigint | number | string } };
		const overwriteType: "role" | "member" | "unknown" = candidate.type === 0 || candidate.type === "role" || candidate.type === "Role"
			? "role"
			: candidate.type === 1 || candidate.type === "member" || candidate.type === "Member"
				? "member"
				: "unknown";

		return {
			id: candidate.id ?? "",
			type: overwriteType,
			allow: candidate.allow?.bitfield?.toString?.() ?? String(candidate.allow?.bitfield ?? "0"),
			deny: candidate.deny?.bitfield?.toString?.() ?? String(candidate.deny?.bitfield ?? "0")
		};
	}).filter((overwrite) => overwrite.id.length > 0);
}

export function normalizeChannelPermissions(channel: GuildBasedChannel, botUserId: string | null | undefined): ChannelPermissionsSummary | undefined {
	if (!botUserId) return undefined;
	const permissions = channel.permissionsFor(botUserId);
	if (!permissions) return undefined;

	return {
		createInstantInvite: permissions.has(PermissionFlagsBits.CreateInstantInvite),
		kickMembers: permissions.has(PermissionFlagsBits.KickMembers),
		banMembers: permissions.has(PermissionFlagsBits.BanMembers),
		administrator: permissions.has(PermissionFlagsBits.Administrator),
		manageChannels: permissions.has(PermissionFlagsBits.ManageChannels),
		manageGuild: permissions.has(PermissionFlagsBits.ManageGuild),
		addReactions: permissions.has(PermissionFlagsBits.AddReactions),
		viewAuditLog: permissions.has(PermissionFlagsBits.ViewAuditLog),
		prioritySpeaker: permissions.has(PermissionFlagsBits.PrioritySpeaker),
		stream: permissions.has(PermissionFlagsBits.Stream),
		viewChannel: permissions.has(PermissionFlagsBits.ViewChannel),
		sendMessages: permissions.has(PermissionFlagsBits.SendMessages),
		sendTTSMessages: permissions.has(PermissionFlagsBits.SendTTSMessages),
		manageMessages: permissions.has(PermissionFlagsBits.ManageMessages),
		embedLinks: permissions.has(PermissionFlagsBits.EmbedLinks),
		attachFiles: permissions.has(PermissionFlagsBits.AttachFiles),
		readMessageHistory: permissions.has(PermissionFlagsBits.ReadMessageHistory),
		mentionEveryone: permissions.has(PermissionFlagsBits.MentionEveryone),
		useExternalEmojis: permissions.has(PermissionFlagsBits.UseExternalEmojis),
		viewGuildInsights: permissions.has(PermissionFlagsBits.ViewGuildInsights),
		connect: permissions.has(PermissionFlagsBits.Connect),
		speak: permissions.has(PermissionFlagsBits.Speak),
		muteMembers: permissions.has(PermissionFlagsBits.MuteMembers),
		deafenMembers: permissions.has(PermissionFlagsBits.DeafenMembers),
		moveMembers: permissions.has(PermissionFlagsBits.MoveMembers),
		useVAD: permissions.has(PermissionFlagsBits.UseVAD),
		changeNickname: permissions.has(PermissionFlagsBits.ChangeNickname),
		manageNicknames: permissions.has(PermissionFlagsBits.ManageNicknames),
		manageRoles: permissions.has(PermissionFlagsBits.ManageRoles),
		manageWebhooks: permissions.has(PermissionFlagsBits.ManageWebhooks),
		manageEmojisAndStickers: permissions.has(PermissionFlagsBits.ManageEmojisAndStickers),
		manageGuildExpressions: permissions.has(PermissionFlagsBits.ManageGuildExpressions),
		useApplicationCommands: permissions.has(PermissionFlagsBits.UseApplicationCommands),
		requestToSpeak: permissions.has(PermissionFlagsBits.RequestToSpeak),
		manageEvents: permissions.has(PermissionFlagsBits.ManageEvents),
		manageThreads: permissions.has(PermissionFlagsBits.ManageThreads),
		createPublicThreads: permissions.has(PermissionFlagsBits.CreatePublicThreads),
		createPrivateThreads: permissions.has(PermissionFlagsBits.CreatePrivateThreads),
		useExternalStickers: permissions.has(PermissionFlagsBits.UseExternalStickers),
		sendMessagesInThreads: permissions.has(PermissionFlagsBits.SendMessagesInThreads),
		useEmbeddedActivities: permissions.has(PermissionFlagsBits.UseEmbeddedActivities),
		moderateMembers: permissions.has(PermissionFlagsBits.ModerateMembers),
		viewCreatorMonetizationAnalytics: permissions.has(PermissionFlagsBits.ViewCreatorMonetizationAnalytics),
		useSoundboard: permissions.has(PermissionFlagsBits.UseSoundboard),
		createGuildExpressions: permissions.has(PermissionFlagsBits.CreateGuildExpressions),
		createEvents: permissions.has(PermissionFlagsBits.CreateEvents),
		useExternalSounds: permissions.has(PermissionFlagsBits.UseExternalSounds),
		sendVoiceMessages: permissions.has(PermissionFlagsBits.SendVoiceMessages),
		sendPolls: permissions.has(PermissionFlagsBits.SendPolls),
		useExternalApps: permissions.has(PermissionFlagsBits.UseExternalApps)
	};
}


// Normalise tags forum Discord.
export function normalizeForumTags(channel: GuildBasedChannel): ForumTagSummary[] | undefined {
	if (channel.type !== ChannelType.GuildForum || !("availableTags" in channel)) return undefined;
	return channel.availableTags.map((tag) => ({
		id: tag.id,
		name: tag.name,
		emoji: tag.emoji?.name ?? tag.emoji?.id ?? null,
		moderated: Boolean(tag.moderated)
	}));
}

// Normalise un post de forum (thread Discord).
export function normalizeForumPost(thread: ThreadChannel): ForumPostSummary {
	return {
		id: thread.id,
		forumId: thread.parentId ?? thread.id,
		guildId: thread.guildId,
		name: thread.name,
		ownerId: thread.ownerId ?? null,
		createdAt: thread.createdAt?.toISOString() ?? null,
		lastMessageAt: thread.lastMessage?.createdAt?.toISOString() ?? (thread.lastMessageId ? null : thread.createdAt?.toISOString() ?? null),
		messageCount: typeof thread.messageCount === "number" ? thread.messageCount : null,
		memberCount: typeof thread.memberCount === "number" ? thread.memberCount : null,
		archived: Boolean(thread.archived),
		locked: Boolean(thread.locked),
		tagIds: Array.isArray(thread.appliedTags) ? thread.appliedTags : []
	};
}

// Normalise channel.
export function normalizeChannel(channel: GuildBasedChannel, channelsById = new Map<string, GuildBasedChannel>(), botUserId?: string | null, sortIndex?: number): ChannelSummary {
	const members = "members" in channel ? channel.members : null;
	const category = resolveChannelCategory(channel, channelsById);

	return {
		id: channel.id,
		guildId: channel.guildId,
		name: channel.name,
		type: mapChannelType(channel),
		topic: "topic" in channel ? channel.topic ?? null : null,
		parentId: channelParentId(channel),
		categoryId: category.categoryId,
		categoryName: category.categoryName,
		position: channelPosition(channel),
		sortIndex,
		lastMessageAt: null,
		memberCount: members && "size" in members ? members.size : undefined,
		unreadCount: 0,
		permissions: normalizeChannelPermissions(channel, botUserId),
		everyonePermissions: channel.guild.roles.everyone.permissions.bitfield.toString(),
		permissionOverwrites: normalizeChannelPermissionOverwrites(channel),
		availableTags: normalizeForumTags(channel)
	};
}

// Tri salons Discord.
export function compareGuildChannels(a: GuildBasedChannel, b: GuildBasedChannel): number {
	const positionA = channelPosition(a);
	const positionB = channelPosition(b);
	if (positionA !== positionB) return positionA - positionB;
	return a.id.localeCompare(b.id);
}

// Normalise user.
export function normalizeUser(member: GuildMember): UserSummary {
	const status = member.presence?.status;
	return {
		id: member.user.id,
		username: member.user.username,
		displayName: member.displayName ?? null,
		avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 128 }),
		bot: member.user.bot,
		supportsApplicationCommands: resolveUserSupportsApplicationCommands(member.user),
		status: status === "online" || status === "idle" || status === "dnd" ? status : "offline"
	};
}

// Résout preferred asset extension.
export function resolvePreferredAssetExtension(hash: string | null | undefined): "gif" | "png" {
	return hash?.startsWith("a_") ? "gif" : "png";
}

// Résout user avatar url.
export function resolveUserAvatarUrl(user: User, size = 256): string | null {
	return user.displayAvatarURL({ extension: resolvePreferredAssetExtension(user.avatar), size });
}

// Résout user banner url.
export function resolveUserBannerUrl(user: User, size = 512): string | null {
	if (!user.banner) return null;
	return user.bannerURL({ extension: resolvePreferredAssetExtension(user.banner), size }) ?? null;
}

// Résout user avatar decoration url.
export function resolveUserAvatarDecorationUrl(user: User, size = 160): string | null {
	const candidate = user as User & { avatarDecorationURL?: (options?: { size?: number }) => string | null };

	if (typeof candidate.avatarDecorationURL !== "function") return null;

	try {
		return candidate.avatarDecorationURL({ size }) ?? null;
	} catch {
		return null;
	}
}

// Résout user supports application commands.
export function resolveUserSupportsApplicationCommands(user: User): boolean {
	if (!user.bot) return false;

	const applicationCommandBadgeFlag = 1 << 19;
	const candidate = user as User & {
		flags?: { bitfield?: bigint | number | string; has?: (flag: string | number | bigint) => boolean } | null;
		publicFlags?: { bitfield?: bigint | number | string; has?: (flag: string | number | bigint) => boolean } | null;
		raw?: { public_flags?: number | string | bigint | null };
	};
	const flagSources = [candidate.flags, candidate.publicFlags];

	for (const flags of flagSources) {
		if (!flags) continue;
		try {
			if (typeof flags.has === "function" && (flags.has("BotHTTPInteractions") || flags.has(applicationCommandBadgeFlag))) return true;
		} catch {
			// Drapeaux inconnus: repli bitfield.
		}
		const bitfield = flags.bitfield;
		if (typeof bitfield === "bigint" && (bitfield & BigInt(applicationCommandBadgeFlag)) !== 0n) return true;
		if (typeof bitfield === "number" && (bitfield & applicationCommandBadgeFlag) !== 0) return true;
		if (typeof bitfield === "string") {
			const parsed = Number(bitfield);
			if (Number.isFinite(parsed) && (parsed & applicationCommandBadgeFlag) !== 0) return true;
		}
	}

	const rawPublicFlags = candidate.raw?.public_flags;
	if (typeof rawPublicFlags === "bigint") return (rawPublicFlags & BigInt(applicationCommandBadgeFlag)) !== 0n;
	if (typeof rawPublicFlags === "number") return (rawPublicFlags & applicationCommandBadgeFlag) !== 0;
	if (typeof rawPublicFlags === "string") {
		const parsed = Number(rawPublicFlags);
		return Number.isFinite(parsed) && (parsed & applicationCommandBadgeFlag) !== 0;
	}

	return false;
}

// Collecte serveurs communs.
export function collectMutualGuilds(client: Client, userId: string): NonNullable<MemberProfileSummary["mutualGuilds"]> {
	const mutualGuilds: NonNullable<MemberProfileSummary["mutualGuilds"]> = [];

	client.guilds.cache.forEach((guild) => {
		if (!guild.members.cache.has(userId)) return;
		mutualGuilds.push({
			id: guild.id,
			name: guild.name,
			iconUrl: guild.iconURL({ extension: resolvePreferredAssetExtension(guild.icon), size: 128 }) ?? null
		});
	});

	return mutualGuilds.sort((left, right) => left.name.localeCompare(right.name));
}

// Collecte serveurs communs détaillée.
export async function collectMutualGuildsDeep(client: Client, userId: string): Promise<NonNullable<MemberProfileSummary["mutualGuilds"]>> {
	const guilds = Array.from(client.guilds.cache.values());
	const results = await Promise.all(
		guilds.map(async (guild): Promise<NonNullable<MemberProfileSummary["mutualGuilds"]>[number] | null> => {
			const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
			if (!member) return null;
			return {
				id: guild.id,
				name: guild.name,
				iconUrl: guild.iconURL({ extension: resolvePreferredAssetExtension(guild.icon), size: 128 }) ?? null
			};
		})
	);

	return results
		.filter((guild): guild is NonNullable<MemberProfileSummary["mutualGuilds"]>[number] => guild !== null)
		.sort((left, right) => left.name.localeCompare(right.name));
}

// Normalise member profile.
export function normalizeMemberProfile(member: GuildMember): MemberProfileSummary {
	return {
		guildId: member.guild.id,
		userId: member.user.id,
		username: member.user.username,
		displayName: member.displayName ?? null,
		avatarUrl: resolveUserAvatarUrl(member.user, 256),
		bannerUrl: resolveUserBannerUrl(member.user, 512),
		avatarDecorationUrl: resolveUserAvatarDecorationUrl(member.user, 160),
		bot: member.user.bot,
		supportsApplicationCommands: resolveUserSupportsApplicationCommands(member.user),
		roleIds: member.roles.cache.filter((role) => role.id !== member.guild.id).map((role) => role.id),
		joinedAt: member.joinedAt?.toISOString() ?? null,
		timeoutUntil: member.communicationDisabledUntil?.toISOString() ?? null,
		voiceChannelId: member.voice.channelId ?? null,
		serverMuted: member.voice.serverMute === true,
		serverDeafened: member.voice.serverDeaf === true,
		mutualGuilds: collectMutualGuilds(member.client, member.user.id)
	};
}

// Construit detailed member profile.
export async function buildDetailedMemberProfile(member: GuildMember): Promise<MemberProfileSummary> {
	const freshUser = await member.user.fetch(true).catch(() => member.user);
	return {
		guildId: member.guild.id,
		userId: freshUser.id,
		username: freshUser.username,
		displayName: member.displayName ?? (freshUser as User & { displayName?: string | null; globalName?: string | null }).displayName ?? (freshUser as User & { globalName?: string | null }).globalName ?? freshUser.username,
		avatarUrl: resolveUserAvatarUrl(freshUser, 256),
		bannerUrl: resolveUserBannerUrl(freshUser, 512),
		avatarDecorationUrl: resolveUserAvatarDecorationUrl(freshUser, 160),
		bot: freshUser.bot,
		supportsApplicationCommands: resolveUserSupportsApplicationCommands(freshUser),
		roleIds: member.roles.cache.filter((role) => role.id !== member.guild.id).map((role) => role.id),
		joinedAt: member.joinedAt?.toISOString() ?? null,
		timeoutUntil: member.communicationDisabledUntil?.toISOString() ?? null,
		voiceChannelId: member.voice.channelId ?? null,
		serverMuted: member.voice.serverMute === true,
		serverDeafened: member.voice.serverDeaf === true,
		mutualGuilds: await collectMutualGuildsDeep(member.client, freshUser.id)
	};
}

// Construit direct user profile.
export async function buildDirectUserProfile(client: Client, userId: string): Promise<MemberProfileSummary> {
	const user = await client.users.fetch(userId);
	const freshUser = await user.fetch(true).catch(() => user);
	const profileDisplayName = (freshUser as User & { displayName?: string | null; globalName?: string | null }).displayName ?? (freshUser as User & { globalName?: string | null }).globalName ?? freshUser.username;
	return {
		guildId: DM_GUILD_ID,
		userId: freshUser.id,
		username: freshUser.username,
		displayName: profileDisplayName,
		avatarUrl: resolveUserAvatarUrl(freshUser, 256),
		bannerUrl: resolveUserBannerUrl(freshUser, 512),
		avatarDecorationUrl: resolveUserAvatarDecorationUrl(freshUser, 160),
		bot: freshUser.bot,
		supportsApplicationCommands: resolveUserSupportsApplicationCommands(freshUser),
		roleIds: [],
		joinedAt: null,
		timeoutUntil: null,
		voiceChannelId: null,
		serverMuted: false,
		serverDeafened: false,
		mutualGuilds: await collectMutualGuildsDeep(client, freshUser.id)
	};
}

// Normalise presence.
export function normalizePresence(member: GuildMember): PresenceSnapshot {
	const status = member.presence?.status;
	return {
		userId: member.user.id,
		status: status === "online" || status === "idle" || status === "dnd" ? status : "offline",
		activity: member.presence?.activities[0]?.name ?? null,
		updatedAt: now()
	};
}

// Normalise voice state.
export function normalizeVoiceState(state: VoiceState): VoiceStateSummary | null {
	if (!state.guild || !state.member) return null;

	return {
		userId: state.id,
		guildId: state.guild.id,
		channelId: state.channelId ?? null,
		selfMuted: state.selfMute === true,
		selfDeafened: state.selfDeaf === true,
		serverMuted: state.serverMute === true,
		serverDeafened: state.serverDeaf === true,
		sessionId: state.sessionId ?? null
	};
}


export function jsonSerializableValue(value: unknown): unknown {
	if (typeof value === "bigint") return value.toString();
	if (value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((item) => jsonSerializableValue(item));
	if (value instanceof Date) return value.toISOString();
	if (!isRecord(value)) return String(value);
	return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSerializableValue(item)]));
}

export function jsonSerializableRecord(value: unknown): Record<string, unknown> {
	const serializable = jsonSerializableValue(value);
	return isRecord(serializable) ? serializable : {};
}

export type DiscordApplicationCommandJson = Record<string, unknown> & {
	options?: unknown;
	description?: unknown;
	default_member_permissions?: unknown;
	dm_permission?: unknown;
	nsfw?: unknown;
	contexts?: unknown;
	integration_types?: unknown;
	name_localizations?: unknown;
	description_localizations?: unknown;
};

export type DiscordApplicationCommandLike = ApplicationCommand & {
	createdTimestamp?: number | null;
	guildId?: string | null;
	version?: string | null;
	dmPermission?: boolean | null;
	nsfw?: boolean | null;
	defaultMemberPermissions?: { bitfield?: bigint | number | string } | null;
};

// Commandes Discord normalisées.
export function normalizeApplicationCommandType(type: number | string | undefined): ApplicationCommandSummary["type"] {
	if (type === 1 || type === "CHAT_INPUT" || type === "ChatInput") return "Chat Input";
	if (type === 2 || type === "USER" || type === "User") return "User";
	if (type === 3 || type === "MESSAGE" || type === "Message") return "Message";
	return "Unknown";
}

// Normalise application command option type.
export function normalizeApplicationCommandOptionType(type: unknown): string {
	if (typeof type === "string") return type;
	if (typeof type !== "number") return "Unknown";
	const labels: Record<number, string> = {
		1: "Subcommand",
		2: "Subcommand Group",
		3: "String",
		4: "Integer",
		5: "Boolean",
		6: "User",
		7: "Channel",
		8: "Role",
		9: "Mentionable",
		10: "Number",
		11: "Attachment"
	};
	return labels[type] ?? `Type ${type}`;
}

// Normalise application command options.
export function normalizeApplicationCommandOptions(value: unknown): ApplicationCommandOptionSummary[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(isRecord)
		.map((option) => {
			const children = Array.isArray(option.options) ? option.options : [];
			const choices = Array.isArray(option.choices)
				? option.choices.filter(isRecord).map((choice) => ({
					name: typeof choice.name === "string" ? choice.name : "choice",
					value: typeof choice.value === "number" || typeof choice.value === "string" ? choice.value : String(choice.value ?? ""),
					nameLocalizations: isRecord(choice.name_localizations) ? Object.fromEntries(Object.entries(choice.name_localizations).filter(([, value]) => typeof value === "string")) as Record<string, string> : null
				}))
				: [];
			return {
				name: typeof option.name === "string" ? option.name : "unknown",
				description: typeof option.description === "string" ? option.description : null,
				type: normalizeApplicationCommandOptionType(option.type),
				required: typeof option.required === "boolean" ? option.required : undefined,
				optionCount: children.length,
				options: normalizeApplicationCommandOptions(children),
				choices,
				autocomplete: typeof option.autocomplete === "boolean" ? option.autocomplete : undefined,
				minValue: typeof option.min_value === "number" ? option.min_value : null,
				maxValue: typeof option.max_value === "number" ? option.max_value : null,
				minLength: typeof option.min_length === "number" ? option.min_length : null,
				maxLength: typeof option.max_length === "number" ? option.max_length : null,
				channelTypes: Array.isArray(option.channel_types) ? option.channel_types.filter((item): item is number => typeof item === "number") : undefined,
				nameLocalizations: isRecord(option.name_localizations) ? Object.fromEntries(Object.entries(option.name_localizations).filter(([, value]) => typeof value === "string")) as Record<string, string> : null,
				descriptionLocalizations: isRecord(option.description_localizations) ? Object.fromEntries(Object.entries(option.description_localizations).filter(([, value]) => typeof value === "string")) as Record<string, string> : null
			};
		});
}

// Bitfield permissions lisible.
export function stringifyPermissionBitfield(value: unknown): string | null {
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
	if (typeof value === "string") return value;
	return null;
}

// Normalise command contexts.
export function normalizeCommandContexts(value: unknown): ApplicationCommandSummary["contexts"] {
	if (!Array.isArray(value)) return null;
	return value.map((item) => {
		if (item === 0 || item === "GUILD") return "guild";
		if (item === 1 || item === "BOT_DM") return "bot_dm";
		if (item === 2 || item === "PRIVATE_CHANNEL") return "private_channel";
		return null;
	}).filter((item): item is NonNullable<ApplicationCommandSummary["contexts"]>[number] => Boolean(item));
}

// Normalise command integration types.
export function normalizeCommandIntegrationTypes(value: unknown): ApplicationCommandSummary["integrationTypes"] {
	if (!Array.isArray(value)) return null;
	return value.map((item) => {
		if (item === 0 || item === "GUILD_INSTALL") return "guild_install";
		if (item === 1 || item === "USER_INSTALL") return "user_install";
		return null;
	}).filter((item): item is NonNullable<ApplicationCommandSummary["integrationTypes"]>[number] => Boolean(item));
}

// Normalise localization map.
export function normalizeLocalizationMap(value: unknown): Record<string, string> | null {
	if (!isRecord(value)) return null;
	const entries = Object.entries(value).filter(([, item]) => typeof item === "string" && item.trim().length > 0) as Array<[string, string]>;
	return entries.length ? Object.fromEntries(entries) : null;
}

// Normalise application command.
export function normalizeApplicationCommand(command: ApplicationCommand, scope: ApplicationCommandScope, guildId?: string | null): ApplicationCommandSummary {
	const commandLike = command as DiscordApplicationCommandLike;
	const raw = jsonSerializableRecord(command.toJSON()) as DiscordApplicationCommandJson;
	const options = normalizeApplicationCommandOptions(raw.options);
	const runtime = readBotdeckRuntime(raw.botdeckRuntime);
	const createdAt = typeof commandLike.createdTimestamp === "number" ? new Date(commandLike.createdTimestamp).toISOString() : null;
	const defaultMemberPermissions = stringifyPermissionBitfield(commandLike.defaultMemberPermissions?.bitfield) ?? stringifyPermissionBitfield(raw.default_member_permissions);

	return {
		id: command.id,
		applicationId: command.applicationId ?? null,
		guildId: scope === "guild" ? guildId ?? commandLike.guildId ?? null : null,
		scope,
		name: command.name,
		type: normalizeApplicationCommandType(command.type as number | string | undefined),
		description: typeof raw.description === "string" && raw.description.trim().length > 0 ? raw.description : null,
		optionCount: options.length,
		options,
		version: commandLike.version ?? (typeof raw.version === "string" ? raw.version : null),
		defaultMemberPermissions,
		dmPermission: typeof commandLike.dmPermission === "boolean" ? commandLike.dmPermission : typeof raw.dm_permission === "boolean" ? raw.dm_permission : null,
		nsfw: typeof commandLike.nsfw === "boolean" ? commandLike.nsfw : typeof raw.nsfw === "boolean" ? raw.nsfw : null,
		contexts: normalizeCommandContexts(raw.contexts),
		integrationTypes: normalizeCommandIntegrationTypes(raw.integration_types),
		nameLocalizations: normalizeLocalizationMap(raw.name_localizations),
		descriptionLocalizations: normalizeLocalizationMap(raw.description_localizations),
		createdAt,
		updatedAt: createdAt,
		runtime,
		raw
	};
}

export type DiscordApplicationCommandPayload = Record<string, unknown>;

export const applicationCommandTypeToApi: Record<ApplicationCommandDraft["type"], number> = {
	chat_input: 1,
	user: 2,
	message: 3
};

export const applicationCommandOptionTypeToApi: Record<ApplicationCommandDraftOption["type"], number> = {
	sub_command: 1,
	sub_command_group: 2,
	string: 3,
	integer: 4,
	boolean: 5,
	user: 6,
	channel: 7,
	role: 8,
	mentionable: 9,
	number: 10,
	attachment: 11
};

// Traductions vers payload.
export function localizationMapToPayload(value: Record<string, string> | null | undefined): Record<string, string> | undefined {
	if (!value) return undefined;
	const entries = Object.entries(value).filter(([, item]) => item.trim().length > 0);
	return entries.length ? Object.fromEntries(entries) : undefined;
}

// Contextes commande vers payload.
export function commandContextsToPayload(value: ApplicationCommandDraft["contexts"]): number[] | undefined {
	if (!value?.length) return undefined;
	const map: Record<NonNullable<ApplicationCommandDraft["contexts"]>[number], number> = { guild: 0, bot_dm: 1, private_channel: 2 };
	return value.map((item) => map[item]);
}

// Types intégration vers payload.
export function commandIntegrationTypesToPayload(value: ApplicationCommandDraft["integrationTypes"]): number[] | undefined {
	if (!value?.length) return undefined;
	const map: Record<NonNullable<ApplicationCommandDraft["integrationTypes"]>[number], number> = { guild_install: 0, user_install: 1 };
	return value.map((item) => map[item]);
}

// Option brouillon vers payload.
export function draftOptionToPayload(option: ApplicationCommandDraftOption): DiscordApplicationCommandPayload {
	const payload: DiscordApplicationCommandPayload = {
		type: applicationCommandOptionTypeToApi[option.type],
		name: option.name.trim(),
		description: option.description.trim() || "Option",
		name_localizations: localizationMapToPayload(option.nameLocalizations),
		description_localizations: localizationMapToPayload(option.descriptionLocalizations)
	};

	if (option.type !== "sub_command" && option.type !== "sub_command_group") {
		payload.required = option.required;
	}
	if (["string", "integer", "number"].includes(option.type) && option.choices.length > 0 && !option.autocomplete) {
		payload.choices = option.choices.map((choice) => ({ name: choice.name, value: choice.value, name_localizations: localizationMapToPayload(choice.nameLocalizations) }));
	}
	if (["string", "integer", "number"].includes(option.type) && option.autocomplete) payload.autocomplete = true;
	if (["integer", "number"].includes(option.type)) {
		if (typeof option.minValue === "number") payload.min_value = option.minValue;
		if (typeof option.maxValue === "number") payload.max_value = option.maxValue;
	}
	if (option.type === "string") {
		if (typeof option.minLength === "number") payload.min_length = option.minLength;
		if (typeof option.maxLength === "number") payload.max_length = option.maxLength;
	}
	if (option.type === "channel" && option.channelTypes.length > 0) payload.channel_types = option.channelTypes;
	if ((option.type === "sub_command" || option.type === "sub_command_group") && option.options.length > 0) {
		payload.options = option.options.slice(0, 25).map(draftOptionToPayload);
	}

	return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

// Charge Discord depuis brouillon.
export function applicationCommandDraftToPayload(draft: ApplicationCommandDraft): DiscordApplicationCommandPayload {
	const isGuildScopedCommand = draft.scope === "guild";
	const contexts = !isGuildScopedCommand ? commandContextsToPayload(draft.contexts) : undefined;
	const integrationTypes = !isGuildScopedCommand ? commandIntegrationTypesToPayload(draft.integrationTypes) : undefined;
	const payload: DiscordApplicationCommandPayload = {
		type: applicationCommandTypeToApi[draft.type],
		name: draft.name.trim(),
		name_localizations: localizationMapToPayload(draft.nameLocalizations),
		default_member_permissions: draft.defaultMemberPermissions?.trim() || null,
		nsfw: draft.nsfw === true ? true : undefined,
		contexts,
		integration_types: integrationTypes
	};

	if (draft.type === "chat_input") {
		payload.description = draft.description.trim() || "Command";
		payload.description_localizations = localizationMapToPayload(draft.descriptionLocalizations);
		if (draft.options.length > 0) payload.options = draft.options.slice(0, 25).map(draftOptionToPayload);
	} else {
		payload.description = undefined;
	}

	// Discord refuse les anciens champs DM quand une commande utilise les nouveaux
	// contextes, et les commandes serveur n'en ont pas besoin: elles sont déjà
	// limitées au serveur par l'endpoint guild.commands.*.
	if (!isGuildScopedCommand && !contexts && typeof draft.dmPermission === "boolean") {
		payload.dm_permission = draft.dmPermission;
	}

	return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

export function clamp<T>(items: T[], limit: number): T[] {
	return items.length > limit ? items.slice(items.length - limit) : items;
}

// Borne history limit.
export function clampHistoryLimit(limit: number): number {
	if (!Number.isFinite(limit)) return 50;
	return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

// Pause contrôlée.
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}


export function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

export function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
	const seen = new Set<string>();
	const uniqueItems: T[] = [];
	for (const item of items) {
		const key = keyOf(item);
		if (seen.has(key)) continue;
		seen.add(key);
		uniqueItems.push(item);
	}
	return uniqueItems;
}

let databaseWriteQueue: Promise<void> = Promise.resolve();

// Erreur base transitoire.
export function isTransientDatabaseError(error: unknown): boolean {
	const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
	return message.includes("socket timeout")
		|| message.includes("database failed to respond")
		|| message.includes("database is locked")
		|| message.includes("timed out")
		|| message.includes("timeout expired");
}

export async function runDatabaseWriteWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (!isTransientDatabaseError(error) || attempt === attempts - 1) throw error;
			await delay(150 * (attempt + 1));
		}
	}
	throw lastError;
}

export async function enqueueDatabaseWrite<T>(operation: () => Promise<T>): Promise<T> {
	const previousWrite = databaseWriteQueue.catch(() => undefined);
	const currentWrite = previousWrite.then(() => runDatabaseWriteWithRetry(operation));
	databaseWriteQueue = currentWrite.then(() => undefined, () => undefined);
	return currentWrite;
}

export async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
	let index = 0;
	const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
		while (index < items.length) {
			const item = items[index];
			index += 1;
			await worker(item);
		}
	});
	await Promise.all(workers);
}

// Salon rattaché serveur.
export function isGuildBasedChannel(channel: { guild?: Guild | null; type?: ChannelType } | null | undefined): channel is GuildBasedChannel {
	return Boolean(channel && "guild" in channel);
}
