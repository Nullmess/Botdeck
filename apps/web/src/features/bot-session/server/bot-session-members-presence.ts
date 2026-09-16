// Extraction BotSession: bot session members presence.

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


export async function setPresence(this: BotSessionContext, 
  status: "online" | "idle" | "dnd" | "offline",
  activityOrActivities?:
    | Extract<ClientCommand, { type: "presence.set" }>["activity"]
    | Extract<ClientCommand, { type: "presence.set" }>["activities"],
): Promise<void> {
  const discordStatus = status === "offline" ? "invisible" : status;
  const requestedActivities = Array.isArray(activityOrActivities)
    ? activityOrActivities
    : activityOrActivities
      ? [activityOrActivities]
      : [];
  const activities: Array<{
    name: string;
    type: ActivityType;
    state?: string;
    url?: string;
  }> = [];

  for (const activity of requestedActivities) {
    if (!activity) continue;
    if (activity.type === "custom") {
      const customState =
        activity.state?.trim() || activity.name?.trim() || "";
      if (!customState) continue;
      activities.push({
        name: customState,
        type: ActivityType.Custom,
        state: customState,
      });
      continue;
    }

    const name = activity.name.trim();
    if (!name) continue;
    activities.push({
      name,
      type: activityTypeToDiscord(activity.type),
      state: activity.state?.trim() || undefined,
      url: activity.type === "streaming" ? activity.url : undefined,
    });
  }

  await this.client.user?.setPresence({
    status: discordStatus,
    activities: activities as any,
  });
}

export async function fetchUserProfile(this: BotSessionContext, userId: string): Promise<void> {
  const profile = await buildDirectUserProfile(this.client, userId);
  this.publishEvent({ type: "member.profile", profile });
}

export async function fetchMemberProfile(this: BotSessionContext, 
  guildId: string,
  userId: string,
): Promise<void> {
  const guild = await this.client.guilds.fetch(guildId);
  await guild.roles.fetch().catch(() => undefined);
  const member = await guild.members.fetch(userId);
  this.publishGuildRoles(guild);
  this.publishEvent({
    type: "member.profile",
    profile: await buildDetailedMemberProfile(member),
  });
}

export async function setMemberTimeout(this: BotSessionContext, 
  guildId: string,
  userId: string,
  until: string | null,
  reason?: string,
): Promise<void> {
  const member = await this.fetchGuildMember(guildId, userId);
  await member.timeout(
    until ? Math.max(0, Date.parse(until) - Date.now()) : null,
    reason,
  );
  await this.fetchMemberProfile(guildId, userId);
}

export async function kickMember(this: BotSessionContext, 
  guildId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const member = await this.fetchGuildMember(guildId, userId);
  await member.kick(reason);
  this.rememberModerationLog(guildId, "kick", userId);
  await this.publishGuildMembers(guildId);
  await this.sendModerationLog(
    member.guild,
    "kick",
    this.client.user ?? null,
    member.user,
    reason,
  ).catch(() => undefined);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: "Member kicked.",
    context: { botId: this.account.id, guildId, userId },
  });
}

export async function banMember(this: BotSessionContext, 
  guildId: string,
  userId: string,
  reason?: string,
  deleteMessageSeconds = 0,
): Promise<void> {
  const guild = await this.client.guilds.fetch(guildId);
  const targetUser = await this.client.users
    .fetch(userId)
    .catch(() => ({ id: userId, username: userId, displayName: userId }));
  await guild.members.ban(userId, { reason, deleteMessageSeconds });
  this.rememberModerationLog(guildId, "ban", userId);
  await this.publishGuildMembers(guildId);
  await this.sendModerationLog(
    guild,
    "ban",
    this.client.user ?? null,
    targetUser,
    reason,
  ).catch(() => undefined);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: "Member banned.",
    context: { botId: this.account.id, guildId, userId },
  });
}

export async function unbanMember(this: BotSessionContext, 
  guildId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  const guild = await this.client.guilds.fetch(guildId);
  const targetUser = await this.client.users
    .fetch(userId)
    .catch(() => ({ id: userId, username: userId, displayName: userId }));
  await guild.bans.remove(userId, reason);
  this.rememberModerationLog(guildId, "unban", userId);
  await this.sendModerationLog(
    guild,
    "unban",
    this.client.user ?? null,
    targetUser,
    reason,
  ).catch(() => undefined);
  this.publishEvent({
    type: "audit.log",
    level: "info",
    message: "Member unbanned.",
    context: { botId: this.account.id, guildId, userId },
  });
}

export async function setMemberNickname(this: BotSessionContext, 
  guildId: string,
  userId: string,
  nickname: string | null,
): Promise<void> {
  const member = await this.fetchGuildMember(guildId, userId);
  await member.setNickname(nickname?.trim() || null, "Updated from Botdeck");
  await this.fetchMemberProfile(guildId, userId);
  await this.publishGuildMembers(guildId);
}

export async function addMemberRole(this: BotSessionContext, 
  guildId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  const member = await this.fetchGuildMember(guildId, userId);
  await member.roles.add(roleId);
  await this.fetchMemberProfile(guildId, userId);
  await this.publishGuildMembers(guildId);
}

export async function removeMemberRole(this: BotSessionContext, 
  guildId: string,
  userId: string,
  roleId: string,
): Promise<void> {
  const member = await this.fetchGuildMember(guildId, userId);
  await member.roles.remove(roleId);
  await this.fetchMemberProfile(guildId, userId);
  await this.publishGuildMembers(guildId);
}

export async function moveVoiceMember(this: BotSessionContext, 
  guildId: string,
  userId: string,
  channelId: string | null,
): Promise<void> {
  const member = await this.fetchGuildMember(guildId, userId);
  await member.voice.setChannel(channelId);
  await this.fetchMemberProfile(guildId, userId);
}

export async function fetchGuildMember(this: BotSessionContext, 
  guildId: string,
  userId: string,
): Promise<GuildMember> {
  const guild = await this.client.guilds.fetch(guildId);
  return guild.members.fetch(userId);
}

export function publishGuildRoles(this: BotSessionContext, guild: Guild): void {
  const roles = Array.from(guild.roles.cache.values())
    .filter((role) => role.id !== guild.id)
    .sort((left, right) => right.position - left.position)
    .map((role) => normalizeRole(guild.id, role));
  this.publishEvent({ type: "state.roles", guildId: guild.id, roles });
}
