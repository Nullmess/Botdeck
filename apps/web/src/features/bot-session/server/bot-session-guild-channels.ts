// Extraction BotSession: bot session guild channels.

// Session bot Discord

import type { BotSessionContext } from "./bot-session-context";
import { prisma } from "@/lib/prisma";
import {
  applyWorkspaceEvent,
  createWorkspaceState,
  normalizeDiscordError,
  type ApplicationCommandDraft,
  type ApplicationCommandRuntimeDefinition,
  type ApplicationCommandScope,
  type ApplicationCommandSummary,
  type BotAccountSummary,
  type ClientCommand,
  type ClientEvent,
  type EmbedPayload,
  type GuildAutomationConfig,
  type GuildAutomationKind,
  type GuildAutomationMessageType,
  type GuildRoleAutomationRuleConfig,
  type MessageSummary,
  type VoiceStateSummary,
  type WorkspaceState,
} from "@botdeck/shared";
import {
  ActivityType,
  AuditLogEvent,
  ChannelType,
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  PermissionsBitField,
  type ChatInputCommandInteraction,
  type Collection,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type PartialGuildMember,
  type Interaction,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type Role,
  type User,
} from "discord.js";
import { ensureDatabaseReady } from "@/server/database-bootstrap";
import { decryptToken } from "@/server/token-crypto";

import {
  DEFAULT_LOG_EVENT_MESSAGES,
  LOG_EVENT_KEYS,
  LOG_EVENT_LABELS,
  type LogEventConfig,
  type LogEventKey,
  type LogEventPayload,
  type StoredLogConfig,
} from "./features/automation-logs";
import {
  buildModerationTemplateValues,
  isModerationResponseMode,
  moderationActionFromRuntime,
  moderationEmbedPages,
  moderationLogKey,
  moderationResponseType,
  type ModerationAction,
  type ModerationTarget,
} from "./features/moderation";
import {
  ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS,
  ROLE_AUTOMATION_MAX_MESSAGES,
  ROLE_AUTOMATION_MAX_VOICE_SECONDS,
  withRoleAutomationTimeout,
  type RoleAutomationRuleInput,
  type StoredMemberActivity,
  type StoredRoleAutomationRule,
} from "./features/role-automation";

import {
  BotAccountRow,
  BotAccountUpdatePatch,
  DATABASE_WRITE_BATCH_SIZE,
  DATABASE_WRITE_CONCURRENCY,
  DM_GUILD_ID,
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_GOODBYE_MESSAGE,
  EMBED_MESSAGE_PAGE_TTL_MS,
  MESSAGE_CACHE_CHANNEL_LIMIT,
  MESSAGE_CACHE_PER_CHANNEL_LIMIT,
  MessageEmbedPageCacheEntry,
  RuntimeEmbedPage,
  RuntimeModalResponse,
  RuntimeModalResponseMatch,
  WARMUP_CHANNEL_CONCURRENCY,
  WARMUP_GUILD_CONCURRENCY,
  WARMUP_HISTORY_LIMIT,
  activityTypeToDiscord,
  applicationCommandDraftToPayload,
  buildDetailedMemberProfile,
  buildDirectUserProfile,
  chunkArray,
  clamp,
  clampHistoryLimit,
  compareGuildChannels,
  delay,
  enqueueDatabaseWrite,
  fallbackRuntimeForCommand,
  fetchInteractionReplyMessage,
  fillRuntimeTemplate,
  fillRuntimeTemplateForMessage,
  fillRuntimeTemplateFromValues,
  fillWelcomeTemplate,
  fillGoodbyeTemplate,
  isGuildBasedChannel,
  channelParentId,
  isPrefixCommandDraft,
  isRecord,
  isUnknownApplicationCommandError,
  localPrefixCommandId,
  mapChannelType,
  messageEmbedPagePayload,
  messageIsEphemeral,
  modalResponseMatchForQuery,
  normalizeApplicationCommand,
  normalizeChannel,
  normalizeDirectMessageChannel,
  normalizeDirectMessageUser,
  normalizeGuild,
  normalizeGuildMember,
  normalizeGuildInvite,
  normalizeForumPost,
  normalizeMemberProfile,
  normalizeMessage,
  normalizePresence,
  normalizeRole,
  normalizeUser,
  normalizeVoiceState,
  now,
  reactionMatchesEmoji,
  readBotdeckRuntime,
  removeOwnReactionFromSummary,
  resolveDirectMessagePeer,
  runWithConcurrency,
  runtimeEmbedPages,
  runtimeEmbedPagePayload,
  runtimeMetadata,
  runtimeModal,
  runtimeModalResponseEmbeds,
  runtimeModalResponsePayload,
  runtimeModalResponses,
  runtimeReplyPayload,
  runtimeResponseMode,
  runtimeWelcomeRemoveConfirmation,
  runtimeGoodbyeRemoveConfirmation,
  runtimeWelcomeSetConfirmation,
  runtimeGoodbyeSetConfirmation,
  runtimeWelcomeEmbedPages,
  runtimeGoodbyeEmbedPages,
  runtimeWelcomeMessage,
  runtimeGoodbyeMessage,
  runtimeWelcomeMessageType,
  runtimeGoodbyeMessageType,
  safeJsonParse,
  storedWelcomeEmbedPages,
  storedGoodbyeEmbedPages,
  templateRuntimeEmbed,
  welcomeTemplateValues,
  goodbyeTemplateValues,
  storedCommandDefinitionToSummary,
  toDiscordEmbed,
  uniqueBy,
} from "@/server/control-plane-helpers";


