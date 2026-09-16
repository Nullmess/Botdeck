"use client";

import { Input, Select, Textarea } from "../../../components/ui/field";
import type { BotAccountSummary, GuildSummary } from "@botdeck/shared";
import { useMemo, useState } from "react";
import { i18nText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Card, Panel, Section } from "@/components/ui/panel";

import type { UiLanguage } from "@/features/workspace/core";
import { Badge } from "../../../components/ui/badge";

type InstallTarget = "server" | "user";
type ScopeKey = "bot" | "applications.commands";
type PermissionKey =
	| "createInstantInvite"
	| "kickMembers"
	| "banMembers"
	| "administrator"
	| "manageChannels"
	| "manageGuild"
	| "addReactions"
	| "viewAuditLog"
	| "prioritySpeaker"
	| "stream"
	| "viewChannel"
	| "sendMessages"
	| "sendTTSMessages"
	| "manageMessages"
	| "embedLinks"
	| "attachFiles"
	| "readMessageHistory"
	| "mentionEveryone"
	| "useExternalEmojis"
	| "viewGuildInsights"
	| "connect"
	| "speak"
	| "muteMembers"
	| "deafenMembers"
	| "moveMembers"
	| "useVAD"
	| "changeNickname"
	| "manageNicknames"
	| "manageRoles"
	| "manageWebhooks"
	| "manageGuildExpressions"
	| "useApplicationCommands"
	| "requestToSpeak"
	| "manageEvents"
	| "manageThreads"
	| "createPublicThreads"
	| "createPrivateThreads"
	| "useExternalStickers"
	| "sendMessagesInThreads"
	| "useEmbeddedActivities"
	| "moderateMembers"
	| "viewCreatorMonetizationAnalytics"
	| "useSoundboard"
	| "createGuildExpressions"
	| "createEvents"
	| "useExternalSounds"
	| "sendVoiceMessages"
	| "setVoiceChannelStatus"
	| "sendPolls"
	| "useExternalApps"
	| "pinMessages"
	| "bypassSlowmode";

interface PermissionDefinition {
	key: PermissionKey;
	bit: number;
	labelFr: string;
	labelEn: string;
	descriptionFr: string;
	descriptionEn: string;
	advanced?: boolean;
}

