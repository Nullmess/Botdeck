"use client";

// Surcouches mess (Menus, médias, réacts).

import {
  type MessageAttachmentSummary,
  type WorkspaceState,
} from "@botdeck/shared";
import { type MouseEvent, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useModalLayer } from "@/components/ui/modal-stack";
import { Card } from "@/components/ui/panel";

import {
  AppToast,
  displayMessageAuthor,
  ExternalLinkPromptState,
  formatFileSize,
  handleExternalLinkClick,
  isAudioAttachment,
  isImageAttachment,
  isVideoAttachment,
  MediaPreviewState,
  MessageContextMenuState,
  SyncQueueEvent,
  uiText,
  UiText,
} from "@/features/workspace/core";

// Modale confirmation suppression.
export function ConfirmDeleteModal({
  botName,
  loading,
  onCancel,
  onConfirm,
  text,
}: {
  botName: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  text: UiText;
}) {
  return (
    <Modal surfaceClassName="botModal actionConfirmModal" aria-label={text.confirmRemoveBot} onClose={loading ? undefined : onCancel}>
        <div className="botModalHeader">
          <p className="eyebrow">{text.removeBot}</p>
          <Button
            variant="icon"
            className="modalClose"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            ×
          </Button>
        </div>
        <h2>{text.deleteBotQuestion(botName)}</h2>
        <p className="subtle">{text.deleteBotHelp}</p>
        <div className="modalActions">
          <Button
            variant="secondary"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            {text.cancel}
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? text.removing : text.deleteBot}
          </Button>
        </div>
    </Modal>
  );
}

// Menu contextuel message.
export function MessageContextMenu({
  menu,
  author,
  messagesLocked = false,
  onClose,
  onProfile,
  onReply,
  onPinToggle,
  onDelete,
  onCopyMessageId,
  onCopyUserId,
  text,
}: {
  menu: MessageContextMenuState;
  author?: WorkspaceState["usersById"][string];
  messagesLocked?: boolean;
  onClose: () => void;
  onProfile: () => void;
  onReply: () => void;
  onPinToggle: () => void;
  onDelete: () => void;
  onCopyMessageId: () => void;
  onCopyUserId: () => void;
  text: UiText;
}) {
  const authorName = displayMessageAuthor(menu.message, author, "user");
  const layer = useModalLayer();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ x: menu.x, y: menu.y });

  useLayoutEffect(() => {
    const margin = 8;
    const menuElement = menuRef.current;
    const menuWidth = menuElement?.offsetWidth ?? 220;
    const menuHeight = menuElement?.offsetHeight ?? 0;
    const maxX = Math.max(margin, window.innerWidth - menuWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - menuHeight - margin);

    setPosition({
      x: Math.min(Math.max(menu.x, margin), maxX),
      y: Math.min(Math.max(menu.y, margin), maxY),
    });
  }, [menu.x, menu.y, menu.message.id]);

  return (
    <>
      <Button
        variant="unstyled"
        className="contextMenuBackdrop"
        type="button"
        aria-label={text.closeMessageMenu}
        onClick={onClose}
        style={{ zIndex: layer.backdrop }}
      />
      <div
        ref={menuRef}
        className="messageContextMenu"
        role="menu"
        style={{ left: position.x, top: position.y, zIndex: layer.surface }}
      >
        <Button
          variant="unstyled"
          type="button"
          role="menuitem"
          onClick={onProfile}
        >
          {text.profile} <span>{authorName}</span>
        </Button>
        <Button
          variant="unstyled"
          type="button"
          role="menuitem"
          className={messagesLocked ? "isReadonlyLocked" : ""}
          disabled={messagesLocked}
          title={messagesLocked ? text.readOnlyModeWriteBlocked : undefined}
          onClick={onReply}
        >
          {text.reply}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          role="menuitem"
          className={messagesLocked ? "isReadonlyLocked" : ""}
          disabled={messagesLocked}
          title={messagesLocked ? text.readOnlyModeWriteBlocked : undefined}
          onClick={onPinToggle}
        >
          {menu.message.pinned ? text.unpin : text.pin}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          role="menuitem"
          className={messagesLocked ? "isReadonlyLocked" : "danger"}
          disabled={messagesLocked}
          title={messagesLocked ? text.readOnlyModeWriteBlocked : undefined}
          onClick={onDelete}
        >
          {text.deleteMessage}
        </Button>
        <div className="contextMenuSeparator" />
        <Button
          variant="unstyled"
          type="button"
          role="menuitem"
          onClick={onCopyMessageId}
        >
          {text.copyMessageId}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          role="menuitem"
          onClick={onCopyUserId}
        >
          {text.copyUserId}
        </Button>
      </div>
    </>
  );
}