type RecreatePurgeOptions = {
  reason?: string;
  transcript?: boolean;
  finishMessage?: boolean;
  confirmation?: string;
  executorId?: string | null;
};

type ChannelTranscriptMessage = {
  id: string;
  authorId: string;
  author: string;
  content: string;
  createdAt: string | null;
  editedAt: string | null;
  attachments: { name: string; url: string; contentType?: string | null; size?: number | null }[];
  embeds: number;
};

function isTextLikeChannel(channel: any): boolean {
  return Boolean(channel && "messages" in channel && typeof channel.messages?.fetch === "function" && typeof channel.send === "function");
}

function isSendableGuildTextChannel(channel: any): boolean {
  return Boolean(channel && typeof channel.send === "function" && channel.type !== ChannelType.GuildForum && channel.type !== ChannelType.GuildCategory);
}

function clonePermissionOverwrites(channel: any) {
  return Array.from(channel.permissionOverwrites?.cache?.values?.() ?? []).map((overwrite: any) => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow?.bitfield?.toString?.() ?? String(overwrite.allow?.bitfield ?? "0"),
    deny: overwrite.deny?.bitfield?.toString?.() ?? String(overwrite.deny?.bitfield ?? "0"),
  }));
}

function readableChannelType(channel: any): string {
  switch (channel?.type) {
    case ChannelType.GuildText:
      return "text";
    case ChannelType.GuildAnnouncement:
      return "announcement";
    case ChannelType.GuildVoice:
      return "voice";
    case ChannelType.GuildStageVoice:
      return "stage";
    case ChannelType.GuildForum:
      return "forum";
    case ChannelType.GuildMedia:
      return "media";
    default:
      return String(channel?.type ?? "unknown");
  }
}

async function collectChannelTranscript(channel: any, limit = 1000): Promise<ChannelTranscriptMessage[]> {
  if (!isTextLikeChannel(channel)) return [];
  const messages: ChannelTranscriptMessage[] = [];
  let before: string | undefined;
  while (messages.length < limit) {
    const batch = await channel.messages.fetch({ limit: Math.min(100, limit - messages.length), before }).catch(() => null);
    if (!batch?.size) break;
    const values = Array.from(batch.values()) as any[];
    for (const message of values) {
      messages.push({
        id: message.id,
        authorId: message.author?.id ?? "",
        author: message.author?.tag ?? message.author?.username ?? "Unknown",
        content: message.content ?? "",
        createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : null,
        editedAt: message.editedAt instanceof Date ? message.editedAt.toISOString() : null,
        attachments: Array.from(message.attachments?.values?.() ?? []).map((attachment: any) => ({
          name: attachment.name ?? attachment.filename ?? "attachment",
          url: attachment.url ?? "",
          contentType: attachment.contentType ?? null,
          size: typeof attachment.size === "number" ? attachment.size : null,
        })),
        embeds: message.embeds?.length ?? 0,
      });
    }
    before = values.at(-1)?.id;
    if (!before || values.length < 100) break;
  }
  return messages.reverse();
}

function buildChannelCreateOptions(channel: any, reason: string, permissionOverwrites: any[]) {
  const base: any = {
    name: channel.name,
    type: channel.type,
    parent: channel.parentId ?? null,
    permissionOverwrites,
    reason,
  };

  if ("topic" in channel) base.topic = channel.topic ?? null;
  if ("nsfw" in channel) base.nsfw = Boolean(channel.nsfw);
  if ("rateLimitPerUser" in channel) base.rateLimitPerUser = channel.rateLimitPerUser ?? 0;
  if ("defaultAutoArchiveDuration" in channel) base.defaultAutoArchiveDuration = channel.defaultAutoArchiveDuration ?? undefined;

  if ("bitrate" in channel) base.bitrate = channel.bitrate;
  if ("userLimit" in channel) base.userLimit = channel.userLimit ?? 0;
  if ("rtcRegion" in channel) base.rtcRegion = channel.rtcRegion ?? null;
  if ("videoQualityMode" in channel) base.videoQualityMode = channel.videoQualityMode ?? undefined;

  if (channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
    if ("availableTags" in channel) {
      base.availableTags = Array.from(channel.availableTags?.values?.() ?? channel.availableTags ?? []).map((tag: any) => ({
        name: tag.name,
        moderated: Boolean(tag.moderated),
        emoji: tag.emojiId ? { id: tag.emojiId, name: tag.emojiName ?? null } : tag.emojiName ? { name: tag.emojiName } : undefined,
      }));
    }
    if ("defaultReactionEmoji" in channel) base.defaultReactionEmoji = channel.defaultReactionEmoji ?? null;
    if ("defaultSortOrder" in channel) base.defaultSortOrder = channel.defaultSortOrder ?? null;
    if ("defaultForumLayout" in channel) base.defaultForumLayout = channel.defaultForumLayout ?? null;
  }
  return base;
}


const guildMemberFetchWarnings = new Set<string>();
const guildMemberFetchRateLimits = new Map<string, number>();
const guildMemberFetchRateLimitNotices = new Map<string, number>();
const GUILD_MEMBER_FETCH_RATE_LIMIT_BUFFER_MS = 1_000;

function getGuildShardId(guild: Guild): number {
  const shardId = (guild as any).shardId;
  return typeof shardId === "number" && Number.isFinite(shardId) ? shardId : 0;
}

function hasGatewayShard(client: Client, guild: Guild): boolean {
  const shards = (client as any).ws?.shards;
  if (!shards || typeof shards.has !== "function") return true;
  return shards.has(getGuildShardId(guild));
}


function guildMemberFetchKey(context: BotSessionContext, guild: Guild): string {
  return `${context.account.id}:${guild.id}`;
}