const permissionDefinitions: PermissionDefinition[] = [
	{ key: "viewChannel", bit: 10, labelFr: "Voir les salons", labelEn: "View Channels", descriptionFr: "Permet au bot de voir les salons serveur.", descriptionEn: "Allows the bot to see guild channels." },
	{ key: "useApplicationCommands", bit: 31, labelFr: "Utiliser les commandes d’application", labelEn: "Use Application Commands", descriptionFr: "Nécessaire pour les commandes slash et contextuelles.", descriptionEn: "Required for slash and context commands." },
	{ key: "readMessageHistory", bit: 16, labelFr: "Lire l’historique", labelEn: "Read Message History", descriptionFr: "Permet de charger les anciens messages.", descriptionEn: "Allows loading previous messages." },
	{ key: "sendMessages", bit: 11, labelFr: "Envoyer des messages", labelEn: "Send Messages", descriptionFr: "Permet au bot d’écrire dans les salons.", descriptionEn: "Allows the bot to write in channels." },
	{ key: "sendMessagesInThreads", bit: 38, labelFr: "Écrire dans les threads", labelEn: "Send Messages in Threads", descriptionFr: "Permet de répondre dans les threads et posts forum.", descriptionEn: "Allows replying in threads and forum posts." },
	{ key: "embedLinks", bit: 14, labelFr: "Embeds", labelEn: "Embed Links", descriptionFr: "Permet d’envoyer des réponses enrichies et embeds.", descriptionEn: "Allows rich responses and embeds." },
	{ key: "attachFiles", bit: 15, labelFr: "Joindre des fichiers", labelEn: "Attach Files", descriptionFr: "Permet d’envoyer des pièces jointes.", descriptionEn: "Allows sending attachments." },
	{ key: "addReactions", bit: 6, labelFr: "Ajouter des réactions", labelEn: "Add Reactions", descriptionFr: "Permet d’ajouter des réactions aux messages.", descriptionEn: "Allows adding reactions." },
	{ key: "manageMessages", bit: 13, labelFr: "Gérer les messages", labelEn: "Manage Messages", descriptionFr: "Suppression, modération de messages, épingles selon les cas.", descriptionEn: "Delete and moderate messages; useful for pins depending on actions." },
	{ key: "pinMessages", bit: 51, labelFr: "Épingler les messages", labelEn: "Pin Messages", descriptionFr: "Permission moderne pour épingler et désépingler.", descriptionEn: "Modern permission for pinning and unpinning messages." },
	{ key: "sendPolls", bit: 49, labelFr: "Envoyer des sondages", labelEn: "Send Polls", descriptionFr: "Permet d’envoyer des sondages Discord.", descriptionEn: "Allows sending Discord polls." },
	{ key: "sendTTSMessages", bit: 12, labelFr: "Messages TTS", labelEn: "Send TTS Messages", descriptionFr: "Permet d’envoyer des messages text-to-speech.", descriptionEn: "Allows sending text-to-speech messages.", advanced: true },
	{ key: "mentionEveryone", bit: 17, labelFr: "Mentionner everyone/here", labelEn: "Mention Everyone", descriptionFr: "À éviter sauf bot d’annonce maîtrisé.", descriptionEn: "Avoid unless the bot is a controlled announcement bot.", advanced: true },
	{ key: "sendVoiceMessages", bit: 46, labelFr: "Messages vocaux", labelEn: "Send Voice Messages", descriptionFr: "Permet d’envoyer des messages vocaux.", descriptionEn: "Allows sending voice messages." },
	{ key: "manageThreads", bit: 34, labelFr: "Gérer les threads", labelEn: "Manage Threads", descriptionFr: "Archivage, verrouillage et gestion des threads.", descriptionEn: "Archive, lock and manage threads." },
	{ key: "createPublicThreads", bit: 35, labelFr: "Créer threads publics", labelEn: "Create Public Threads", descriptionFr: "Permet de créer des threads publics.", descriptionEn: "Allows creating public threads." },
	{ key: "createPrivateThreads", bit: 36, labelFr: "Créer threads privés", labelEn: "Create Private Threads", descriptionFr: "Permet de créer des threads privés.", descriptionEn: "Allows creating private threads." },
	{ key: "createInstantInvite", bit: 0, labelFr: "Créer des invitations", labelEn: "Create Invites", descriptionFr: "Permet de créer des invitations de salon.", descriptionEn: "Allows creating channel invites." },
	{ key: "manageChannels", bit: 4, labelFr: "Gérer les salons", labelEn: "Manage Channels", descriptionFr: "Création, édition, suppression et déplacement des salons.", descriptionEn: "Create, edit, delete and reorder channels." },
	{ key: "manageGuild", bit: 5, labelFr: "Gérer le serveur", labelEn: "Manage Server", descriptionFr: "Paramètres serveur, AutoMod selon les cas, intégrations avancées.", descriptionEn: "Server settings, some AutoMod and advanced integrations." },
	{ key: "viewAuditLog", bit: 7, labelFr: "Voir l’audit log", labelEn: "View Audit Log", descriptionFr: "Utile pour logs enrichis et actions de modération.", descriptionEn: "Useful for enriched logs and moderation actions." },
	{ key: "kickMembers", bit: 1, labelFr: "Expulser des membres", labelEn: "Kick Members", descriptionFr: "Action de modération kick.", descriptionEn: "Kick moderation action." },
	{ key: "banMembers", bit: 2, labelFr: "Bannir des membres", labelEn: "Ban Members", descriptionFr: "Action de modération ban/unban.", descriptionEn: "Ban/unban moderation action." },
	{ key: "moderateMembers", bit: 40, labelFr: "Timeout / modérer", labelEn: "Moderate Members", descriptionFr: "Timeout et modération temporaire.", descriptionEn: "Timeout and temporary moderation." },
	{ key: "manageRoles", bit: 28, labelFr: "Gérer les rôles", labelEn: "Manage Roles", descriptionFr: "Rôles automatiques, ajout/retrait de rôles, hiérarchie.", descriptionEn: "Auto roles, add/remove roles and hierarchy." },
	{ key: "manageNicknames", bit: 27, labelFr: "Gérer les pseudos", labelEn: "Manage Nicknames", descriptionFr: "Modification des pseudos membres.", descriptionEn: "Edit member nicknames." },
	{ key: "changeNickname", bit: 26, labelFr: "Changer son pseudo", labelEn: "Change Nickname", descriptionFr: "Changer le pseudo du bot dans le serveur.", descriptionEn: "Change the bot nickname in the guild." },
	{ key: "viewGuildInsights", bit: 19, labelFr: "Voir statistiques serveur", labelEn: "View Server Insights", descriptionFr: "Statistiques serveur si disponibles.", descriptionEn: "Server insights when available.", advanced: true },
	{ key: "manageWebhooks", bit: 29, labelFr: "Gérer les webhooks", labelEn: "Manage Webhooks", descriptionFr: "Création et gestion de webhooks de logs.", descriptionEn: "Create and manage logging webhooks." },
	{ key: "manageGuildExpressions", bit: 30, labelFr: "Gérer les expressions", labelEn: "Manage Expressions", descriptionFr: "Gérer emojis, stickers et sons créés par tous.", descriptionEn: "Manage emojis, stickers and sounds created by everyone." },
	{ key: "createGuildExpressions", bit: 43, labelFr: "Créer des expressions", labelEn: "Create Expressions", descriptionFr: "Créer emojis, stickers et sons du bot.", descriptionEn: "Create emojis, stickers and sounds as the bot." },
	{ key: "manageEvents", bit: 33, labelFr: "Gérer événements", labelEn: "Manage Events", descriptionFr: "Gérer les événements planifiés.", descriptionEn: "Manage scheduled events." },
	{ key: "createEvents", bit: 44, labelFr: "Créer événements", labelEn: "Create Events", descriptionFr: "Créer des événements planifiés.", descriptionEn: "Create scheduled events." },
	{ key: "useExternalEmojis", bit: 18, labelFr: "Emojis externes", labelEn: "Use External Emojis", descriptionFr: "Utiliser des emojis d’autres serveurs.", descriptionEn: "Use emojis from other servers." },
	{ key: "useExternalStickers", bit: 37, labelFr: "Stickers externes", labelEn: "Use External Stickers", descriptionFr: "Utiliser des stickers d’autres serveurs.", descriptionEn: "Use stickers from other servers." },
	{ key: "useExternalApps", bit: 50, labelFr: "Apps externes", labelEn: "Use External Apps", descriptionFr: "Autorise les réponses publiques d’apps installées côté utilisateur.", descriptionEn: "Allows public responses from user-installed apps." },
	{ key: "useEmbeddedActivities", bit: 39, labelFr: "Activités intégrées", labelEn: "Use Embedded Activities", descriptionFr: "Lancer/autoriser des activités intégrées.", descriptionEn: "Launch or allow embedded activities.", advanced: true },
	{ key: "connect", bit: 20, labelFr: "Se connecter en vocal", labelEn: "Connect", descriptionFr: "Permet au bot d’entrer en salon vocal.", descriptionEn: "Allows the bot to join voice channels." },
	{ key: "speak", bit: 21, labelFr: "Parler en vocal", labelEn: "Speak", descriptionFr: "Permet au bot de parler en vocal.", descriptionEn: "Allows the bot to speak in voice." },
	{ key: "stream", bit: 9, labelFr: "Stream", labelEn: "Stream", descriptionFr: "Permet de diffuser en vocal.", descriptionEn: "Allows streaming in voice." },
	{ key: "prioritySpeaker", bit: 8, labelFr: "Priority speaker", labelEn: "Priority Speaker", descriptionFr: "Mode prioritaire vocal.", descriptionEn: "Priority speaker mode.", advanced: true },
	{ key: "muteMembers", bit: 22, labelFr: "Mute membres", labelEn: "Mute Members", descriptionFr: "Mute serveur en vocal.", descriptionEn: "Server-mute members in voice." },
	{ key: "deafenMembers", bit: 23, labelFr: "Deafen membres", labelEn: "Deafen Members", descriptionFr: "Rendre sourd côté serveur.", descriptionEn: "Server-deafen members." },
	{ key: "moveMembers", bit: 24, labelFr: "Déplacer membres", labelEn: "Move Members", descriptionFr: "Déplacer/déconnecter les membres vocaux.", descriptionEn: "Move or disconnect voice members." },
	{ key: "useVAD", bit: 25, labelFr: "Détection vocale", labelEn: "Use Voice Activity", descriptionFr: "Utiliser la détection d’activité vocale.", descriptionEn: "Use voice activity detection." },
	{ key: "requestToSpeak", bit: 32, labelFr: "Demander la parole", labelEn: "Request to Speak", descriptionFr: "Demande de parole en stage.", descriptionEn: "Request to speak in stage channels." },
	{ key: "useSoundboard", bit: 42, labelFr: "Soundboard", labelEn: "Use Soundboard", descriptionFr: "Utiliser le soundboard.", descriptionEn: "Use the soundboard." },
	{ key: "useExternalSounds", bit: 45, labelFr: "Sons externes", labelEn: "Use External Sounds", descriptionFr: "Utiliser des sons externes.", descriptionEn: "Use external soundboard sounds." },
	{ key: "setVoiceChannelStatus", bit: 48, labelFr: "Statut salon vocal", labelEn: "Set Voice Channel Status", descriptionFr: "Modifier le statut d’un salon vocal.", descriptionEn: "Set a voice channel status." },
	{ key: "bypassSlowmode", bit: 52, labelFr: "Ignorer le slowmode", labelEn: "Bypass Slowmode", descriptionFr: "Permet d’ignorer le slowmode si nécessaire.", descriptionEn: "Allows bypassing slowmode when needed." },
	{ key: "administrator", bit: 3, labelFr: "Administrateur", labelEn: "Administrator", descriptionFr: "À éviter sauf serveur/lab personnel. Donne tous les droits.", descriptionEn: "Avoid outside personal/lab servers. Grants all permissions.", advanced: true }
];

