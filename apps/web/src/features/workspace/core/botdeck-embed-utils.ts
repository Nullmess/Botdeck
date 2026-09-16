import type { EmbedPayload, MessageSummary } from "@botdeck/shared";
import type { UiText } from "./botdeck-app-i18n";

export type EmbedDraftField = {
	id: string;
	name: string;
	value: string;
	inline: boolean;
};
export type EmbedDraftState = {
	title: string;
	description: string;
	url: string;
	color: string;
	timestampEnabled: boolean;
	authorName: string;
	authorUrl: string;
	authorIconUrl: string;
	thumbnailUrl: string;
	imageUrl: string;
	footerText: string;
	footerIconUrl: string;
	fields: EmbedDraftField[];
};
export type EmbedComposerPageDraft = EmbedDraftState & { id: string };
export type EmbedValidationResult = {
	valid: boolean;
	message: string | null;
};
export const defaultEmbedDraft: EmbedDraftState = {
	title: "",
	description: "",
	url: "",
	color: "#35f2c4",
	timestampEnabled: false,
	authorName: "",
	authorUrl: "",
	authorIconUrl: "",
	thumbnailUrl: "",
	imageUrl: "",
	footerText: "",
	footerIconUrl: "",
	fields: []
};

// Crée une page embed.
export function createEmbedComposerPage(seed: Partial<EmbedDraftState> = {}): EmbedComposerPageDraft {
	return {
		...defaultEmbedDraft,
		...seed,
		id: crypto.randomUUID(),
		fields: seed.fields?.map((field) => ({ ...field, id: field.id || crypto.randomUUID() })) ?? []
	};
}

