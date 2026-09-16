import { Input, Textarea } from "@/components/ui/field";
import type {
	BotAccountSummary,
	ChannelSummary,
	MessageSummary,
	WorkspaceState
} from "@botdeck/shared";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import { ComposerFormatToolbar, EmbedComposerIcon } from "@/components/botdeck-app-widgets";
import { Button } from "./ui/button";
import {
	displayMessageAuthor,
	displayUserName,
	messageSnippet,
	stripDiscriminator,
	type ComposerAttachment,
	type ComposerFormat,
	type ComposerMentionState,
	type ComposerSelectionState,
	type UiText
} from "@/features/workspace/core";

type BotdeckMessageComposerProps = {
	activeBot: BotAccountSummary | null;
	activeBotId: string | null;
	activeBotMessagesLocked: boolean;
	activeChannel: ChannelSummary | null;
	activeChannelCanAttach: boolean;
	activeChannelCanEmbed: boolean;
	activeChannelCanSend: boolean;
	attachmentBusy: boolean;
	botdeckHomeOpen: boolean;
	composerAttachments: ComposerAttachment[];
	composerInputRef: RefObject<HTMLTextAreaElement | null>;
	composerMention: ComposerMentionState | null;
	composerMentionIndex: number;
	composerMentionSuggestions: WorkspaceState["usersById"][string][];
	composerSelection: ComposerSelectionState | null;
	draft: string;
	fileInputRef: RefObject<HTMLInputElement | null>;
	handleComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
	handleFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
	insertComposerMention: (user: WorkspaceState["usersById"][string]) => void;
	formatSelectedDraft: (format: ComposerFormat) => void;
	removeComposerAttachment: (id: string) => void;
	replyTarget: MessageSummary | null;
	setDraft: (value: string) => void;
	setEmbedModalOpen: (value: boolean) => void;
	setReplyTarget: (value: MessageSummary | null) => void;
	submitMessage: (event: FormEvent<HTMLFormElement>) => void;
	text: UiText;
	updateComposerMention: (value?: string, caret?: number) => void;
	updateComposerSelection: () => void;
	workspace: WorkspaceState;
};

