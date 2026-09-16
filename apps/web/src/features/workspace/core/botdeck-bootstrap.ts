import { createWorkspaceState, type BotAccountSummary, type WorkspaceState } from "@botdeck/shared";

export type BootstrapState = {
	bots: BotAccountSummary[];
	workspace: WorkspaceState;
	wsAuthToken?: string | null;
	wsUrl?: string | null;
	localApiToken?: string | null;
};

let browserLocalApiToken: string | null = null;

export function setBrowserLocalApiToken(token: string | null | undefined): void {
	browserLocalApiToken = typeof token === "string" && token.length > 0 ? token : null;
}

export function localApiHeaders(): HeadersInit {
	return browserLocalApiToken ? { "X-Botdeck-Request": "1", "X-Botdeck-Local-Token": browserLocalApiToken } : { "X-Botdeck-Request": "1" };
}

export function botdeckFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
	return fetch(input, {
		...init,
		cache: init.cache ?? "no-store",
		headers: {
			...localApiHeaders(),
			...(init.headers ?? {})
		}
	});
}


// Valide l’état bootstrap.
export function isBootstrapState(value: unknown): value is BootstrapState {
	return typeof value === "object" && value !== null && "bots" in value && "workspace" in value;
}

// Normalise l’état bootstrap.
export function normalizeWorkspaceState(value: Partial<WorkspaceState> | WorkspaceState | null | undefined): WorkspaceState {
	const base = createWorkspaceState();
	const workspace = typeof value === "object" && value !== null ? value : {};
	return {
		...base,
		...workspace,
		bots: Array.isArray(workspace.bots) ? workspace.bots : base.bots,
		guilds: Array.isArray(workspace.guilds) ? workspace.guilds : base.guilds,
		channelsByGuild: workspace.channelsByGuild ?? base.channelsByGuild,
		messagesByChannel: workspace.messagesByChannel ?? base.messagesByChannel,
		pinnedMessagesByChannel: workspace.pinnedMessagesByChannel ?? base.pinnedMessagesByChannel,
		usersById: workspace.usersById ?? base.usersById,
		rolesByGuildId: workspace.rolesByGuildId ?? base.rolesByGuildId,
		membersByGuildId: workspace.membersByGuildId ?? base.membersByGuildId,
		invitesByGuildId: workspace.invitesByGuildId ?? base.invitesByGuildId,
		bansByGuildId: workspace.bansByGuildId ?? base.bansByGuildId,
		memberProfilesByKey: workspace.memberProfilesByKey ?? base.memberProfilesByKey,
		presencesByUserId: workspace.presencesByUserId ?? base.presencesByUserId,
		voiceByGuildId: workspace.voiceByGuildId ?? base.voiceByGuildId,
		forumPostsByChannel: workspace.forumPostsByChannel ?? base.forumPostsByChannel,
		logs: Array.isArray(workspace.logs) ? workspace.logs : base.logs
	};
}

// Normalise l’état bootstrap.
export function normalizeBootstrapState(value: unknown): BootstrapState {
	// Snapshots anciens/nouveaux normalisés.
	if (isBootstrapState(value)) {
		const localApiToken = typeof (value as { localApiToken?: unknown }).localApiToken === "string" ? (value as { localApiToken: string }).localApiToken : null;
		setBrowserLocalApiToken(localApiToken);
		return {
			bots: value.bots,
			workspace: normalizeWorkspaceState(value.workspace),
			wsAuthToken: typeof (value as { wsAuthToken?: unknown }).wsAuthToken === "string" ? (value as { wsAuthToken: string }).wsAuthToken : null,
			wsUrl: typeof (value as { wsUrl?: unknown }).wsUrl === "string" ? (value as { wsUrl: string }).wsUrl : null,
			localApiToken
		};
	}

	if (typeof value === "object" && value !== null) {
		const workspace = value as WorkspaceState;
		const localApiToken = typeof (value as { localApiToken?: unknown }).localApiToken === "string" ? (value as { localApiToken: string }).localApiToken : null;
		setBrowserLocalApiToken(localApiToken);
		return {
			bots: Array.isArray((value as { bots?: unknown }).bots) ? ((value as { bots: BotAccountSummary[] }).bots ?? []) : [],
			workspace: normalizeWorkspaceState(workspace),
			wsAuthToken: typeof (value as { wsAuthToken?: unknown }).wsAuthToken === "string" ? (value as { wsAuthToken: string }).wsAuthToken : null,
			wsUrl: typeof (value as { wsUrl?: unknown }).wsUrl === "string" ? (value as { wsUrl: string }).wsUrl : null,
			localApiToken
		};
	}

	setBrowserLocalApiToken(null);
	return {
		bots: [],
		workspace: createWorkspaceState(),
		wsAuthToken: null,
		wsUrl: null,
		localApiToken: null
	};
}


export const fallbackWorkspaceState = createWorkspaceState({
	selectedBotId: null,
	guilds: [
		{ id: "100", name: "Botdeck HQ", iconUrl: null, unreadCount: 2, mentionCount: 0, memberCount: 14, approximatePresenceCount: 8 },
		{ id: "200", name: "Ops", iconUrl: null, unreadCount: 0, mentionCount: 1, memberCount: 7, approximatePresenceCount: 4 }
	],
	channelsByGuild: {
		"100": [
			{ id: "101", guildId: "100", name: "announcements", type: "text", topic: "Release notes and platform status", unreadCount: 0 },
			{ id: "102", guildId: "100", name: "general", type: "text", topic: "Everyday coordination", unreadCount: 2 }
		],
		"200": [
			{ id: "201", guildId: "200", name: "support", type: "text", topic: "Requests and triage", unreadCount: 1 }
		]
	},
	messagesByChannel: {
		"102": [
			{
				id: "m1",
				channelId: "102",
				authorId: "sys",
				authorTag: "System",
				authorAvatarUrl: null,
				content: "Botdeck is ready. Add a bot to continue.",
				createdAt: new Date().toISOString(),
				attachments: [],
				embeds: []
			}
		]
	},
	usersById: {
		sys: { id: "sys", username: "system", displayName: "System", avatarUrl: null, bot: true, status: "offline" }
	},
	presencesByUserId: {},
	voiceByGuildId: {},
	logs: [
		{ id: "l1", level: "info", message: "Client booting.", timestamp: new Date().toISOString() },
		{ id: "l2", level: "info", message: "Awaiting a bot token.", timestamp: new Date().toISOString() }
	],
	connected: false,
	botClientId: null,
	lastSyncAt: null
});


// Nettoie la sélection UI.
export function clearUiSelection(workspace: WorkspaceState): WorkspaceState {
	return {
		...workspace,
		selectedBotId: null,
		selectedGuildId: null,
		selectedChannelId: null
	};
}


export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		cache: "no-store",
		...init,
		headers: { "Content-Type": "application/json", ...localApiHeaders(), ...(init?.headers ?? {}) }
	});

	const payload = (await response.json()) as T;
	if (!response.ok) {
		throw new Error(typeof payload === "object" && payload && "message" in payload ? String((payload as { message?: unknown }).message) : "Request failed");
	}
	return payload;
}

