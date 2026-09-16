"use client";

// Éditeur embeds multi-pages


import { Input, Textarea } from "../ui/field";
import {
	type EmbedPayload
} from "@botdeck/shared";
import { useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { i18nText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/panel";
import { Modal } from "@/components/ui/modal";

import {
	cloneEmbedComposerPage,
	ComposerFormat,
	createEmbedComposerPage,
	defaultEmbedDraft,
	EmbedComposerPageDraft,
	EmbedDraftField,
	embedDraftPayloadsFromPages,
	EmbedDraftState,
	embedDraftToPayload,
	formatTime,
	handleExternalLinkClick,
	renderMessageContent,
	UiText,
	validateEmbedComposerPages
} from "@/features/workspace/core";
import { SlashStudioEmbedEditor, type CommandEmbedPageDraft } from "@/features/slash-studio/components/slash-studio-widgets";

// Icône embed compositeur.
export function EmbedComposerIcon() {
	return (
		<svg className="composerEmbedSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="M5 5h14v14H5z" />
			<path d="M8 9h8" />
			<path d="M8 13h5" />
			<path d="M16 15.5h1.5" />
		</svg>
	);
}

// Barre de formatage du compositeur.
export function ComposerFormatToolbar({ onFormat, text }: { onFormat: (format: ComposerFormat) => void; text: UiText }) {
	const tools: { format: ComposerFormat; label: string; title: string; icon: ReactNode }[] = [
		{ format: "bold", label: text.bold, title: text.bold, icon: <text x="12" y="16" textAnchor="middle" fontWeight="800" fontSize="13">B</text> },
		{ format: "italic", label: text.italic, title: text.italic, icon: <text x="12" y="16" textAnchor="middle" fontStyle="italic" fontWeight="700" fontSize="13">I</text> },
		{ format: "underline", label: text.underline, title: text.underline, icon: <><text x="12" y="15" textAnchor="middle" fontWeight="700" fontSize="12">U</text><path d="M7 18h10" /></> },
		{ format: "strike", label: text.strike, title: text.strike, icon: <><text x="12" y="16" textAnchor="middle" fontWeight="700" fontSize="12">S</text><path d="M6 12h12" /></> },
		{ format: "inlineCode", label: text.code, title: text.inlineCode, icon: <><path d="m9 8-4 4 4 4" /><path d="m15 8 4 4-4 4" /></> },
		{ format: "codeBlock", label: text.codeBlock, title: text.codeBlock, icon: <><path d="M5 7h14v10H5z" /><path d="M8 10h4" /><path d="M8 13h8" /></> },
		{ format: "spoiler", label: text.spoiler, title: text.spoiler, icon: <><path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z" /><path d="M12 9.5a2.5 2.5 0 1 1 0 5" /></> },
		{ format: "quote", label: text.quote, title: text.quote, icon: <><path d="M8 9h4" /><path d="M8 13h8" /><path d="M5 8v8" /></> }
	];

	return (
		<div className="composerFormatToolbar" role="toolbar" aria-label={text.formatSelection}>
			{tools.map((tool) => (
				<Button key={tool.format} variant="ghost" type="button" title={tool.title} aria-label={tool.label} onMouseDown={(event) => event.preventDefault()} onClick={() => onFormat(tool.format)}>
					<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
						{tool.icon}
					</svg>
				</Button>
			))}
		</div>
	);
}

// Champ Markdown contrôlé.
function MarkdownField({ label, value, onChange, placeholder, maxLength, singleLine = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number; singleLine?: boolean }) {
	const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
	const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
	const hasSelection = selection ? selection.end > selection.start : false;
	const updateSelection = () => {
		const input = ref.current;
		if (!input) return;
		setSelection({ start: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 });
	};
	const wrapSelection = (before: string, after = before) => {
		const input = ref.current;
		if (!input || !hasSelection || !selection) return;
		const start = selection.start;
		const end = selection.end;
		const selected = value.slice(start, end);
		const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
		onChange(next);
		requestAnimationFrame(() => {
			input.focus();
			input.setSelectionRange(start + before.length, start + before.length + selected.length);
			updateSelection();
		});
	};
	return (
		<label className={singleLine ? "commandMarkdownField" : "commandFlowTextarea commandMarkdownField"}>
			<span>{label}</span>
			{hasSelection ? <MarkdownToolbar onFormat={wrapSelection} blockEnabled={!singleLine} /> : null}
			{singleLine
				? <Input ref={ref as RefObject<HTMLInputElement>} value={value} maxLength={maxLength} onSelect={updateSelection} onKeyUp={updateSelection} onMouseUp={updateSelection} onBlur={() => window.setTimeout(() => setSelection(null), 120)} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
				: <Textarea ref={ref as RefObject<HTMLTextAreaElement>} value={value} maxLength={maxLength} onSelect={updateSelection} onKeyUp={updateSelection} onMouseUp={updateSelection} onBlur={() => window.setTimeout(() => setSelection(null), 120)} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}
		</label>
	);
}

// Barre d’outils Markdown.
function MarkdownToolbar({ onFormat, blockEnabled }: { onFormat: (before: string, after?: string) => void; blockEnabled: boolean }) {
	return (
		<div className="commandMarkdownToolbar" onMouseDown={(event) => event.preventDefault()}>
			<Button variant="ghost" type="button" onClick={() => onFormat("**")}>B</Button>
			<Button variant="ghost" type="button" onClick={() => onFormat("*")}>I</Button>
			<Button variant="ghost" type="button" onClick={() => onFormat("__")}>U</Button>
			<Button variant="ghost" type="button" onClick={() => onFormat("~~")}>S</Button>
			<Button variant="ghost" type="button" onClick={() => onFormat("||")}>{i18nText("Spoiler")}</Button>
			<Button variant="ghost" type="button" onClick={() => onFormat("`")}>{i18nText("Code")}</Button>
			{blockEnabled ? <Button variant="ghost" type="button" onClick={() => onFormat("```\n", "\n```")}>{i18nText("Bloc")}</Button> : null}
			<Button variant="ghost" type="button" onClick={() => onFormat("> ", "")}>{i18nText("Citation")}</Button>
		</div>
	);
}

// Convertit les pages de l’éditeur unifié vers le payload Discord.
function composerPayloadsFromStudioJson(value: string): EmbedPayload[] {
	let pages: unknown[] = [];
	try {
		const parsed = JSON.parse(value || "[]");
		pages = Array.isArray(parsed) ? parsed : [];
	} catch {
		pages = [];
	}
	return pages.slice(0, 10).map((item) => {
		const page = item && typeof item === "object" && !Array.isArray(item) ? item as Partial<CommandEmbedPageDraft> : {};
		const color = typeof page.color === "string" && /^#[0-9a-fA-F]{6}$/.test(page.color) ? Number.parseInt(page.color.slice(1), 16) : undefined;
		const fields = Array.isArray(page.fields) ? page.fields
			.filter((field) => field && typeof field === "object" && !Array.isArray(field))
			.map((field) => field as { name?: unknown; value?: unknown; inline?: unknown })
			.filter((field) => typeof field.name === "string" && field.name.trim() && typeof field.value === "string" && field.value.trim())
			.slice(0, 25)
			.map((field) => ({ name: String(field.name), value: String(field.value), inline: field.inline === true })) : [];
		const payload: EmbedPayload = {
			title: typeof page.title === "string" && page.title.trim() ? page.title : undefined,
			description: typeof page.description === "string" && page.description.trim() ? page.description : undefined,
			color,
			author: typeof page.author === "string" && page.author.trim() ? {
				name: page.author,
				iconUrl: typeof page.authorIconUrl === "string" && page.authorIconUrl.trim() ? page.authorIconUrl : undefined
			} : undefined,
			footer: typeof page.footer === "string" && page.footer.trim() ? {
				text: page.footer,
				iconUrl: typeof page.footerIconUrl === "string" && page.footerIconUrl.trim() ? page.footerIconUrl : undefined
			} : undefined,
			imageUrl: typeof page.imageUrl === "string" && page.imageUrl.trim() ? page.imageUrl : undefined,
			thumbnailUrl: typeof page.thumbnailUrl === "string" && page.thumbnailUrl.trim() ? page.thumbnailUrl : undefined,
			fields: fields.length ? fields : undefined
		};
		return payload;
	}).filter((embed) => Boolean(embed.title || embed.description || embed.author || embed.footer || embed.imageUrl || embed.thumbnailUrl || embed.fields?.length));
}

// Modale embed compositeur.
export function EmbedComposerModal({ onClose, onSend, text }: { onClose: () => void; onSend: (embeds: EmbedPayload[], content?: string) => void; text: UiText }) {
	const [embedPagesJson, setEmbedPagesJson] = useState(() => JSON.stringify([createEmbedComposerPage({ description: "" })].map((page) => ({
		id: page.id,
		title: page.title,
		description: page.description,
		color: page.color,
		author: page.authorName,
		authorIconUrl: page.authorIconUrl,
		footer: page.footerText,
		footerIconUrl: page.footerIconUrl,
		imageUrl: page.imageUrl,
		thumbnailUrl: page.thumbnailUrl,
		fields: page.fields
	})), null, 2));
	const embeds = useMemo(() => composerPayloadsFromStudioJson(embedPagesJson), [embedPagesJson]);
	const content = "";
	return (
		<Modal backdropClassName="modalBackdrop embedComposerBackdrop" surfaceClassName="embedComposerModal embedStudioModal" aria-label={text.createEmbed} onClose={onClose}>
				<header className="settingsHeader embedStudioHeader">
					<div>
						<p className="eyebrow">{text.embedMessage}</p>
						<h2>{text.createEmbed}</h2>
						<p className="subtle">{text.embedPagesReady(embeds.length || 1)}</p>
					</div>
					<Button variant="icon" className="modalClose" type="button" onClick={onClose} aria-label={text.closeEmbed}>
						×
					</Button>
				</header>
				<div className="embedComposerUnifiedEditor">
					<SlashStudioEmbedEditor
						value={embedPagesJson}
						fallbackTitle=""
						fallbackDescription=""
						previewMode="generic"
						onChange={setEmbedPagesJson}
					/>
				</div>
				<footer className="modalActions embedStudioActions">
					<span className={`embedValidationNote${embeds.length ? " isOk" : ""}`}>{embeds.length ? text.embedReady : text.emptyEmbedPreview}</span>
					<Button variant="secondary" type="button" onClick={onClose}>
						{text.cancel}
					</Button>
					<Button type="button" disabled={!embeds.length} onClick={() => embeds.length && onSend(embeds, content)}>
						{text.send}
					</Button>
				</footer>
			</Modal>
	);
}

// Aperçu embed fidèle.
export function EmbedPreview({ embed, onImagePreview, onExternalLink, text }: { embed: EmbedPayload | null; onImagePreview?: (url: string, filename: string) => void; onExternalLink?: (url: string, label?: string) => void; text: UiText }) {
	if (!embed) return <Card className="embedCard embedPreviewEmpty">{text.emptyEmbedPreview}</Card>;
	const embedAccentColor = embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#5865f2";
	return (
		<Card className="embedCard richEmbedCard" style={{ "--embed-accent-color": embedAccentColor } as CSSProperties}>
			{embed.author ? (
				<div className="embedAuthor">
					{embed.author.iconUrl ? <img src={embed.author.iconUrl} alt="" aria-hidden="true" /> : null}
					{embed.author.url ? <a className="messageLink" href={embed.author.url} target="_blank" rel="noreferrer" onClick={(event) => handleExternalLinkClick(event, embed.author?.url ?? "", embed.author?.name ?? text.link, onExternalLink)}>{embed.author.name}</a> : <strong>{embed.author.name}</strong>}
				</div>
			) : null}
			{embed.title ? embed.url ? <a className="messageLink embedTitle" href={embed.url} target="_blank" rel="noreferrer" onClick={(event) => handleExternalLinkClick(event, embed.url ?? "", embed.title ?? text.link, onExternalLink)}>{embed.title}</a> : <strong className="embedTitle">{embed.title}</strong> : null}
			{embed.description ? <div className="messageContent">{renderMessageContent(embed.description, "embed-description", onExternalLink)}</div> : null}
			{embed.thumbnailUrl ? <Button variant="ghost" className="embedThumbnailButton" type="button" onClick={() => onImagePreview?.(embed.thumbnailUrl ?? "", embed.title ?? "Thumbnail")}><img className="embedThumbnail" src={embed.thumbnailUrl} alt="" loading="lazy" /></Button> : null}
			{embed.fields?.length ? (
				<div className="embedFieldGrid">
					{embed.fields.map((field, index) => (
						<div key={`${field.name}-${index}`} className={field.inline ? "isInline" : ""}>
							<strong>{field.name}</strong>
							<div className="messageContent">{renderMessageContent(field.value, `embed-field-${index}`, onExternalLink)}</div>
						</div>
					))}
				</div>
			) : null}
			{embed.imageUrl ? <Button variant="ghost" className="messageImageLink" type="button" onClick={() => onImagePreview?.(embed.imageUrl ?? "", embed.title ?? text.embedImage)}><img className="embedImage" src={embed.imageUrl} alt="" loading="lazy" /></Button> : null}
			{embed.footer || embed.timestamp ? (
				<div className="embedFooter">
					{embed.footer?.iconUrl ? <img src={embed.footer.iconUrl} alt="" aria-hidden="true" /> : null}
					<span>{[embed.footer?.text, embed.timestamp ? formatTime(embed.timestamp) : null].filter(Boolean).join(" · ")}</span>
				</div>
			) : null}
		</Card>
	);
}