export function BotdeckMessageComposer({
	activeBot,
	activeBotId,
	activeBotMessagesLocked,
	activeChannel,
	activeChannelCanAttach,
	activeChannelCanEmbed,
	activeChannelCanSend,
	attachmentBusy,
	botdeckHomeOpen,
	composerAttachments,
	composerInputRef,
	composerMention,
	composerMentionIndex,
	composerMentionSuggestions,
	composerSelection,
	draft,
	fileInputRef,
	handleComposerKeyDown,
	handleFileInputChange,
	insertComposerMention,
	formatSelectedDraft,
	removeComposerAttachment,
	replyTarget,
	setDraft,
	setEmbedModalOpen,
	setReplyTarget,
	submitMessage,
	text,
	updateComposerMention,
	updateComposerSelection,
	workspace
}: BotdeckMessageComposerProps) {
	if (activeChannel?.type === "forum") return null;

	return (
		<form className="composer" onSubmit={submitMessage}>
			{replyTarget ? (
				<div className="replyComposerPreview">
					<span>
						{text.replyingTo} <strong>{displayMessageAuthor(replyTarget, workspace.usersById[replyTarget.authorId], "user")}</strong>
					</span>
					<small>{messageSnippet(replyTarget, text)}</small>
					<Button variant="icon" type="button" aria-label={text.cancelReply} onClick={() => setReplyTarget(null)}>
						×
					</Button>
				</div>
			) : null}
			{composerAttachments.length ? (
				<div className="composerAttachmentTray">
					{composerAttachments.map((attachment) => (
						<article key={attachment.id} className="composerAttachment">
							{attachment.previewUrl ? (
								<img src={attachment.previewUrl} alt="" aria-hidden="true" />
							) : (
								<span className="composerFileIcon" aria-hidden="true">
									{text.file}
								</span>
							)}
							<div>
								<strong>{attachment.filename}</strong>
								<small>{Math.ceil(attachment.size / 1024)} KB</small>
							</div>
							<Button variant="icon" type="button" aria-label={text.removeFile(attachment.filename)} onClick={() => removeComposerAttachment(attachment.id)}>
								×
							</Button>
						</article>
					))}
				</div>
			) : null}
			{composerSelection ? <ComposerFormatToolbar onFormat={formatSelectedDraft} text={text} /> : null}
			{composerMention && composerMentionSuggestions.length ? (
				<div className="composerMentionMenu" role="listbox">
					{composerMentionSuggestions.map((user, index) => {
						const label = displayUserName(user);
						const presence = workspace.presencesByUserId[user.id]?.status ?? user.status ?? "offline";
						return (
							<Button
								key={user.id}
								variant="ghost"
								type="button"
								role="option"
								aria-selected={index === composerMentionIndex}
								className={index === composerMentionIndex ? "isSelected" : ""}
								onMouseDown={(event) => {
									event.preventDefault();
									insertComposerMention(user);
								}}
							>
								<span className="mentionMenuAvatar" aria-hidden="true">
									{user.avatarUrl ? <img src={user.avatarUrl} alt="" aria-hidden="true" /> : label.slice(0, 1).toUpperCase()}
									<span className={`presenceDot ${presence}`} />
								</span>
								<span>
									<strong>{label}</strong>
									<small>@{user.username}</small>
								</span>
							</Button>
						);
					})}
				</div>
			) : null}
			<div className={`composerRow${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}>
				<Input ref={fileInputRef} className="composerFileInput" type="file" multiple onChange={handleFileInputChange} />
				<Button
					variant="icon"
					className={`composerAttachButton${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}
					type="button"
					aria-label={text.addFile}
					disabled={botdeckHomeOpen || !activeChannelCanAttach || !activeBotId || attachmentBusy || activeBotMessagesLocked}
					title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : text.addFile}
					onClick={() => fileInputRef.current?.click()}
				>
					<span aria-hidden="true">+</span>
				</Button>
				<Button
					variant="icon"
					className={`composerEmbedButton${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}
					type="button"
					aria-label={text.createEmbed}
					title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : activeChannel?.type === "dm" ? text.createDmEmbed : text.createEmbed}
					disabled={botdeckHomeOpen || !activeChannelCanEmbed || !activeBotId || activeBotMessagesLocked}
					onClick={() => setEmbedModalOpen(true)}
				>
					<EmbedComposerIcon />
				</Button>
				<div className={`composerInputShell${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}>
					<Textarea
						ref={composerInputRef}
						className={`composerInput${activeBotMessagesLocked ? " isReadonlyLocked" : ""}`}
						placeholder={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : botdeckHomeOpen ? text.composerLockedPlaceholder : text.composerPlaceholder}
						title={activeBotMessagesLocked ? text.readOnlyModeWriteBlocked : undefined}
						maxLength={2000}
						rows={1}
						disabled={botdeckHomeOpen || !activeChannelCanSend || !activeBotId || activeBotMessagesLocked}
						value={draft}
						onChange={(event) => {
							setDraft(event.target.value);
							updateComposerMention(event.target.value, event.target.selectionStart);
						}}
						onSelect={updateComposerSelection}
						onKeyUp={() => {
							updateComposerSelection();
							updateComposerMention();
						}}
						onMouseUp={updateComposerSelection}
						onBlur={() => window.setTimeout(() => {
							updateComposerSelection();
						}, 120)}
						onKeyDown={handleComposerKeyDown}
					/>
				</div>
			</div>
			{(draft.trim() || composerAttachments.length) && activeChannel?.type !== "voice" ? (
				<div className="typingIndicator" aria-live="polite">
					<span />
					<span />
					<span />
					<strong>{stripDiscriminator(activeBot?.name ?? "Bot")}</strong> {attachmentBusy ? text.preparesFiles : text.writes}
				</div>
			) : null}
		</form>
	);
}