// Clone une page embed.
export function cloneEmbedComposerPage(page: EmbedComposerPageDraft): EmbedComposerPageDraft {
	return createEmbedComposerPage({
		title: page.title,
		description: page.description,
		url: page.url,
		color: page.color,
		timestampEnabled: page.timestampEnabled,
		authorName: page.authorName,
		authorUrl: page.authorUrl,
		authorIconUrl: page.authorIconUrl,
		thumbnailUrl: page.thumbnailUrl,
		imageUrl: page.imageUrl,
		footerText: page.footerText,
		footerIconUrl: page.footerIconUrl,
		fields: page.fields.map((field) => ({ ...field, id: crypto.randomUUID() }))
	});
}
// Convertit couleur hexadécimale.
export function hexColorToNumber(color: string): number | undefined {
	const normalized = color.trim().replace(/^#/, "");
	return /^[0-9a-fA-F]{6}$/.test(normalized) ? Number.parseInt(normalized, 16) : undefined;
}

// Brouillon embed → charge Discord.
export function embedDraftToPayload(draft: EmbedDraftState): EmbedPayload | null {
	const fields = draft.fields
		.map((field) => ({ name: field.name.trim(), value: field.value.trim(), inline: field.inline }))
		.filter((field) => field.name && field.value)
		.slice(0, 25);
	const payload: EmbedPayload = {
		title: draft.title.trim() || undefined,
		description: draft.description.trim() || undefined,
		url: draft.url.trim() || undefined,
		color: hexColorToNumber(draft.color),
		timestamp: draft.timestampEnabled ? new Date().toISOString() : undefined,
		author: draft.authorName.trim()
			? {
				name: draft.authorName.trim(),
				url: draft.authorUrl.trim() || undefined,
				iconUrl: draft.authorIconUrl.trim() || undefined
			}
			: undefined,
		footer: draft.footerText.trim()
			? {
				text: draft.footerText.trim(),
				iconUrl: draft.footerIconUrl.trim() || undefined
			}
			: undefined,
		imageUrl: draft.imageUrl.trim() || undefined,
		thumbnailUrl: draft.thumbnailUrl.trim() || undefined,
		fields: fields.length ? fields : undefined
	};

	const hasVisibleContent = Boolean(
		payload.title ||
		payload.description ||
		payload.author ||
		payload.footer ||
		payload.imageUrl ||
		payload.thumbnailUrl ||
		payload.fields?.length
	);

	return hasVisibleContent ? payload : null;
}

// Vérifie le contenu embed.
export function embedHasContent(embed: EmbedPayload | null): embed is EmbedPayload {
	return Boolean(embed);
}

// Valide le brouillon embed.
export function validateEmbedDraft(draft: EmbedDraftState, text: UiText): EmbedValidationResult {
	// Validation UI avant Discord.
	const hasTitle = Boolean(draft.title.trim());
	const hasDescription = Boolean(draft.description.trim());
	const hasAuthor = Boolean(draft.authorName.trim());
	const hasFooter = Boolean(draft.footerText.trim());
	const hasImage = Boolean(draft.imageUrl.trim());
	const hasThumbnail = Boolean(draft.thumbnailUrl.trim());
	const hasCompleteField = draft.fields.some((field) => field.name.trim() && field.value.trim());
	const hasPartialField = draft.fields.some((field) => Boolean(field.name.trim()) !== Boolean(field.value.trim()));

	if (draft.url.trim() && !hasTitle) return { valid: false, message: text.embedTitleUrlRequiresTitle };
	if ((draft.authorUrl.trim() || draft.authorIconUrl.trim()) && !hasAuthor) return { valid: false, message: text.embedAuthorRequiresName };
	if (draft.footerIconUrl.trim() && !hasFooter) return { valid: false, message: text.embedFooterRequiresText };
	if (hasPartialField) return { valid: false, message: text.embedFieldRequiresNameValue };
	if (!hasTitle && !hasDescription && !hasAuthor && !hasFooter && !hasImage && !hasThumbnail && !hasCompleteField) {
		return { valid: false, message: text.embedRequiresContent };
	}

	return { valid: true, message: null };
}

// Convertit les pages embed.
export function embedDraftPayloadsFromPages(pages: EmbedComposerPageDraft[]): EmbedPayload[] {
	return pages.map((page) => embedDraftToPayload(page)).filter(embedHasContent).slice(0, 10);
}

// Valide les pages embed.
export function validateEmbedComposerPages(pages: EmbedComposerPageDraft[], text: UiText): EmbedValidationResult {
	let contentPages = 0;
	for (const [index, page] of pages.entries()) {
		const hasTitle = Boolean(page.title.trim());
		const hasAuthor = Boolean(page.authorName.trim());
		const hasFooter = Boolean(page.footerText.trim());
		const hasPartialField = page.fields.some((field) => Boolean(field.name.trim()) !== Boolean(field.value.trim()));
		const payload = embedDraftToPayload(page);
		if (embedHasContent(payload)) contentPages += 1;
		const prefix = pages.length > 1 ? `Page ${index + 1} · ` : "";
		if (page.url.trim() && !hasTitle) return { valid: false, message: `${prefix}${text.embedTitleUrlRequiresTitle}` };
		if ((page.authorUrl.trim() || page.authorIconUrl.trim()) && !hasAuthor) return { valid: false, message: `${prefix}${text.embedAuthorRequiresName}` };
		if (page.footerIconUrl.trim() && !hasFooter) return { valid: false, message: `${prefix}${text.embedFooterRequiresText}` };
		if (hasPartialField) return { valid: false, message: `${prefix}${text.embedFieldRequiresNameValue}` };
	}
	if (!contentPages) return { valid: false, message: text.embedRequiresContent };
	return { valid: true, message: null };
}

// Convertit l’embed Discord.
export function embedSummaryToPayload(embed: NonNullable<MessageSummary["embeds"]>[number]): EmbedPayload {
	return {
		title: embed.title ?? undefined,
		description: embed.description ?? undefined,
		url: embed.url ?? undefined,
		color: embed.color ?? undefined,
		timestamp: embed.timestamp ?? undefined,
		author: embed.authorName
			? {
				name: embed.authorName,
				url: embed.authorUrl ?? undefined,
				iconUrl: embed.authorIconUrl ?? undefined
			}
			: undefined,
		footer: embed.footerText
			? {
				text: embed.footerText,
				iconUrl: embed.footerIconUrl ?? undefined
			}
			: undefined,
		imageUrl: embed.imageUrl ?? undefined,
		thumbnailUrl: embed.thumbnailUrl ?? undefined,
		fields: embed.fields
	};
}
