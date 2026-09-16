// Stockage local et réglages Botdeck partagés.

import type { ApplicationCommandDraft, ApplicationCommandRuntimeDefinition, ChannelSummary, MessageSummary } from "@botdeck/shared";
import type { UiLanguage } from "./botdeck-app-i18n";

export type PresenceChoice = "online" | "idle" | "dnd" | "offline";

export type ActivityChoice = "playing" | "streaming" | "listening" | "watching" | "competing";

export type ActivityPlatformChoice = "none" | "twitch" | "youtube" | "spotify" | "soundcloud" | "appleMusic" | "customUrl";

export type RetainedDmChannel = ChannelSummary & { retainedAt: string };

export type DismissedDmState = Record<string, string>;

export type DismissedEphemeralMessageState = Record<string, string>;

export type ChannelActivityState = Record<string, { unreadCount: number; mentionCount: number }>;

export type BotSettingsState = {
	status: PresenceChoice;
	activityEnabled: boolean;
	activityType: ActivityChoice;
	activityName: string;
	activityState: string;
	activityUrl: string;
	activityPlatform: ActivityPlatformChoice;
	activityButtonPrimaryLabel: string;
	activityButtonPrimaryUrl: string;
	activityButtonSecondaryLabel: string;
	activityButtonSecondaryUrl: string;
	compactMessages: boolean;
	performanceMode: boolean;
};

export type BotCustomStatusState = {
	enabled: boolean;
	emoji: string;
	text: string;
};

export const retainedDmStoragePrefix = "botdeck:retained-dms:";
export const dismissedDmStoragePrefix = "botdeck:dismissed-dms:";
export const dismissedEphemeralMessagesStoragePrefix = "botdeck:dismissed-ephemeral-messages:";
export const channelActivityStoragePrefix = "botdeck:channel-activity:";
export const botSettingsStoragePrefix = "botdeck:bot-settings:";
export const botCustomStatusStoragePrefix = "botdeck:bot-custom-status:";
export const slashCommandDraftStoragePrefix = "botdeck:slash-command-draft:";
export const channelSidebarWidthStorageKey = "botdeck:channel-sidebar-width";

export const minChannelSidebarWidth = 232;
export const maxChannelSidebarWidth = 360;
export const botEntryMinimumDuration = 1200;
export const botEntryFadeDuration = 260;
export const botEntryMaximumDuration = 45000;

export const defaultBotSettings: BotSettingsState = {
	status: "online",
	activityEnabled: false,
	activityType: "playing",
	activityName: "Botdeck",
	activityState: "",
	activityUrl: "",
	activityPlatform: "none",
	activityButtonPrimaryLabel: "",
	activityButtonPrimaryUrl: "",
	activityButtonSecondaryLabel: "",
	activityButtonSecondaryUrl: "",
	compactMessages: false,
	performanceMode: false
};

export const defaultBotCustomStatus: BotCustomStatusState = {
	enabled: false,
	emoji: "",
	text: ""
};

export const botCustomStatusMaxLength = 128;

export const presenceLabels: Record<UiLanguage, Record<PresenceChoice, string>> = {
	fr: {
		online: "En ligne",
		idle: "Inactif",
		dnd: "Ne pas déranger",
		offline: "Invisible"
	},
	en: {
		online: "Online",
		idle: "Idle",
		dnd: "Do not disturb",
		offline: "Invisible"
	}
};

export const botPresenceSettingKeys: Array<keyof BotSettingsState> = [
	"activityEnabled",
	"activityType",
	"activityName",
	"activityState",
	"activityUrl",
	"activityPlatform"
];

// Détecte les changements présence.
export function botPresenceSettingsChanged(previous: BotSettingsState, next: BotSettingsState): boolean {
	return botPresenceSettingKeys.some((key) => previous[key] !== next[key]);
}

// Désactive la présence Discord.
export function disableDiscordPresence(settings: BotSettingsState): BotSettingsState {
	return settings.activityEnabled ? { ...settings, activityEnabled: false } : settings;
}


export function retainedDmStorageKey(botId: string): string {
	return `${retainedDmStoragePrefix}${botId}`;
}

// Clé stockage des MP masqués.
export function dismissedDmStorageKey(botId: string): string {
	return `${dismissedDmStoragePrefix}${botId}`;
}

// Clé stockage messages éphémères.
export function dismissedEphemeralMessagesStorageKey(botId: string): string {
	return `${dismissedEphemeralMessagesStoragePrefix}${botId}`;
}

