"use client";

import type { Dispatch, SetStateAction } from "react";
import type { BotAccountSummary } from "@botdeck/shared";
import {
	AppBadge,
	BotCustomStatusState,
	BotSettingsState,
	PresenceChoice,
	dmGuildId,
	formatBotCustomStatus,
	presenceLabels,
	readBotSettings,
	stripDiscriminator,
	type UiLanguage,
	type UiText
} from "@/features/workspace/core";
import { SettingsIcon } from "@/components/botdeck-app-widgets";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";

type BotdeckUserPanelProps = {
	activeBot: BotAccountSummary | null;
	activeBotId: string | null;
	activeBotUserId: string | null;
	activeGuildId: string | null;
	botCustomStatus: BotCustomStatusState;
	language: UiLanguage;
	open: boolean;
	presenceStatus: PresenceChoice;
	setBotSettings: Dispatch<SetStateAction<BotSettingsState>>;
	setOpen: Dispatch<SetStateAction<boolean>>;
	setSettingsDirty: Dispatch<SetStateAction<boolean>>;
	setSettingsOpen: Dispatch<SetStateAction<boolean>>;
	text: UiText;
	onOpenMemberProfile: (guildId: string | null, userId: string) => void;
	onUpdatePresence: (nextStatus: PresenceChoice) => void;
};

export function BotdeckUserPanel({
	activeBot,
	activeBotId,
	activeBotUserId,
	activeGuildId,
	botCustomStatus,
	language,
	open,
	presenceStatus,
	setBotSettings,
	setOpen,
	setSettingsDirty,
	setSettingsOpen,
	text,
	onOpenMemberProfile,
	onUpdatePresence
}: BotdeckUserPanelProps) {
	return (
		<Panel as="footer" className="userPanel">
			<Button variant="icon" className="userAvatarButton" type="button" aria-label={presenceLabels[language][presenceStatus]} onClick={() => setOpen((current) => !current)}>
				<span className="userAvatarWrap">
					{activeBot?.avatarUrl ? <img className="userAvatarImage" src={activeBot.avatarUrl} alt="" aria-hidden="true" /> : <span>{stripDiscriminator(activeBot?.name ?? "Bot").slice(0, 1).toUpperCase()}</span>}
					<span className={`presenceDot ${presenceStatus}`} />
				</span>
			</Button>
			<Button variant="ghost" className="userIdentity" type="button" onClick={() => {
				setOpen(false);
				if (activeBotUserId) onOpenMemberProfile(activeGuildId && activeGuildId !== dmGuildId ? activeGuildId : dmGuildId, activeBotUserId);
			}}>
				<span className="userText">
					<span className="userNameLine">
						<strong>{stripDiscriminator(activeBot?.name ?? "Bot")}</strong>
						<AppBadge />
					</span>
					<small>{formatBotCustomStatus(botCustomStatus) || presenceLabels[language][presenceStatus]}</small>
				</span>
			</Button>
			<div className="userControls" aria-label={text.botControls}>
				<Button
					variant="icon"
					className="userControlButton"
					type="button"
					aria-label={text.botSettings}
					title={text.botSettings}
					onClick={() => {
						if (activeBotId) setBotSettings(readBotSettings(activeBotId));
						setSettingsDirty(false);
						setSettingsOpen(true);
					}}
				>
					<SettingsIcon />
				</Button>
			</div>
			{open ? (
				<div className="presenceMenu" role="menu">
					{(["online", "idle", "dnd", "offline"] as PresenceChoice[]).map((choice) => (
						<Button key={choice} variant="ghost" type="button" role="menuitem" className={presenceStatus === choice ? "isSelected" : ""} onClick={() => onUpdatePresence(choice)}>
							<span className={`presenceDot ${choice}`} />
							<span>{presenceLabels[language][choice]}</span>
						</Button>
					))}
				</div>
			) : null}
		</Panel>
	);
}