function retryAfterFromMemberFetchError(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { retryAfter?: unknown; data?: { retry_after?: unknown }; message?: unknown };
  const direct = typeof candidate.retryAfter === "number" ? candidate.retryAfter : null;
  const data = typeof candidate.data?.retry_after === "number" ? candidate.data.retry_after : null;
  const seconds = direct ?? data;
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds * 1000) + GUILD_MEMBER_FETCH_RATE_LIMIT_BUFFER_MS;
  }
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const match = /Retry after ([0-9]+(?:\.[0-9]+)?) seconds/i.exec(message);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.ceil(parsed * 1000) + GUILD_MEMBER_FETCH_RATE_LIMIT_BUFFER_MS
    : null;
}

function auditMemberFetchFallback(
  context: BotSessionContext,
  guild: Guild,
  error?: unknown,
): void {
  const key = `${guildMemberFetchKey(context, guild)}:member-fetch-fallback`;
  if (guildMemberFetchWarnings.has(key)) return;
  guildMemberFetchWarnings.add(key);
  context.publishEvent({
    type: "audit.log",
    level: "warn",
    message:
      "Impossible de récupérer tous les membres Discord. Botdeck utilise le cache local pour éviter de bloquer le tableau de bord.",
    context: {
      botId: context.account.id,
      botName: context.account.name,
      guildId: guild.id,
      guildName: guild.name,
      shardId: getGuildShardId(guild),
      error:
        error instanceof Error
          ? error.message
          : "Gateway shard unavailable",
    },
  });
}

function auditMemberFetchRateLimited(
  context: BotSessionContext,
  guild: Guild,
  retryAfterMs: number,
): void {
  const key = guildMemberFetchKey(context, guild);
  const nowMs = Date.now();
  const previousNoticeAt = guildMemberFetchRateLimitNotices.get(key) ?? 0;
  if (nowMs - previousNoticeAt < 60_000) return;
  guildMemberFetchRateLimitNotices.set(key, nowMs);
  context.publishEvent({
    type: "audit.log",
    level: "info",
    message:
      "Discord limite temporairement la synchronisation complète des membres. Botdeck affiche le cache local et réessaiera plus tard.",
    context: {
      botId: context.account.id,
      botName: context.account.name,
      guildId: guild.id,
      guildName: guild.name,
      shardId: getGuildShardId(guild),
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    },
  });
}

async function safeFetchGuildChannels(guild: Guild) {
  try {
    return await guild.channels.fetch();
  } catch {
    return null;
  }
}

async function safeFetchGuildMembers(
  context: BotSessionContext,
  guild: Guild,
  options?: { withPresences?: boolean },
): Promise<Collection<string, GuildMember> | null> {
  const key = guildMemberFetchKey(context, guild);
  const cooldownUntil = guildMemberFetchRateLimits.get(key) ?? 0;
  const nowMs = Date.now();
  if (cooldownUntil > nowMs) {
    auditMemberFetchRateLimited(context, guild, cooldownUntil - nowMs);
    return null;
  }
  if (!hasGatewayShard(context.client, guild)) {
    auditMemberFetchFallback(context, guild);
    return null;
  }

  try {
    const members = await guild.members.fetch(options);
    guildMemberFetchRateLimits.delete(key);
    guildMemberFetchRateLimitNotices.delete(key);
    return members;
  } catch (error) {
    const retryAfterMs = retryAfterFromMemberFetchError(error);
    if (retryAfterMs) {
      guildMemberFetchRateLimits.set(key, Date.now() + retryAfterMs);
      auditMemberFetchRateLimited(context, guild, retryAfterMs);
    } else {
      auditMemberFetchFallback(context, guild, error);
    }
    return null;
  }
}

async function safeFetchGuildRoles(guild: Guild): Promise<void> {
  try {
    await guild.roles.fetch();
  } catch {
    // Cached roles are enough for the UI when Discord refuses a refresh.
  }
}


export async function refreshGuild(this: BotSessionContext, 
  guild: Guild,
): Promise<{ channelCount: number; userIds: string[] }> {
  const fetchedChannels = await safeFetchGuildChannels(guild);
  await safeFetchGuildRoles(guild);

  const channelCollection = fetchedChannels ?? guild.channels.cache;
  const memberCollection = guild.members.cache;

  const rawChannels = Array.from(channelCollection.values())
    .filter((channel): channel is GuildBasedChannel =>
      isGuildBasedChannel(channel),
    )
    .sort(compareGuildChannels);
  const channelsById = new Map(
    rawChannels.map((channel) => [channel.id, channel]),
  );
  const channels = rawChannels.map((channel, index) =>
    normalizeChannel(channel, channelsById, this.client.user?.id, index),
  );
  const members = Array.from(memberCollection.values());
  const users = members.map(normalizeUser);
  const memberSummaries = members.map(normalizeGuildMember);
  const presences = members.map(normalizePresence);
  const roles = Array.from(guild.roles.cache.values())
    .filter((role) => role.id !== guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => normalizeRole(guild.id, role));

  await this.persistGuildSnapshot(guild, rawChannels, members);
  this.publishEvent({ type: "guild.updated", guild: normalizeGuild(guild) });
  this.publishEvent({ type: "state.channels", guildId: guild.id, channels });
  this.publishEvent({ type: "state.users", users });
  this.publishEvent({
    type: "state.members",
    guildId: guild.id,
    members: memberSummaries,
  });
  this.publishEvent({ type: "state.roles", guildId: guild.id, roles });
  this.publishEvent({ type: "state.presences", presences });
  this.publishEvent({
    type: "audit.log",
    level: "debug",
    message: `Synced ${guild.name}: ${channels.length} channel${channels.length === 1 ? "" : "s"}, ${users.length} member${users.length === 1 ? "" : "s"}.`,
    context: {
      botId: this.account.id,
      botName: this.account.name,
      guildId: guild.id,
      channelCount: channels.length,
      memberCount: users.length,
    },
  });
  return {
    channelCount: channels.length,
    userIds: users.map((user) => user.id),
  };
}