// Clé stockage activité salon.
export function channelActivityStorageKey(botId: string): string {
	return `${channelActivityStoragePrefix}${botId}`;
}

// Clé stockage réglages bot.
export function botSettingsStorageKey(botId: string): string {
	return `${botSettingsStoragePrefix}${botId}`;
}

// Clé stockage statut bot.
export function botCustomStatusStorageKey(botId: string): string {
	return `${botCustomStatusStoragePrefix}${botId}`;
}

// Crée le runtime commande.
export function createCommandRuntimeDefinition(intent: string, kind: "simple" | "embed" | "ticket" | "roles" | "moderation", content: string): ApplicationCommandRuntimeDefinition {
	const visibility = kind === "moderation" ? "ephemeral" : "public";
	const workflowMap: Record<typeof kind, ApplicationCommandRuntimeDefinition["workflow"]> = {
		simple: [{ id: "reply", type: "reply", label: "Répondre", content }],
		embed: [
			{ id: "compose", type: "send_embed", label: "Composer l'embed", metadata: { color: 3535556 } },
			{ id: "reply", type: "reply", label: "Envoyer l'embed", content }
		],
		ticket: [
			{ id: "channel", type: "create_ticket_channel", label: "Créer le salon ticket", metadata: { private: true } },
			{ id: "reply", type: "reply", label: "Confirmer", content }
		],
		roles: [
			{ id: "roles", type: "role_menu", label: "Préparer le menu de rôles", metadata: { multi: true } },
			{ id: "reply", type: "reply", label: "Afficher le menu", content }
		],
		moderation: [
			{ id: "guard", type: "moderation", label: "Vérifier les permissions", metadata: { planned: true } },
			{ id: "reply", type: "reply", label: "Confirmer l'action", content }
		]
	};

	return {
		version: 1,
		intent,
		response: { content, visibility },
		workflow: workflowMap[kind],
		variables: ["user.mention", "guild.name", "command.name"]
	};
}

// Genre runtime du brouillon.
export function commandRuntimeKindFromDraft(draft: ApplicationCommandDraft): "simple" | "embed" | "ticket" | "roles" | "moderation" {
	const lower = `${draft.name} ${draft.description}`.toLowerCase();
	if (lower.includes("ticket")) return "ticket";
	if (lower.includes("role") || lower.includes("rôle")) return "roles";
	if (lower.includes("embed") || lower.includes("info")) return "embed";
	if (draft.defaultMemberPermissions || lower.includes("ban") || lower.includes("kick") || lower.includes("mute")) return "moderation";
	return "simple";
}

// Garantit un runtime valide.
export function ensureCommandRuntime(draft: ApplicationCommandDraft, fallbackIntent = ""): ApplicationCommandDraft {
	if (draft.runtime?.response?.content) return draft;
	const kind = commandRuntimeKindFromDraft(draft);
	const name = draft.name || "commande";
	const content = kind === "simple" && name === "ping"
		? "Pong"
		: kind === "ticket"
			? "Ticket reçu. L'équipe va prendre le relais."
			: kind === "roles"
				? "Choisis tes rôles avec le menu ci-dessous."
				: kind === "embed"
					? `Voici les informations pour /${name}.`
					: kind === "moderation"
						? "Action de modération reçue pour {membre}. Raison: {raison}."
						: `Commande /${name} exécutée.`;
	return { ...draft, runtime: createCommandRuntimeDefinition(fallbackIntent || `/${name}`, kind, content) };
}

// Clé stockage brouillon slash.
export function slashCommandDraftStorageKey(botId: string, guildId: string | null): string {
	return `${slashCommandDraftStoragePrefix}${botId}:${guildId ?? "global"}`;
}

// Lit le brouillon slash stocké.
export function readStoredSlashCommandDraft(storageKey: string | null, fallback: ApplicationCommandDraft): ApplicationCommandDraft {
	if (!storageKey || typeof window === "undefined") return fallback;
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return fallback;
		return ensureCommandRuntime({ ...fallback, ...(parsed as Partial<ApplicationCommandDraft>) });
	} catch {
		return fallback;
	}
}

// Écrit le brouillon slash.
export function writeStoredSlashCommandDraft(storageKey: string | null, draft: ApplicationCommandDraft): void {
	if (!storageKey || typeof window === "undefined") return;
	window.localStorage.setItem(storageKey, JSON.stringify(draft));
}