// Indicateur de file sync.
export function SyncQueueIndicator({
  event,
  text,
}: {
  event: SyncQueueEvent | null;
  text: UiText;
}) {
  if (!event) return null;
  const active =
    event.status === "queued" ||
    event.status === "running" ||
    event.pending > 0 ||
    event.running > 0;
  const label =
    event.status === "queued"
      ? text.syncQueueQueued
      : event.status === "running"
        ? text.syncQueueRunning
        : event.status === "completed"
          ? text.syncQueueCompleted
          : text.syncQueueFailed;
  return (
    <div
      className={`syncQueueIndicator syncQueue-${event.status}${active ? " isActive" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="syncQueueDot" aria-hidden="true" />
      <strong>{label}</strong>
      <span>{event.label}</span>
      {event.pending || event.running ? (
        <small>{text.syncQueuePending(event.pending, event.running)}</small>
      ) : null}
      {event.message ? <small>{event.message}</small> : null}
    </div>
  );
}

// Pile de notifications.
export function ToastStack({ toasts }: { toasts: AppToast[] }) {
  return (
    <div className="toastStack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.tone}${toast.leaving ? " isLeaving" : ""}`}
        >
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

// Confirmation lien externe.
export function ExternalLinkModal({
  prompt,
  onCancel,
  text,
}: {
  prompt: ExternalLinkPromptState;
  onCancel: () => void;
  text: UiText;
}) {
  const parsedLink = (() => {
    try {
      const url = new URL(prompt.url);
      return {
        hostname: url.hostname,
        protocol: url.protocol.replace(":", "").toUpperCase(),
        path: `${url.pathname}${url.search}` || "/",
        isSecure: url.protocol === "https:",
      };
    } catch {
      return {
        hostname: prompt.url,
        protocol: "URL",
        path: prompt.url,
        isSecure: false,
      };
    }
  })();

  return (
    <Modal backdropClassName="externalLinkBackdrop" surfaceClassName="externalLinkModal externalLinkModalRedesigned" aria-label={text.externalLinkDialog} onClose={onCancel}>
        <Button
          variant="icon"
          className="externalLinkClose"
          type="button"
          aria-label={text.close}
          onClick={onCancel}
        >
          <span aria-hidden="true">×</span>
        </Button>

        <div className="externalLinkHero">
          <div className="externalLinkIcon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M7 17 17 7" />
              <path d="M9 7h8v8" />
              <path d="M14 17H7V10" />
            </svg>
          </div>
          <div className="externalLinkCopy">
            <p className="eyebrow externalLinkEyebrow">{text.externalLink}</p>
            <h2>{text.leavingBotdeck}</h2>
            <p>{text.externalLinkHelp}</p>
          </div>
        </div>

        <div className="externalLinkPreview" aria-label="Destination">
          <div className="externalLinkUrlLine" title={prompt.url}>
            <span
              className={`externalLinkProtocol${parsedLink.isSecure ? " isSecure" : " isWarning"}`}
            >
              {parsedLink.protocol}
            </span>
            <strong title={parsedLink.hostname}>{parsedLink.hostname}</strong>
            <span className="externalLinkPath">{parsedLink.path}</span>
          </div>
        </div>

        <footer className="externalLinkActions">
          <Button
            variant="secondary"
            className="externalLinkCancelButton"
            type="button"
            onClick={onCancel}
          >
            {text.cancel}
          </Button>
          <a
            className="sendButton externalLinkContinueButton"
            href={prompt.url}
            target="_blank"
            rel="noreferrer"
            onClick={onCancel}
          >
            {text.continue}
          </a>
        </footer>
    </Modal>
  );
}

function sanitizeDownloadFilename(filename: string) {
  const safe = filename
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ");
  return safe || "botdeck-download";
}

async function downloadRemoteFile(url: string, filename: string) {
  const response = await fetch(url, {
    credentials: "omit",
    mode: "cors",
    referrerPolicy: "no-referrer",
  });

  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = sanitizeDownloadFilename(filename);
  anchor.rel = "noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
}

function handleAttachmentDownloadClick(
  event: MouseEvent<HTMLAnchorElement>,
  url: string,
  filename: string,
) {
  event.preventDefault();
  event.stopPropagation();

  void downloadRemoteFile(url, filename).catch(() => {
    window.alert(
      "Téléchargement impossible depuis cette URL. Vérifie la connexion, le VPN/proxy ou le pare-feu, puis réessaie.",
    );
  });
}

// Actions pièce jointe.
export function AttachmentActions({
  url,
  filename,
  onExternalLink,
  text,
}: {
  url: string;
  filename: string;
  onExternalLink?: (url: string, label?: string) => void;
  text?: UiText;
}) {
  const labels = text ?? uiText.fr;
  return (
    <span className="attachmentActions">
      <a
        className="attachmentAction"
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(event) =>
          handleExternalLinkClick(event, url, filename, onExternalLink)
        }
      >
        {labels.open}
      </a>
      <a
        className="attachmentAction"
        href={url}
        download={filename}
        onClick={(event) => handleAttachmentDownloadClick(event, url, filename)}
      >
        {labels.download}
      </a>
    </span>
  );
}

// Affichage pièce jointe.
export function MessageAttachmentView({
  attachment,
  onPreview,
  onExternalLink,
  text,
}: {
  attachment: MessageAttachmentSummary;
  onPreview: (
    attachment: MessageAttachmentSummary,
    kind: MediaPreviewState["kind"],
  ) => void;
  onExternalLink?: (url: string, label?: string) => void;
  text: UiText;
}) {
  const isImage = isImageAttachment(
    attachment.contentType,
    attachment.filename,
  );
  const isVideo = isVideoAttachment(
    attachment.contentType,
    attachment.filename,
  );
  const isAudio = isAudioAttachment(
    attachment.contentType,
    attachment.filename,
  );

  if (isImage) {
    return (
      <article className="mediaAttachment imageOnlyAttachment">
        <Button
          variant="unstyled"
          className="messageImageLink"
          type="button"
          onClick={() => onPreview(attachment, "image")}
          aria-label={`${text.enlarge} ${attachment.filename}`}
        >
          <img
            className="messageImage"
            src={attachment.url}
            alt={attachment.filename}
            loading="lazy"
          />
        </Button>
      </article>
    );
  }

  if (isVideo) {
    return (
      <article className="mediaAttachment">
        <video
          className="messageVideo"
          src={attachment.url}
          controls
          preload="metadata"
          playsInline
        />
        <div className="attachmentMetaRow">
          <span>
            <strong>{attachment.filename}</strong>
            <small>{formatFileSize(attachment.size)}</small>
          </span>
          <span className="attachmentActions">
            <Button
              variant="unstyled"
              className="attachmentAction"
              type="button"
              onClick={() => onPreview(attachment, "video")}
            >
              {text.enlarge}
            </Button>
            <a
              className="attachmentAction"
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) =>
                handleExternalLinkClick(
                  event,
                  attachment.url,
                  attachment.filename,
                  onExternalLink,
                )
              }
            >
              {text.open}
            </a>
            <a
              className="attachmentAction"
              href={attachment.url}
              download={attachment.filename}
              onClick={(event) =>
                handleAttachmentDownloadClick(
                  event,
                  attachment.url,
                  attachment.filename,
                )
              }
            >
              {text.download}
            </a>
          </span>
        </div>
      </article>
    );
  }

  if (isAudio) {
    return (
      <Card as="article" className="audioAttachment">
        <div className="attachmentMetaRow">
          <span>
            <strong>{attachment.filename}</strong>
            <small>{formatFileSize(attachment.size)}</small>
          </span>
          <AttachmentActions
            url={attachment.url}
            filename={attachment.filename}
            onExternalLink={onExternalLink}
            text={text}
          />
        </div>
        <audio
          className="messageAudio"
          src={attachment.url}
          controls
          preload="metadata"
        />
      </Card>
    );
  }

  return (
    <Card as="article" className="attachmentCard">
      <div>
        <strong>{attachment.filename}</strong>
        <small>{formatFileSize(attachment.size)}</small>
      </div>
      <AttachmentActions
        url={attachment.url}
        filename={attachment.filename}
        onExternalLink={onExternalLink}
        text={text}
      />
    </Card>
  );
}

