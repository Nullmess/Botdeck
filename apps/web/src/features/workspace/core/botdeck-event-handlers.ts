import type { MouseEvent } from "react";

export type ExternalLinkHandler = (url: string, label?: string) => void;

// Intercepte les liens externes pour afficher une confirmation UI.
export function handleExternalLinkClick(
	event: MouseEvent<HTMLAnchorElement>,
	url: string,
	label: string,
	onExternalLink?: ExternalLinkHandler
): void {
	if (!onExternalLink) return;
	event.preventDefault();
	onExternalLink(url, label);
}
