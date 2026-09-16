// Gestion TLS locale pour Botdeck.

import { createHash, createSign, generateKeyPairSync, randomBytes, X509Certificate } from "node:crypto";
import { existsSync } from "node:fs";
import net from "node:net";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import tls from "node:tls";

export type BotdeckTlsMode = "dual" | "https-only";

export type BotdeckTlsConfig = {
	enabled: true;
	mode: BotdeckTlsMode;
	host: string;
	httpPort: number;
	httpsPort: number;
	certificatePath: string;
	keyPath: string;
	generated: boolean;
	fingerprint: string;
	updatedAt: string;
	validFrom?: string | null;
	validTo?: string | null;
};

const defaultHttpPort = 3000;
const defaultHttpsPort = 3443;
const restartExitCode = 42;

function parsePort(value: string | undefined, fallback: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

export function normalizeHttpsPort(value: unknown, fallback = tlsHttpsPort()): number {
	const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
	if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) return fallback;
	return parsed;
}

export function botdeckDataDir(): string {
	return process.env.BOTDECK_DATA_DIR || process.env.BOTDECK_PROJECT_DIR && path.join(process.env.BOTDECK_PROJECT_DIR, ".botdeck") || path.join(process.cwd(), ".botdeck");
}

export function tlsDirectory(): string {
	return path.join(botdeckDataDir(), "tls");
}

export function tlsConfigPath(): string {
	return path.join(tlsDirectory(), "tls-config.json");
}

export function tlsHttpPort(): number {
	return parsePort(process.env.PORT || process.env.BOTDECK_HTTP_PORT, defaultHttpPort);
}

export function tlsHttpsPort(): number {
	return parsePort(process.env.BOTDECK_HTTPS_PORT, defaultHttpsPort);
}

export function tlsListenHost(): string {
	return process.env.HOST || "127.0.0.1";
}

export function isPrivilegedHttpsPort(httpsPort: number): boolean {
	return process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() !== 0 && httpsPort < 1024;
}

export function assertHttpsPortAllowed(httpsPort: number): void {
	if (!Number.isFinite(httpsPort) || httpsPort < 1 || httpsPort > 65535) {
		throw new Error("Choisis un port HTTPS valide entre 1024 et 65535.");
	}
	if (isPrivilegedHttpsPort(httpsPort)) {
		throw new Error(`Le port ${httpsPort} est un port système. Botdeck est lancé sans droits administrateur, donc HTTPS ne peut pas écouter dessus. Utilise plutôt 3443, 4443 ou un port supérieur à 1023.`);
	}
	if (httpsPort === tlsHttpPort()) {
		throw new Error(`Le port ${httpsPort} est déjà utilisé par HTTP. Choisis un port HTTPS différent.`);
	}
}

export async function assertHttpsPortCanListen(httpsPort: number, host = tlsListenHost()): Promise<void> {
	assertHttpsPortAllowed(httpsPort);
	await new Promise<void>((resolve, reject) => {
		const server = net.createServer();
		server.once("error", (error: NodeJS.ErrnoException) => {
			const code = error.code || "UNKNOWN";
			if (code === "EACCES") {
				reject(new Error(`Le port ${httpsPort} est refusé par le système. Utilise 3443, 4443 ou lance Botdeck avec les droits nécessaires.`));
				return;
			}
			if (code === "EADDRINUSE") {
				reject(new Error(`Le port ${httpsPort} est déjà utilisé. Choisis un autre port HTTPS.`));
				return;
			}
			reject(new Error(`Le port ${httpsPort} ne peut pas être utilisé pour HTTPS (${code}).`));
		});
		server.listen(httpsPort, host, () => {
			server.close(() => resolve());
		});
	});
}