async function refreshGuildChannelsOnly(
  context: BotSessionContext,
  guild: Guild,
): Promise<number> {
  const fetchedChannels = await safeFetchGuildChannels(guild);
  const channelCollection = fetchedChannels ?? guild.channels.cache;
  const rawChannels = Array.from(channelCollection.values())
    .filter((channel): channel is GuildBasedChannel =>
      isGuildBasedChannel(channel),
    )
    .sort(compareGuildChannels);
  const channelsById = new Map(
    rawChannels.map((channel) => [channel.id, channel]),
  );
  const channels = rawChannels.map((channel, index) =>
    normalizeChannel(channel, channelsById, context.client.user?.id, index),
  );

  context.publishEvent({ type: "guild.updated", guild: normalizeGuild(guild) });
  context.publishEvent({ type: "state.channels", guildId: guild.id, channels });
  context.publishEvent({
    type: "audit.log",
    level: "debug",
    message: `Synced ${guild.name}: ${channels.length} channel${channels.length === 1 ? "" : "s"} after channel move.`,
    context: {
      botId: context.account.id,
      botName: context.account.name,
      guildId: guild.id,
      channelCount: channels.length,
      refreshScope: "channels-only",
    },
  });

  return channels.length;
}

export async function syncForumPosts(this: BotSessionContext, 
  forumId: string,
  includeArchived = true,
): Promise<void> {
  const channel = await this.client.channels.fetch(forumId);
  if (!this.isForumLikeChannel(channel)) {
    throw new Error("Selected channel is not a Discord forum.");
  }
  const forum = channel as any;
  const activeResult = await forum.threads.fetchActive().catch(() => null);
  const forumActiveThreads = activeResult?.threads
    ? [...activeResult.threads.values()]
    : [];
  const guildActiveResult = await forum.guild?.channels
    ?.fetchActiveThreads?.()
    .catch(() => null);
  const guildActiveThreads = guildActiveResult?.threads
    ? [...guildActiveResult.threads.values()].filter(
        (thread: any) => thread.parentId === forumId,
      )
    : [];
  let archivedThreads: any[] = [];
  if (includeArchived) {
    const publicArchived = await forum.threads
      .fetchArchived({ type: "public", limit: 100 })
      .catch(() => null);
    const privateArchived = await forum.threads
      .fetchArchived({ type: "private", limit: 100 })
      .catch(() => null);
    archivedThreads = [
      ...(publicArchived?.threads
        ? [...publicArchived.threads.values()]
        : []),
      ...(privateArchived?.threads
        ? [...privateArchived.threads.values()]
        : []),
    ];
  }
  const uniqueThreads = uniqueBy(
    [...forumActiveThreads, ...guildActiveThreads, ...archivedThreads],
    (thread: any) => thread.id,
  );
  const posts = uniqueThreads
    .filter((thread: any) => thread.parentId === forumId)
    .map((thread: any) => normalizeForumPost(thread))
    .sort(
      (left, right) =>
        Date.parse(right.lastMessageAt ?? right.createdAt ?? "0") -
        Date.parse(left.lastMessageAt ?? left.createdAt ?? "0"),
    );
  this.publishEvent({ type: "state.forumPosts", forumId, posts });
}

export async function createForumPost(this: BotSessionContext, 
  forumId: string,
  title: string,
  content: string,
  tagIds: string[] = [],
): Promise<void> {
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  if (!cleanTitle) throw new Error("Forum post title is required.");
  if (!cleanContent) throw new Error("Forum post description is required.");
  const channel = await this.client.channels.fetch(forumId);
  if (!this.isForumLikeChannel(channel)) {
    throw new Error("Selected channel is not a Discord forum.");
  }
  const forum = channel as any;
  const thread = await forum.threads.create({
    name: cleanTitle.slice(0, 100),
    message: {
      content: cleanContent.slice(0, 2000),
      allowedMentions: { parse: ["users"], repliedUser: false },
    },
    appliedTags: tagIds.slice(0, 5),
  });
  const post = normalizeForumPost(thread as any);
  this.publishEvent({ type: "forumPost.created", forumId, post });
  await this.syncForumPosts(forumId).catch(() => undefined);
}

export async function updateGuildProfile(this: BotSessionContext, 
  guildId: string,
  patch: {
    name?: string;
    description?: string | null;
    iconDataUrl?: string | null;
  },
): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageGuild))
    throw new Error("Missing Manage Server permission.");

  const body: Record<string, unknown> = {};
  if (typeof patch.name === "string") {
    const name = patch.name.trim().slice(0, 100);
    if (!name) throw new Error("Server name is required.");
    body.name = name;
  }
  if (patch.iconDataUrl !== undefined) body.icon = patch.iconDataUrl || null;

  // Discord only exposes the public server description for guilds that support the Community profile.
  // Sending it on every guild can make the whole profile update fail, so Botdeck edits it only when Discord exposes it.
  const canEditDescription = guild.features.includes("COMMUNITY");
  if (patch.description !== undefined && canEditDescription)
    body.description = patch.description?.trim() || null;

  if (!Object.keys(body).length) {
    this.publishEvent({
      type: "guild.updated",
      guild: normalizeGuild(guild),
    });
    return;
  }

  const updated = await guild.edit(body as any);
  this.publishEvent({
    type: "guild.updated",
    guild: normalizeGuild(updated),
  });
  await this.refreshGuild(updated);
}



