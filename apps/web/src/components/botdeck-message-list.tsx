import { Input } from "@/components/ui/field";
import { createPortal } from "react-dom";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { BotAccountSummary, MessageAttachmentSummary, MessageSummary, WorkspaceState } from "@botdeck/shared";
import {
	AppBadge,
	MediaPreviewState,
	MessageContextMenuState,
	PinIcon,
	ReactionPickerState,
	UiLanguage,
	UiText,
	displayMessageAuthor,
	embedSummaryToPayload,
	extractInlineGifUrls,
	formatTime,
	getVisibleMessageReactions,
	isChannelPinSystemMessage,
	isEphemeralMessage,
	isInlineGifEmbedForUrls,
	messageKey,
	messageMentionsUser,
	messageSnippet,
	quickReactionEmojis,
	reactionEmojiIndex,
	renderMessageContent,
	stripInlineGifUrls
} from "@/features/workspace/core";
import { EmbedPreview, MessageAttachmentView, MoreIcon, ReplyIcon, SmileIcon } from "@/components/botdeck-app-widgets";
import { InlineGifPreview } from "@/components/botdeck-app-chat-widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type BotdeckMessageRowsProps = {
	activeBot: BotAccountSummary | null;
	activeBotMessagesLocked: boolean;
	activeBotUserId: string | null;
	activeGuildId: string | null;
	activeMessageById: Map<string, MessageSummary>;
	hiddenBotOnlyReactionKeys: Set<string>;
	language: UiLanguage;
	messages: MessageSummary[];
	reactionPicker: ReactionPickerState | null;
	reactionSearch: string;
	setMediaPreview: Dispatch<SetStateAction<MediaPreviewState | null>>;
	setMessageContextMenu: Dispatch<SetStateAction<MessageContextMenuState | null>>;
	setReactionPicker: Dispatch<SetStateAction<ReactionPickerState | null>>;
	setReactionSearch: Dispatch<SetStateAction<string>>;
	setReplyTarget: Dispatch<SetStateAction<MessageSummary | null>>;
	text: UiText;
	usersById: WorkspaceState["usersById"];
	onDismissEphemeralMessage: (message: MessageSummary) => void;
	onOpenAttachmentPreview: (attachment: MessageAttachmentSummary, kind: MediaPreviewState["kind"]) => void;
	onOpenReactionPicker: (messageId: string, anchor: HTMLElement) => void;
	onOpenMemberProfile: (guildId: string | null, userId: string) => void;
	onOpenMemberContextMenu: (event: MouseEvent<HTMLElement>, guildId: string | null, userId: string) => boolean;
	onOpenPinsPanel: () => void;
	onPromptExternalLink: (url: string) => void;
	onSetMessageReaction: (message: MessageSummary, emoji: string, remove?: boolean) => void;
};