function uniqueScopes(keys: Iterable<ScopeKey>): ScopeKey[] {
	return [...new Set(keys)];
}

function calculatePermissionValue(keys: PermissionKey[]): string {
	const byKey = new Map(permissionDefinitions.map((permission) => [permission.key, permission]));
	const value = keys.reduce((acc, key) => {
		const permission = byKey.get(key);
		return permission ? acc | (1n << BigInt(permission.bit)) : acc;
	}, 0n);
	return value.toString(10);
}

function formatPermissionHex(value: string): string {
	try {
		return `0x${BigInt(value).toString(16).toUpperCase().padStart(16, "0")}`;
	} catch {
		return "0x0000000000000000";
	}
}

function labelFor(permission: PermissionDefinition, language: UiLanguage): string {
	return language === "fr" ? permission.labelFr : permission.labelEn;
}

function descriptionFor(permission: PermissionDefinition, language: UiLanguage): string {
	return language === "fr" ? permission.descriptionFr : permission.descriptionEn;
}

function copyInviteText(language: UiLanguage) {
	return language === "fr"
		? {
			title: "Invitation",
			help: "Génère uniquement le lien OAuth2 pour inviter ou installer l’application Discord.",
			summaryTitle: "Résumé",
			summaryHelp: "Vue rapide du lien qui sera généré.",
			identityTitle: "Identité OAuth2",
			identityHelp: "L’Application ID permet à Discord de savoir quelle application installer.",
			clientIdSource: "Source du Client ID",
			clientIdAutomatic: "Automatique",
			clientIdManual: "Manuel",
			clientIdMissing: "À renseigner",
			clientIdAutomaticHelp: "Pris depuis l’Application ID du bot chargé dans Botdeck.",
			clientIdManualHelp: "Valeur saisie manuellement pour générer un autre lien.",
			clientIdMissingHelp: "Renseigne l’Application ID Discord pour générer le lien.",
			parametersTitle: "Paramètres inclus",
			parametersHelp: "Aperçu des paramètres réellement envoyés dans l’URL OAuth2.",
			activeScopes: "Scopes actifs",
			integrationType: "Integration type",
			guildLock: "Serveur verrouillé",
			developerTitle: "Pré-requis Developer Portal",
			developerHelp: "Points à vérifier côté Discord si l’invitation ne fonctionne pas.",
			guildInstallPortal: "Guild Install",
			guildInstallPortalHelp: "À activer pour installer le bot dans un serveur.",
			userInstallPortal: "User Install",
			userInstallPortalHelp: "À activer pour les installations utilisateur.",
			publicBotPortal: "Bot public",
			publicBotPortalHelp: "Nécessaire pour qu’une autre personne puisse ajouter le bot à son serveur.",
			toCheck: "À vérifier",
			authorizationTitle: "Autorisation",
			authorizationHelp: "Paramètres envoyés dans l’URL d’autorisation Discord.",
			scopesTitle: "Scopes OAuth2",
			scopesHelp: "Scopes présents dans le paramètre scope de l’URL.",
			permissionsTitle: "Permissions serveur",
			permissionsHelp: "Permissions brutes du bot pour une installation serveur. Aucune permission n’est cochée automatiquement.",
			technicalTitle: "Valeurs techniques",
			technicalHelp: "Valeurs calculées à partir des permissions cochées.",
			urlTitle: "URL générée",
			urlHelp: "Lien prêt à copier ou à ouvrir dans le navigateur.",
			clientId: "Client ID / Application ID",
			clientIdHelp: "Pris depuis le bot connecté si disponible. Tu peux le remplacer par l’Application ID du Developer Portal.",
			clientIdPlaceholder: "Ex: 123456789012345678",
			installType: "Type d’installation",
			serverInstall: "Serveur",
			userInstall: "Utilisateur",
			serverHelp: "Ajoute le bot à un serveur avec permissions serveur.",
			userHelp: "Installe l’application côté utilisateur pour les commandes compatibles User Install.",
			selectedGuild: "Serveur préselectionné",
			noGuild: "Aucun serveur imposé",
			disableGuildSelect: "Bloquer le choix du serveur",
			promptConsent: "Forcer la fenêtre d’autorisation",
			permissionInteger: "Permission integer",
			permissionHex: "Hex",
			missingClientId: "Ajoute un Client ID pour générer l’URL.",
			copy: "Copier",
			copied: "Copié",
			open: "Ouvrir",
			selectAll: "Tout cocher",
			clear: "Vider",
			required: "Requis",
			optional: "Optionnel",
			enabled: "Activé",
			disabled: i18nText("Désactivé"),
			notApplicable: "Non applicable",
			selectedCount: (count: number) => `${count} permission${count > 1 ? "s" : ""}`,
			scopeHelp: {
				bot: "Ajoute le bot à un serveur.",
				"applications.commands": "Ajoute les commandes slash et contextuelles."
			} satisfies Record<ScopeKey, string>,
			publicBotWarning: "Si le bot n’est pas public, seul le propriétaire ou l’équipe de l’application pourra l’ajouter.",
			userWarning: "User Install doit être activé dans le Developer Portal. Les permissions serveur ne s’appliquent pas à ce mode.",
			adminWarning: "Administrator donne tous les droits. À réserver à un lab ou serveur personnel.",
			twoFaNote: "Certaines permissions sensibles peuvent nécessiter la 2FA du compte qui ajoute le bot sur un serveur avec 2FA obligatoire."
		}
		: {
			title: "Invitation",
			help: "Only generates the OAuth2 link used to invite or install the Discord application.",
			summaryTitle: "Summary",
			summaryHelp: "Quick view of the link that will be generated.",
			identityTitle: "OAuth2 identity",
			identityHelp: "The Application ID tells Discord which app to install.",
			clientIdSource: "Client ID source",
			clientIdAutomatic: "Automatic",
			clientIdManual: "Manual",
			clientIdMissing: "Required",
			clientIdAutomaticHelp: "Taken from the Application ID loaded in Botdeck.",
			clientIdManualHelp: "Manual value used to generate another link.",
			clientIdMissingHelp: "Enter the Discord Application ID to generate the link.",
			parametersTitle: "Included parameters",
			parametersHelp: "Preview of the parameters actually sent in the OAuth2 URL.",
			activeScopes: "Active scopes",
			integrationType: "Integration type",
			guildLock: "Locked server",
			developerTitle: "Developer Portal requirements",
			developerHelp: "Things to check in Discord if the invitation does not work.",
			guildInstallPortal: "Guild Install",
			guildInstallPortalHelp: "Enable it to install the bot in a server.",
			userInstallPortal: "User Install",
			userInstallPortalHelp: "Enable it for user installs.",
			publicBotPortal: "Public bot",
			publicBotPortalHelp: "Required for someone else to add the bot to their server.",
			toCheck: "Check",
			authorizationTitle: "Authorization",
			authorizationHelp: "Parameters sent in the Discord authorization URL.",
			scopesTitle: "OAuth2 scopes",
			scopesHelp: "Scopes included in the URL scope parameter.",
			permissionsTitle: "Server permissions",
			permissionsHelp: "Raw bot permissions for a server install. No permission is selected automatically.",
			technicalTitle: "Technical values",
			technicalHelp: "Values calculated from the selected permissions.",
			urlTitle: "Generated URL",
			urlHelp: "Link ready to copy or open in the browser.",
			clientId: "Client ID / Application ID",
			clientIdHelp: "Taken from the connected bot when available. You can replace it with the Application ID from the Developer Portal.",
			clientIdPlaceholder: "Ex: 123456789012345678",
			installType: "Install type",
			serverInstall: "Server",
			userInstall: "User",
			serverHelp: "Adds the bot to a server with server permissions.",
			userHelp: "Installs the app for a user for compatible User Install commands.",
			selectedGuild: "Preselected server",
			noGuild: "No forced server",
			disableGuildSelect: "Lock server choice",
			promptConsent: "Force authorization screen",
			permissionInteger: "Permission integer",
			permissionHex: "Hex",
			missingClientId: "Add a Client ID to generate the URL.",
			copy: "Copy",
			copied: "Copied",
			open: "Open",
			selectAll: "Select all",
			clear: "Clear",
			required: "Required",
			optional: "Optional",
			enabled: "Enabled",
			disabled: "Disabled",
			notApplicable: "Not applicable",
			selectedCount: (count: number) => `${count} permission${count > 1 ? "s" : ""}`,
			scopeHelp: {
				bot: "Adds the bot to a server.",
				"applications.commands": "Adds slash and context commands."
			} satisfies Record<ScopeKey, string>,
			publicBotWarning: "If the bot is not public, only the application owner or team can add it.",
			userWarning: "User Install must be enabled in the Developer Portal. Server permissions do not apply in this mode.",
			adminWarning: "Administrator grants every permission. Keep it for labs or personal servers.",
			twoFaNote: "Some sensitive permissions can require 2FA from the account adding the bot on a 2FA-required server."
		};
}