// Supprime le brouillon slash.
export function clearStoredSlashCommandDraft(storageKey: string | null): void {
	if (!storageKey || typeof window === "undefined") return;
	window.localStorage.removeItem(storageKey);
}

// Vide le cache bot navigateur.
export function clearBrowserBotCache(botId: string): void {
	if (typeof window === "undefined") return;
	for (const key of [
		botSettingsStorageKey(botId),
		botCustomStatusStorageKey(botId),
		`${slashCommandDraftStoragePrefix}${botId}:global`,
		retainedDmStorageKey(botId),
		dismissedDmStorageKey(botId),
		dismissedEphemeralMessagesStorageKey(botId),
		channelActivityStorageKey(botId)
	]) {
		window.localStorage.removeItem(key);
	}
}

// Vide les caches au mieux.
export async function clearBestEffortBrowserCaches(botId: string): Promise<void> {
	clearBrowserBotCache(botId);
	if (typeof window === "undefined") return;
	try {
		window.sessionStorage.removeItem(botSettingsStorageKey(botId));
		window.sessionStorage.removeItem(botCustomStatusStorageKey(botId));
		window.sessionStorage.removeItem(retainedDmStorageKey(botId));
		window.sessionStorage.removeItem(dismissedDmStorageKey(botId));
		window.sessionStorage.removeItem(dismissedEphemeralMessagesStorageKey(botId));
		window.sessionStorage.removeItem(channelActivityStorageKey(botId));
	} catch {
		// Tentative non bloquante.
	}

	try {
		if ("caches" in window) {
			const cacheNames = await window.caches.keys();
			await Promise.all(cacheNames.filter((name) => name.toLowerCase().includes("botdeck")).map((name) => window.caches.delete(name)));
		}
	} catch {
		// Tentative non bloquante.
	}
}

// Borne largeur sidebar salons.
export function clampChannelSidebarWidth(width: number): number {
	return Math.min(maxChannelSidebarWidth, Math.max(minChannelSidebarWidth, Math.round(width)));
}

// Lit la largeur sidebar salons.
export function readChannelSidebarWidth(): number {
	if (typeof window === "undefined") return 258;
	const raw = window.localStorage.getItem(channelSidebarWidthStorageKey);
	const parsed = raw ? Number.parseInt(raw, 10) : NaN;
	return Number.isFinite(parsed) ? clampChannelSidebarWidth(parsed) : 258;
}

// Sauve la largeur sidebar salons.
export function writeChannelSidebarWidth(width: number): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(channelSidebarWidthStorageKey, String(clampChannelSidebarWidth(width)));
}

// Lit les réglages bot.
export function readBotSettings(botId: string): BotSettingsState {
	if (typeof window === "undefined") return defaultBotSettings;
	try {
		const raw = window.localStorage.getItem(botSettingsStorageKey(botId));
		if (!raw) return defaultBotSettings;
		const parsed = JSON.parse(raw) as Partial<BotSettingsState>;
		return {
			...defaultBotSettings,
			...parsed,
			status: ["online", "idle", "dnd", "offline"].includes(parsed.status ?? "") ? (parsed.status as PresenceChoice) : defaultBotSettings.status,
			activityType: ["playing", "streaming", "listening", "watching", "competing"].includes(parsed.activityType ?? "")
				? (parsed.activityType as ActivityChoice)
				: defaultBotSettings.activityType,
			activityPlatform: ["none", "twitch", "youtube", "spotify", "soundcloud", "appleMusic", "customUrl"].includes(parsed.activityPlatform ?? "")
				? (parsed.activityPlatform as ActivityPlatformChoice)
				: defaultBotSettings.activityPlatform,
			compactMessages: Boolean(parsed.compactMessages),
			performanceMode: Boolean(parsed.performanceMode)
		};
	} catch {
		return defaultBotSettings;
	}
}

// Sauve les réglages bot.
export function writeBotSettings(botId: string, settings: BotSettingsState): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(botSettingsStorageKey(botId), JSON.stringify(settings));
}

// Lit le statut personnalisé.
export function readBotCustomStatus(botId: string): BotCustomStatusState {
	if (typeof window === "undefined") return defaultBotCustomStatus;
	try {
		const raw = window.localStorage.getItem(botCustomStatusStorageKey(botId));
		if (!raw) return defaultBotCustomStatus;
		const parsed = JSON.parse(raw) as Partial<BotCustomStatusState>;
		const text = typeof parsed.text === "string" ? parsed.text.trim().slice(0, botCustomStatusMaxLength) : defaultBotCustomStatus.text;
		return {
			enabled: Boolean(parsed.enabled && text),
			emoji: "",
			text
		};
	} catch {
		return defaultBotCustomStatus;
	}
}