export async function fetchGuildInvites(this: BotSessionContext, guildId: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const invites = Array.from((await guild.invites.fetch()).values())
    .map((invite) => normalizeGuildInvite(guild.id, invite))
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
      return rightTime - leftTime || left.code.localeCompare(right.code);
    });
  this.publishEvent({ type: "state.guildInvites", guildId: guild.id, invites });
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Fetched ${invites.length} server invite${invites.length === 1 ? "" : "s"}.`,
    context: { botId: this.account.id, guildId: guild.id, inviteCount: invites.length },
  });
}

export async function createGuildInvite(this: BotSessionContext,
  guildId: string,
  channelId: string,
  options: {
    maxAge?: number;
    maxUses?: number;
    temporary?: boolean;
    unique?: boolean;
    reason?: string;
  } = {},
): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const channel =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !("createInvite" in channel) || typeof (channel as any).createInvite !== "function") {
    throw new Error("This channel cannot create invites.");
  }
  await (channel as any).createInvite({
    maxAge: Math.max(0, Math.min(604800, options.maxAge ?? 86400)),
    maxUses: Math.max(0, Math.min(100, options.maxUses ?? 0)),
    temporary: Boolean(options.temporary),
    unique: options.unique !== false,
    reason: options.reason,
  });
  await this.fetchGuildInvites(guildId);
}

export async function deleteGuildInvite(this: BotSessionContext, guildId: string, code: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const invite = await guild.invites.fetch(code);
  await invite.delete("Deleted from Botdeck");
  await this.fetchGuildInvites(guildId);
}


export async function fetchGuildBans(this: BotSessionContext, guildId: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const bans = Array.from((await guild.bans.fetch()).values())
    .map((ban) => normalizeGuildBan(guild.id, ban))
    .sort((left, right) => left.username.localeCompare(right.username));
  this.publishEvent({ type: "state.guildBans", guildId: guild.id, bans });
}

export async function createGuildBan(this: BotSessionContext, guildId: string, userId: string, options: { reason?: string; deleteMessageSeconds?: number } = {}): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  await guild.bans.create(userId, { reason: options.reason, deleteMessageSeconds: options.deleteMessageSeconds });
  await this.fetchGuildBans(guildId);
}

export async function deleteGuildBan(this: BotSessionContext, guildId: string, userId: string, reason?: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  await guild.bans.remove(userId, reason || "Unbanned from Botdeck");
  await this.fetchGuildBans(guildId);
}

export async function fetchGuildMembers(this: BotSessionContext, guildId: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");

  const allMembers = await safeFetchGuildMembers(this, guild, {
    withPresences: false,
  });
  const fetchedMembers = allMembers ?? guild.members.cache;

  const members = Array.from(fetchedMembers.values()).sort(
    (left, right) =>
      (right.joinedTimestamp ?? 0) - (left.joinedTimestamp ?? 0),
  );
  this.publishEvent({
    type: "state.users",
    users: members.map(normalizeUser),
  });
  this.publishEvent({
    type: "state.members",
    guildId: guild.id,
    members: members.map(normalizeGuildMember),
  });
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Fetched ${members.length}/${guild.memberCount ?? members.length} server member${members.length === 1 ? "" : "s"}.`,
    context: {
      botId: this.account.id,
      guildId: guild.id,
      memberCount: members.length,
      expectedMemberCount: guild.memberCount,
    },
  });
}

export async function fetchGuildRoles(this: BotSessionContext, guildId: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  await this.refreshGuildRoles(guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Fetched ${guild.roles.cache.size} server role${guild.roles.cache.size === 1 ? "" : "s"}.`,
    context: {
      botId: this.account.id,
      guildId: guild.id,
      roleCount: guild.roles.cache.size,
    },
  });
}

export async function publishGuildMembers(this: BotSessionContext, guildId: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return;
  const members = Array.from(guild.members.cache.values());
  this.publishEvent({
    type: "state.users",
    users: members.map(normalizeUser),
  });
  this.publishEvent({
    type: "state.members",
    guildId: guild.id,
    members: members.map(normalizeGuildMember),
  });
}

export async function refreshGuildRoles(this: BotSessionContext, guild: Guild): Promise<void> {
  await guild.roles.fetch().catch(() => undefined);
  const roles = Array.from(guild.roles.cache.values())
    .filter((role) => role.id !== guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => normalizeRole(guild.id, role));
  this.publishEvent({ type: "state.roles", guildId: guild.id, roles });
}

export function rolePermissionsFromPayload(this: BotSessionContext, 
  value?: string | null,
): PermissionsBitField | undefined {
  if (value === undefined || value === null) return undefined;
  return new PermissionsBitField(this.rolePermissionBitsFromPayload(value));
}

export function rolePermissionBitsFromPayload(this: BotSessionContext, value: string): bigint {
  const raw = value.trim();
  if (!raw) return 0n;
  try {
    const bits = BigInt(raw);
    if (bits < 0n) throw new Error("negative");
    return bits;
  } catch {
    throw new Error("Invalid role permissions bitfield.");
  }
}

export async function resolveEditableGuildRole(this: BotSessionContext, 
  guildId: string,
  roleId: string,
): Promise<{ guild: Guild; role: Role }> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles))
    throw new Error("Missing Manage Roles permission.");
  const role =
    guild.roles.cache.get(roleId) ??
    (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) throw new Error("Role not found.");
  if (role.managed) throw new Error("Managed roles cannot be edited.");
  if (!role.editable)
    throw new Error(
      "This role is above the bot role and cannot be edited by Discord.",
    );
  return { guild, role };
}

export async function createGuildRole(this: BotSessionContext, 
  guildId: string,
  payload: {
    name: string;
    color?: string | null;
    permissions?: string;
    hoist?: boolean;
    mentionable?: boolean;
  },
): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles))
    throw new Error("Missing Manage Roles permission.");
  const role = await guild.roles.create({
    name: payload.name.trim().slice(0, 100) || "New role",
    color: payload.color || undefined,
    permissions: this.rolePermissionsFromPayload(payload.permissions),
    hoist: Boolean(payload.hoist),
    mentionable: Boolean(payload.mentionable),
    reason: "Created from Botdeck",
  } as any);
  await this.refreshGuildRoles(guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Role created: ${role.name}.`,
    context: { botId: this.account.id, guildId, roleId: role.id },
  });
}

