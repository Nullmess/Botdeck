"use client";

import type { BotAccountSummary } from "@botdeck/shared";
import { useState, type FormEvent, type ReactNode, type RefObject, type TransitionStartFunction } from "react";
import type { AppToast, UiText } from "@/features/workspace/core";
import { fetchJson } from "@/features/workspace/core";
import { BotTokenModal } from "@/components/botdeck-shell-panels";

type UseAddBotModalOptions = {
	text: UiText;
	visibleBots: BotAccountSummary[];
	botEntryStartedAtRef: RefObject<number>;
	startNavTransition: TransitionStartFunction;
	setSwitchingBotSnapshot: (bot: BotAccountSummary | null) => void;
	setEntryOverlayClosing: (closing: boolean) => void;
	setSwitchingBotId: (botId: string | null) => void;
	setSelectedBotId: (botId: string | null) => void;
	setBotdeckHomeOpen: (open: boolean) => void;
	setSelectedGuildId: (guildId: string | null) => void;
	setSelectedChannelId: (channelId: string | null) => void;
	setSyncingChannelId: (channelId: string | null) => void;
	pushToast: (message: string, tone: AppToast["tone"]) => void;
	refreshBootstrap: (preferredBotId?: string | null) => Promise<unknown>;
	promptExternalLink: (url: string, label?: string) => void;
};

type UseAddBotModalResult = {
	botModal: ReactNode;
	openAddBot: () => void;
};

export function useAddBotModal({
	text,
	visibleBots,
	botEntryStartedAtRef,
	startNavTransition,
	setSwitchingBotSnapshot,
	setEntryOverlayClosing,
	setSwitchingBotId,
	setSelectedBotId,
	setBotdeckHomeOpen,
	setSelectedGuildId,
	setSelectedChannelId,
	setSyncingChannelId,
	pushToast,
	refreshBootstrap,
	promptExternalLink
}: UseAddBotModalOptions): UseAddBotModalResult {
	const [botToken, setBotToken] = useState("");
	const [botReadOnlyMode, setBotReadOnlyMode] = useState(false);
	const [botReadOnlyBlockMessages, setBotReadOnlyBlockMessages] = useState(false);
	const [botReadOnlyBlockChannels, setBotReadOnlyBlockChannels] = useState(false);
	const [botReadOnlyBlockModeration, setBotReadOnlyBlockModeration] = useState(false);
	const [showAddBot, setShowAddBot] = useState(false);
	const [botModalClosing, setBotModalClosing] = useState(false);
	const [botAdding, setBotAdding] = useState(false);
	const [botModalError, setBotModalError] = useState<string | null>(null);

	const resetReadOnlyOptions = () => {
		setBotReadOnlyMode(false);
		setBotReadOnlyBlockMessages(false);
		setBotReadOnlyBlockChannels(false);
		setBotReadOnlyBlockModeration(false);
	};

	function closeBotModal(animated = false) {
		if (!showAddBot) return;
		setBotModalError(null);
		if (!animated) {
			setBotModalClosing(false);
			setShowAddBot(false);
			resetReadOnlyOptions();
			return;
		}
		setBotModalClosing(true);
		window.setTimeout(() => {
			setShowAddBot(false);
			setBotModalClosing(false);
			setBotAdding(false);
			resetReadOnlyOptions();
		}, 220);
	}

	const submitBot = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const token = botToken.trim();
		if (!token) return;

		setBotAdding(true);
		setBotModalError(null);
		botEntryStartedAtRef.current = Date.now();

		try {
			const result = await fetchJson<{ ok: boolean; bot: BotAccountSummary }>("/api/bots", {
				method: "POST",
				body: JSON.stringify({
					token,
					readOnlyMode: botReadOnlyMode,
					readOnlyBlockMessages: botReadOnlyBlockMessages,
					readOnlyBlockChannels: botReadOnlyBlockChannels,
					readOnlyBlockModeration: botReadOnlyBlockModeration
				})
			});
			const alreadyKnown = visibleBots.some((bot) => bot.id === result.bot.id);

			setBotToken("");
			resetReadOnlyOptions();
			setBotAdding(false);
			setSwitchingBotSnapshot(null);
			setEntryOverlayClosing(false);
			setSwitchingBotId(null);
			startNavTransition(() => {
				setSelectedBotId(null);
				setBotdeckHomeOpen(false);
				setSelectedGuildId(null);
				setSelectedChannelId(null);
				setSyncingChannelId(null);
			});
			pushToast(alreadyKnown ? text.botAlreadyLoaded : text.botAdded, "success");
			closeBotModal(true);
			void refreshBootstrap(null);
		} catch (error) {
			setBotAdding(false);
			setBotModalError(error instanceof Error ? error.message : text.failedAddBot);
		}
	};

	const openAddBot = () => {
		setBotModalError(null);
		setBotModalClosing(false);
		setShowAddBot(true);
	};

	const botModal = showAddBot ? (
		<BotTokenModal
			onClose={() => closeBotModal(true)}
			onSubmit={submitBot}
			token={botToken}
			setToken={setBotToken}
			readOnlyMode={botReadOnlyMode}
			setReadOnlyMode={setBotReadOnlyMode}
			readOnlyBlockMessages={botReadOnlyBlockMessages}
			setReadOnlyBlockMessages={setBotReadOnlyBlockMessages}
			readOnlyBlockChannels={botReadOnlyBlockChannels}
			setReadOnlyBlockChannels={setBotReadOnlyBlockChannels}
			readOnlyBlockModeration={botReadOnlyBlockModeration}
			setReadOnlyBlockModeration={setBotReadOnlyBlockModeration}
			loading={botAdding}
			error={botModalError}
			closing={botModalClosing}
			text={text}
			onExternalLink={promptExternalLink}
		/>
	) : null;

	return { botModal, openAddBot };
}
