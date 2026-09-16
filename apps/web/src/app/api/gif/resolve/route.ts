// Résolution GIF Tenor/Giphy

export const dynamic = "force-dynamic";

import { errorJson, noStoreJson } from "@/server/api-response";

const directGifPattern = new RegExp(String.raw`https?://[^"'<>\s]+?\.(?:gif|webp)(?:\?[^"'<>\s]*)?`, "gi");
const tenorMediaPattern = new RegExp(String.raw`https?://media\.tenor\.com/[^"'<>\s]+?\.(?:gif|webp)(?:\?[^"'<>\s]*)?`, "gi");
const giphyMediaPattern = new RegExp(String.raw`https?://(?:media\d?\.giphy\.com|i\.giphy\.com)/[^"'<>\s]+?\.(?:gif|webp)(?:\?[^"'<>\s]*)?`, "gi");

// Nettoie l’URL résolue.
function cleanResolvedUrl(value: string): string {
	return value
		.replace(/\\\\\//g, "/")
		.replace(/&amp;/g, "&")
		.replace(/\\u0026/g, "&")
		.replace(/\\u003d/g, "=")
		.replace(/\\u003f/g, "?");
}

// Vérifie la source GIF.
function isAllowedSource(url: URL): boolean {
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	return host === "tenor.com"
		|| host === "media.tenor.com"
		|| host === "giphy.com"
		|| host.endsWith(".giphy.com")
		|| host === "i.giphy.com";
}

// Détecte un média direct.
function directMediaUrl(url: URL): string | null {
	const host = url.hostname.toLowerCase().replace(/^www\./, "");
	const path = url.pathname.toLowerCase();
	if (/\.(gif|webp)$/i.test(path) && (host === "media.tenor.com" || host.endsWith(".giphy.com") || host === "i.giphy.com")) {
		return url.toString();
	}
	return null;
}

// Extrait l’URL média.
function extractMediaUrl(html: string): string | null {
	const normalized = cleanResolvedUrl(html);
	const candidates = [
		...normalized.matchAll(tenorMediaPattern),
		...normalized.matchAll(giphyMediaPattern),
		...normalized.matchAll(directGifPattern)
	].map((match) => cleanResolvedUrl(match[0]));
	return candidates.find((candidate) => {
		try {
			const parsed = new URL(candidate);
			return parsed.protocol === "https:" && /\.(gif|webp)$/i.test(parsed.pathname);
		} catch {
			return false;
		}
	}) ?? null;
}

// Récupère le HTML distant.
async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		headers: {
			"accept": "text/html,application/json;q=0.9,*/*;q=0.8",
			"user-agent": "Botdeck/0.1 GIF resolver"
		}
	});
	if (!response.ok) throw new Error(`GIF resolver HTTP ${response.status}`);
	return response.text();
}

// Réponse HTTP légère.
export async function GET(request: Request) {
	const requestUrl = new URL(request.url);
	const rawUrl = requestUrl.searchParams.get("url")?.trim();
	if (!rawUrl) return errorJson("Missing url");

	let target: URL;
	try {
		target = new URL(rawUrl);
	} catch {
		return errorJson("Invalid url");
	}

	if (target.protocol !== "https:" || !isAllowedSource(target)) {
		return errorJson("Unsupported GIF provider");
	}

	const direct = directMediaUrl(target);
	if (direct) return noStoreJson({ ok: true, url: direct, sourceUrl: rawUrl });

	try {
		const html = await fetchText(target.toString());
		const mediaUrl = extractMediaUrl(html);
		if (mediaUrl) return noStoreJson({ ok: true, url: mediaUrl, sourceUrl: rawUrl });
	} catch {
		// Repli oEmbed.
	}

	try {
		const oembedUrl = target.hostname.toLowerCase().includes("tenor.com")
			? `https://tenor.com/oembed?url=${encodeURIComponent(target.toString())}`
			: `https://giphy.com/services/oembed?url=${encodeURIComponent(target.toString())}`;
		const oembedText = await fetchText(oembedUrl);
		const mediaUrl = extractMediaUrl(oembedText);
		if (mediaUrl) return noStoreJson({ ok: true, url: mediaUrl, sourceUrl: rawUrl });
	} catch {
		// Erreur propre, parsing masqué.
	}

	return errorJson("GIF media not found", 404);
}
