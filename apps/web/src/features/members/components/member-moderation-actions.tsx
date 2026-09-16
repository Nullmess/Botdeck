"use client";

import { type FormEvent, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useModalLayer } from "@/components/ui/modal-stack";
import type { UiText } from "@/features/workspace/core";
import type { MemberContextMenuState, MemberModerationAction, MemberModerationTarget } from "@/features/members/hooks/use-member-moderation-actions";

export function MemberContextMenu({
	menu,
	canModerate,
	readOnlyLocked = false,
	onClose,
	onProfile,
	onKick,
	onBan,
	onCopyUserId,
	text
}: {
	menu: MemberContextMenuState;
	canModerate: boolean;
	readOnlyLocked?: boolean;
	onClose: () => void;
	onProfile: () => void;
	onKick: () => void;
	onBan: () => void;
	onCopyUserId: () => void;
	text: UiText;
}) {
	const layer = useModalLayer();
	const menuRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = useState({ x: menu.x, y: menu.y });
	const moderationDisabled = !canModerate || readOnlyLocked;

	useLayoutEffect(() => {
		const margin = 8;
		const menuElement = menuRef.current;
		const menuWidth = menuElement?.offsetWidth ?? 240;
		const menuHeight = menuElement?.offsetHeight ?? 0;
		const maxX = Math.max(margin, window.innerWidth - menuWidth - margin);
		const maxY = Math.max(margin, window.innerHeight - menuHeight - margin);
		setPosition({ x: Math.min(Math.max(menu.x, margin), maxX), y: Math.min(Math.max(menu.y, margin), maxY) });
	}, [menu.x, menu.y, menu.userId]);

	return (
		<>
			<Button variant="unstyled" className="contextMenuBackdrop" type="button" aria-label={text.closeMemberMenu} onClick={onClose} style={{ zIndex: layer.backdrop }} />
			<div ref={menuRef} className="messageContextMenu memberContextMenu" role="menu" style={{ left: position.x, top: position.y, zIndex: layer.surface }}>
				<Button variant="unstyled" type="button" role="menuitem" onClick={onProfile}>
					{text.profile} <span>{menu.displayName}</span>
				</Button>
				<div className="contextMenuSeparator" />
				<Button type="button" variant="danger" role="menuitem" className={readOnlyLocked ? "isReadonlyLocked" : "danger"} disabled={moderationDisabled} title={readOnlyLocked ? text.readOnlyModeWriteBlocked : undefined} onClick={onKick}>
					{text.kickMember}
				</Button>
				<Button type="button" variant="danger" role="menuitem" className={readOnlyLocked ? "isReadonlyLocked" : "danger"} disabled={moderationDisabled} title={readOnlyLocked ? text.readOnlyModeWriteBlocked : undefined} onClick={onBan}>
					{text.banMember}
				</Button>
				<div className="contextMenuSeparator" />
				<Button variant="unstyled" type="button" role="menuitem" onClick={onCopyUserId}>
					{text.copyUserId}
				</Button>
				{!readOnlyLocked && !canModerate ? <small className="contextMenuHint">{text.moderationUnavailable}</small> : null}
			</div>
		</>
	);
}

export function MemberModerationModal({
	target,
	reason,
	setReason,
	onCancel,
	onConfirm,
	text
}: {
	target: MemberModerationTarget;
	reason: string;
	setReason: (value: string) => void;
	onCancel: () => void;
	onConfirm: () => void;
	text: UiText;
}) {
	const actionLabel = target.action === "kick" ? text.kickMember : text.banMember;
	const submitLabel = target.action === "kick" ? text.confirmKickMember : text.confirmBanMember;
	const title = target.action === "kick" ? text.kickMemberQuestion(target.displayName) : text.banMemberQuestion(target.displayName);
	const help = target.action === "kick" ? text.kickMemberHelp : text.banMemberHelp;

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onConfirm();
	};

	return (
		<Modal surfaceClassName="botModal actionConfirmModal memberModerationModal" aria-label={actionLabel} onClose={onCancel}>
			<form onSubmit={submit}>
				<div className="botModalHeader">
					<p className="eyebrow">{text.moderation}</p>
					<Button variant="icon" className="modalClose" type="button" onClick={onCancel} aria-label={text.close}>
						×
					</Button>
				</div>
				<h2>{title}</h2>
				<p className="subtle">{help}</p>
				<label className="memberModerationReasonField">
					<span>{text.moderationReasonOptional}</span>
					<Textarea value={reason} maxLength={512} rows={4} placeholder={text.moderationReasonPlaceholder} onChange={(event) => setReason(event.target.value)} autoFocus />
					<small>{text.moderationReasonLimit(reason.length)}</small>
				</label>
				<div className="modalActions">
					<Button variant="secondary" type="button" onClick={onCancel}>
						{text.cancel}
					</Button>
					<Button variant="danger" type="submit">
						{submitLabel}
					</Button>
				</div>
			</form>
		</Modal>
	);
}

export type { MemberModerationAction };
