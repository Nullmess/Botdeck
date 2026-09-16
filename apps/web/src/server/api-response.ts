// Helpers API HTTP Botdeck.

type JsonHeaders = Record<string, string>;

export type ApiErrorBody = {
	ok: false;
	message: string;
	code?: string;
};

const noStoreHeaders = {
	"Cache-Control": "no-store, max-age=0"
} as const;

export function noStoreJson<T>(body: T, init: ResponseInit = {}): Response {
	return Response.json(body, {
		...init,
		headers: mergeHeaders(noStoreHeaders, init.headers)
	});
}

export function okJson<T extends Record<string, unknown>>(body: T, init: ResponseInit = {}): Response {
	return noStoreJson({ ok: true, ...body }, init);
}

export function errorJson(message: string, status = 400, code?: string, init: ResponseInit = {}): Response {
	return noStoreJson({ ok: false, message, ...(code ? { code } : {}) } satisfies ApiErrorBody, {
		...init,
		status
	});
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function mergeHeaders(defaults: JsonHeaders, incoming?: HeadersInit): Headers {
	const headers = new Headers(incoming);
	for (const [key, value] of Object.entries(defaults)) {
		if (!headers.has(key)) headers.set(key, value);
	}
	return headers;
}
