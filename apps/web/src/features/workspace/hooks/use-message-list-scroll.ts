import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { ChannelSummary, MessageSummary } from "@botdeck/shared";
import { messageListIsAtBottom } from "@/features/workspace/core";

type UseMessageListScrollParams = {
	activeBotId: string | null;
	activeChannel: ChannelSummary | null;
	activeMessages: MessageSummary[];
	channelIsSyncing: boolean;
	botdeckHomeOpen: boolean;
	pendingScrollMessageId: string | null;
	setPendingScrollMessageId: Dispatch<SetStateAction<string | null>>;
};

type UseMessageListScrollResult = {
	messageListRef: RefObject<HTMLDivElement | null>;
	messageListAtBottom: boolean;
	setMessageListAtBottom: Dispatch<SetStateAction<boolean>>;
	scrollMessageListToBottom: (behavior?: ScrollBehavior, passes?: number) => void;
	updateMessageListBottomState: () => void;
};

export function useMessageListScroll({
	activeBotId,
	activeChannel,
	activeMessages,
	channelIsSyncing,
	botdeckHomeOpen,
	pendingScrollMessageId,
	setPendingScrollMessageId
}: UseMessageListScrollParams): UseMessageListScrollResult {
	const [messageListAtBottom, setMessageListAtBottom] = useState(true);
	const messageListRef = useRef<HTMLDivElement | null>(null);
	const lastAutoScrollKeyRef = useRef<string | null>(null);

	const scrollMessageListToBottom = (behavior: ScrollBehavior = "smooth", passes = 3) => {
		const list = messageListRef.current;
		if (!list) return;
		const scroll = (remaining: number) => {
			const target = list.scrollHeight;
			list.scrollTo({ top: target, behavior });
			setMessageListAtBottom(true);
			if (remaining > 0) {
				window.requestAnimationFrame(() => scroll(remaining - 1));
			}
		};
		window.requestAnimationFrame(() => scroll(passes));
	};

	const updateMessageListBottomState = () => {
		const list = messageListRef.current;
		if (!list) return;
		setMessageListAtBottom(messageListIsAtBottom(list));
	};

	useEffect(() => {
		if (botdeckHomeOpen || !activeBotId || !activeChannel?.id || activeChannel.type === "voice") {
			lastAutoScrollKeyRef.current = null;
			setMessageListAtBottom(true);
			return;
		}

		const latestMessageId = activeMessages.at(-1)?.id ?? "";
		const channelKey = `${activeBotId}:${activeChannel.id}`;
		const renderKey = `${channelKey}:${latestMessageId}:${channelIsSyncing ? "syncing" : "ready"}`;
		const enteringChannel = lastAutoScrollKeyRef.current === null || !lastAutoScrollKeyRef.current.startsWith(`${channelKey}:`);

		if (enteringChannel || channelIsSyncing || messageListAtBottom) {
			lastAutoScrollKeyRef.current = renderKey;
			scrollMessageListToBottom(enteringChannel || channelIsSyncing ? "auto" : "smooth", enteringChannel || channelIsSyncing ? 8 : 3);
			return;
		}

		lastAutoScrollKeyRef.current = renderKey;
	}, [activeBotId, activeChannel?.id, activeChannel?.type, activeMessages.length, activeMessages.at(-1)?.id, channelIsSyncing, messageListAtBottom, botdeckHomeOpen]);

	useEffect(() => {
		if (!pendingScrollMessageId) return;
		const target = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(pendingScrollMessageId)}"]`);
		if (!target) return;
		target.scrollIntoView({ block: "center", behavior: "smooth" });
		target.classList.add("isJumpTarget");
		const timer = window.setTimeout(() => target.classList.remove("isJumpTarget"), 1400);
		setPendingScrollMessageId(null);
		return () => window.clearTimeout(timer);
	}, [activeMessages, pendingScrollMessageId, setPendingScrollMessageId]);

	return {
		messageListRef,
		messageListAtBottom,
		setMessageListAtBottom,
		scrollMessageListToBottom,
		updateMessageListBottomState
	};
}