export async function readTlsConfig(): Promise<BotdeckTlsConfig | null> {
	try {
		const payload = JSON.parse(await readFile(tlsConfigPath(), "utf8")) as Partial<BotdeckTlsConfig>;
		if (!payload.enabled || !payload.certificatePath || !payload.keyPath) return null;
		if (!existsSync(payload.certificatePath) || !existsSync(payload.keyPath)) return null;
		return {
			enabled: true,
			mode: payload.mode === "dual" ? "dual" : "https-only",
			host: canonicalLocalHost(payload.host || "127.0.0.1"),
			httpPort: payload.httpPort || tlsHttpPort(),
			httpsPort: payload.httpsPort || tlsHttpsPort(),
			certificatePath: payload.certificatePath,
			keyPath: payload.keyPath,
			generated: Boolean(payload.generated),
			fingerprint: payload.fingerprint || "",
			updatedAt: payload.updatedAt || new Date().toISOString(),
			validFrom: typeof payload.validFrom === "string" ? payload.validFrom : null,
			validTo: typeof payload.validTo === "string" ? payload.validTo : null
		};
	} catch {
		return null;
	}
}

export function canonicalLocalHost(host: string | undefined | null): string {
	const normalized = String(host || "").trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
	if (!normalized || normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") return "127.0.0.1";
	return normalized;
}

export function requestHost(request: Request): string {
	const raw = request.headers.get("x-forwarded-host") || request.headers.get("host") || "127.0.0.1:3000";
	const withoutPort = raw.replace(/^\[/, "").replace(/\](:\d+)?$/, "");
	const host = withoutPort.includes(":") && !withoutPort.includes(".") ? "::1" : withoutPort.split(":")[0] || "127.0.0.1";
	return canonicalLocalHost(host);
}

export function tlsUrls(request: Request, config?: Partial<BotdeckTlsConfig> | null) {
	const host = canonicalLocalHost(config?.host || requestHost(request));
	const httpPort = config?.httpPort || tlsHttpPort();
	const httpsPort = config?.httpsPort || tlsHttpsPort();
	return {
		host,
		httpUrl: `http://${host}:${httpPort}`,
		httpsUrl: `https://${host}:${httpsPort}`,
		httpPort,
		httpsPort
	};
}

function fingerprintFor(certificate: string): string {
	return createHash("sha256").update(certificate).digest("hex").match(/.{1,2}/g)?.join(":") ?? "";
}

function certificateDates(certificate: string): { validFrom: string | null; validTo: string | null } {
	try {
		const parsed = new X509Certificate(certificate);
		return {
			validFrom: new Date(parsed.validFrom).toISOString(),
			validTo: new Date(parsed.validTo).toISOString()
		};
	} catch {
		return { validFrom: null, validTo: null };
	}
}

async function removeFileBestEffort(filePath: string | undefined | null): Promise<void> {
	if (!filePath) return;
	try {
		await unlink(filePath);
	} catch {
		// Le fichier peut déjà avoir été supprimé.
	}
}

export function validateTlsPair(certificate: string, key: string): void {
	try {
		tls.createSecureContext({ cert: certificate, key });
	} catch (error) {
		throw new Error(error instanceof Error ? error.message : "Certificat TLS invalide.");
	}
}

export async function saveTlsPair(options: { certificate: string; key: string; host: string; generated: boolean; mode?: BotdeckTlsMode; httpsPort?: number }): Promise<BotdeckTlsConfig> {
	const dir = tlsDirectory();
	await mkdir(dir, { recursive: true });
	validateTlsPair(options.certificate, options.key);
	const previous = await readTlsConfig();
	const dates = certificateDates(options.certificate);

	const suffix = randomBytes(5).toString("hex");
	const certificatePath = path.join(dir, `botdeck-${suffix}.crt`);
	const keyPath = path.join(dir, `botdeck-${suffix}.key`);
	await writeFile(certificatePath, options.certificate, { mode: 0o600 });
	await writeFile(keyPath, options.key, { mode: 0o600 });

	const config: BotdeckTlsConfig = {
		enabled: true,
		mode: options.mode ?? "https-only",
		host: options.host,
		httpPort: tlsHttpPort(),
		httpsPort: normalizeHttpsPort(options.httpsPort, tlsHttpsPort()),
		certificatePath,
		keyPath,
		generated: options.generated,
		fingerprint: fingerprintFor(options.certificate),
		updatedAt: new Date().toISOString(),
		validFrom: dates.validFrom,
		validTo: dates.validTo
	};
	await writeFile(tlsConfigPath(), JSON.stringify(config, null, 2), { mode: 0o600 });
	if (previous?.certificatePath !== certificatePath) void removeFileBestEffort(previous?.certificatePath);
	if (previous?.keyPath !== keyPath) void removeFileBestEffort(previous?.keyPath);
	return config;
}

export async function updateTlsMode(mode: BotdeckTlsMode, request: Request): Promise<BotdeckTlsConfig> {
	const current = await readTlsConfig();
	if (!current) throw new Error("Aucun certificat TLS n’est encore configuré.");
	const next = { ...current, mode, host: current.host || requestHost(request), updatedAt: new Date().toISOString() };
	await mkdir(tlsDirectory(), { recursive: true });
	await writeFile(tlsConfigPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
	return next;
}

export async function updateTlsPort(httpsPort: number, request: Request): Promise<BotdeckTlsConfig> {
	const current = await readTlsConfig();
	if (!current) throw new Error("Aucun certificat TLS n’est encore configuré.");
	const next = {
		...current,
		host: current.host || requestHost(request),
		httpsPort: normalizeHttpsPort(httpsPort, current.httpsPort || tlsHttpsPort()),
		updatedAt: new Date().toISOString()
	};
	await mkdir(tlsDirectory(), { recursive: true });
	await writeFile(tlsConfigPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
	return next;
}

function derLength(length: number): Buffer {
	if (length < 0x80) return Buffer.from([length]);
	const bytes: number[] = [];
	let value = length;
	while (value > 0) {
		bytes.unshift(value & 0xff);
		value >>= 8;
	}
	return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag: number, ...parts: Buffer[]): Buffer {
	const body = Buffer.concat(parts);
	return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

function sequence(...parts: Buffer[]): Buffer {
	return der(0x30, ...parts);
}

function set(...parts: Buffer[]): Buffer {
	return der(0x31, ...parts);
}

function integer(value: number | Buffer): Buffer {
	let bytes: Buffer;
	if (typeof value === "number") {
		const parts: number[] = [];
		let current = value;
		do {
			parts.unshift(current & 0xff);
			current >>= 8;
		} while (current > 0);
		bytes = Buffer.from(parts);
	} else {
		bytes = Buffer.from(value);
		while (bytes.length > 1 && bytes[0] === 0 && (bytes[1] & 0x80) === 0) bytes = bytes.subarray(1);
	}
	if (bytes[0] & 0x80) bytes = Buffer.concat([Buffer.from([0]), bytes]);
	return der(0x02, bytes);
}

function oid(value: string): Buffer {
	const parts = value.split(".").map((part) => Number.parseInt(part, 10));
	if (parts.length < 2 || parts.some((part) => !Number.isFinite(part))) throw new Error(`OID invalide: ${value}`);
	const bytes = [parts[0] * 40 + parts[1]];
	for (const part of parts.slice(2)) {
		const encoded = [part & 0x7f];
		let current = part >> 7;
		while (current > 0) {
			encoded.unshift((current & 0x7f) | 0x80);
			current >>= 7;
		}
		bytes.push(...encoded);
	}
	return der(0x06, Buffer.from(bytes));
}

function nullValue(): Buffer {
	return Buffer.from([0x05, 0x00]);
}

function utf8(value: string): Buffer {
	return der(0x0c, Buffer.from(value, "utf8"));
}

function octetString(value: Buffer): Buffer {
	return der(0x04, value);
}

function bitString(value: Buffer, unusedBits = 0): Buffer {
	return der(0x03, Buffer.concat([Buffer.from([unusedBits]), value]));
}

function booleanValue(value: boolean): Buffer {
	return der(0x01, Buffer.from([value ? 0xff : 0x00]));
}

function context(tag: number, value: Buffer, constructed = true): Buffer {
	return der((constructed ? 0xa0 : 0x80) + tag, value);
}

function utcTime(date: Date): Buffer {
	const year = date.getUTCFullYear() % 100;
	const stamp = [
		year,
		date.getUTCMonth() + 1,
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds()
	].map((part) => String(part).padStart(2, "0")).join("");
	return der(0x17, Buffer.from(`${stamp}Z`, "ascii"));
}

function algorithmIdentifier(): Buffer {
	return sequence(oid("1.2.840.113549.1.1.11"), nullValue());
}

function commonName(value: string): Buffer {
	return sequence(set(sequence(oid("2.5.4.3"), utf8(value))));
}

function ipv4Bytes(value: string): Buffer | null {
	if (net.isIP(value) !== 4) return null;
	return Buffer.from(value.split(".").map((part) => Number.parseInt(part, 10)));
}

function safeDnsName(value: string): string | null {
	const normalized = value.trim().toLowerCase();
	if (!normalized || net.isIP(normalized)) return null;
	if (!/^[a-z0-9.-]+$/.test(normalized)) return null;
	return normalized;
}

function extension(oidValue: string, value: Buffer, critical = false): Buffer {
	return sequence(oid(oidValue), ...(critical ? [booleanValue(true)] : []), octetString(value));
}

function subjectAltName(host: string): Buffer {
	const names: Buffer[] = [context(2, Buffer.from("localhost", "ascii"), false), context(7, Buffer.from([127, 0, 0, 1]), false)];
	const ip = ipv4Bytes(host);
	if (ip && !ip.equals(Buffer.from([127, 0, 0, 1]))) names.push(context(7, ip, false));
	const dns = safeDnsName(host);
	if (dns && dns !== "localhost") names.push(context(2, Buffer.from(dns, "ascii"), false));
	return sequence(...names);
}

function pem(label: string, derValue: Buffer): string {
	const body = derValue.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
	return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

export async function generateLocalCertificate(host: string): Promise<{ certificate: string; key: string }> {
	const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
	const now = new Date();
	const validFrom = new Date(now.getTime() - 60_000);
	const validTo = new Date(now.getTime() + 825 * 24 * 60 * 60 * 1000);
	const subject = commonName("Botdeck Local");
	const publicKeyDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;
	const extensions = context(3, sequence(
		extension("2.5.29.19", sequence(), true),
		extension("2.5.29.15", bitString(Buffer.from([0xa0]), 5), true),
		extension("2.5.29.37", sequence(oid("1.3.6.1.5.5.7.3.1"))),
		extension("2.5.29.17", subjectAltName(host))
	));
	const tbsCertificate = sequence(
		context(0, integer(2)),
		integer(randomBytes(16)),
		algorithmIdentifier(),
		subject,
		sequence(utcTime(validFrom), utcTime(validTo)),
		subject,
		publicKeyDer,
		extensions
	);
	const signature = createSign("RSA-SHA256").update(tbsCertificate).end().sign(privateKey);
	const certificateDer = sequence(tbsCertificate, algorithmIdentifier(), bitString(signature));
	const keyDer = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
	return {
		certificate: pem("CERTIFICATE", certificateDer),
		key: pem("PRIVATE KEY", keyDer)
	};
}

export function scheduleTlsRestart(): boolean {
	if (process.env.BOTDECK_ALLOW_SERVER_RESTART !== "1") return false;
	setTimeout(() => process.exit(restartExitCode), 650);
	return true;
}

export function restartPayload(request: Request, config: BotdeckTlsConfig) {
	const urls = tlsUrls(request, config);
	return {
		ok: true,
		configured: true,
		mode: config.mode,
		httpsUrl: urls.httpsUrl,
		httpUrl: urls.httpUrl,
		httpPort: urls.httpPort,
		httpsPort: urls.httpsPort,
		restartRequired: true,
		willRestart: scheduleTlsRestart(),
		fingerprint: config.fingerprint,
		validFrom: config.validFrom ?? null,
		validTo: config.validTo ?? null
	};
}
