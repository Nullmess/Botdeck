"use client";

import { Input } from "./field";
import { Modal } from "./modal";
// UI transverses: icônes, réglages


import {
	botAccountIsReadOnly,
	type BotAccountSummary,
	type ChannelSummary,
	type GuildSummary
} from "@botdeck/shared";
import { type ReactNode, useState } from "react";
import { i18nText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Card, Panel, Section } from "@/components/ui/panel";
import { Tabs, TabButton } from "@/components/ui/tabs";

import {
	ActivityChoice,
	ActivityPlatformChoice,
	BotSettingsState,
	UiLanguage,
	UiText
} from "@/features/workspace/core";
import { BotInviteBuilder } from "@/features/invite-builder/components/bot-invite-builder";
import { Badge } from "../ui/badge";

// Icône sourire.
export function SmileIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
			<path d="M8.4 10h.1" />
			<path d="M15.5 10h.1" />
			<path d="M8.5 14c.9 1.5 2 2.2 3.5 2.2s2.6-.7 3.5-2.2" />
			<path d="M18.5 3.5v3" />
			<path d="M17 5h3" />
		</svg>
	);
}

// Icône réponse.
export function ReplyIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="M10 7 5 12l5 5" />
			<path d="M6 12h8.5a5 5 0 0 1 5 5v1" />
		</svg>
	);
}

// Icône plus.
export function MoreIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="M6.5 12h.01" />
			<path d="M12 12h.01" />
			<path d="M17.5 12h.01" />
		</svg>
	);
}

// Icône salon type.
export function ChannelTypeIcon({ type }: { type: ChannelSummary["type"] }) {
	if (type === "voice") {
		return (
			<span className="channelTypeIcon channelTypeIconVoice" aria-hidden="true">
				<svg className="channelTypeIconGlyph" viewBox="0 0 24 24" focusable="false">
					<path d="M4 9.25v5.5h3.9l5.1 4.1V5.15l-5.1 4.1H4Z" fill="currentColor" />
					<path d="M16.1 8.4a5 5 0 0 1 0 7.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
					<path d="M18.9 5.8a9 9 0 0 1 0 12.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
				</svg>
			</span>
		);
	}
	if (type === "forum") {
		return <span className="channelTypeIcon channelTypeIconForum" aria-hidden="true" />;
	}
	if (type === "thread") {
		return <span className="channelTypeIcon channelTypeIconThread" aria-hidden="true" />;
	}
	return (
		<span className="channelTypeIcon channelTypeIconText" aria-hidden="true">
			#
		</span>
	);
}

// Icône contrôle.
export function ControlIcon({ children }: { children: ReactNode }) {
	return (
		<svg className="controlSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			{children}
		</svg>
	);
}

// Icône réglages.
export function SettingsIcon() {
	return (
		<ControlIcon>
			<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
			<path d="m19.4 15.1-1.1.6.1 1.3a1.7 1.7 0 0 1-2.4 1.8l-1.2-.5-1 .8a1.7 1.7 0 0 1-2.8 0l-1-.8-1.2.5A1.7 1.7 0 0 1 6.4 17l.1-1.3-1.1-.6a1.7 1.7 0 0 1 0-3l1.1-.6-.1-1.3a1.7 1.7 0 0 1 2.4-1.8l1.2.5 1-.8a1.7 1.7 0 0 1 2.8 0l1 .8 1.2-.5a1.7 1.7 0 0 1 2.4 1.8l-.1 1.3 1.1.6a1.7 1.7 0 0 1 0 3Z" />
		</ControlIcon>
	);
}

