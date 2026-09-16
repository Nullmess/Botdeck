"use client";

// Widgets locaux de l’interface principale Botdeck.


import { type ChannelSummary } from "@botdeck/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { i18nText } from "@/features/workspace/core";

import { needsInlineGifResolution, type UiLanguage, type UiText } from "@/features/workspace/core";
import { ChannelTypeIcon } from "@/components/botdeck-app-widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// GIF inline: liens résolus.
export function InlineGifPreview({ url, label, onPreview, text }: { url: string; label: string; onPreview: (url: string, filename: string) => void; text: UiText }) {
	const [resolvedUrl, setResolvedUrl] = useState(() => needsInlineGifResolution(url) ? "" : url);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		if (!needsInlineGifResolution(url)) {
			setResolvedUrl(url);
			return () => {
				cancelled = true;
			};
		}

		setResolvedUrl("");
		fetch(`/api/gif/resolve?url=${encodeURIComponent(url)}`)
			.then((response) => response.ok ? response.json() as Promise<{ url?: string }> : Promise.reject(new Error("GIF resolution failed")))
			.then((payload) => {
				if (!cancelled && payload.url) setResolvedUrl(payload.url);
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, [url]);

	if (failed) return null;

	return (
		<Button variant="unstyled"
			className={`inlineGifPreview messageImageLink${resolvedUrl ? "" : " isLoading"}`}
			type="button"
			disabled={!resolvedUrl}
			onClick={() => resolvedUrl ? onPreview(resolvedUrl, label) : undefined}
			aria-label={`${text.enlarge} ${label}`}
		>
			{resolvedUrl ? <img className="messageImage" src={resolvedUrl} alt={label} loading="lazy" /> : <span className="inlineGifSkeleton" aria-hidden="true" />}
		</Button>
	);
}


export type ChannelContextMenuState = {
	channel: ChannelSummary | null;
	x: number;
	y: number;
};

export function ChatChannelTag({ botdeckHomeOpen, channel }: { botdeckHomeOpen: boolean; channel: ChannelSummary | null }) {
	if (botdeckHomeOpen) {
		return <Badge className="chatChannelTag" tone="unstyled">B</Badge>;
	}

	if (channel?.type === "dm") {
		return <Badge className="chatChannelTag" tone="unstyled">@</Badge>;
	}

	if (channel?.type === "voice" || channel?.type === "forum" || channel?.type === "thread") {
		return (
			<Badge className="chatChannelTag chatChannelTagIcon" tone="unstyled">
				<ChannelTypeIcon type={channel.type} />
			</Badge>
		);
	}

	return <Badge className="chatChannelTag" tone="unstyled">#</Badge>;
}

export function ChannelContextMenu({
	menu,
	canManage,
	readOnlyLocked = false,
	language,
	onClose,
	onCopyId,
	onDelete,
	onRecreatePurge
}: {
	menu: ChannelContextMenuState;
	canManage: boolean;
	readOnlyLocked?: boolean;
	language: UiLanguage;
	onClose: () => void;
	onCopyId: () => void;
	onDelete: () => void;
	onRecreatePurge: () => void;
}) {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState({ x: menu.x, y: menu.y });
	const isCategory = menu.channel?.type === "category";
	const label = language === "fr" ? {
		copyChannelId: "Copier l'ID du salon",
		copyCategoryId: "Copier l'ID de la catégorie",
		recreatePurgeChannel: "Purger par recréation",
		deleteChannel: "Supprimer le salon",
		deleteCategory: "Supprimer la catégorie",
		manageRequired: "Permission Gérer les salons requise",
		readOnlyBlocked: "Bloqué par lecture seule"
	} : {
		copyChannelId: "Copy channel ID",
		copyCategoryId: "Copy category ID",
		recreatePurgeChannel: "Recreate purge",
		deleteChannel: "Delete channel",
		deleteCategory: "Delete category",
		manageRequired: "Manage Channels permission required",
		readOnlyBlocked: "Blocked by read-only mode"
	};

	useLayoutEffect(() => {
		const margin = 8;
		const menuElement = menuRef.current;
		const menuWidth = menuElement?.offsetWidth ?? 240;
		const menuHeight = menuElement?.offsetHeight ?? 0;
		const maxX = Math.max(margin, window.innerWidth - menuWidth - margin);
		const maxY = Math.max(margin, window.innerHeight - menuHeight - margin);
		setPosition({ x: Math.min(Math.max(menu.x, margin), maxX), y: Math.min(Math.max(menu.y, margin), maxY) });
	}, [menu.x, menu.y, menu.channel?.id]);

	return (
		<>
			<Button variant="unstyled" className="contextMenuBackdrop" type="button" aria-label={i18nText("Close channel menu")} onClick={onClose} />
			<div ref={menuRef} className="messageContextMenu channelContextMenu" role="menu" style={{ left: position.x, top: position.y }}>
				{menu.channel ? (
					<>
						<Button type="button" variant="ghost" role="menuitem" onClick={onCopyId}>
							{isCategory ? label.copyCategoryId : label.copyChannelId}
						</Button>
						{!isCategory && menu.channel?.type !== "thread" ? (
							<Button type="button" variant="danger" role="menuitem" className={readOnlyLocked ? "isReadonlyLocked" : "danger"} onClick={onRecreatePurge} disabled={!canManage || readOnlyLocked} title={readOnlyLocked ? label.readOnlyBlocked : undefined}>
								{label.recreatePurgeChannel}
							</Button>
						) : null}
						<Button type="button" variant="danger" role="menuitem" className={readOnlyLocked ? "isReadonlyLocked" : "danger"} onClick={onDelete} disabled={!canManage || readOnlyLocked} title={readOnlyLocked ? label.readOnlyBlocked : undefined}>
							{isCategory ? label.deleteCategory : label.deleteChannel}
						</Button>
					</>
				) : null}
				{!readOnlyLocked && !canManage ? <small className="contextMenuHint">{label.manageRequired}</small> : null}
			</div>
		</>
	);
}
