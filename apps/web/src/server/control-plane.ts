// Control plane serveur

import { prisma } from "@/lib/prisma";
import {
	applyWorkspaceEvent,
	getReadOnlyCommandBlockKind,
	readOnlyBlockKindLabel,
	createWorkspaceState,
	type BotAccountSummary,
	type ClientCommand,
	type ClientEvent,
	type WorkspaceState
} from "@botdeck/shared";
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";
import { WebSocket, WebSocketServer } from "ws";
import { appendAuditLog } from "./audit-log";
import { createBrowserWebSocketAuthToken, validateWebSocketClient, validateWebSocketListenHost } from "./websocket-auth";
import { ensureDatabaseReady } from "./database-bootstrap";
import { loadRuntimeSecret } from "./runtime-secret";
import { decryptToken, encryptToken } from "./token-crypto";
import { loadWorkspaceBootstrap } from "./workspace-bootstrap";

import {
	BotAccountRow,
	CommandEnvelope,
	STARTUP_SESSION_CONCURRENCY,
	SnapshotEnvelope,
	browserCommandFailureMessage,
	isCommandEnvelope,
	normalizeBotToken,
	now,
	runWithConcurrency,
	safeJsonParse
} from "./control-plane-helpers";
import { BotSession } from "@/features/bot-session/server/bot-session";

function clientJsonStringify(value: unknown): string {
	return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
}

const ROLE_AUTOMATION_MAX_MESSAGES = 1000000;
const ROLE_AUTOMATION_MAX_VOICE_SECONDS = 1000000 * 60;
const ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS = 20000 * 86400;

const wsCommandBuckets = new Map<string, { count: number; resetAt: number }>();

function websocketListenHosts(configuredHost: string): string[] {
	const normalized = configuredHost.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
	if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") {
		return ["127.0.0.1", "::1"];
	}
	return [configuredHost];
}

function websocketHostLabel(host: string): string {
	return host.includes(":") ? `[${host}]` : host;
}

function commandRateLimitProfile(commandType: string): { windowMs: number; max: number } {
	if (/delete|ban|kick|timeout|recreate|purge|remove/i.test(commandType)) return { windowMs: 60_000, max: 10 };
	if (/create|update|send|edit|move|pin|react|automation|role|invite|presence|nick|archive|lock/i.test(commandType)) return { windowMs: 60_000, max: 60 };
	return { windowMs: 30_000, max: 120 };
}

function assertWebSocketCommandRateLimit(commandType: string): void {
	const profile = commandRateLimitProfile(commandType);
	const now = Date.now();
	const bucket = wsCommandBuckets.get(commandType);
	if (!bucket || bucket.resetAt <= now) {
		wsCommandBuckets.set(commandType, { count: 1, resetAt: now + profile.windowMs });
		return;
	}
	bucket.count += 1;
	if (bucket.count > profile.max) throw new Error("Action temporairement limitée. Réessaie dans quelques secondes.");
}

function commandShouldBeAudited(commandType: string): boolean {
	return /delete|ban|kick|timeout|recreate|purge|remove|create|update|send|edit|move|automation|role|invite|presence|nick|archive|lock/i.test(commandType);
}

function toRoleAutomationInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): number | null {
	if (value === undefined || value === null || value === "") return null;
	const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
	if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
	return Math.min(parsed, max);
}

function toRoleAutomationBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function assertBotWriteAccessEnabled(bot: BotSession | null | undefined, commandType: ClientCommand["type"]): void {
	const blockKind = getReadOnlyCommandBlockKind(bot?.account, commandType);
	if (blockKind) {
		throw new Error(`Mode lecture seule actif : ${readOnlyBlockKindLabel(blockKind)} bloqué.`);
	}
}

function assertServerAutomationManagementEnabled(bot: BotSession | null | undefined): void {
	assertBotWriteAccessEnabled(bot, "guild.automation.update");
}

