"use client";

import { applyWorkspaceEvent, type ClientCommand, type ClientEvent, type WorkspaceState } from "@botdeck/shared";
import { useEffect, useReducer, useRef, useState } from "react";
import { normalizeWorkspaceState } from "@/features/workspace/core";

// Contrat transport WebSocket interne.
export type TransportEnvelope =
	| ClientEvent
	| { type: "snapshot"; state: WorkspaceState }
	| { type: "pong"; requestId: string; sentAt: string };

export type CommandStatusEvent = Extract<ClientEvent, { type: "command.completed" | "command.failed" }>;
export type WorkspaceReadyEvent = Extract<ClientEvent, { type: "workspace.ready" }>;
export type ApplicationCommandsEvent = Extract<ClientEvent, { type: "applicationCommands.list" | "applicationCommand.created" | "applicationCommand.updated" | "applicationCommand.deleted" }>;
export type SyncQueueEvent = Extract<ClientEvent, { type: "sync.queue" }>;

const BOTDECK_WS_PATH = "/botdeck-ws";

export function browserWebSocketBaseUrl(runtimeUrl?: string | null): string {
	if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
	if (typeof window === "undefined") return runtimeUrl || "ws://127.0.0.1:3001";
	const secure = window.location.protocol === "https:";
	if (secure) {
		const host = window.location.host || "127.0.0.1:3443";
		return `wss://${host}${BOTDECK_WS_PATH}`;
	}
	return runtimeUrl || "ws://127.0.0.1:3001";
}

export function authenticatedWebSocketUrl(baseUrl: string, authToken: string): string {
	const url = new URL(baseUrl, window.location.href);
	url.searchParams.set("auth", authToken);
	return url.toString();
}

export function authenticatedWebSocketProtocols(authToken: string): string[] {
	return ["botdeck", authToken];
}

// Réducteur principal: mutations centrales.
export function workspaceReducer(state: WorkspaceState, action: TransportEnvelope): WorkspaceState {
	if (action.type === "snapshot") return normalizeWorkspaceState(action.state);
	if (action.type === "pong") return applyWorkspaceEvent(state, { type: "audit.log", level: "debug", message: "Transport heartbeat." });
	if (action.type === "command.completed" || action.type === "command.failed") return state;
	return applyWorkspaceEvent(state, action);
}

// Transport live: connexion + reconnexion.
export function useBotdeckTransport(enabled: boolean, initialWorkspace: WorkspaceState, authToken?: string | null, runtimeWsUrl?: string | null) {
	const [workspace, dispatch] = useReducer(workspaceReducer, initialWorkspace);
	const [status, setStatus] = useState<"booting" | "connecting" | "connected" | "disconnected" | "error">(
		enabled ? "connecting" : "booting"
	);
	const socketRef = useRef<WebSocket | null>(null);
	const [lastCommandEvent, setLastCommandEvent] = useState<CommandStatusEvent | null>(null);
	const [lastWorkspaceReadyEvent, setLastWorkspaceReadyEvent] = useState<WorkspaceReadyEvent | null>(null);
	const [lastApplicationCommandsEvent, setLastApplicationCommandsEvent] = useState<ApplicationCommandsEvent | null>(null);
	const [lastSyncQueueEvent, setLastSyncQueueEvent] = useState<SyncQueueEvent | null>(null);
	const retryRef = useRef<number | null>(null);
	const pingRef = useRef<number | null>(null);
	const backoffRef = useRef(0);

	useEffect(() => {
		dispatch({ type: "snapshot", state: initialWorkspace });
	}, [initialWorkspace]);

	useEffect(() => {
		if (!enabled) {
			setStatus("booting");
			return;
		}

		let mounted = true;

		const sendPing = () => {
			const socket = socketRef.current;
			if (!socket || socket.readyState !== WebSocket.OPEN) return;
			socket.send(JSON.stringify({ type: "ping", requestId: crypto.randomUUID() } satisfies ClientCommand));
		};

		const clearTimers = () => {
			if (retryRef.current !== null) window.clearTimeout(retryRef.current);
			if (pingRef.current !== null) window.clearInterval(pingRef.current);
			retryRef.current = null;
			pingRef.current = null;
		};

		const connect = () => {
			if (!mounted) return;
			setStatus("connecting");
			if (!authToken) {
				setStatus("error");
				return;
			}

			const socket = new WebSocket(authenticatedWebSocketUrl(browserWebSocketBaseUrl(runtimeWsUrl), authToken), authenticatedWebSocketProtocols(authToken));
			socketRef.current = socket;

			socket.onopen = () => {
				if (!mounted) return;
				setStatus("connected");
				backoffRef.current = 0;
				pingRef.current = window.setInterval(sendPing, 25000);
				sendPing();
			};

			socket.binaryType = "arraybuffer";

			socket.onmessage = (event) => {
				if (event.data instanceof ArrayBuffer) {
					return;
				}

				try {
					const payload = JSON.parse(event.data as string) as TransportEnvelope;
					if (payload.type === "command.completed" || payload.type === "command.failed") {
						setLastCommandEvent(payload);
					}
					if (payload.type === "workspace.ready") {
						setLastWorkspaceReadyEvent(payload);
					}
					if (payload.type === "applicationCommands.list" || payload.type === "applicationCommand.created" || payload.type === "applicationCommand.updated" || payload.type === "applicationCommand.deleted") {
						setLastApplicationCommandsEvent(payload);
					}
					if (payload.type === "sync.queue") {
						setLastSyncQueueEvent(payload);
					}
					dispatch(payload);
				} catch {
					// Trame WebSocket invalide ignorée.
				}
			};

			socket.onerror = () => {
				if (mounted) setStatus("error");
			};

			socket.onclose = () => {
				if (!mounted) return;
				setStatus("disconnected");
				clearTimers();
				backoffRef.current = Math.min(backoffRef.current + 1, 6);
				retryRef.current = window.setTimeout(connect, Math.min(1000 * 2 ** backoffRef.current, 15000));
			};
		};

		connect();

		return () => {
			mounted = false;
			clearTimers();
			socketRef.current?.close();
			socketRef.current = null;
		};
	}, [enabled, authToken, runtimeWsUrl]);

	return { workspace, status, socketRef, lastCommandEvent, lastWorkspaceReadyEvent, lastApplicationCommandsEvent, lastSyncQueueEvent };
}