export function BotdeckMessageRows({
	activeBot,
	activeBotMessagesLocked,
	activeBotUserId,
	activeGuildId,
	activeMessageById,
	hiddenBotOnlyReactionKeys,
	language,
	messages,
	reactionPicker,
	reactionSearch,
	setMediaPreview,
	setMessageContextMenu,
	setReactionPicker,
	setReactionSearch,
	setReplyTarget,
	text,
	usersById,
	onDismissEphemeralMessage,
	onOpenAttachmentPreview,
	onOpenMemberProfile,
	onOpenMemberContextMenu,
	onOpenPinsPanel,
	onOpenReactionPicker,
	onPromptExternalLink,
	onSetMessageReaction
}: BotdeckMessageRowsProps) {
	const reactionSearchQuery = reactionSearch.trim().toLowerCase();
	const visibleReactionEmojiGroups = reactionEmojiIndex
		.map((group) => ({
			category: group.category,
			items: reactionSearchQuery ? group.items.filter((item) => item.searchable.includes(reactionSearchQuery)) : group.items
		}))
		.filter((group) => group.items.length > 0);

	return messages.map((message) => {
		const author = usersById[message.authorId];
		const authorLabel = displayMessageAuthor(message, author);
		const authorIsBot = author?.bot || activeBot?.discordUserId === message.authorId;
		const authorAvatar = message.authorAvatarUrl ?? author?.avatarUrl ?? null;
		const replyToMessage = message.replyToMessageId ? activeMessageById.get(message.replyToMessageId) ?? null : null;
		const replyAuthor = replyToMessage ? usersById[replyToMessage.authorId] : null;
		const replyAuthorLabel = replyToMessage ? displayMessageAuthor(replyToMessage, replyAuthor) : text.unknown;
		const replyAuthorIsBot = !!replyToMessage && (replyAuthor?.bot || activeBot?.discordUserId === replyToMessage.authorId);
		const messageIsEphemeral = isEphemeralMessage(message);
		const inlineGifUrls = extractInlineGifUrls(message.content);
		const visibleContent = stripInlineGifUrls(message.content, inlineGifUrls);
		const visibleEmbeds = message.embeds?.filter((embed) => !isInlineGifEmbedForUrls(embed, inlineGifUrls)) ?? [];
		const visibleReactions = getVisibleMessageReactions(message, hiddenBotOnlyReactionKeys);
		const mentionsActiveBot = messageMentionsUser(message, activeBotUserId);

		if (isChannelPinSystemMessage(message)) {
			return (
				<article key={messageKey(message)} className="systemMessageRow" data-message-id={message.id}>
					<PinIcon className="discordPinIcon systemPinGlyph" />
					<p>
						<span className="authorNameLine">
							<strong>{authorLabel}</strong>
							{authorIsBot ? <AppBadge /> : null}
						</span>{" "}
						{text.pinnedSystem}{" "}
						<Button type="button" variant="ghost" onClick={onOpenPinsPanel}>
							{text.viewPinnedMessages}
						</Button>
					</p>
				</article>
			);
		}

		return (
			<article key={messageKey(message)} className={`messageRow${mentionsActiveBot ? " hasSelfMention" : ""}`} data-message-id={message.id}>
				<div className="messageHoverToolbar" aria-label={text.messageActions}>
					{!messageIsEphemeral ? (
						<>
							{quickReactionEmojis.slice(0, 3).map((emoji) => (
								<Button variant="unstyled" key={emoji} className={`messageToolbarButton isEmoji${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`} type="button" aria-label={`${text.addReaction} ${emoji}`} disabled={activeBotMessagesLocked} title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : undefined} onClick={() => onSetMessageReaction(message, emoji)}>
									{emoji}
								</Button>
							))}
							<span className="reactionPickerWrap">
								<Button variant="unstyled"
									className={`messageToolbarButton${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}
									type="button"
									aria-label={text.addReactionLabel}
									disabled={activeBotMessagesLocked}
									title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : undefined}
									onClick={(event) => onOpenReactionPicker(message.id, event.currentTarget)}
								>
									<SmileIcon />
								</Button>
								{reactionPicker?.messageId === message.id && typeof document !== "undefined" ? createPortal((
									<span className="reactionPicker" role="menu" aria-label={text.addReactionLabel} style={{ left: reactionPicker.x, top: reactionPicker.y }}>
										<label className="reactionPickerSearchLabel" htmlFor={`reaction-search-${message.id}`}>{text.emojiSearch}</label>
										<Input
											id={`reaction-search-${message.id}`}
											className="reactionPickerSearch"
											type="search"
											value={reactionSearch}
											placeholder={text.emojiSearchPlaceholder}
											onChange={(event) => setReactionSearch(event.target.value)}
											onKeyDown={(event) => {
												if (event.key === "Escape") setReactionPicker(null);
											}}
											autoFocus
										/>
										<div className="reactionPickerGrid" role="menu">
											{visibleReactionEmojiGroups.length ? visibleReactionEmojiGroups.map((group) => (
												<section key={group.category.en} className="reactionPickerCategory">
													<p>{group.category[language]}</p>
													<div>
														{group.items.map(({ emoji }) => (
															<Button variant="unstyled" key={`${group.category.en}-${emoji}`} type="button" role="menuitem" aria-label={`${text.addReaction} ${emoji}`} disabled={activeBotMessagesLocked} className={activeBotMessagesLocked ? "isReadonlyLocked" : ""} title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : undefined} onClick={() => onSetMessageReaction(message, emoji)}>
																{emoji}
															</Button>
														))}
													</div>
												</section>
											)) : <p className="reactionPickerEmpty">{text.emojiNoResults}</p>}
										</div>
									</span>
								), document.body) : null}
							</span>
						</>
					) : null}
					<Button variant="icon" className={`messageToolbarButton${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`} type="button" aria-label={text.reply} disabled={activeBotMessagesLocked} title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : undefined} onClick={() => setReplyTarget(message)}>
						<ReplyIcon />
					</Button>
					<Button
						variant="icon"
						className="messageToolbarButton"
						type="button"
						aria-label={text.moreActions}
						onClick={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							setMessageContextMenu({ message, x: rect.right - 220, y: rect.bottom + 6 });
						}}
					>
						<MoreIcon />
					</Button>
				</div>
				<Button variant="unstyled" className="avatar messageAvatarButton" type="button" aria-label={text.profile} onClick={() => onOpenMemberProfile(activeGuildId, message.authorId)} onContextMenu={(event) => onOpenMemberContextMenu(event, activeGuildId, message.authorId)}>
					{authorAvatar ? (
						<img className="messageAvatarImage" src={authorAvatar} alt="" aria-hidden="true" />
					) : (
						(author?.displayName ?? authorLabel).slice(0, 1).toUpperCase()
					)}
				</Button>
				<div
					className="messageBody"
					onContextMenu={(event) => {
						event.preventDefault();
						setMessageContextMenu({ message, x: event.clientX, y: event.clientY });
					}}
				>
					{replyToMessage ? (
						<div className="messageReplyPreview">
							<span className="authorNameLine">
								<strong>{replyAuthorLabel}</strong>
								{replyAuthorIsBot ? <AppBadge /> : null}
							</span>
							<span>{messageSnippet(replyToMessage, text)}</span>
						</div>
					) : message.replyToMessageId ? (
						<div className="messageReplyPreview isMissing">
							<strong>{text.reply}</strong>
							<span>{text.originalMessageNotLoaded}</span>
						</div>
					) : null}
					<div className="messageMeta">
						<Button variant="unstyled" className="authorNameLine messageAuthorButton" type="button" onClick={() => onOpenMemberProfile(activeGuildId, message.authorId)} onContextMenu={(event) => onOpenMemberContextMenu(event, activeGuildId, message.authorId)}>
							<strong>{authorLabel}</strong>
							{authorIsBot ? <AppBadge /> : null}
						</Button>
						<span>{formatTime(message.createdAt)}</span>
						{message.pinned ? <Badge className="messagePinBadge" tone="unstyled">{text.pinned}</Badge> : null}
					</div>
					{visibleContent ? <div className="messageContent">{renderMessageContent(visibleContent, `message-${message.id}`, onPromptExternalLink, usersById, activeBotUserId)}</div> : null}
					{inlineGifUrls.length ? (
						<div className="inlineGifStack">
							{inlineGifUrls.map((url, index) => (
								<InlineGifPreview
									key={`${message.id}-inline-gif-${index}`}
									url={url}
									label={`GIF ${index + 1}`}
									text={text}
									onPreview={(previewUrl, filename) => setMediaPreview({ kind: "image", url: previewUrl, filename })}
								/>
							))}
						</div>
					) : null}
					{message.attachments?.length ? (
						<div className="attachmentStack">
							{message.attachments.map((attachment) => (
								<MessageAttachmentView key={attachment.id} attachment={attachment} onPreview={onOpenAttachmentPreview} onExternalLink={onPromptExternalLink} text={text} />
							))}
						</div>
					) : null}
					{visibleEmbeds.length ? (
						<div className="embedStack">
							{visibleEmbeds.map((embed, index) => (
								<EmbedPreview key={`${message.id}-embed-${index}`} embed={embedSummaryToPayload(embed)} onImagePreview={(url, filename) => setMediaPreview({ kind: "image", url, filename })} onExternalLink={onPromptExternalLink} text={text} />
							))}
						</div>
					) : null}
					{messageIsEphemeral ? (
						<div className="ephemeralMessageNotice">
							<span className="ephemeralMessageEye" aria-hidden="true">👁</span>
							<span>{text.ephemeralMessageNotice}</span>
							<span aria-hidden="true">·</span>
							<Button type="button" variant="ghost" onClick={() => onDismissEphemeralMessage(message)}>{text.dismissEphemeralMessage}</Button>
						</div>
					) : null}
					{!messageIsEphemeral && visibleReactions.length ? (
						<div className="reactionBar">
							{visibleReactions.map((reaction) => (
								<Button variant="unstyled"
									key={reaction.emoji}
									className={`reactionButton${reaction.me ? " isMine" : ""}${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}
									type="button"
									aria-label={`${reaction.me ? text.removeReaction : text.addReaction} ${reaction.label}`}
									disabled={activeBotMessagesLocked}
									title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : undefined}
									onClick={() => onSetMessageReaction(message, reaction.emoji, reaction.me)}
								>
									<span>{reaction.label}</span>
									<strong>{reaction.count}</strong>
								</Button>
							))}
						</div>
					) : null}
				</div>
			</article>
		);
	});
}
