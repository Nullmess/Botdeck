"use client";

import type { BotAccountSummary } from "@botdeck/shared";
import type { ReactNode } from "react";
import { stripDiscriminator, type UiLanguage, type UiText } from "@/features/workspace/core";
import { BotLauncher, FirstLaunchPresentation, LoadingScreen } from "@/features/workspace/components/botdeck-launcher-views";
import { ConfirmDeleteModal, ToastStack } from "@/components/botdeck-app-widgets";
import { TransitionOverlay } from "@/components/botdeck-shell-panels";
import type { AppToast } from "@/features/workspace/core";

type BotdeckAppStartupViewProps = {
	mode: "loading" | "firstLaunch" | "launcher";
	bots?: BotAccountSummary[];
	text: UiText;
	language: UiLanguage;
	toasts: AppToast[];
	botModal: ReactNode;
	externalLinkModal: ReactNode;
	projectInfoModal: ReactNode;
	tlsSettingsModal: ReactNode;
	switchingBotId?: string | null;
	transitionBot?: BotAccountSummary | null;
	entryOverlayClosing?: boolean;
	botDeleteTarget?: BotAccountSummary | null;
	botDeleteBusy?: boolean;
	onSelectBot?: (botId: string) => void;
	onOpenAddBot?: () => void;
	onRemoveBot?: (bot: BotAccountSummary) => void;
	onOpenProjectInfo?: () => void;
	onOpenTlsSettings?: () => void;
	onLanguageChange?: (language: UiLanguage) => void;
	onCloseFirstLaunch?: () => void;
	onExternalLink?: (url: string, label?: string) => void;
	onCancelDeleteBot?: () => void;
	onConfirmDeleteBot?: () => void;
};

export function BotdeckAppStartupView({
	mode,
	bots = [],
	text,
	language,
	toasts,
	botModal,
	externalLinkModal,
	projectInfoModal,
	tlsSettingsModal,
	switchingBotId = null,
	transitionBot = null,
	entryOverlayClosing = false,
	botDeleteTarget = null,
	botDeleteBusy = false,
	onSelectBot,
	onOpenAddBot,
	onRemoveBot,
	onOpenProjectInfo,
	onOpenTlsSettings,
	onLanguageChange,
	onCloseFirstLaunch,
	onExternalLink,
	onCancelDeleteBot,
	onConfirmDeleteBot
}: BotdeckAppStartupViewProps) {
	if (mode === "loading") {
		return (
			<>
				<LoadingScreen text={text} />
				{botModal}
				{externalLinkModal}
				{projectInfoModal}
				{tlsSettingsModal}
			</>
		);
	}

	if (mode === "firstLaunch") {
		return (
			<>
				<FirstLaunchPresentation language={language} onLanguageChange={onLanguageChange ?? (() => undefined)} onClose={onCloseFirstLaunch ?? (() => undefined)} onExternalLink={onExternalLink ?? (() => undefined)} />
				{botModal}
				{externalLinkModal}
				{projectInfoModal}
				{tlsSettingsModal}
				<ToastStack toasts={toasts} />
			</>
		);
	}

	return (
		<>
			<BotLauncher
				bots={bots}
				onSelectBot={onSelectBot ?? (() => undefined)}
				onOpenAddBot={onOpenAddBot ?? (() => undefined)}
				onRemoveBot={onRemoveBot ?? (() => undefined)}
				onOpenProjectInfo={onOpenProjectInfo ?? (() => undefined)}
				onOpenTlsSettings={onOpenTlsSettings ?? (() => undefined)}
				language={language}
				onLanguageChange={onLanguageChange ?? (() => undefined)}
				text={text}
			/>
			{botModal}
			{externalLinkModal}
			{projectInfoModal}
			{tlsSettingsModal}
			<ToastStack toasts={toasts} />
			{switchingBotId ? <TransitionOverlay bot={transitionBot} fallbackName={text.loadingServers} closing={entryOverlayClosing} text={text} /> : null}
			{botDeleteTarget ? (
				<ConfirmDeleteModal
					botName={stripDiscriminator(botDeleteTarget.name)}
					loading={botDeleteBusy}
					text={text}
					onCancel={() => {
						if (!botDeleteBusy) onCancelDeleteBot?.();
					}}
					onConfirm={onConfirmDeleteBot ?? (() => undefined)}
				/>
			) : null}
		</>
	);
}
