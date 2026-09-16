"use client";

import { type ChannelSummary, type MessageSummary, type WorkspaceState } from "@botdeck/shared";
import { useState, type ReactNode } from "react";
import { handleExternalLinkClick } from "./botdeck-event-handlers";
import { appIconPath, displayUserName } from "./botdeck-display-utils";
import type { UiText } from "./botdeck-app-i18n";

export type ComposerAttachment = {
	id: string;
	filename: string;
	contentType: string | null;
	size: number;
	data: string;
	previewUrl: string | null;
};
export type ComposerFormat = "bold" | "italic" | "underline" | "strike" | "inlineCode" | "codeBlock" | "spoiler" | "quote";
export type ComposerMentionState = {
	start: number;
	end: number;
	query: string;
};
export type ComposerSelectionState = {
	start: number;
	end: number;
};
export const channelPinnedMessageType = 6;
export const maxComposerAttachments = 10;
export const maxComposerAttachmentSize = 8 * 1024 * 1024;


// Extrait court du message.
export function messageSnippet(message: MessageSummary, text: UiText): string {
	const content = message.content.trim();
	if (content) return content.length > 90 ? `${content.slice(0, 87)}...` : content;
	if (message.attachments?.length) return text.attachmentCount(message.attachments.length);
	if (message.embeds?.length) return text.embedCount(message.embeds.length);
	return text.message;
}

// Détecte l’épinglage système.
export function isChannelPinSystemMessage(message: MessageSummary): boolean {
	return Boolean(message.system && message.type === channelPinnedMessageType);
}

