"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppToast } from "@/features/workspace/core";

export type PushToast = (message: string, tone?: AppToast["tone"]) => void;

export function useAppToasts(): { toasts: AppToast[]; pushToast: PushToast } {
	const [toasts, setToasts] = useState<AppToast[]>([]);
	const toastTimers = useRef<Map<string, [number, number]>>(new Map());
	const lastToastSignatureRef = useRef<{ signature: string; at: number } | null>(null);

	const pushToast = useCallback<PushToast>((message, tone = "info") => {
		const signature = `${tone}:${message}`;
		const timestamp = Date.now();
		if (lastToastSignatureRef.current?.signature === signature && timestamp - lastToastSignatureRef.current.at < 1800) return;
		lastToastSignatureRef.current = { signature, at: timestamp };

		const id = crypto.randomUUID();
		setToasts((current) => [...current, { id, message, tone, leaving: false }]);

		const leaveTimer = window.setTimeout(() => {
			setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
			const removeTimer = window.setTimeout(() => {
				setToasts((current) => current.filter((toast) => toast.id !== id));
				toastTimers.current.delete(id);
			}, 240);

			const timers = toastTimers.current.get(id);
			if (timers) {
				timers[1] = removeTimer;
			}
		}, 3000);

		toastTimers.current.set(id, [leaveTimer, 0]);
	}, []);

	useEffect(
		() => () => {
			for (const [leaveTimer, removeTimer] of toastTimers.current.values()) {
				window.clearTimeout(leaveTimer);
				if (removeTimer) window.clearTimeout(removeTimer);
			}
			toastTimers.current.clear();
		},
		[]
	);

	return { toasts, pushToast };
}