// Modale média aperçu.
export function MediaPreviewModal({
  media,
  onClose,
  onExternalLink,
  text,
}: {
  media: MediaPreviewState;
  onClose: () => void;
  onExternalLink?: (url: string, label?: string) => void;
  text: UiText;
}) {
  return (
    <Modal backdropClassName="mediaPreviewBackdrop" surfaceClassName="mediaPreviewModal" aria-label={media.filename} onClose={onClose}>
        <div
          className="mediaPreviewToolbar"
          aria-label={media.filename}
          onClick={(event) => event.stopPropagation()}
        >
          <a
            className="mediaPreviewAction"
            href={media.url}
            target="_blank"
            rel="noreferrer"
            title={text.open}
            aria-label={text.open}
            onClick={(event) =>
              handleExternalLinkClick(
                event,
                media.url,
                media.filename,
                onExternalLink,
              )
            }
          >
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M7 7h4a1 1 0 1 0 0-2H5.75A2.75 2.75 0 0 0 3 7.75v10.5A2.75 2.75 0 0 0 5.75 21h10.5A2.75 2.75 0 0 0 19 18.25V13a1 1 0 1 0-2 0v5.25a.75.75 0 0 1-.75.75H5.75a.75.75 0 0 1-.75-.75V7.75A.75.75 0 0 1 5.75 7H7Z" />
              <path d="M14 3.5a1 1 0 0 0 0 2h3.09l-7.3 7.3a1 1 0 1 0 1.42 1.4l7.29-7.29V10a1 1 0 1 0 2 0V4.5a1 1 0 0 0-1-1H14Z" />
            </svg>
          </a>
          <a
            className="mediaPreviewAction"
            href={media.url}
            download={media.filename}
            title={text.download}
            aria-label={text.download}
            onClick={(event) =>
              handleAttachmentDownloadClick(event, media.url, media.filename)
            }
          >
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M11 4a1 1 0 1 1 2 0v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4Z" />
              <path d="M5 17a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v1.25A1.75 1.75 0 0 1 18.25 21H5.75A1.75 1.75 0 0 1 4 19.25V18a1 1 0 0 1 1-1Z" />
            </svg>
          </a>
          <Button
            variant="unstyled"
            className="mediaPreviewAction mediaPreviewClose"
            type="button"
            onClick={onClose}
            aria-label={text.close}
            title={text.close}
          >
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M6.3 5.7a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.42 11.4l4.29 4.3a1 1 0 0 1-1.42 1.4L12 12.82l-4.3 4.29a1 1 0 0 1-1.4-1.42l4.28-4.29-4.29-4.3a1 1 0 0 1 0-1.4Z" />
            </svg>
          </Button>
        </div>
        <p className="srOnly">
          {media.filename}
          {media.size ? `, ${formatFileSize(media.size)}` : ""}
        </p>
        <div className="mediaPreviewBody">
          {media.kind === "image" ? (
            <img
              src={media.url}
              alt={media.filename}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <video
              src={media.url}
              controls
              autoPlay
              playsInline
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
    </Modal>
  );
}