function readPositiveIntegerLike(value: unknown): number | null {
	if (value === undefined || value === null || value === "") return null;
	const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number.parseInt(value.trim(), 10) : Number.NaN;
	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function invalidBrowserCommandMessage(payload: unknown): string {
	if (payload && typeof payload === "object") {
		const command = payload as Record<string, unknown>;
		if (command.type === "guild.roleAutomation.upsert") {
			if (typeof command.roleId !== "string" || !command.roleId.trim()) return "Sélectionne un rôle avant d’enregistrer cette règle automatique.";
			if (typeof command.guildId !== "string" || !command.guildId.trim()) return "Serveur introuvable pour cette règle automatique. Recharge l’interface puis réessaie.";
			const messages = readPositiveIntegerLike(command.minMessages);
			const voiceSeconds = readPositiveIntegerLike(command.minVoiceSeconds);
			const memberAgeSeconds = readPositiveIntegerLike(command.minMemberAgeSeconds);
			if (messages !== null && messages > ROLE_AUTOMATION_MAX_MESSAGES) return `Le nombre de messages doit rester inférieur ou égal à ${ROLE_AUTOMATION_MAX_MESSAGES.toLocaleString("fr-FR")}.`;
			if (voiceSeconds !== null && voiceSeconds > ROLE_AUTOMATION_MAX_VOICE_SECONDS) return "Le temps vocal demandé est trop élevé.";
			if (memberAgeSeconds !== null && memberAgeSeconds > ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS) return "L’ancienneté doit rester entre 0 et 20 000 jours.";
			return "Règle automatique invalide. Vérifie le rôle et les nombres saisis, puis réessaie.";
		}
	}
	return "Commande invalide ou incomplète. Recharge l’interface puis réessaie.";
}

// Orchestrateur d’exécution unique.
class BotdeckControlPlane {
	private readonly wsPort = Number.parseInt(process.env.BOTDECK_WS_PORT ?? "3001", 10) || 3001;
	private readonly wsHost = process.env.BOTDECK_WS_HOST ?? "127.0.0.1";
	private readonly sockets = new Set<WebSocket>();
	private readonly sessions = new Map<string, BotSession>();
	private state = createWorkspaceState();
	private readonly tokenKey: Buffer = loadRuntimeSecret();
	private wsServerStarted = false;
	private initPromise: Promise<void> | null = null;
	private startupPromise: Promise<void> | null = null;
	private readonly sessionStartPromises = new Map<string, Promise<void>>();

	public async init(): Promise<void> {
		if (this.wsServerStarted) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = this.initOnce().catch((error) => {
			this.initPromise = null;
			throw error;
		});

		return this.initPromise;
	}

	private async initOnce(): Promise<void> {
		await ensureDatabaseReady();
		await this.startWebSocketServer();
		// Restauration bots persistés.
		// Connexion Discord en arrière-plan.
		void this.startStoredBotSessions();
		await this.refreshState();
	}

	private async startWebSocketServer(): Promise<void> {
		if (this.wsServerStarted) return;

		const listenHostValidation = validateWebSocketListenHost(this.wsHost);
		if (!listenHostValidation.ok) throw new Error(listenHostValidation.message);

		await new Promise<void>((resolve, reject) => {
			let settled = false;
			let pending = 0;
			let plainListening = false;
			let secureListening = false;
			const certificatePath = process.env.BOTDECK_TLS_CERTIFICATE_PATH;
			const keyPath = process.env.BOTDECK_TLS_KEY_PATH;
			const useSecureSocket = Boolean(certificatePath && keyPath && existsSync(certificatePath) && existsSync(keyPath));
			const wssPort = Number.parseInt(process.env.BOTDECK_WSS_PORT ?? String(this.wsPort + 1), 10) || this.wsPort + 1;
			const listenHosts = websocketListenHosts(this.wsHost);

			const maybeSettle = () => {
				if (settled || pending > 0) return;
				if (plainListening && (!useSecureSocket || secureListening)) {
					settled = true;
					this.wsServerStarted = true;
					resolve();
					return;
				}
				settled = true;
				reject(new Error("Botdeck WebSocket could not listen on every required loopback endpoint."));
			};

			const failStartup = (error: NodeJS.ErrnoException) => {
				if (settled) {
					console.error("[botdeck:ws] runtime websocket error", error);
					return;
				}
				settled = true;
				reject(error);
			};

			const markUnavailable = (label: string, error: NodeJS.ErrnoException) => {
				const code = error.code || "UNKNOWN";
				if (code === "EADDRINUSE") {
					console.warn(
						`[botdeck:ws] ${label} is already in use. ` +
						"Keeping the HTTP app alive; stop the old process or change the WebSocket port."
					);
					return;
				}
				if (code === "EADDRNOTAVAIL" || code === "EINVAL") {
					console.warn(`[botdeck:ws] ${label} is not available on this machine (${code}); continuing with the other loopback host.`);
					return;
				}
				failStartup(error);
			};

			const handleProtocols = (protocols: Set<string>) => protocols.has("botdeck") ? "botdeck" : false;

			const verifyClient = (info: { req: IncomingMessage; origin: string }, done: (result: boolean, code?: number, message?: string) => void) => {
				const validation = validateWebSocketClient(info.req, info.origin);
				if (validation.ok) {
					done(true);
					return;
				}

				console.warn(`[botdeck:ws] rejected browser socket: ${validation.reason}`);
				done(false, 401, "Unauthorized");
			};

			const startPlainSocket = (host: string) => {
				let done = false;
				const finishAttempt = () => {
					if (done) return;
					done = true;
					pending -= 1;
				};
				pending += 1;
				const label = `ws://${websocketHostLabel(host)}:${this.wsPort}`;
				const wsServer = new WebSocketServer({
					host,
					port: this.wsPort,
					verifyClient,
					handleProtocols
				});
				wsServer.on("connection", (socket) => this.attachBrowser(socket));
				wsServer.once("error", (error: NodeJS.ErrnoException) => {
					finishAttempt();
					markUnavailable(label, error);
					maybeSettle();
				});
				wsServer.once("listening", () => {
					plainListening = true;
					finishAttempt();
					console.info(`[botdeck:ws] listening ${label}`);
					maybeSettle();
				});
			};

			const startSecureSocket = (host: string) => {
				let done = false;
				const finishAttempt = () => {
					if (done) return;
					done = true;
					pending -= 1;
				};
				pending += 1;
				const label = `wss://${websocketHostLabel(host)}:${wssPort}`;
				const tlsServer = createHttpsServer({
					cert: readFileSync(certificatePath as string),
					key: readFileSync(keyPath as string)
				});
				const wssServer = new WebSocketServer({ server: tlsServer, verifyClient, handleProtocols });
				wssServer.on("connection", (socket) => this.attachBrowser(socket));
				wssServer.once("error", (error: NodeJS.ErrnoException) => {
					finishAttempt();
					markUnavailable(label, error);
					maybeSettle();
				});
				tlsServer.once("error", (error: NodeJS.ErrnoException) => {
					finishAttempt();
					markUnavailable(label, error);
					maybeSettle();
				});
				tlsServer.once("listening", () => {
					secureListening = true;
					finishAttempt();
					console.info(`[botdeck:ws] listening ${label}`);
					maybeSettle();
				});
				tlsServer.listen(wssPort, host);
			};

			for (const host of listenHosts) startPlainSocket(host);
			if (useSecureSocket) for (const host of listenHosts) startSecureSocket(host);

		});
	}

	public createBrowserAuthToken(): string {
		return createBrowserWebSocketAuthToken();
	}

	public createBrowserWebSocketUrl(request?: Request): string {
		const hostHeader = request?.headers.get("x-forwarded-host") || request?.headers.get("host") || "127.0.0.1:3000";
		const rawHost = hostHeader.replace(/^\[/, "").replace(/\](:\d+)?$/, "");
		const hostname = rawHost.includes(":") && !rawHost.includes(".") ? "127.0.0.1" : (rawHost.split(":")[0] || "127.0.0.1");
		const normalized = hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1" ? "127.0.0.1" : hostname;
		return `ws://${normalized}:${this.wsPort}`;
	}

	public async getStatus(): Promise<{ bots: BotAccountSummary[]; workspace: WorkspaceState }> {
		await this.init();
		await ensureDatabaseReady();
		void this.startStoredBotSessions();
		await this.refreshState();
		const bots = await this.listBots();
		this.state = applyWorkspaceEvent(this.state, { type: "state.bots", bots });
		return {
			bots,
			workspace: this.state
		};
	}

	public async addBot(token: string, name = "Botdeck Bot", readOnlyOptions: { readOnlyMode?: boolean; readOnlyBlockMessages?: boolean; readOnlyBlockChannels?: boolean; readOnlyBlockModeration?: boolean } | boolean = false): Promise<BotAccountSummary> {
		await ensureDatabaseReady();
		const normalizedToken = normalizeBotToken(token);
		if (!normalizedToken) {
			throw new Error("Bot token is required.");
		}
		const readOnlyMode = typeof readOnlyOptions === "boolean" ? readOnlyOptions : readOnlyOptions.readOnlyMode === true;
		const readOnlyBlockMessages = readOnlyMode && typeof readOnlyOptions === "object" && readOnlyOptions.readOnlyBlockMessages === true;
		const readOnlyBlockChannels = readOnlyMode && typeof readOnlyOptions === "object" && readOnlyOptions.readOnlyBlockChannels === true;
		const readOnlyBlockModeration = readOnlyMode && typeof readOnlyOptions === "object" && readOnlyOptions.readOnlyBlockModeration === true;
		const rows: BotAccountRow[] = await prisma.botAccount.findMany({ orderBy: { updatedAt: "desc" } });
		for (const row of rows) {
			const storedToken = decryptToken(
				{
					ciphertext: row.tokenCiphertext,
					iv: row.tokenIv,
					authTag: row.tokenAuthTag
				},
				this.tokenKey
			);
			if (storedToken === normalizedToken) {
				const nextReadOnlyMode = Boolean(readOnlyMode);
				const nextPolicy = {
					readOnlyMode: nextReadOnlyMode,
					commandStudioDisabled: nextReadOnlyMode,
					readOnlyBlockMessages,
					readOnlyBlockChannels,
					readOnlyBlockModeration
				};
				if (
					(row.readOnlyMode === true || row.commandStudioDisabled === true) !== nextReadOnlyMode
					|| Boolean(row.readOnlyBlockMessages) !== readOnlyBlockMessages
					|| Boolean(row.readOnlyBlockChannels) !== readOnlyBlockChannels
					|| Boolean(row.readOnlyBlockModeration) !== readOnlyBlockModeration
				) {
					await prisma.botAccount.update({ where: { id: row.id }, data: nextPolicy }).catch(() => undefined);
					Object.assign(row, nextPolicy);
				}
				await this.syncBotSession(row.id).catch(() => undefined);
				await this.selectBot(row.id);
				await this.refreshState();
				return this.readBotSummary(row.id);
			}
		}
		const encrypted = encryptToken(normalizedToken, this.tokenKey);
		const bot = await prisma.botAccount.create({
			data: {
				name,
				tokenCiphertext: encrypted.ciphertext,
				tokenIv: encrypted.iv,
				tokenAuthTag: encrypted.authTag,
				enabled: true,
				readOnlyMode,
				readOnlyBlockMessages,
				readOnlyBlockChannels,
				readOnlyBlockModeration,
				commandStudioDisabled: readOnlyMode
			}
		});

		try {
			await this.syncBotSession(bot.id);
			await this.selectBot(bot.id);
			await this.refreshState();
			return this.readBotSummary(bot.id);
		} catch (error) {
			await prisma.botAccount.delete({ where: { id: bot.id } }).catch(() => undefined);
			await this.refreshState();
			throw error;
		}
	}

	private async purgeBotFromDatabase(botId: string): Promise<void> {
		await prisma.$transaction(async (tx: any) => {
			await tx.applicationCommandDefinition.deleteMany({ where: { botAccountId: botId } });
			await tx.presence.deleteMany({ where: { botAccountId: botId } });
			await tx.message.deleteMany({ where: { botAccountId: botId } });
			await tx.channel.deleteMany({ where: { botAccountId: botId } });
			await tx.user.deleteMany({ where: { botAccountId: botId } });
			await tx.guild.deleteMany({ where: { botAccountId: botId } });
			await tx.botAccount.deleteMany({ where: { id: botId } });
		});
	}

	public async removeBot(botId: string): Promise<void> {
		await ensureDatabaseReady();
		const session = this.sessions.get(botId);
		if (session) {
			await session.stop().catch(() => undefined);
			this.sessions.delete(botId);
		}

		await this.purgeBotFromDatabase(botId);

		const bots = await this.listBots();
		this.state = createWorkspaceState({ bots });
		this.broadcast({ type: "state.bots", bots });
		this.broadcastSnapshot();
		this.broadcast({ type: "audit.log", level: "info", message: "Bot removed and purged from storage.", context: { botId } });
	}

	public async listBots(): Promise<BotAccountSummary[]> {
		await ensureDatabaseReady();
		const rows: BotAccountRow[] = await prisma.botAccount.findMany({ orderBy: { updatedAt: "desc" } });
		return rows.map((bot) =>
			this.toBotSummary({
				...bot,
				discordUserId: bot.discordUserId ?? null,
				avatarUrl: bot.avatarUrl ?? null,
				lastConnectedAt: bot.lastConnectedAt ?? null,
				lastError: bot.lastError ?? null,
				readOnlyMode: (bot.readOnlyMode === true || bot.commandStudioDisabled === true),
				readOnlyBlockMessages: Boolean(bot.readOnlyBlockMessages),
				readOnlyBlockChannels: Boolean(bot.readOnlyBlockChannels),
				readOnlyBlockModeration: Boolean(bot.readOnlyBlockModeration),
				commandStudioDisabled: Boolean(bot.commandStudioDisabled || bot.readOnlyMode)
			})
		);
	}

	private async readBotSummary(botId: string): Promise<BotAccountSummary> {
		const row = await prisma.botAccount.findUnique({ where: { id: botId } });
		if (!row) throw new Error("Bot account was not found after startup.");

		return this.toBotSummary({
			...row,
			discordUserId: row.discordUserId ?? null,
			avatarUrl: row.avatarUrl ?? null,
			lastConnectedAt: row.lastConnectedAt ?? null,
			lastError: row.lastError ?? null,
			readOnlyMode: (row.readOnlyMode === true || row.commandStudioDisabled === true),
			readOnlyBlockMessages: Boolean(row.readOnlyBlockMessages),
			readOnlyBlockChannels: Boolean(row.readOnlyBlockChannels),
			readOnlyBlockModeration: Boolean(row.readOnlyBlockModeration),
			commandStudioDisabled: Boolean(row.commandStudioDisabled || row.readOnlyMode)
		});
	}

	public async selectBot(botId: string): Promise<void> {
		const previous = this.state;
		let session = this.sessions.get(botId);

		if (!session) {
			const storedBot = await prisma.botAccount.findUnique({ where: { id: botId } });
			if (!storedBot) {
				throw new Error("Bot account was not found.");
			}
			if (!storedBot.enabled) {
				throw new Error("This bot is disabled.");
			}

			// UI ouverte avant login Discord.
			// Hydratation SQLite puis sync arrière-plan.
			session = await this.ensureBotSession(storedBot);
			void this.startBotSession(storedBot).catch((error) => {
				this.broadcast({
					type: "audit.log",
					level: "error",
					message: "Selected bot failed to start.",
					context: { botId, error: error instanceof Error ? error.message : "Unknown startup failure" }
				});
			});
		}

		this.state = session
			? {
				...session.snapshot(),
				selectedBotId: botId,
				bots: previous.bots,
				logs: previous.logs
			}
			: createWorkspaceState({
				connected: previous.connected,
				selectedBotId: botId,
				bots: previous.bots,
				logs: previous.logs
			});
		await this.persistState();
		this.broadcastSnapshot();
		if (session?.status === "online") {
			void session.refreshWorkspace().catch((error) => {
				this.broadcast({
					type: "audit.log",
					level: "error",
					message: "Failed to refresh selected bot workspace.",
					context: { botId, error: error instanceof Error ? error.message : "Unknown workspace refresh failure" }
				});
			});
		}
	}

	public async handleBrowserCommand(socket: WebSocket, command: CommandEnvelope): Promise<void> {
		assertWebSocketCommandRateLimit(command.type);
		const bot = command.type === "ping" || command.type === "bot.select" ? null : this.withBot(command.botId);
		assertBotWriteAccessEnabled(bot, command.type);
		switch (command.type) {
			case "ping":
				socket.send(clientJsonStringify({ type: "pong", requestId: command.requestId, sentAt: now() }));
				return;
			case "bot.select":
				await this.selectBot(command.botId);
				return;
			case "channel.sync":
				await bot?.syncChannelHistory(command.channelId, command.limit ?? 50);
				return;
			case "channel.pins":
				await bot?.syncChannelPins(command.channelId);
				return;
			case "channel.move":
				await bot?.enqueueAction("channel.move", () => bot.moveGuildChannel(command.guildId, command.channelId, command.targetId, command.placement));
				return;
			case "channel.delete":
				await bot?.enqueueAction("channel.delete", () => bot.deleteGuildChannel(command.guildId, command.channelId));
				return;
			case "channel.recreatePurge":
				await bot?.enqueueAction("channel.recreatePurge", () => bot.recreatePurgeGuildChannel(command.guildId, command.channelId, {
					reason: command.reason,
					transcript: false,
					finishMessage: false,
					confirmation: command.confirmation
				}));
				return;
			case "guild.profile.update":
				await bot?.enqueueAction("guild.profile.update", () => bot.updateGuildProfile(command.guildId, { name: command.name, description: command.description, iconDataUrl: command.iconDataUrl }));
				return;
			case "guild.members.fetch":
				await bot?.enqueueAction("guild.members.fetch", () => bot.fetchGuildMembers(command.guildId));
				return;
			case "guild.roles.fetch":
				await bot?.enqueueAction("guild.roles.fetch", () => bot.fetchGuildRoles(command.guildId));
				return;
			case "guild.invites.fetch":
				await bot?.enqueueAction("guild.invites.fetch", () => bot.fetchGuildInvites(command.guildId));
				return;
			case "guild.invite.create":
				await bot?.enqueueAction("guild.invite.create", () => bot.createGuildInvite(command.guildId, command.channelId, { maxAge: command.maxAge, maxUses: command.maxUses, temporary: command.temporary, unique: command.unique, reason: command.reason }));
				return;
			case "guild.invite.delete":
				await bot?.enqueueAction("guild.invite.delete", () => bot.deleteGuildInvite(command.guildId, command.code));
				return;
			case "guild.bans.fetch":
				await bot?.enqueueAction("guild.bans.fetch", () => bot.fetchGuildBans(command.guildId));
				return;
			case "guild.ban.create":
				await bot?.enqueueAction("guild.ban.create", () => bot.createGuildBan(command.guildId, command.userId, { reason: command.reason, deleteMessageSeconds: command.deleteMessageSeconds }));
				return;
			case "guild.ban.delete":
				await bot?.enqueueAction("guild.ban.delete", () => bot.deleteGuildBan(command.guildId, command.userId, command.reason));
				return;
			case "guild.automation.fetch":
				await bot?.enqueueAction("guild.automation.fetch", () => bot.syncGuildAutomationConfig(command.guildId));
				return;
			case "guild.automation.update":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction(`guild.automation.${command.kind}.update`, () => bot.updateGuildAutomationConfig({
					guildId: command.guildId,
					kind: command.kind,
					channelId: command.channelId,
					messageType: command.messageType,
					messageTemplate: command.messageTemplate,
					embedPagesJson: command.embedPagesJson,
					eventConfigsJson: command.eventConfigsJson
				}));
				return;
			case "guild.automation.remove":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction(`guild.automation.${command.kind}.remove`, () => bot.removeGuildAutomationConfig(command.guildId, command.kind));
				return;
			case "guild.automation.test":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction(`guild.automation.${command.kind}.test`, () => bot.testGuildAutomationConfig(command.guildId, command.kind));
				return;
			case "guild.roleAutomation.upsert":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction("guild.roleAutomation.upsert", () => bot.upsertGuildRoleAutomationRule(command.guildId, {
					ruleId: command.ruleId ?? null,
					roleId: command.roleId,
					enabled: toRoleAutomationBoolean(command.enabled, true),
					conditionMode: command.conditionMode === "any" ? "any" : "all",
					minMessages: toRoleAutomationInteger(command.minMessages, ROLE_AUTOMATION_MAX_MESSAGES),
					minVoiceSeconds: toRoleAutomationInteger(command.minVoiceSeconds, ROLE_AUTOMATION_MAX_VOICE_SECONDS),
					minMemberAgeSeconds: toRoleAutomationInteger(command.minMemberAgeSeconds, ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS),
					removeWhenInvalid: toRoleAutomationBoolean(command.removeWhenInvalid, false),
					ignoreBots: toRoleAutomationBoolean(command.ignoreBots, true),
					applyToExistingMembers: toRoleAutomationBoolean(command.applyToExistingMembers, false)
				}));
				return;
			case "guild.roleAutomation.delete":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction("guild.roleAutomation.delete", () => bot.deleteGuildRoleAutomationRule(command.guildId, command.ruleId));
				return;
			case "guild.roleAutomation.test":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction("guild.roleAutomation.test", () => bot.testGuildRoleAutomation(command.guildId, command.ruleId ?? null));
				return;
			case "guild.roleAutomation.sync":
				assertServerAutomationManagementEnabled(bot);
				await bot?.enqueueAction("guild.roleAutomation.sync", () => bot.syncGuildRoleAutomation(command.guildId));
				return;
			case "guild.role.create":
				await bot?.enqueueAction("guild.role.create", () => bot.createGuildRole(command.guildId, { name: command.name, color: command.color, permissions: command.permissions, hoist: command.hoist, mentionable: command.mentionable }));
				return;
			case "guild.role.update":
				await bot?.enqueueAction("guild.role.update", () => bot.updateGuildRole(command.guildId, command.roleId, { name: command.name, color: command.color, permissions: command.permissions, hoist: command.hoist, mentionable: command.mentionable }));
				return;
			case "guild.role.permissions.update":
				await bot?.enqueueAction("guild.role.permissions.update", () => bot.updateGuildRolePermissions(command.guildId, command.roleId, command.permissions));
				return;
			case "guild.role.delete":
				await bot?.enqueueAction("guild.role.delete", () => bot.deleteGuildRole(command.guildId, command.roleId));
				return;
			case "forum.posts.fetch":
				await bot?.enqueueAction("forum.posts.fetch", () => bot.syncForumPosts(command.forumId, command.includeArchived ?? true));
				return;
			case "forum.post.create":
				await bot?.enqueueAction("forum.post.create", () => bot.createForumPost(command.forumId, command.title, command.content, command.tagIds ?? []));
				return;
			case "forum.post.delete":
				await bot?.enqueueAction("forum.post.delete", () => bot.deleteForumPost(command.threadId));
				return;
			case "forum.post.archive":
				await bot?.enqueueAction("forum.post.archive", () => bot.setForumPostArchived(command.threadId, command.archived));
				return;
			case "forum.post.lock":
				await bot?.enqueueAction("forum.post.lock", () => bot.setForumPostLocked(command.threadId, command.locked));
				return;
			case "message.context":
				await bot?.syncMessageContext(command.channelId, command.messageId, command.limit ?? 80);
				return;
			case "dm.open":
				await bot?.enqueueAction("dm.open", () => bot.openDirectThread(command.userId, command.limit ?? 50));
				return;
			case "message.send":
				await bot?.enqueueAction("message.send", () => bot.sendMessage(command.channelId, command.content, command.replyToMessageId, command.attachments, command.embeds, command.embedPagination));
				return;
			case "message.edit":
				await bot?.enqueueAction("message.edit", () => bot.editMessage(command.channelId, command.messageId, command.content));
				return;
			case "message.delete":
				await bot?.enqueueAction("message.delete", () => bot.deleteMessage(command.channelId, command.messageId));
				return;
			case "message.pin":
				await bot?.enqueueAction("message.pin", () => bot.setMessagePinned(command.channelId, command.messageId, command.pinned));
				return;
			case "message.react":
				await bot?.enqueueAction("message.react", () => bot.reactToMessage(command.channelId, command.messageId, command.emoji));
				return;
			case "message.unreact":
				await bot?.enqueueAction("message.unreact", () => bot.unreactToMessage(command.channelId, command.messageId, command.emoji));
				return;
			case "presence.set":
				await bot?.enqueueAction("presence.set", () => bot.setPresence(command.status, command.activities ?? command.activity));
				return;
			case "user.profile":
				await bot?.enqueueAction("user.profile", () => bot.fetchUserProfile(command.userId));
				return;
			case "member.profile":
				await bot?.enqueueAction("member.profile", () => bot.fetchMemberProfile(command.guildId, command.userId));
				return;
			case "member.timeout":
				await bot?.enqueueAction("member.timeout", () => bot.setMemberTimeout(command.guildId, command.userId, command.until, command.reason));
				return;
			case "member.kick":
				await bot?.enqueueAction("member.kick", () => bot.kickMember(command.guildId, command.userId, command.reason));
				return;
			case "member.nick.set":
				await bot?.enqueueAction("member.nick.set", () => bot.setMemberNickname(command.guildId, command.userId, command.nickname));
				return;
			case "member.ban":
				await bot?.enqueueAction("member.ban", () => bot.banMember(command.guildId, command.userId, command.reason, command.deleteMessageSeconds));
				return;
			case "member.unban":
				await bot?.enqueueAction("member.unban", () => bot.unbanMember(command.guildId, command.userId, command.reason));
				return;
			case "member.role.add":
				await bot?.enqueueAction("member.role.add", () => bot.addMemberRole(command.guildId, command.userId, command.roleId));
				return;
			case "member.role.remove":
				await bot?.enqueueAction("member.role.remove", () => bot.removeMemberRole(command.guildId, command.userId, command.roleId));
				return;
			case "voice.member.move":
				await bot?.enqueueAction("voice.member.move", () => bot.moveVoiceMember(command.guildId, command.userId, command.channelId));
				return;
			case "applicationCommands.fetch": {
				// Lecture seule: aucune écriture Discord.
				const result = await bot?.enqueueAction("applicationCommands.fetch", () => bot.fetchApplicationCommands(command.guildId, Boolean(command.allGuilds)));
				if (result && bot && socket.readyState === WebSocket.OPEN) {
					socket.send(clientJsonStringify({
						type: "applicationCommands.list",
						botId: bot.account.id,
						guildId: command.guildId ?? null,
						globalCommands: result.globalCommands,
						guildCommands: result.guildCommands,
						partialError: result.partialError ?? null
					} satisfies ClientEvent));
				}
				return;
			}
			case "applicationCommand.create": {
				if (command.apply !== true) throw new Error("Application command write blocked: explicit apply is required.");
				const created = await bot?.enqueueAction("applicationCommand.create", () => bot.createApplicationCommand(command.draft));
				if (created && bot && socket.readyState === WebSocket.OPEN) {
					socket.send(clientJsonStringify({ type: "applicationCommand.created", botId: bot.account.id, command: created } satisfies ClientEvent));
				}
				return;
			}
			case "applicationCommand.update": {
				if (command.apply !== true) throw new Error("Application command write blocked: explicit apply is required.");
				const updated = await bot?.enqueueAction("applicationCommand.update", () => bot.updateApplicationCommand(command.commandId, command.draft));
				if (updated && bot && socket.readyState === WebSocket.OPEN) {
					socket.send(clientJsonStringify({ type: "applicationCommand.updated", botId: bot.account.id, command: updated } satisfies ClientEvent));
				}
				return;
			}
			case "applicationCommand.delete":
				if (command.apply !== true) throw new Error("Application command delete blocked: explicit apply is required.");
				await bot?.enqueueAction("applicationCommand.delete", () => bot.deleteApplicationCommand(command.commandId, command.scope, command.guildId));
				if (bot && socket.readyState === WebSocket.OPEN) {
					socket.send(clientJsonStringify({
						type: "applicationCommand.deleted",
						botId: bot.account.id,
						commandId: command.commandId,
						scope: command.scope,
						guildId: command.guildId ?? null
					} satisfies ClientEvent));
				}
				return;
			default:
				throw new Error(`Unsupported command ${(command as ClientCommand).type}`);
		}
	}

	private attachBrowser(socket: WebSocket): void {
		this.sockets.add(socket);
		socket.send(clientJsonStringify({ type: "snapshot", state: this.state } satisfies SnapshotEnvelope));

		socket.on("message", async (raw) => {
			const payload = safeJsonParse(raw.toString());
			if (!isCommandEnvelope(payload)) {
				const fallback = payload && typeof payload === "object" ? payload as { requestId?: unknown; type?: unknown } : null;
				if (socket.readyState === WebSocket.OPEN && typeof fallback?.requestId === "string" && typeof fallback?.type === "string") {
					socket.send(clientJsonStringify({ type: "command.failed", requestId: fallback.requestId, command: fallback.type as ClientCommand["type"], message: invalidBrowserCommandMessage(payload) } satisfies ClientEvent));
				}
				return;
			}
			try {
				await this.handleBrowserCommand(socket, payload);
				if (commandShouldBeAudited(payload.type)) {
					void appendAuditLog({ level: "info", action: `ws.${payload.type}`, message: "Browser command completed.", context: { requestId: payload.requestId, command: payload.type, botId: "botId" in payload ? payload.botId : undefined } });
				}
				if (socket.readyState === WebSocket.OPEN) {
					socket.send(clientJsonStringify({ type: "command.completed", requestId: payload.requestId, command: payload.type } satisfies ClientEvent));
				}
			} catch (error) {
				const message = browserCommandFailureMessage(error, payload.type);
				if (socket.readyState === WebSocket.OPEN) {
					socket.send(clientJsonStringify({ type: "command.failed", requestId: payload.requestId, command: payload.type, message } satisfies ClientEvent));
				}
				this.broadcast({
					type: "audit.log",
					level: "error",
					message: "Command failed.",
					context: { requestId: payload.requestId, command: payload.type, error: message }
				});
			}
		});

		socket.on("close", () => {
			this.sockets.delete(socket);
		});
	}

	private broadcast(event: ClientEvent): void {
		if (event.type === "audit.log") {
			void appendAuditLog({ level: event.level === "warn" ? "warning" : event.level, action: "runtime.audit", message: event.message, context: event.context });
		}
		this.state = applyWorkspaceEvent(this.state, event);
		const payload = clientJsonStringify(event);
		for (const socket of this.sockets) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(payload);
			}
		}
		if (process.env.BOTDECK_DEBUG_WS === "1") console.log(payload);
	}

	private async refreshState(): Promise<void> {
		await this.reconcileSessionsWithStoredBots();
		const previousState = this.state;
		const nextState = await loadWorkspaceBootstrap(previousState.selectedBotId);
		const canReuseRuntimeSnapshot = Boolean(previousState.selectedBotId && this.sessions.has(previousState.selectedBotId));
		let selectedGuildId = nextState.selectedGuildId;
		if (previousState.selectedGuildId && nextState.guilds.some((guild) => guild.id === previousState.selectedGuildId)) {
			selectedGuildId = previousState.selectedGuildId;
		}

		const guilds = nextState.guilds.length || !canReuseRuntimeSnapshot ? nextState.guilds : previousState.guilds;
		const channelsByGuild =
			Object.keys(nextState.channelsByGuild).length > 0 || !canReuseRuntimeSnapshot ? nextState.channelsByGuild : previousState.channelsByGuild;
		const messagesByChannel =
			Object.keys(previousState.messagesByChannel).length > 0 && canReuseRuntimeSnapshot ? previousState.messagesByChannel : nextState.messagesByChannel;
		const usersById = Object.keys(previousState.usersById).length > 0 && canReuseRuntimeSnapshot ? previousState.usersById : nextState.usersById;
		const rolesByGuildId =
			Object.keys(previousState.rolesByGuildId).length > 0 && canReuseRuntimeSnapshot ? previousState.rolesByGuildId : nextState.rolesByGuildId;
		const membersByGuildId =
			Object.keys(previousState.membersByGuildId).length > 0 && canReuseRuntimeSnapshot ? previousState.membersByGuildId : nextState.membersByGuildId;
		const invitesByGuildId =
			Object.keys(previousState.invitesByGuildId).length > 0 && canReuseRuntimeSnapshot ? previousState.invitesByGuildId : nextState.invitesByGuildId;
		const bansByGuildId =
			Object.keys(previousState.bansByGuildId).length > 0 && canReuseRuntimeSnapshot ? previousState.bansByGuildId : nextState.bansByGuildId;
		const memberProfilesByKey =
			Object.keys(previousState.memberProfilesByKey).length > 0 && canReuseRuntimeSnapshot ? previousState.memberProfilesByKey : nextState.memberProfilesByKey;
		const presencesByUserId =
			Object.keys(previousState.presencesByUserId).length > 0 && canReuseRuntimeSnapshot ? previousState.presencesByUserId : nextState.presencesByUserId;

		let selectedChannelId = nextState.selectedChannelId;
		if (
			previousState.selectedChannelId &&
			selectedGuildId &&
			channelsByGuild[selectedGuildId]?.some((channel) => channel.id === previousState.selectedChannelId)
		) {
			selectedChannelId = previousState.selectedChannelId;
		}

		this.state = {
			...nextState,
			guilds,
			channelsByGuild,
			connected: previousState.connected,
			botClientId: previousState.botClientId,
			lastSyncAt: previousState.lastSyncAt,
			selectedGuildId,
			selectedChannelId,
			messagesByChannel,
			usersById,
			rolesByGuildId,
			membersByGuildId,
			invitesByGuildId,
			bansByGuildId,
			memberProfilesByKey,
			presencesByUserId,
			voiceByGuildId: previousState.voiceByGuildId,
			logs: previousState.logs
		};
		if (previousState.selectedBotId && this.state.bots.some((bot) => bot.id === previousState.selectedBotId)) {
			this.state = applyWorkspaceEvent(this.state, { type: "bot.select", botId: previousState.selectedBotId });
		}
		const bots = await this.listBots();
		this.state = applyWorkspaceEvent(this.state, { type: "state.bots", bots });
		this.broadcast({ type: "state.bots", bots });
		this.broadcastSnapshot();
		await this.persistState();
	}

	private async reconcileSessionsWithStoredBots(rows?: BotAccountRow[]): Promise<BotAccountRow[]> {
		await ensureDatabaseReady();
		const storedRows = rows ?? await prisma.botAccount.findMany({ orderBy: { updatedAt: "desc" } });
		const storedIds = new Set(storedRows.map((row: BotAccountRow) => row.id));
		await Promise.all([...this.sessions.entries()].map(async ([botId, session]) => {
			if (storedIds.has(botId)) return;
			await session.stop().catch(() => undefined);
			this.sessions.delete(botId);
		}));
		if (this.state.selectedBotId && !storedIds.has(this.state.selectedBotId)) {
			this.state = createWorkspaceState({ bots: storedRows.map((row: BotAccountRow) => this.toBotSummary(row)) });
		}
		return storedRows;
	}

	private broadcastSnapshot(): void {
		const payload = clientJsonStringify({ type: "snapshot", state: this.state } satisfies SnapshotEnvelope);
		for (const socket of this.sockets) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(payload);
			}
		}
	}

	private async persistState(): Promise<void> {
		const bots = await this.listBots();
		this.state = applyWorkspaceEvent(this.state, { type: "state.bots", bots });
	}

	private async refreshBotList(): Promise<void> {
		const bots = await this.listBots();
		this.state = applyWorkspaceEvent(this.state, { type: "state.bots", bots });
		this.broadcast({ type: "state.bots", bots });
		this.broadcastSnapshot();
	}

	private publishBotEvent(botId: string, event: ClientEvent): void {
		if (event.type === "audit.log") {
			this.broadcast(event);
			return;
		}
		if (this.state.selectedBotId === botId) {
			this.broadcast(event);
		}
	}

	private async syncBotSessions(): Promise<void> {
		await ensureDatabaseReady();
		const rows: BotAccountRow[] = await prisma.botAccount.findMany({ orderBy: { updatedAt: "desc" } });
		await this.reconcileSessionsWithStoredBots(rows);
		const enabledRows = rows.filter((row) => row.enabled);
		await runWithConcurrency(enabledRows, STARTUP_SESSION_CONCURRENCY, async (row) => {
			await this.syncBotSession(row.id).catch((error) => {
				this.broadcast({
					type: "audit.log",
					level: "error",
					message: "Stored bot failed to auto-start.",
					context: {
						botId: row.id,
						botName: row.name,
						error: error instanceof Error ? error.message : "Unknown startup failure"
					}
				});
			});
		});
	}

	private startStoredBotSessions(): Promise<void> {
		if (!this.startupPromise) {
			this.startupPromise = this.syncBotSessions().finally(() => {
				this.startupPromise = null;
			});
		}
		return this.startupPromise;
	}

	private rowToSessionAccount(row: BotAccountRow): BotAccountRow {
		return {
			id: row.id,
			name: row.name,
			tokenCiphertext: row.tokenCiphertext,
			tokenIv: row.tokenIv,
			tokenAuthTag: row.tokenAuthTag,
			discordUserId: row.discordUserId,
			avatarUrl: row.avatarUrl,
			enabled: row.enabled,
			readOnlyMode: (row.readOnlyMode === true || row.commandStudioDisabled === true),
			readOnlyBlockMessages: Boolean(row.readOnlyBlockMessages),
			readOnlyBlockChannels: Boolean(row.readOnlyBlockChannels),
			readOnlyBlockModeration: Boolean(row.readOnlyBlockModeration),
			commandStudioDisabled: Boolean(row.commandStudioDisabled || row.readOnlyMode),
			lastConnectedAt: row.lastConnectedAt,
			lastError: row.lastError
		};
	}

	private async ensureBotSession(row: BotAccountRow): Promise<BotSession> {
		if (!row.enabled) throw new Error("This bot is disabled.");

		const existing = this.sessions.get(row.id);
		if (existing) return existing;

		const session = new BotSession(
			this.rowToSessionAccount(row),
			() => this.tokenKey,
			(event) => this.publishBotEvent(row.id, event),
			async (accountId, patch) => {
				await prisma.botAccount.update({
					where: { id: accountId },
					data: patch
				});
				await this.refreshBotList();
			}
		);

		this.sessions.set(row.id, session);
		session.hydrate(await loadWorkspaceBootstrap(row.id));
		return session;
	}

	private startBotSession(row: BotAccountRow): Promise<void> {
		const runningStart = this.sessionStartPromises.get(row.id);
		if (runningStart) return runningStart;

		const startPromise = (async () => {
			const session = await this.ensureBotSession(row);
			if (session.status === "online") return;
			try {
				await session.start();
			} catch (error) {
				this.sessions.delete(row.id);
				throw error;
			}
		})().finally(() => {
			this.sessionStartPromises.delete(row.id);
		});

		this.sessionStartPromises.set(row.id, startPromise);
		return startPromise;
	}

	private async syncBotSession(botId: string): Promise<void> {
		const row = await prisma.botAccount.findUnique({ where: { id: botId } });
		if (!row || !row.enabled) return;
		await this.startBotSession(row);
	}

	private withBot(botId?: string): BotSession {
		const targetId = botId ?? this.state.selectedBotId ?? this.state.bots.find((bot) => bot.enabled)?.id;
		if (!targetId) {
			throw new Error("No bot is available.");
		}
		const session = this.sessions.get(targetId);
		if (!session) {
			throw new Error("Selected bot is offline or not initialized.");
		}
		return session;
	}

	private toBotSummary(bot: BotAccountRow): BotAccountSummary {
		const runningStatus = this.sessions.get(bot.id)?.status;
		return {
			id: bot.id,
			name: bot.name,
			discordUserId: bot.discordUserId,
			avatarUrl: bot.avatarUrl,
			enabled: bot.enabled,
			status: runningStatus ?? (bot.lastError ? "error" : bot.enabled ? "connecting" : "offline"),
			lastConnectedAt: bot.lastConnectedAt?.toISOString() ?? null,
			lastError: bot.lastError,
			readOnlyMode: (bot.readOnlyMode === true || bot.commandStudioDisabled === true),
			readOnlyBlockMessages: Boolean(bot.readOnlyBlockMessages),
			readOnlyBlockChannels: Boolean(bot.readOnlyBlockChannels),
			readOnlyBlockModeration: Boolean(bot.readOnlyBlockModeration),
			commandStudioDisabled: Boolean(bot.commandStudioDisabled || bot.readOnlyMode)
		};
	}
}

const globalForControlPlane = globalThis as unknown as { controlPlane?: BotdeckControlPlane };

// Instance stable malgré reload Next.
export function getControlPlane(): BotdeckControlPlane {
	if (!globalForControlPlane.controlPlane) {
		globalForControlPlane.controlPlane = new BotdeckControlPlane();
	}
	return globalForControlPlane.controlPlane;
}
