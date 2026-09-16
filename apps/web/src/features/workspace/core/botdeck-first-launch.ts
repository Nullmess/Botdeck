export const firstLaunchPresentationStorageKey = "botdeck:first-launch-presentation:v2";
export const firstLaunchPresentationCookieName = "botdeck_first_launch_presentation";
export const firstLaunchPresentationRedirectFlag = "botdeckFirstLaunch";

export function markFirstLaunchPresentationSeen(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(firstLaunchPresentationStorageKey, "seen");
	} catch {
		// LocalStorage peut être indisponible.
	}
	try {
		window.document.cookie = `${firstLaunchPresentationCookieName}=seen; Max-Age=31536000; Path=/; SameSite=Lax`;
	} catch {
		// Cookie indisponible: l'état local suffit pour cette origine.
	}
}

export function appendFirstLaunchRedirectFlag(targetUrl: string): string {
	if (typeof window === "undefined") return targetUrl;
	try {
		const url = new URL(targetUrl, window.location.href);
		url.searchParams.set(firstLaunchPresentationRedirectFlag, "done");
		return url.toString();
	} catch {
		return targetUrl;
	}
}

export function firstLaunchPresentationWasSeen(): boolean {
	if (typeof window === "undefined") return true;
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get(firstLaunchPresentationRedirectFlag) === "done") {
			markFirstLaunchPresentationSeen();
			return true;
		}
	} catch {
		// URL non lisible.
	}
	try {
		if (window.localStorage.getItem(firstLaunchPresentationStorageKey) === "seen") return true;
	} catch {
		// LocalStorage indisponible.
	}
	try {
		const cookieSeen = window.document.cookie
			.split(";")
			.map((entry) => entry.trim())
			.some((entry) => entry === `${firstLaunchPresentationCookieName}=seen`);
		if (cookieSeen) {
			markFirstLaunchPresentationSeen();
			return true;
		}
	} catch {
		// Cookie non lisible.
	}
	return false;
}

export function clearFirstLaunchRedirectFlag(): void {
	if (typeof window === "undefined") return;
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get(firstLaunchPresentationRedirectFlag) !== "done") return;
		url.searchParams.delete(firstLaunchPresentationRedirectFlag);
		const nextUrl = `${url.pathname}${url.search}${url.hash}`;
		window.history.replaceState(window.history.state, "", nextUrl || "/");
	} catch {
		// On garde l'URL telle quelle si l'historique n'est pas disponible.
	}
}