// Modale bot réglages.
export function BotSettingsModal({
	settings,
	dirty,
	onChange,
	onCancelChanges,
	onClose,
	onApply,
	language,
	text,
	bot,
	guilds,
	activeGuildId
}: {
	settings: BotSettingsState;
	dirty: boolean;
	onChange: (settings: BotSettingsState) => void;
	onCancelChanges: () => void;
	onClose: () => void;
	onApply: () => void;
	language: UiLanguage;
	text: UiText;
	bot: BotAccountSummary | null;
	guilds: GuildSummary[];
	activeGuildId: string | null;
}) {
	const patchSettings = (patch: Partial<BotSettingsState>) => onChange({ ...settings, ...patch });
	const activityTypeOrder: ActivityChoice[] = ["playing", "streaming", "listening", "watching", "competing"];
	const streamingPlatforms: ActivityPlatformChoice[] = ["twitch", "youtube", "customUrl"];
	const isFrench = language === "fr";
	const [tab, setTab] = useState<"info" | "activity" | "invitation" | "interface">("info");
	const copy = isFrench
		? {
			pageTitle: "Paramètres du bot",
			pageSubtitle: "Configuration utile pour un bot Discord.js. Les options impossibles ou trompeuses sont volontairement retirées.",
			noBotTitle: "Botdeck",
			infoTab: "Infos bot",
			activityTab: "Activité",
			invitationTab: "Invitation",
			interfaceTab: "Interface",
			infoTitle: "Infos bot",
			infoHelp: "Résumé du bot courant et données techniques utiles.",
			summaryTitle: "Résumé",
			summaryHelp: "État rapide du bot connecté à ce workspace.",
			identityTitle: "Identité",
			identityHelp: "Données techniques utiles pour relier le bot aux réglages Botdeck et Discord.",
			stateTitle: "État",
			stateHelp: "Dernière connexion et erreur éventuelle.",
			connectedStatus: "État du bot",
			localName: "Nom local",
			botdeckId: "ID Botdeck",
			applicationId: "Application ID",
			knownServers: "Serveurs connus",
			slashStudioStatus: "Mode de gestion",
			lastConnection: "Dernière connexion",
			lastError: "Dernière erreur",
			enabledLabel: "Activé",
			disabledLabel: "Lecture seule",
			unknownValue: "Non renseigné",
			neverConnected: "Jamais connecté",
			noError: "Aucune erreur récente",
			activityTitle: "Activité Discord",
			activityHelp: "Présence affichée par le bot dans Discord.",
			activityHeroTitle: "Activité",
			activityHeroHelp: "Présence Discord visible dans la liste des membres et sur le profil du bot.",
			activityRowTitle: "Activité du bot",
			activityRowHelp: "Affiche une activité dans la liste des membres et sur le profil du bot.",
			activityTypeHelp: "Un bot Discord.js peut publier une activité à la fois.",
			activityNamePlaceholder: "Botdeck",
			activityStatePlaceholder: "Support, modération, tickets...",
			fieldRequired: "Obligatoire si l'activité est activée.",
			streamSource: "Source du stream",
			streamSourceHelp: "Discord accepte surtout Twitch/YouTube pour le type Stream.",
			streamUrlPlaceholder: "https://twitch.tv/tonlive",
			apiTitle: "Mode lecture seule et API",
			apiHelp: "Raccourcis de lecture pour comprendre ce qui dépend de Discord Developer Portal, du code du bot ou du mode lecture seule.",
			slashCommands: "Commandes slash",
			slashCommandsHelp: "Déclarées côté bot. En mode lecture seule, Botdeck les affiche seulement et ne répond pas aux interactions.",
			intents: "Intents et permissions",
			intentsHelp: "À configurer dans le Developer Portal Discord et dans le code du bot, pas dans ce panneau local.",
			tokenSecurity: "Token du bot",
			tokenSecurityHelp: "Stocké et géré par Botdeck au moment de l'ajout du bot. Il n'est pas réaffiché ici.",
			interfaceTitle: "Interface Botdeck",
			interfaceHelp: "Préférences locales qui changent uniquement l'affichage du dashboard.",
			interfaceHeroTitle: "Interface",
			interfaceHeroHelp: "Réglages locaux qui changent seulement l’expérience Botdeck, sans modifier Discord.",
			compactDescription: "Réduit l'espace vertical des messages dans Botdeck.",
			performanceTitle: "Mode performance",
			performanceDescription: "Réduit l'historique affiché, charge moins de messages par salon et limite les calculs coûteux.",
			managedBadge: "Géré ailleurs",
			localBadge: "Local",
			readOnlyBadge: "Lecture seule"
		}
		: {
			pageTitle: "Bot settings",
			pageSubtitle: "Useful Discord.js bot configuration. Impossible or misleading options are intentionally removed.",
			noBotTitle: "Botdeck",
			infoTab: "Bot info",
			activityTab: "Activity",
			invitationTab: "Invitation",
			interfaceTab: "Interface",
			infoTitle: "Bot info",
			infoHelp: "Summary of the current bot and useful technical data.",
			summaryTitle: "Summary",
			summaryHelp: "Quick status of the bot connected to this workspace.",
			identityTitle: "Identity",
			identityHelp: "Technical data used to connect the bot with Botdeck and Discord settings.",
			stateTitle: "State",
			stateHelp: "Last connection and possible recent error.",
			connectedStatus: "Bot status",
			localName: "Local name",
			botdeckId: "Botdeck ID",
			applicationId: "Application ID",
			knownServers: "Known servers",
			slashStudioStatus: "Management mode",
			lastConnection: "Last connection",
			lastError: "Last error",
			enabledLabel: "Enabled",
			disabledLabel: "Read-only",
			unknownValue: "Not available",
			neverConnected: "Never connected",
			noError: "No recent error",
			activityTitle: "Discord activity",
			activityHelp: "Presence displayed by the bot inside Discord.",
			activityHeroTitle: "Activity",
			activityHeroHelp: "Discord presence shown in member lists and on the bot profile.",
			activityRowTitle: "Bot activity",
			activityRowHelp: "Shows an activity in member lists and on the bot profile.",
			activityTypeHelp: "A Discord.js bot can publish one activity at a time.",
			activityNamePlaceholder: "Botdeck",
			activityStatePlaceholder: "Support, moderation, tickets...",
			fieldRequired: "Required when activity is enabled.",
			streamSource: "Stream source",
			streamSourceHelp: "Discord mostly accepts Twitch/YouTube for Streaming activities.",
			streamUrlPlaceholder: "https://twitch.tv/yourlive",
			apiTitle: "Read-only mode and API",
			apiHelp: "Read-only guidance for what depends on the Discord Developer Portal or bot code.",
			slashCommands: "Slash commands",
			slashCommandsHelp: "Declared by the bot. In read-only mode, Botdeck only displays them and does not answer interactions.",
			intents: "Intents and permissions",
			intentsHelp: "Configured in the Discord Developer Portal and in bot code, not in this local panel.",
			tokenSecurity: "Bot token",
			tokenSecurityHelp: "Stored and managed by Botdeck when the bot is added. It is not shown again here.",
			interfaceTitle: "Botdeck interface",
			interfaceHelp: "Local preferences that only affect dashboard display.",
			interfaceHeroTitle: "Interface",
			interfaceHeroHelp: "Local settings that only change the Botdeck experience without changing Discord.",
			compactDescription: "Reduces vertical spacing between Botdeck messages.",
			performanceTitle: "Performance mode",
			performanceDescription: "Shows less history, loads fewer messages per channel and limits expensive UI calculations.",
			managedBadge: "Managed elsewhere",
			localBadge: "Local",
			readOnlyBadge: "Read-only"
		};

	const botInitial = (bot?.name || copy.noBotTitle).slice(0, 1).toUpperCase();
	const formatDateTime = (value?: string | null) => {
		if (!value) return copy.neverConnected;
		try {
			return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
		} catch {
			return value;
		}
	};
	const statusLabel = bot?.status ?? "offline";
	const statusClassName = bot?.status === "online" ? "discordSettingsBadge" : bot?.status === "error" ? "discordDangerBadge" : "discordMutedBadge";
	const slashStudioLabel = botAccountIsReadOnly(bot) ? copy.disabledLabel : copy.enabledLabel;
	const slashStudioClassName = botAccountIsReadOnly(bot) ? "discordMutedBadge" : "discordSettingsBadge";

	return (
		<Modal as="aside" backdropClassName="serverSettingsBackdrop" surfaceClassName="serverSettingsPanel" aria-label={text.botSettings} onClose={onClose}>
				<header className="serverSettingsHeader">
					<div className="serverSettingsIdentity">
						<div className="serverSettingsIcon botSettingsAvatar" aria-hidden="true">
							{bot?.avatarUrl ? <img src={bot.avatarUrl} alt="" /> : botInitial}
						</div>
						<div>
							<p className="eyebrow">{copy.pageTitle}</p>
							<h2>{bot?.name ?? copy.noBotTitle}</h2>
						</div>
					</div>
					<Button variant="icon" className="panelCloseButton" type="button" onClick={onClose} aria-label={text.close}>×</Button>
				</header>

				<div className="serverSettingsBody">
					<Tabs as="nav" className="serverSettingsNav" aria-label={copy.pageTitle}>
							<TabButton active={tab === "info"} type="button" onClick={() => setTab("info")}>{copy.infoTab}</TabButton>
							<TabButton active={tab === "activity"} type="button" onClick={() => setTab("activity")}>{copy.activityTab}</TabButton>
							<TabButton active={tab === "invitation"} type="button" onClick={() => setTab("invitation")}>{copy.invitationTab}</TabButton>
							<TabButton active={tab === "interface"} type="button" onClick={() => setTab("interface")}>{copy.interfaceTab}</TabButton>
						</Tabs>

						<section className="serverSettingsContent">
							{tab === "info" ? (
								<Panel className="serverSettingsFormSurface isProfileEditor serverInfoPanel">
									<div className="serverInfoHero">
										<div className="serverInfoIcon botSettingsAvatar" aria-hidden="true">
											{bot?.avatarUrl ? <img src={bot.avatarUrl} alt="" /> : botInitial}
										</div>
										<div>
											<h3>{copy.infoTitle}</h3>
											<p>{copy.infoHelp}</p>
										</div>
									</div>

									<Section className="discordSettingsBlock">
										<div className="discordSettingsBlockHeader">
											<h3>{copy.summaryTitle}</h3>
											<p>{copy.summaryHelp}</p>
										</div>
										<Card className="discordSettingsPanel">
											<div className="discordSettingsRow">
												<div>
													<strong>{copy.connectedStatus}</strong>
													<span>{bot?.enabled ? copy.enabledLabel : copy.disabledLabel}</span>
												</div>
												<Badge as="small" className={statusClassName} tone="unstyled">{statusLabel}</Badge>
											</div>
											<div className="discordSettingsRow">
												<div>
													<strong>{copy.knownServers}</strong>
													<span>{guilds.length}</span>
												</div>
												<Badge as="small" tone="muted">{i18nText("guilds")}</Badge>
											</div>
											<div className="discordSettingsRow">
												<div>
													<strong>{copy.slashStudioStatus}</strong>
													<span>{slashStudioLabel}</span>
												</div>
												<Badge as="small" className={slashStudioClassName} tone="unstyled">{"{/}"}</Badge>
											</div>
										</Card>
									</Section>

									<Section className="discordSettingsBlock">
										<div className="discordSettingsBlockHeader">
											<h3>{copy.identityTitle}</h3>
											<p>{copy.identityHelp}</p>
										</div>
										<Card className="discordSettingsPanel">
											<div className="discordSettingsRow"><div><strong>{copy.localName}</strong><span>{bot?.name ?? copy.noBotTitle}</span></div><Badge as="small" tone="muted">{i18nText("local")}</Badge></div>
											<div className="discordSettingsRow"><div><strong>{copy.botdeckId}</strong><span>{bot?.id ?? copy.unknownValue}</span></div><Badge as="small" tone="muted">{i18nText("Botdeck")}</Badge></div>
											<div className="discordSettingsRow"><div><strong>{copy.applicationId}</strong><span>{bot?.discordUserId ?? copy.unknownValue}</span></div><Badge as="small" tone="success">{i18nText("Discord")}</Badge></div>
										</Card>
									</Section>

									<Section className="discordSettingsBlock">
										<div className="discordSettingsBlockHeader">
											<h3>{copy.stateTitle}</h3>
											<p>{copy.stateHelp}</p>
										</div>
										<Card className="discordSettingsPanel">
											<div className="discordSettingsRow"><div><strong>{copy.lastConnection}</strong><span>{formatDateTime(bot?.lastConnectedAt)}</span></div><Badge as="small" tone="muted">{i18nText("time")}</Badge></div>
											<div className="discordSettingsRow"><div><strong>{copy.lastError}</strong><span>{bot?.lastError || copy.noError}</span></div><Badge as="small" className={bot?.lastError ? "discordDangerBadge" : "discordSettingsBadge"} tone="unstyled">{bot?.lastError ? "error" : "ok"}</Badge></div>
										</Card>
									</Section>

									<Section className="discordSettingsBlock">
										<div className="discordSettingsBlockHeader">
											<h3>{copy.apiTitle}</h3>
											<p>{copy.apiHelp}</p>
										</div>
										<Card className="discordSettingsPanel">
											<div className="discordSettingsRow">
												<div>
													<strong>{copy.slashCommands}</strong>
													<span>{copy.slashCommandsHelp}</span>
												</div>
												<Badge as="em" tone="success">{"{/}"}</Badge>
											</div>
											<div className="discordSettingsRow">
												<div>
													<strong>{copy.intents}</strong>
													<span>{copy.intentsHelp}</span>
												</div>
												<Badge as="small" tone="muted">{copy.managedBadge}</Badge>
											</div>
											<div className="discordSettingsRow">
												<div>
													<strong>{copy.tokenSecurity}</strong>
													<span>{copy.tokenSecurityHelp}</span>
												</div>
												<Badge as="small" tone="muted">{copy.readOnlyBadge}</Badge>
											</div>
										</Card>
									</Section>
								</Panel>
							) : null}

							{tab === "activity" ? (
								<Panel className="serverSettingsFormSurface serverAutomationPanel">
									<div className="discordSettingsBlockHeader">
										<h3>{copy.activityTitle}</h3>
										<p>{copy.activityHelp}</p>
									</div>

									<Card className="discordSettingsPanel">
										<div className="discordSettingsRow discordSettingsRowTop">
											<div>
												<strong>{copy.activityRowTitle}</strong>
												<span>{copy.activityRowHelp}</span>
											</div>
											<Button variant="unstyled"
												type="button"
												className={`discordToggle serverRolePermissionSwitch${settings.activityEnabled ? " isAllowed" : ""}`}
												role="switch"
												aria-checked={settings.activityEnabled}
												aria-label={copy.activityRowTitle}
												onClick={() => patchSettings({ activityEnabled: !settings.activityEnabled })}
											>
												<span className="serverRolePermissionToggle" aria-hidden="true"><span /></span>
											</Button>
										</div>

										<div className={`discordSettingsFormWrap${settings.activityEnabled ? " isOpen" : ""}`} aria-hidden={!settings.activityEnabled}>
											<div className="discordSettingsForm">
												<div className="dashboardLabelRow">
													<span className="settingsBlockTitle">{text.activityType}</span>
													<small>{copy.activityTypeHelp}</small>
												</div>
												<div className="settingsSegmented discordActivityTypes" role="group" aria-label={text.activityType}>
													{activityTypeOrder.map((choice) => (
														<Button key={choice} variant="ghost" type="button" className={settings.activityType === choice ? "isSelected" : ""} onClick={() => patchSettings({ activityType: choice, activityPlatform: choice === "streaming" ? settings.activityPlatform === "none" ? "twitch" : settings.activityPlatform : "none" })}>
											{text.activityLabels[choice]}
										</Button>
													))}
												</div>

												<div className="discordFormGrid">
													<label className="settingsField">
														<span>{text.activityText}</span>
														<Input value={settings.activityName} maxLength={128} onChange={(event) => patchSettings({ activityName: event.target.value })} placeholder={copy.activityNamePlaceholder} />
														<small>{copy.fieldRequired}</small>
													</label>
													<label className="settingsField">
														<span>{text.activityState}</span>
														<Input value={settings.activityState} maxLength={128} onChange={(event) => patchSettings({ activityState: event.target.value })} placeholder={copy.activityStatePlaceholder} />
													</label>
												</div>

												{settings.activityType === "streaming" ? (
													<div className="discordStreamSettings">
														<div className="dashboardLabelRow">
															<span className="settingsBlockTitle">{copy.streamSource}</span>
															<small>{copy.streamSourceHelp}</small>
														</div>
														<div className="settingsSegmented discordStreamSources" role="group" aria-label={copy.streamSource}>
															{streamingPlatforms.map((choice) => (
																<Button key={choice} variant="ghost" type="button" className={settings.activityPlatform === choice ? "isSelected" : ""} onClick={() => patchSettings({ activityPlatform: choice })}>
													{text.platformLabels[choice]}
												</Button>
															))}
														</div>
														<label className="settingsField">
															<span>{text.streamingLink}</span>
															<Input value={settings.activityUrl} onChange={(event) => patchSettings({ activityUrl: event.target.value })} placeholder={copy.streamUrlPlaceholder} />
														</label>
													</div>
												) : null}
											</div>
										</div>
									</Card>
								</Panel>
							) : null}

							{tab === "invitation" ? <BotInviteBuilder bot={bot} guilds={guilds} activeGuildId={activeGuildId} language={language} /> : null}

							{tab === "interface" ? (
								<Panel className="serverSettingsFormSurface serverAutomationPanel">
									<div className="discordSettingsBlockHeader">
										<h3>{copy.interfaceTitle}</h3>
										<p>{copy.interfaceHelp}</p>
									</div>
									<Card className="discordSettingsPanel">
										<div className="discordSettingsRow discordSettingsRowTop discordCompactRow">
											<div>
												<strong>{text.compactMessages}</strong>
												<span>{copy.compactDescription}</span>
												<Badge as="small" tone="muted">{copy.localBadge}</Badge>
											</div>
											<Button variant="unstyled"
												type="button"
												className={`discordToggle serverRolePermissionSwitch${settings.compactMessages ? " isAllowed" : ""}`}
												role="switch"
												aria-checked={settings.compactMessages}
												aria-label={text.compactMessages}
												onClick={() => patchSettings({ compactMessages: !settings.compactMessages })}
											>
												<span className="serverRolePermissionToggle" aria-hidden="true"><span /></span>
											</Button>
										</div>

										<div className="discordSettingsRow discordSettingsRowTop discordCompactRow">
											<div>
												<strong>{copy.performanceTitle}</strong>
												<span>{copy.performanceDescription}</span>
												<Badge as="small" tone="muted">{copy.localBadge}</Badge>
											</div>
											<Button variant="unstyled"
												type="button"
												className={`discordToggle serverRolePermissionSwitch${settings.performanceMode ? " isAllowed" : ""}`}
												role="switch"
												aria-checked={settings.performanceMode}
												aria-label={copy.performanceTitle}
												onClick={() => patchSettings({ performanceMode: !settings.performanceMode })}
											>
												<span className="serverRolePermissionToggle" aria-hidden="true"><span /></span>
											</Button>
										</div>
									</Card>
								</Panel>
							) : null}

						</section>
					</div>

				<div className={`settingsSaveBar serverSettingsSaveNotice serverSettingsFloatingSaveBar${dirty ? " isVisible" : ""}`} aria-hidden={!dirty}>
					<span>{text.unsavedChanges}</span>
					<Button variant="secondary" className="settingsCancelButton" type="button" onClick={onCancelChanges}>
						{text.cancel}
					</Button>
					<Button variant="primary" className="settingsSaveButton" type="button" onClick={onApply}>
						{text.save}
					</Button>
				</div>
		</Modal>
	);
}

