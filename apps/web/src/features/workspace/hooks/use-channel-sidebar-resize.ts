import { type PointerEvent as ReactPointerEvent } from "react";

import { clampChannelSidebarWidth, writeChannelSidebarWidth } from "@/features/workspace/core";

export function useChannelSidebarResize(
	channelSidebarWidth: number,
	setChannelSidebarWidth: (width: number) => void
) {
	return (event: ReactPointerEvent<HTMLButtonElement>) => {
		if (window.matchMedia("(max-width: 900px)").matches) return;
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = channelSidebarWidth;
		document.body.classList.add("isResizingChannelSidebar");

		const handlePointerMove = (moveEvent: PointerEvent) => {
			setChannelSidebarWidth(clampChannelSidebarWidth(startWidth + moveEvent.clientX - startX));
		};

		const removeListeners = () => {
			document.body.classList.remove("isResizingChannelSidebar");
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerCancel);
		};

		function handlePointerUp(upEvent: PointerEvent) {
			const nextWidth = clampChannelSidebarWidth(startWidth + upEvent.clientX - startX);
			setChannelSidebarWidth(nextWidth);
			writeChannelSidebarWidth(nextWidth);
			removeListeners();
		}

		function handlePointerCancel() {
			removeListeners();
		}

		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerCancel);
	};
}