// Sauve le statut personnalisé.
export function writeBotCustomStatus(botId: string, status: BotCustomStatusState): void {
	if (typeof window === "undefined") return;
	const text = status.text.trim().slice(0, botCustomStatusMaxLength);
	window.localStorage.setItem(botCustomStatusStorageKey(botId), JSON.stringify({
		enabled: Boolean(status.enabled && text),
		emoji: "",
		text
	}));
}

// Résume le statut personnalisé.
export function formatBotCustomStatus(status: BotCustomStatusState): string {
	if (!status.enabled) return "";
	const text = status.text.trim();
	return text;
}

// Lit les MP conservés.
export function readRetainedDms(botId: string): RetainedDmChannel[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = window.localStorage.getItem(retainedDmStorageKey(botId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as RetainedDmChannel[];
		return Array.isArray(parsed) ? parsed.filter((channel) => channel?.id && channel.type === "dm") : [];
	} catch {
		return [];
	}
}

// Sauve les MP conservés.
export function writeRetainedDms(botId: string, channels: RetainedDmChannel[]): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(retainedDmStorageKey(botId), JSON.stringify(channels));
}

// Lit les MP masqués.
export function readDismissedDmState(botId: string): DismissedDmState {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(dismissedDmStorageKey(botId));
		if (!raw) return {};
		const parsed = JSON.parse(raw) as DismissedDmState;
		if (!parsed || typeof parsed !== "object") return {};
		const dismissed: DismissedDmState = {};
		for (const [channelId, dismissedAt] of Object.entries(parsed)) {
			if (typeof dismissedAt === "string" && Number.isFinite(Date.parse(dismissedAt))) {
				dismissed[channelId] = dismissedAt;
			}
		}
		return dismissed;
	} catch {
		return {};
	}
}

// Sauve les MP masqués.
export function writeDismissedDmState(botId: string, dismissed: DismissedDmState): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(dismissedDmStorageKey(botId), JSON.stringify(dismissed));
}

// Lit les messages éphémères masqués.
export function readDismissedEphemeralMessageState(botId: string): DismissedEphemeralMessageState {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(dismissedEphemeralMessagesStorageKey(botId));
		if (!raw) return {};
		const parsed = JSON.parse(raw) as DismissedEphemeralMessageState;
		if (!parsed || typeof parsed !== "object") return {};
		const dismissed: DismissedEphemeralMessageState = {};
		for (const [messageKey, dismissedAt] of Object.entries(parsed)) {
			if (typeof dismissedAt === "string" && Number.isFinite(Date.parse(dismissedAt))) {
				dismissed[messageKey] = dismissedAt;
			}
		}
		return dismissed;
	} catch {
		return {};
	}
}

// Sauve les messages éphémères masqués.
export function writeDismissedEphemeralMessageState(botId: string, dismissed: DismissedEphemeralMessageState): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(dismissedEphemeralMessagesStorageKey(botId), JSON.stringify(dismissed));
}

// Clé de masquage éphémère.
export function ephemeralMessageDismissKey(message: MessageSummary): string {
	return `${message.channelId}:${message.id}`;
}

// Détecte un message éphémère.
export function isEphemeralMessage(message: MessageSummary): boolean {
	return Boolean(message.ephemeral || ((message.flags ?? 0) & 64) === 64);
}

// Lit l’activité salons.
export function readChannelActivityState(botId: string): ChannelActivityState {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(channelActivityStorageKey(botId));
		if (!raw) return {};
		const parsed = JSON.parse(raw) as ChannelActivityState;
		if (!parsed || typeof parsed !== "object") return {};
		const activity: ChannelActivityState = {};
		for (const [channelId, value] of Object.entries(parsed)) {
			const unreadCount = Math.max(0, Number(value?.unreadCount) || 0);
			const mentionCount = Math.max(0, Number(value?.mentionCount) || 0);
			if (unreadCount > 0 || mentionCount > 0) {
				activity[channelId] = { unreadCount, mentionCount };
			}
		}
		return activity;
	} catch {
		return {};
	}
}

// Sauve l’activité salons.
export function writeChannelActivityState(botId: string, activity: ChannelActivityState): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(channelActivityStorageKey(botId), JSON.stringify(activity));
}

// Détecte une mention utilisateur.
