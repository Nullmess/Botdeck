// Lifecycle helpers for BotSession start/stop.
// Keep token decrypt/login/error handling outside the main session class.

import type { BotAccountSummary, ClientEvent } from "@botdeck/shared";
import type { Client } from "discord.js";
import { decryptToken } from "@/server/token-crypto";
import type { BotAccountRow, BotAccountUpdatePatch } from "@/server/control-plane-helpers";

export type BotSessionLifecycleContext = {
  account: BotAccountRow;
  client: Client;
  status: BotAccountSummary["status"];
  lastError: string | null;
  readyPromise: Promise<void> | null;
  resolveReady: (() => void) | null;
  rejectReady: ((error: unknown) => void) | null;
  roleAutomationTimer: NodeJS.Timeout | null;
  keyResolver: () => Buffer | null;
  attachHandlers: () => void;
  updateAccount: (accountId: string, patch: BotAccountUpdatePatch) => Promise<void>;
  publishEvent: (event: ClientEvent) => void;
};

export async function startBotSessionLifecycle(
  session: BotSessionLifecycleContext,
): Promise<void> {
  if (session.status === "online") return;
  if (session.readyPromise) return session.readyPromise;

  const key = session.keyResolver();
  if (!key) throw new Error("Runtime encryption key is unavailable.");

  const token = decryptToken(
    {
      ciphertext: session.account.tokenCiphertext,
      iv: session.account.tokenIv,
      authTag: session.account.tokenAuthTag,
    },
    key,
  );

  session.status = "connecting";
  session.lastError = null;
  session.attachHandlers();
  session.readyPromise = new Promise<void>((resolve, reject) => {
    session.resolveReady = resolve;
    session.rejectReady = reject;
  });

  try {
    await session.client.login(token);
    await session.readyPromise;
  } catch (error) {
    session.status = "error";
    session.lastError =
      error instanceof Error ? error.message : "Failed to start bot session";
    session.readyPromise = null;
    session.resolveReady = null;
    session.rejectReady = null;
    await session
      .updateAccount(session.account.id, { lastError: session.lastError })
      .catch(() => undefined);
    throw error;
  }
}

export async function stopBotSessionLifecycle(
  session: BotSessionLifecycleContext,
): Promise<void> {
  session.status = "offline";
  if (session.roleAutomationTimer) clearInterval(session.roleAutomationTimer);
  session.roleAutomationTimer = null;
  session.readyPromise = null;
  session.resolveReady = null;
  session.rejectReady = null;
  session.client.removeAllListeners();
  session.client.destroy();
}