export async function updateGuildRole(this: BotSessionContext, 
  guildId: string,
  roleId: string,
  payload: {
    name?: string;
    color?: string | null;
    permissions?: string;
    hoist?: boolean;
    mentionable?: boolean;
  },
): Promise<void> {
  const { guild, role } = await this.resolveEditableGuildRole(
    guildId,
    roleId,
  );
  const permissions =
    payload.permissions !== undefined
      ? this.rolePermissionsFromPayload(payload.permissions)
      : undefined;
  const beforePermissions = role.permissions.bitfield.toString();
  const editedRole = await role.edit({
    ...(payload.name !== undefined
      ? { name: payload.name.trim().slice(0, 100) || role.name }
      : {}),
    ...(payload.color !== undefined ? { color: payload.color || null } : {}),
    ...(permissions !== undefined
      ? { permissions: permissions.bitfield }
      : {}),
    ...(payload.hoist !== undefined ? { hoist: payload.hoist } : {}),
    ...(payload.mentionable !== undefined
      ? { mentionable: payload.mentionable }
      : {}),
    reason: "Updated from Botdeck",
  } as any);
  if (permissions !== undefined) {
    const expectedPermissions = permissions.bitfield.toString();
    const appliedPermissions = editedRole.permissions.bitfield.toString();
    if (appliedPermissions !== expectedPermissions) {
      throw new Error(
        `Discord did not apply the requested role permissions. Expected ${expectedPermissions}, got ${appliedPermissions}.`,
      );
    }
  }
  await this.refreshGuildRoles(guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Role updated: ${editedRole.name}.`,
    context: {
      botId: this.account.id,
      guildId,
      roleId: editedRole.id,
      beforePermissions,
      permissions: payload.permissions ?? null,
      appliedPermissions: editedRole.permissions.bitfield.toString(),
    },
  });
}

export async function updateGuildRolePermissions(this: BotSessionContext, 
  guildId: string,
  roleId: string,
  permissions: string,
): Promise<void> {
  const { guild, role } = await this.resolveEditableGuildRole(
    guildId,
    roleId,
  );
  const nextPermissions = new PermissionsBitField(
    this.rolePermissionBitsFromPayload(permissions),
  );
  await role.setPermissions(
    nextPermissions,
    "Updated role permissions from Botdeck",
  );
  await this.refreshGuildRoles(guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Role permissions updated: ${role.name}.`,
    context: {
      botId: this.account.id,
      guildId,
      roleId: role.id,
      permissions,
    },
  });
}

export async function deleteGuildRole(this: BotSessionContext, guildId: string, roleId: string): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");
  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles))
    throw new Error("Missing Manage Roles permission.");
  const role =
    guild.roles.cache.get(roleId) ??
    (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) throw new Error("Role not found.");
  if (role.managed) throw new Error("Managed roles cannot be deleted.");
  if (!role.editable)
    throw new Error(
      "This role is above the bot role and cannot be deleted by Discord.",
    );
  await role.delete("Deleted from Botdeck");
  await this.refreshGuildRoles(guild);
}