export function BotInviteBuilder({ bot, guilds, activeGuildId, language }: {
	bot: BotAccountSummary | null;
	guilds: GuildSummary[];
	activeGuildId: string | null;
	language: UiLanguage;
}) {
	const copy = copyInviteText(language);
	const [installTarget, setInstallTarget] = useState<InstallTarget>("server");
	const [clientIdOverride, setClientIdOverride] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<ScopeKey[]>(["bot", "applications.commands"]);
	const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([]);
	const [guildId, setGuildId] = useState(activeGuildId && activeGuildId !== "dm" ? activeGuildId : "");
	const [disableGuildSelect, setDisableGuildSelect] = useState(false);
	const [promptConsent, setPromptConsent] = useState(false);
	const [copied, setCopied] = useState(false);
	const clientId = clientIdOverride.trim() || bot?.discordUserId?.trim() || "";
	const selectedGuild = guilds.find((guild) => guild.id === guildId);
	const permissionValue = useMemo(() => calculatePermissionValue(selectedPermissions), [selectedPermissions]);
	const permissionHex = useMemo(() => formatPermissionHex(permissionValue), [permissionValue]);
	const inviteUrl = useMemo(() => {
		if (!clientId) return "";
		const url = new URL("https://discord.com/oauth2/authorize");
		const scopes = installTarget === "user"
			? ["applications.commands"]
			: selectedScopes.length ? selectedScopes : ["bot"];
		url.searchParams.set("client_id", clientId);
		url.searchParams.set("scope", scopes.join(" "));
		url.searchParams.set("integration_type", installTarget === "user" ? "1" : "0");
		if (installTarget === "server" && scopes.includes("bot")) {
			url.searchParams.set("permissions", permissionValue);
		}
		if (installTarget === "server" && guildId) {
			url.searchParams.set("guild_id", guildId);
			if (disableGuildSelect) url.searchParams.set("disable_guild_select", "true");
		}
		if (promptConsent) url.searchParams.set("prompt", "consent");
		return url.toString();
	}, [clientId, disableGuildSelect, guildId, installTarget, permissionValue, promptConsent, selectedScopes]);

	const activeScopes = useMemo(() => installTarget === "user"
		? ["applications.commands"]
		: selectedScopes.length ? selectedScopes : ["bot"], [installTarget, selectedScopes]);
	const clientIdSourceLabel = clientIdOverride.trim()
		? copy.clientIdManual
		: bot?.discordUserId?.trim() ? copy.clientIdAutomatic : copy.clientIdMissing;
	const clientIdSourceHelp = clientIdOverride.trim()
		? copy.clientIdManualHelp
		: bot?.discordUserId?.trim() ? copy.clientIdAutomaticHelp : copy.clientIdMissingHelp;
	const clientIdSourceBadge = clientId ? "discordSettingsBadge" : "discordMutedBadge";

	const selectedPermissionSet = useMemo(() => new Set(selectedPermissions), [selectedPermissions]);
	const selectedScopeSet = useMemo(() => new Set(selectedScopes), [selectedScopes]);
	const includesAdmin = selectedPermissionSet.has("administrator");
	const togglePermission = (key: PermissionKey) => {
		setSelectedPermissions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
	};
	const toggleScope = (scope: ScopeKey) => {
		if (installTarget === "server" && scope === "bot") return;
		setSelectedScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
	};
	const switchTarget = (target: InstallTarget) => {
		setInstallTarget(target);
		setCopied(false);
		if (target === "server") {
			setSelectedScopes((current) => uniqueScopes(["bot", "applications.commands", ...current.filter((scope) => scope !== "bot")]));
		} else {
			setSelectedScopes(["applications.commands"]);
			setDisableGuildSelect(false);
		}
	};
	const copyUrl = async () => {
		if (!inviteUrl || typeof navigator === "undefined") return;
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 1600);
	};

	return (
		<Panel className="serverSettingsFormSurface serverAutomationPanel botInviteSettingsPanel">
			<div className="discordSettingsBlockHeader">
				<h3>{copy.title}</h3>
				<p>{copy.help}</p>
			</div>

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.identityTitle}</h3>
					<p>{copy.identityHelp}</p>
				</div>
				<Card className="discordSettingsPanel botInviteFormPanel">
					<label className="settingsField botInviteClientField">
						<span>{copy.clientId}</span>
						<Input value={clientIdOverride} onChange={(event) => setClientIdOverride(event.target.value.replace(/[^0-9]/g, ""))} placeholder={bot?.discordUserId ?? copy.clientIdPlaceholder} inputMode="numeric" />
						<small>{copy.clientIdHelp}</small>
					</label>
					<div className="discordSettingsRow">
						<div>
							<strong>{copy.clientIdSource}</strong>
							<span>{clientIdSourceHelp}</span>
						</div>
						<Badge as="small" className={clientIdSourceBadge} tone="unstyled">{clientIdSourceLabel}</Badge>
					</div>
				</Card>
			</Section>

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.authorizationTitle}</h3>
					<p>{copy.authorizationHelp}</p>
				</div>
				<Card className="discordSettingsPanel">
					<div className="dashboardLabelRow">
						<span className="settingsBlockTitle">{copy.installType}</span>
						<small>{installTarget === "server" ? copy.serverHelp : copy.userHelp}</small>
					</div>
					<div className="settingsSegmented botInviteModeSwitch" role="group" aria-label={copy.installType}>
						<Button variant="unstyled" type="button" className={installTarget === "server" ? "isSelected" : ""} onClick={() => switchTarget("server")}>{copy.serverInstall}</Button>
						<Button variant="unstyled" type="button" className={installTarget === "user" ? "isSelected" : ""} onClick={() => switchTarget("user")}>{copy.userInstall}</Button>
					</div>

					{installTarget === "server" ? (
						<>
							<label className="settingsField">
								<span>{copy.selectedGuild}</span>
								<Select value={guildId} onChange={(event) => setGuildId(event.target.value)}>
									<option value="">{copy.noGuild}</option>
									{guilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}
								</Select>
								<small>{selectedGuild ? selectedGuild.id : copy.noGuild}</small>
							</label>
							<div className="discordSettingsRow">
								<div>
									<strong>{copy.disableGuildSelect}</strong>
									<span>{guildId ? selectedGuild?.name ?? guildId : copy.noGuild}</span>
								</div>
								<Button variant="unstyled" type="button" className={`discordToggle serverRolePermissionSwitch${guildId && disableGuildSelect ? " isAllowed" : ""}`} role="switch" aria-checked={Boolean(guildId && disableGuildSelect)} disabled={!guildId} onClick={() => setDisableGuildSelect((current) => !current)}>
									<span className="serverRolePermissionToggle" aria-hidden="true"><span /></span>
								</Button>
							</div>
						</>
					) : (
						<div className="discordSettingsRow">
							<div>
								<strong>{copy.userInstall}</strong>
								<span>{copy.userWarning}</span>
							</div>
							<Badge as="small" tone="muted">{i18nText("integration_type=1")}</Badge>
						</div>
					)}
					<div className="discordSettingsRow">
						<div>
							<strong>{copy.promptConsent}</strong>
							<span>{i18nText("prompt=consent")}</span>
						</div>
						<Button variant="unstyled" type="button" className={`discordToggle serverRolePermissionSwitch${promptConsent ? " isAllowed" : ""}`} role="switch" aria-checked={promptConsent} onClick={() => setPromptConsent((current) => !current)}>
							<span className="serverRolePermissionToggle" aria-hidden="true"><span /></span>
						</Button>
					</div>
				</Card>
			</Section>

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.scopesTitle}</h3>
					<p>{copy.scopesHelp}</p>
				</div>
				<Card className="discordSettingsPanel">
					{(["bot", "applications.commands"] as ScopeKey[]).map((scope) => {
						const disabled = installTarget === "user" || (installTarget === "server" && scope === "bot");
						const checked = installTarget === "user" ? scope === "applications.commands" : selectedScopeSet.has(scope);
						return (
							<div className="discordSettingsRow" key={scope}>
								<div>
									<strong>{scope}</strong>
									<span>{copy.scopeHelp[scope]}</span>
								</div>
								<Button variant="unstyled" type="button" className={`discordToggle serverRolePermissionSwitch${checked ? " isAllowed" : ""}`} role="switch" aria-checked={checked} disabled={disabled} onClick={() => toggleScope(scope)}>
									<span className="serverRolePermissionToggle" aria-hidden="true"><span /></span>
								</Button>
							</div>
						);
					})}
				</Card>
			</Section>

			{installTarget === "server" ? (
				<Section className="discordSettingsBlock">
					<div className="discordSettingsBlockHeader">
						<h3>{copy.permissionsTitle}</h3>
						<p>{copy.permissionsHelp}</p>
					</div>
					<Card className="discordSettingsPanel botInvitePermissionPanel">
						<div className="discordSettingsRow botInvitePermissionToolbar">
							<div>
								<strong>{copy.selectedCount(selectedPermissions.length)}</strong>
								<span>{permissionValue}</span>
							</div>
							<div className="botInviteUrlActions">
								<Button variant="secondary" type="button" onClick={() => setSelectedPermissions(permissionDefinitions.map((permission) => permission.key))}>{copy.selectAll}</Button>
								<Button variant="secondary" type="button" onClick={() => setSelectedPermissions([])}>{copy.clear}</Button>
							</div>
						</div>
						<div className="botInvitePermissionList">
							{permissionDefinitions.map((permission) => {
								const selected = selectedPermissionSet.has(permission.key);
								return (
									<Button variant="unstyled" key={permission.key} type="button" className={`botInvitePermissionRow${selected ? " isSelected" : ""}${permission.advanced ? " isAdvanced" : ""}`} onClick={() => togglePermission(permission.key)}>
										<span className="botInvitePermissionCheck" aria-hidden="true">{selected ? "✓" : ""}</span>
										<span>
											<strong>{labelFor(permission, language)}</strong>
											<small>{descriptionFor(permission, language)}</small>
										</span>
									</Button>
								);
							})}
						</div>
					</Card>
					{includesAdmin ? <p className="botInviteWarning">{copy.adminWarning}</p> : null}
					<p className="botInviteNotice">{copy.twoFaNote}</p>
				</Section>
			) : null}

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.parametersTitle}</h3>
					<p>{copy.parametersHelp}</p>
				</div>
				<Card className="discordSettingsPanel">
					<div className="discordSettingsRow">
						<div>
							<strong>{copy.activeScopes}</strong>
							<span>{activeScopes.join(" ")}</span>
						</div>
						<Badge as="small" tone="success">{i18nText("scope")}</Badge>
					</div>
					<div className="discordSettingsRow">
						<div>
							<strong>{copy.integrationType}</strong>
							<span>{installTarget === "user" ? i18nText("1 · User Install") : i18nText("0 · Guild Install")}</span>
						</div>
						<Badge as="small" tone="muted">{i18nText("integration_type")}</Badge>
					</div>
					<div className="discordSettingsRow">
						<div>
							<strong>{copy.guildLock}</strong>
							<span>{installTarget === "server" && guildId && disableGuildSelect ? selectedGuild?.name ?? guildId : copy.disabled}</span>
						</div>
						<Badge as="small" tone="muted">{i18nText("disable_guild_select")}</Badge>
					</div>
				</Card>
			</Section>

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.technicalTitle}</h3>
					<p>{copy.technicalHelp}</p>
				</div>
				<Card className="discordSettingsPanel botInviteTechnicalGrid">
					<label className="settingsField">
						<span>{copy.permissionInteger}</span>
						<Input value={installTarget === "server" ? permissionValue : "0"} readOnly />
					</label>
					<label className="settingsField">
						<span>{copy.permissionHex}</span>
						<Input value={installTarget === "server" ? permissionHex : "0x0000000000000000"} readOnly />
					</label>
				</Card>
			</Section>

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.developerTitle}</h3>
					<p>{copy.developerHelp}</p>
				</div>
				<Card className="discordSettingsPanel">
					<div className="discordSettingsRow">
						<div><strong>{copy.guildInstallPortal}</strong><span>{copy.guildInstallPortalHelp}</span></div>
						<Badge as="small" tone="muted">{copy.toCheck}</Badge>
					</div>
					<div className="discordSettingsRow">
						<div><strong>{copy.userInstallPortal}</strong><span>{copy.userInstallPortalHelp}</span></div>
						<Badge as="small" tone="muted">{copy.toCheck}</Badge>
					</div>
					<div className="discordSettingsRow">
						<div><strong>{copy.publicBotPortal}</strong><span>{copy.publicBotPortalHelp}</span></div>
						<Badge as="small" tone="muted">{copy.toCheck}</Badge>
					</div>
				</Card>
			</Section>

			<Section className="discordSettingsBlock">
				<div className="discordSettingsBlockHeader">
					<h3>{copy.urlTitle}</h3>
					<p>{copy.urlHelp}</p>
				</div>
				<Card className="discordSettingsPanel botInviteUrlPanel">
					<Textarea value={inviteUrl || copy.missingClientId} readOnly rows={4} />
					<div className="botInviteUrlActions">
						<Button variant="secondary" type="button" disabled={!inviteUrl} onClick={copyUrl}>{copied ? copy.copied : copy.copy}</Button>
						<Button type="button" disabled={!inviteUrl} onClick={() => inviteUrl && window.open(inviteUrl, "_blank", "noopener,noreferrer")}>{copy.open}</Button>
					</div>
					<p className="botInviteNotice">{copy.publicBotWarning}</p>
				</Card>
			</Section>
		</Panel>
	);
}
