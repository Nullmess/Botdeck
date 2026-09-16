"use client";

import { type MessageSummary, type WorkspaceState } from "@botdeck/shared";
import { useState } from "react";
import { i18nText, type UiText } from "./botdeck-app-i18n";
import { Badge } from "@/components/ui/badge";

export const appIconPath = "/app-icon.png?v=botdeck-local";


// Formate l’heure.
export function formatTime(iso: string): string {
	return new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Masque le discriminator Discord.
export function stripDiscriminator(label: string): string {
	return label.replace(/#\d{1,4}$/, "");
}

// Nom utilisateur affichable.
export function displayUserName(user?: WorkspaceState["usersById"][string] | null, fallback = "Unknown"): string {
	return stripDiscriminator(user?.displayName ?? user?.username ?? fallback);
}

// Auteur affichable du message.
export function displayMessageAuthor(message: MessageSummary, user?: WorkspaceState["usersById"][string] | null, fallback = "Unknown"): string {
	return stripDiscriminator(message.authorTag ?? user?.displayName ?? user?.username ?? fallback);
}

// Date issue du snowflake Discord.
export function discordSnowflakeCreatedAt(id: string): Date | null {
	try {
		const snowflake = BigInt(id);
		const discordEpoch = 1420070400000n;
		return new Date(Number((snowflake >> 22n) + discordEpoch));
	} catch {
		return null;
	}
}

// Accent profil déterministe.
export function profileAccentFromId(id: string): string {
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
	return `hsl(${hash} 72% 56%)`;
}

// Clé stable du message.
export function messageKey(message: MessageSummary): string {
	return `${message.id}-${message.channelId}`;
}

// Badge application.
export function AppBadge() {
	return <Badge tone="app">{i18nText("APP")}</Badge>;
}

// Badge commande Discord.
export function ApplicationCommandBadge({ label }: { label: string }) {
	return <Badge tone="command" title={label} aria-label={label}>{'{/}'}</Badge>;
}

// Icône épingle.
export function PinIcon({ className = "" }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
			<path d="M16.1 3.25 20.75 7.9a.9.9 0 0 1 0 1.27l-1.36 1.36a.9.9 0 0 1-.98.2l-1.88-.79-3.42 3.42.31 3.38a.9.9 0 0 1-.26.72l-.72.72-4.26-4.26-4.38 4.38-1.1-1.1 4.38-4.38-4.26-4.26.72-.72a.9.9 0 0 1 .72-.26l3.38.31 3.42-3.42-.79-1.88a.9.9 0 0 1 .2-.98l1.36-1.36a.9.9 0 0 1 1.27 0Z" />
		</svg>
	);
}