// Squelette espace de travail.
export function WorkspaceSkeleton({ variant }: { variant: "workspace" | "channels" | "voice" }) {
	if (variant === "workspace") {
		return (
			<article className="workspaceSkeleton">
				<div className="workspaceSkeletonHead">
					<span className="skeletonLine skeletonLineWide" />
					<span className="skeletonLine skeletonLineShort" />
				</div>
				<div className="workspaceSkeletonCard">
					<span className="skeletonLine skeletonLineWide" />
					<span className="skeletonLine" />
					<span className="skeletonLine skeletonLineMedium" />
				</div>
				<div className="workspaceSkeletonMessages">
					<div className="workspaceSkeletonRow">
						<span className="skeletonAvatar" />
						<div>
							<span className="skeletonLine skeletonLineWide" />
							<span className="skeletonLine skeletonLineMedium" />
						</div>
					</div>
					<div className="workspaceSkeletonRow">
						<span className="skeletonAvatar" />
						<div>
							<span className="skeletonLine skeletonLineWide" />
							<span className="skeletonLine skeletonLineShort" />
						</div>
					</div>
				</div>
			</article>
		);
	}

	return (
		<div className={`channelLoading channelLoadingSkeleton ${variant === "voice" ? "isVoice" : ""}`}>
			<span className="skeletonLine skeletonLineWide" />
			<span className="skeletonLine skeletonLineMedium" />
			<span className="skeletonLine skeletonLineShort" />
		</div>
	);
}

// Squelette messages salon.
export function ChannelMessagesSkeleton() {
	return (
		<div className="messageSkeletonStack" aria-label={i18nText("Loading channel messages")}>
			<div className="workspaceSkeletonRow">
				<span className="skeletonAvatar" />
				<div>
					<span className="skeletonLine skeletonLineMedium" />
					<span className="skeletonLine skeletonLineWide" />
				</div>
			</div>
			<div className="workspaceSkeletonRow">
				<span className="skeletonAvatar" />
				<div>
					<span className="skeletonLine skeletonLineShort" />
					<span className="skeletonLine skeletonLineMedium" />
				</div>
			</div>
		</div>
	);
}