export async function moveGuildChannel(this: BotSessionContext, 
  guildId: string,
  channelId: string,
  targetId: string | null,
  placement: "before" | "after" | "inside",
): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");

  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("Missing Manage Channels permission.");
  }

  let channels = Array.from(guild.channels.cache.values()).filter(
    (channel): channel is GuildBasedChannel => isGuildBasedChannel(channel),
  );
  let channelById = new Map(
    channels.map((channel) => [channel.id, channel]),
  );

  if (!channelById.has(channelId) || (targetId && !channelById.has(targetId))) {
    const fetchedChannels = await safeFetchGuildChannels(guild);
    const collection = fetchedChannels ?? guild.channels.cache;
    channels = Array.from(collection.values()).filter(
      (channel): channel is GuildBasedChannel => isGuildBasedChannel(channel),
    );
    channelById = new Map(
      channels.map((channel) => [channel.id, channel]),
    );
  }
  const moving = channelById.get(channelId);
  if (!moving) throw new Error("Channel not found.");
  if (mapChannelType(moving) === "thread")
    throw new Error("Threads cannot be moved from the server channel list.");

  const target = targetId ? (channelById.get(targetId) ?? null) : null;
  if (targetId && !target) throw new Error("Drop target not found.");
  if (target && target.id === moving.id) return;

  const movingIsCategory = moving.type === ChannelType.GuildCategory;
  let nextParentId: string | null = movingIsCategory
    ? null
    : channelParentId(moving);
  let orderedPool: GuildBasedChannel[];
  let insertIndex = 0;

  const sortable = (channel: GuildBasedChannel) =>
    mapChannelType(channel) !== "thread";
  const sortDiscord = (left: GuildBasedChannel, right: GuildBasedChannel) =>
    compareGuildChannels(left, right);

  if (placement === "inside") {
    if (
      !target ||
      target.type !== ChannelType.GuildCategory ||
      movingIsCategory
    ) {
      throw new Error(
        "Only normal channels can be dropped inside a category.",
      );
    }
    nextParentId = target.id;
    orderedPool = channels
      .filter(
        (channel) =>
          sortable(channel) &&
          channel.id !== moving.id &&
          channel.type !== ChannelType.GuildCategory &&
          channelParentId(channel) === nextParentId,
      )
      .sort(sortDiscord);
    insertIndex = orderedPool.length;
  } else if (target) {
    const targetIsCategory = target.type === ChannelType.GuildCategory;
    const targetParentId = targetIsCategory ? null : channelParentId(target);
    if (movingIsCategory && targetParentId) {
      throw new Error("Categories can only be reordered at the server root.");
    }
    nextParentId = movingIsCategory ? null : targetParentId;
    orderedPool = channels
      .filter((channel) => {
        if (!sortable(channel) || channel.id === moving.id) return false;
        if (nextParentId)
          return (
            channel.type !== ChannelType.GuildCategory &&
            channelParentId(channel) === nextParentId
          );
        return (
          channel.type === ChannelType.GuildCategory ||
          channelParentId(channel) === null
        );
      })
      .sort(sortDiscord);
    const targetIndex = orderedPool.findIndex(
      (channel) => channel.id === target.id,
    );
    insertIndex =
      targetIndex >= 0
        ? targetIndex + (placement === "after" ? 1 : 0)
        : orderedPool.length;
  } else {
    nextParentId = null;
    orderedPool = channels
      .filter(
        (channel) =>
          sortable(channel) &&
          channel.id !== moving.id &&
          (channel.type === ChannelType.GuildCategory ||
            channelParentId(channel) === null),
      )
      .sort(sortDiscord);
    insertIndex = orderedPool.length;
  }

  orderedPool.splice(
    Math.max(0, Math.min(insertIndex, orderedPool.length)),
    0,
    moving,
  );

  const body = orderedPool.map((channel, position) => ({
    id: channel.id,
    position,
    ...(channel.id === moving.id && !movingIsCategory
      ? { parent_id: nextParentId }
      : {}),
  }));

  await this.client.rest.patch(
    `/guilds/${guild.id}/channels` as any,
    { body } as any,
  );
  await refreshGuildChannelsOnly(this, guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Channel moved: ${moving.name}.`,
    context: {
      botId: this.account.id,
      guildId: guild.id,
      channelId: moving.id,
      targetId,
      placement,
      parentId: nextParentId,
    },
  });
}

export async function createGuildCategory(this: BotSessionContext, 
  guildId: string,
  name: string,
): Promise<void> {
  const cleanName = name.trim().slice(0, 100);
  if (!cleanName) throw new Error("Category name is required.");
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");

  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("Missing Manage Channels permission.");
  }

  const category = await guild.channels.create({
    name: cleanName,
    type: ChannelType.GuildCategory,
  });
  await this.refreshGuild(guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Category created: ${category.name}.`,
    context: {
      botId: this.account.id,
      guildId: guild.id,
      channelId: category.id,
    },
  });
}