export const linkPattern = /(https?:\/\/[^\s<]+)/g;
export const mentionPattern = /<@!?(\d+)>|@(everyone|here)/g;
export const markdownTokenPattern = /(```[\s\S]*?```|`[^`\n]+`|\[[^\]\n]+?\]\(https?:\/\/[^\s)]+?\)|\|\|[\s\S]+?\|\||\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+?\*|_[^_\n]+?_)/g;

// Détecte une image jointe.
export function isImageAttachment(contentType: string | null | undefined, filename: string): boolean {
	return Boolean(contentType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(filename));
}

// Détecte un GIF joint.
export function isGifAttachment(contentType: string | null | undefined, filename: string): boolean {
	return Boolean(contentType === "image/gif" || /\.gif(?:$|[?#])/i.test(filename));
}

// Détecte un GIF inline.
export function isInlineGifUrl(url: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
	const path = parsed.pathname.toLowerCase();
	return /\.(gif|webp)(?:$|[?#])/i.test(`${path}${parsed.search}`)
		|| (host === "media.tenor.com" && /\.(gif|webp)$/i.test(path))
		|| (host === "tenor.com" && path.startsWith("/view/") && /(?:^|[-_/])gif(?:[-_/]|$)/i.test(path))
		|| (/\.giphy\.com$/i.test(host) && path.includes("/media/"))
		|| (host === "i.giphy.com" && path.includes("/media/"))
		|| (host === "giphy.com" && (path.startsWith("/gifs/") || path.startsWith("/clips/")));
}

// GIF inline à résoudre.
export function needsInlineGifResolution(url: string): boolean {
	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
		const path = parsed.pathname.toLowerCase();
		return (host === "tenor.com" && path.startsWith("/view/"))
			|| (host === "giphy.com" && (path.startsWith("/gifs/") || path.startsWith("/clips/")));
	} catch {
		return false;
	}
}

// Extrait les GIF inline.
export function extractInlineGifUrls(content: string): string[] {
	if (!content) return [];
	const urls: string[] = [];
	for (const match of content.matchAll(linkPattern)) {
		const rawUrl = match[0].replace(/[),.;!?]+$/g, "");
		if (isInlineGifUrl(rawUrl) && !urls.includes(rawUrl)) urls.push(rawUrl);
	}
	return urls.slice(0, 4);
}


// Associe embed et GIF inline.
export function isInlineGifEmbedForUrls(embed: NonNullable<MessageSummary["embeds"]>[number], inlineGifUrls: string[]): boolean {
	if (!inlineGifUrls.length) return false;
	const provider = (embed.provider ?? "").toLowerCase();
	const candidates = [embed.url, embed.imageUrl, embed.thumbnailUrl, embed.authorUrl].filter((value): value is string => Boolean(value));
	const normalizedCandidates = candidates.map((value) => value.toLowerCase());
	const matchesOriginalUrl = inlineGifUrls.some((url) => normalizedCandidates.includes(url.toLowerCase()));
	if (matchesOriginalUrl) return true;
	const hasGifMediaCandidate = candidates.some((value) => isInlineGifUrl(value));
	if (!hasGifMediaCandidate) return false;
	const inlineHosts = inlineGifUrls.map((url) => {
		try {
			return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
		} catch {
			return "";
		}
	});
	const providerLooksLikeGifHost = provider.includes("tenor") || provider.includes("giphy");
	const inlineLooksLikeGifPage = inlineHosts.some((host) => host === "tenor.com" || host === "giphy.com" || host.endsWith(".giphy.com"));
	return providerLooksLikeGifHost && inlineLooksLikeGifPage;
}

// Retire les GIF inline du texte.
export function stripInlineGifUrls(content: string, urls: string[]): string {
	if (!content || !urls.length) return content;
	let cleaned = content;
	for (const url of urls) {
		const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		cleaned = cleaned.replace(new RegExp(`${escapedUrl}[),.;!?]*`, "g"), "");
	}
	return cleaned
		.split("\n")
		.map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
		.filter((line) => line.trim().length > 0)
		.join("\n")
		.trim();
}

// Détecte une vidéo jointe.
export function isVideoAttachment(contentType: string | null | undefined, filename: string): boolean {
	return Boolean(contentType?.startsWith("video/") || /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(filename));
}

// Détecte un audio joint.
export function isAudioAttachment(contentType: string | null | undefined, filename: string): boolean {
	return Boolean(contentType?.startsWith("audio/") || /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus)$/i.test(filename));
}

// Formate la taille fichier.
export function formatFileSize(size: number): string {
	if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
	return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}


// Lit un fichier en base64.
export function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = typeof reader.result === "string" ? reader.result : "";
			resolve(result.includes(",") ? result.split(",").pop() ?? "" : result);
		};
		reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
		reader.readAsDataURL(file);
	});
}

// Logo Botdeck avec fallback local si /app-icon.png ne répond pas encore après bascule HTTPS.
function BotdeckLogoFallback({ className = "botdeckLogo" }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 128 128" aria-hidden="true" focusable="false" role="img">
			<rect width="128" height="128" rx="32" fill="currentColor" opacity=".16" />
			<rect x="24" y="36" width="80" height="58" rx="22" fill="currentColor" opacity=".95" />
			<circle cx="50" cy="65" r="8" fill="#101821" />
			<circle cx="78" cy="65" r="8" fill="#101821" />
			<path d="M56 80h16" stroke="#101821" strokeWidth="7" strokeLinecap="round" />
			<path d="M64 23v14" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
			<circle cx="64" cy="20" r="7" fill="currentColor" />
		</svg>
	);
}

export function BotdeckLogo({ className = "botdeckLogo" }: { className?: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) return <BotdeckLogoFallback className={className} />;
	return <img className={className} src={appIconPath} alt="" aria-hidden="true" draggable={false} onError={() => setFailed(true)} />;
}

// Rend le texte brut inline.
export function renderInlinePlainText(content: string, keyPrefix: string, usersById?: WorkspaceState["usersById"], highlightedUserId?: string | null): ReactNode[] {
	if (!content) return [];

	const nodes: ReactNode[] = [];
	let cursor = 0;

	for (const match of content.matchAll(mentionPattern)) {
		const index = match.index ?? 0;
		const userId = match[1];
		const broadcastMention = match[2];

		if (index > cursor) {
			nodes.push(<span key={`${keyPrefix}-text-${cursor}`}>{content.slice(cursor, index)}</span>);
		}

		const user = userId ? usersById?.[userId] : null;
		const label = broadcastMention ?? (user ? displayUserName(user, userId) : userId);
		const highlightsActiveUser = Boolean(highlightedUserId && (userId === highlightedUserId || broadcastMention === "everyone" || broadcastMention === "here"));

		nodes.push(
			<span key={`${keyPrefix}-mention-${index}`} className={`messageUserMention${highlightsActiveUser ? " isSelfMention" : ""}`}>
				@{label}
			</span>
		);

		cursor = index + match[0].length;
	}

	if (cursor < content.length) {
		nodes.push(<span key={`${keyPrefix}-text-${cursor}`}>{content.slice(cursor)}</span>);
	}

	return nodes;
}

// Markdown limité, sans HTML.
export function renderInlineMarkdown(content: string, keyPrefix: string, onExternalLink?: (url: string, label?: string) => void, usersById?: WorkspaceState["usersById"], highlightedUserId?: string | null): ReactNode[] {
	if (!content) return [];

	return content.split(linkPattern).map((part, index) => {
		if (!part.match(linkPattern)) {
			return renderInlinePlainText(part, `${keyPrefix}-plain-${index}`, usersById, highlightedUserId);
		}

		return (
			<a key={`${keyPrefix}-link-${index}`} className="messageLink" href={part} target="_blank" rel="noreferrer" onClick={(event) => handleExternalLinkClick(event, part, part, onExternalLink)}>
				{part}
			</a>
		);
	}).flat();
}

// Rend un token Markdown.
export function renderMarkdownToken(token: string, key: string, onExternalLink?: (url: string, label?: string) => void, usersById?: WorkspaceState["usersById"], highlightedUserId?: string | null): ReactNode {
	if (token.startsWith("**```") && token.endsWith("```**")) {
		const code = token.slice(5, -5).replace(/^\n|\n$/g, "").toUpperCase();
		if (!code.includes("\n")) return <code key={key} className="messageInlineCode">{code}</code>;
		return <pre key={key} className="messageCodeBlock"><code>{code}</code></pre>;
	}
	if (token.startsWith("__```") && token.endsWith("```__")) {
		const code = token.slice(5, -5).replace(/^\n|\n$/g, "").toUpperCase();
		if (!code.includes("\n")) return <code key={key} className="messageInlineCode">{code}</code>;
		return <pre key={key} className="messageCodeBlock"><code>{code}</code></pre>;
	}
	if (token.startsWith("```") && token.endsWith("```")) {
		const code = token.slice(3, -3).replace(/^\n|\n$/g, "");
		if (!code.includes("\n")) return <code key={key} className="messageInlineCode">{code}</code>;
		return <pre key={key} className="messageCodeBlock"><code>{code}</code></pre>;
	}
	if (token.startsWith("`") && token.endsWith("`")) return <code key={key} className="messageInlineCode">{token.slice(1, -1)}</code>;
	const linkMatch = token.match(/^\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+?)\)$/);
	if (linkMatch) {
		return (
			<a key={key} className="messageLink" href={linkMatch[2]} target="_blank" rel="noreferrer" onClick={(event) => handleExternalLinkClick(event, linkMatch[2], linkMatch[1], onExternalLink)}>
				{renderMessageContent(linkMatch[1], key, onExternalLink, usersById, highlightedUserId)}
			</a>
		);
	}
	if (token.startsWith("||") && token.endsWith("||")) return <span key={key} className="messageSpoiler">{renderMessageContent(token.slice(2, -2), key, onExternalLink, usersById, highlightedUserId)}</span>;
	if (token.startsWith("**") && token.endsWith("**")) return <strong key={key}>{renderMessageContent(token.slice(2, -2), key, onExternalLink, usersById, highlightedUserId)}</strong>;
	if (token.startsWith("__") && token.endsWith("__")) return <u key={key}>{renderMessageContent(token.slice(2, -2), key, onExternalLink, usersById, highlightedUserId)}</u>;
	if (token.startsWith("~~") && token.endsWith("~~")) return <s key={key}>{renderMessageContent(token.slice(2, -2), key, onExternalLink, usersById, highlightedUserId)}</s>;
	if (token.startsWith("*") && token.endsWith("*")) return <em key={key}>{renderMessageContent(token.slice(1, -1), key, onExternalLink, usersById, highlightedUserId)}</em>;
	if (token.startsWith("_") && token.endsWith("_")) return <em key={key}>{renderMessageContent(token.slice(1, -1), key, onExternalLink, usersById, highlightedUserId)}</em>;
	return <span key={key}>{token}</span>;
}

// Rend une ligne message.
export function renderMessageLine(line: string, keyPrefix: string, onExternalLink?: (url: string, label?: string) => void, usersById?: WorkspaceState["usersById"], highlightedUserId?: string | null): ReactNode[] {
	const nodes: ReactNode[] = [];
	let cursor = 0;
	for (const match of line.matchAll(markdownTokenPattern)) {
		const index = match.index ?? 0;
		if (index > cursor) nodes.push(...renderInlineMarkdown(line.slice(cursor, index), `${keyPrefix}-plain-${cursor}`, onExternalLink, usersById, highlightedUserId));
		nodes.push(renderMarkdownToken(match[0], `${keyPrefix}-token-${index}`, onExternalLink, usersById, highlightedUserId));
		cursor = index + match[0].length;
	}
	if (cursor < line.length) nodes.push(...renderInlineMarkdown(line.slice(cursor), `${keyPrefix}-plain-${cursor}`, onExternalLink, usersById, highlightedUserId));
	return nodes;
}

// Rend le texte message.
export function renderMessageTextContent(content: string, keyPrefix: string, onExternalLink?: (url: string, label?: string) => void, usersById?: WorkspaceState["usersById"], highlightedUserId?: string | null): ReactNode[] {
	if (!content) return [];
	const lines = content.split("\n");
	return lines.map((line, index) => {
		const quote = line.startsWith("> ");
		return (
			<span key={`${keyPrefix}-line-${index}`} className={quote ? "messageQuoteLine" : undefined}>
				{renderMessageLine(quote ? line.slice(2) : line, `${keyPrefix}-${index}`, onExternalLink, usersById, highlightedUserId)}
				{index < lines.length - 1 ? <br /> : null}
			</span>
		);
	});
}

// Rend le contenu message.
export function renderMessageContent(content: string, keyPrefix = "message", onExternalLink?: (url: string, label?: string) => void, usersById?: WorkspaceState["usersById"], highlightedUserId?: string | null) {
	if (!content) return null;
	const nodes: ReactNode[] = [];
	const codeBlockPattern = /(?:\*\*|__)?```[\s\S]*?```(?:\*\*|__)?/g;
	let cursor = 0;
	for (const match of content.matchAll(codeBlockPattern)) {
		const index = match.index ?? 0;
		if (index > cursor) nodes.push(...renderMessageTextContent(content.slice(cursor, index), `${keyPrefix}-text-${cursor}`, onExternalLink, usersById, highlightedUserId));
		nodes.push(renderMarkdownToken(match[0], `${keyPrefix}-code-${index}`, onExternalLink, usersById, highlightedUserId));
		cursor = index + match[0].length;
	}
	if (cursor < content.length) nodes.push(...renderMessageTextContent(content.slice(cursor), `${keyPrefix}-text-${cursor}`, onExternalLink, usersById, highlightedUserId));
	return nodes;
}

// Clé stockage des MP conservés.
export function messageMentionsUser(message: MessageSummary, userId: string | null | undefined): boolean {
	if (!userId) return false;
	return message.content.includes(`<@${userId}>`) || message.content.includes(`<@!${userId}>`) || message.content.includes("@everyone") || message.content.includes("@here");
}

// Extrait les utilisateurs mentionnés.
export function mentionedUserIds(content: string): string[] {
	return Array.from(content.matchAll(mentionPattern), (match) => match[1]).filter(Boolean);
}

// Cherche composer mention.
export function findComposerMention(value: string, caret: number): ComposerMentionState | null {
	const beforeCaret = value.slice(0, caret);
	const triggerIndex = beforeCaret.lastIndexOf("@");
	if (triggerIndex < 0) return null;
	const previous = triggerIndex > 0 ? beforeCaret[triggerIndex - 1] : "";
	const query = beforeCaret.slice(triggerIndex + 1);
	if (previous && !/\s|\(|\[|{|:/.test(previous)) return null;
	if (query.includes("<") || /\s/.test(query) || query.length > 32) return null;
	return { start: triggerIndex, end: caret, query };
}

// Vérifie le scroll en bas.
export function messageListIsAtBottom(list: HTMLDivElement, threshold = 36): boolean {
	return list.scrollHeight - list.scrollTop - list.clientHeight <= threshold;
}


