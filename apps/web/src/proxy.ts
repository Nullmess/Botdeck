// Proxy Next

import { NextResponse, type NextRequest } from "next/server";

// Autorise uniquement le local.
function isLoopbackHost(hostHeader: string | null): boolean {
	const host = (hostHeader ?? "").split(":")[0]?.toLowerCase();
	return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function securityHeaders(isDev: boolean): Record<string, string> {
	// Next.js injects small inline bootstrap scripts even in production.
	// Botdeck only accepts loopback hosts, so this keeps the desktop app simple
	// without leaving the local interface open to remote pages.
	const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
	return {
		"Content-Security-Policy": [
			"default-src 'self'",
			`script-src ${scriptSrc}`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https:",
			"font-src 'self' data:",
			"media-src 'self' blob: https:",
			"connect-src 'self' ws://127.0.0.1:* ws://localhost:* wss://127.0.0.1:* wss://localhost:*",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"frame-ancestors 'none'"
		].join("; "),
		"X-Content-Type-Options": "nosniff",
		"Referrer-Policy": "no-referrer",
		"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
		"X-Frame-Options": "DENY"
	};
}

function withSecurityHeaders(response: NextResponse): NextResponse {
	for (const [name, value] of Object.entries(securityHeaders(process.env.NODE_ENV !== "production"))) {
		response.headers.set(name, value);
	}
	return response;
}

// Bloque les requêtes hors local.
export function proxy(request: NextRequest) {
	if (process.env.BOTDECK_ALLOW_NETWORK === "true" || isLoopbackHost(request.headers.get("host"))) {
		return withSecurityHeaders(NextResponse.next());
	}

	return withSecurityHeaders(new NextResponse("Botdeck is restricted to localhost by default.", { status: 403 }));
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
