// Caches courts utilisés par BotSession.

import {
  EMBED_MESSAGE_PAGE_TTL_MS,
  type MessageEmbedPageCacheEntry,
  type RuntimeEmbedPage,
  type RuntimeModalResponse,
  runtimeEmbedPagePayload,
  runtimeModalResponseEmbeds,
  runtimeModalResponsePayload,
} from "@/server/control-plane-helpers";

const CHANNEL_RECREATE_TTL_MS = 60_000;
const MODAL_PAGE_TTL_MS = 15 * 60 * 1000;

type ChannelRecreateCreateEntry = {
  expiresAt: number;
  name: string;
  parentId: string;
  type: string;
};

export type ChannelRecreateCreateSnapshot = {
  name: string;
  parentId: string | null;
  type: string;
};

export type ChannelRecreateCandidate = {
  guildId?: string | null;
  name?: string;
  parentId?: string | null;
  type?: unknown;
};

function pruneNumberExpiry(cache: Map<string, number>, nowMs = Date.now()): void {
  for (const [key, expiresAt] of cache.entries()) {
    if (expiresAt <= nowMs) cache.delete(key);
  }
}

function pruneCreateExpiry(cache: Map<string, ChannelRecreateCreateEntry>, nowMs = Date.now()): void {
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt <= nowMs) cache.delete(key);
  }
}

export function rememberChannelRecreateDelete(cache: Map<string, number>, channelId: string): void {
  const nowMs = Date.now();
  pruneNumberExpiry(cache, nowMs);
  cache.set(channelId, nowMs + CHANNEL_RECREATE_TTL_MS);
}

export function consumeChannelRecreateDelete(cache: Map<string, number>, channelId: string): boolean {
  const expiresAt = cache.get(channelId);
  cache.delete(channelId);
  return typeof expiresAt === "number" && expiresAt > Date.now();
}

export function rememberChannelRecreateCreate(cache: Map<string, ChannelRecreateCreateEntry>, guildId: string, snapshot: ChannelRecreateCreateSnapshot): void {
  const nowMs = Date.now();
  pruneCreateExpiry(cache, nowMs);
  cache.set(guildId, {
    expiresAt: nowMs + CHANNEL_RECREATE_TTL_MS,
    name: snapshot.name,
    parentId: snapshot.parentId ?? "",
    type: snapshot.type,
  });
}

export function consumeChannelRecreateCreate(cache: Map<string, ChannelRecreateCreateEntry>, channel: ChannelRecreateCandidate): boolean {
  const guildId = channel.guildId ?? null;
  if (!guildId) return false;
  const value = cache.get(guildId);
  if (!value) return false;
  if (value.expiresAt <= Date.now()) {
    cache.delete(guildId);
    return false;
  }
  const channelType = String(channel.type ?? "");
  const sameName = value.name === channel.name;
  const sameParent = value.parentId === (channel.parentId ?? "");
  const sameType = value.type === channelType;
  if (!sameName || !sameParent || !sameType) return false;
  cache.delete(guildId);
  return true;
}

export function createModalPageCache(cache: Map<string, { expiresAt: number; embeds: RuntimeEmbedPage[] }>, embeds: RuntimeEmbedPage[]): string {
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt < Date.now()) cache.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  cache.set(token, {
    expiresAt: Date.now() + MODAL_PAGE_TTL_MS,
    embeds,
  });
  return token;
}

export function modalResponsePayload(cache: Map<string, { expiresAt: number; embeds: RuntimeEmbedPage[] }>, response: RuntimeModalResponse, values: Record<string, string>, pageIndex = 0) {
  if (response.kind !== "embed") return runtimeModalResponsePayload(response, values);
  const embeds = runtimeModalResponseEmbeds(response, values);
  const safePageIndex = embeds.length ? Math.max(0, Math.min(embeds.length - 1, pageIndex)) : 0;
  const token = embeds.length > 1 ? createModalPageCache(cache, embeds) : null;
  return runtimeEmbedPagePayload(embeds, safePageIndex, token ? `botdeck:modalpage:${token}` : undefined);
}

export function createMessageEmbedPageCache(cache: Map<string, MessageEmbedPageCacheEntry>, content: string, embeds: Record<string, unknown>[]): string {
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt < Date.now()) cache.delete(key);
  }
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  cache.set(token, {
    expiresAt: Date.now() + EMBED_MESSAGE_PAGE_TTL_MS,
    content,
    embeds,
  });
  return token;
}