export async function recreatePurgeGuildChannel(
  this: BotSessionContext,
  guildId: string,
  channelId: string,
  options: RecreatePurgeOptions = {},
): Promise<void> {
  const confirmation = (options.confirmation ?? "").trim().toUpperCase();
  if (confirmation !== "RECREER" && confirmation !== "RECREATE" && confirmation !== "CONFIRMER" && confirmation !== "CONFIRM") {
    throw new Error("Confirmation required: type RECREER.");
  }

  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");

  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("Missing Manage Channels permission.");
  }
  if (!me.permissions.has(PermissionFlagsBits.ViewChannel)) {
    throw new Error("Missing View Channel permission.");
  }

  const channel =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !isGuildBasedChannel(channel)) throw new Error("Channel not found.");
  if (mapChannelType(channel) === "thread") throw new Error("Threads are not supported by channel recreation.");
  if (channel.type === ChannelType.GuildCategory) throw new Error("Categories are not supported by channel recreation.");

  const oldChannel: any = channel;
  const startedAt = new Date();
  const cleanReason = (options.reason ?? "").trim().slice(0, 480) || "Botdeck channel recreation purge";
  const auditReason = `Botdeck recreate purge: ${cleanReason}`.slice(0, 512);
  const oldPosition = typeof oldChannel.position === "number" ? oldChannel.position : null;
  const oldParentId = oldChannel.parentId ?? null;
  const oldType = readableChannelType(oldChannel);
  const permissionOverwrites = clonePermissionOverwrites(oldChannel);
  const transcriptEnabled = false;
  const transcriptMessages: any[] = [];
  const snapshot = {
    guild: { id: guild.id, name: guild.name },
    oldChannel: {
      id: oldChannel.id,
      name: oldChannel.name,
      type: oldType,
      parentId: oldParentId,
      position: oldPosition,
      topic: "topic" in oldChannel ? oldChannel.topic ?? null : null,
      nsfw: "nsfw" in oldChannel ? Boolean(oldChannel.nsfw) : null,
      rateLimitPerUser: "rateLimitPerUser" in oldChannel ? oldChannel.rateLimitPerUser ?? null : null,
    },
    action: {
      reason: cleanReason,
      startedAt: startedAt.toISOString(),
      transcriptEnabled,
      transcriptMessageCount: transcriptMessages.length,
    },
    permissionOverwrites,
    messages: transcriptMessages,
  };

  const createOptions = buildChannelCreateOptions(oldChannel, auditReason, permissionOverwrites);
  let newChannel: any = null;
  try {
    this.rememberChannelRecreateCreate?.(guild.id, {
      name: oldChannel.name,
      parentId: oldParentId,
      type: String(oldChannel.type),
    });
    newChannel = await guild.channels.create(createOptions);
    if (oldPosition !== null && typeof newChannel.setPosition === "function") {
      await newChannel.setPosition(oldPosition, { reason: auditReason }).catch(() => undefined);
    }



    this.rememberChannelRecreateDelete?.(channelId);
    await oldChannel.delete(auditReason);
    await this.deleteChannelSnapshot(channelId).catch(() => undefined);
    await this.refreshGuild(guild);

    const finishedAt = new Date();
    const duration = `${Math.max(0, finishedAt.getTime() - startedAt.getTime())}ms`;
    const actor = options.executorId ? await this.client.users.fetch(options.executorId).catch(() => null) : this.client.user;
    await this.sendDiscordLog({
      key: "channel_recreate_purge",
      guild,
      values: {
        ...this.baseLogValues(guild, "channel_recreate_purge", actor),
        "channel.id": newChannel.id,
        "channel.name": newChannel.name,
        "channel.mention": `<#${newChannel.id}>`,
        "channel.type": readableChannelType(newChannel),
        "oldChannel.id": oldChannel.id,
        "oldChannel.name": oldChannel.name,
        "oldChannel.type": oldType,
        "oldChannel.parentId": oldParentId ?? "",
        "oldChannel.position": oldPosition !== null ? String(oldPosition) : "",
        "newChannel.id": newChannel.id,
        "newChannel.name": newChannel.name,
        "newChannel.mention": `<#${newChannel.id}>`,
        "newChannel.type": readableChannelType(newChannel),
        "newChannel.parentId": newChannel.parentId ?? "",
        "newChannel.position": typeof newChannel.position === "number" ? String(newChannel.position) : "",
        "purge.reason": cleanReason,
        "purge.transcriptEnabled": transcriptEnabled ? "oui" : "non",
        "purge.transcriptMessageCount": String(transcriptMessages.length),
        "purge.status": "success",
        "purge.startedAt": startedAt.toISOString(),
        "purge.finishedAt": finishedAt.toISOString(),
        "purge.duration": duration,
      },
    }).catch((error: unknown) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send channel recreation log.",
        context: { botId: this.account.id, guildId: guild.id, error: error instanceof Error ? error.message : "Unknown logs failure" },
      }),
    );

    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: `Channel recreated: ${oldChannel.name}.`,
      context: { botId: this.account.id, guildId: guild.id, oldChannelId: channelId, newChannelId: newChannel.id, transcriptMessages: transcriptMessages.length },
    });
  } catch (error) {
    if (newChannel && guild.channels.cache.has(newChannel.id) && guild.channels.cache.has(channelId)) {
      await newChannel.delete(`Botdeck recreate purge rollback: ${cleanReason}`.slice(0, 512)).catch(() => undefined);
    }
    throw error;
  }
}


export async function deleteGuildChannel(this: BotSessionContext, 
  guildId: string,
  channelId: string,
): Promise<void> {
  const guild =
    this.client.guilds.cache.get(guildId) ??
    (await this.client.guilds.fetch(guildId).catch(() => null));
  if (!guild) throw new Error("Server not found.");

  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("Missing Manage Channels permission.");
  }

  const channel =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));
  if (!channel || !isGuildBasedChannel(channel))
    throw new Error("Channel not found.");
  if (mapChannelType(channel) === "thread")
    throw new Error("Threads must be managed from the forum post view.");
  const channelName = channel.name;
  await channel.delete("Deleted from Botdeck");
  await this.deleteChannelSnapshot(channelId).catch(() => undefined);
  await this.refreshGuild(guild);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: `Channel deleted: ${channelName}.`,
    context: { botId: this.account.id, guildId: guild.id, channelId },
  });
}

export async function deleteForumPost(this: BotSessionContext, threadId: string): Promise<void> {
  const channel = await this.client.channels.fetch(threadId);
  if (!channel || !("delete" in channel) || !("parentId" in channel)) {
    throw new Error("Selected forum post cannot be deleted.");
  }
  const forumId = channel.parentId;
  await (channel as any).delete();
  if (forumId)
    this.publishEvent({
      type: "forumPost.deleted",
      forumId,
      postId: threadId,
    });
}

export async function setForumPostArchived(this: BotSessionContext, 
  threadId: string,
  archived: boolean,
): Promise<void> {
  const channel = await this.client.channels.fetch(threadId);
  if (!channel || !("setArchived" in channel) || !("parentId" in channel)) {
    throw new Error("Selected forum post cannot be archived.");
  }
  const updated = await (channel as any).setArchived(archived);
  if (updated.parentId)
    this.publishEvent({
      type: "forumPost.updated",
      forumId: updated.parentId,
      post: normalizeForumPost(updated),
    });
}

export async function setForumPostLocked(this: BotSessionContext, 
  threadId: string,
  locked: boolean,
): Promise<void> {
  const channel = await this.client.channels.fetch(threadId);
  if (!channel || !("setLocked" in channel) || !("parentId" in channel)) {
    throw new Error("Selected forum post cannot be locked.");
  }
  const updated = await (channel as any).setLocked(locked);
  if (updated.parentId)
    this.publishEvent({
      type: "forumPost.updated",
      forumId: updated.parentId,
      post: normalizeForumPost(updated),
    });
}
