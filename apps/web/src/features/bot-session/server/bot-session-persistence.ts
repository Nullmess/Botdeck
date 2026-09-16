// Extraction BotSession: bot session persistence.

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


export async function persistGuildSnapshot(this: BotSessionContext, 
  guild: Guild,
  channels: GuildBasedChannel[],
  members: GuildMember[],
): Promise<void> {
  const botAccountId = this.account.id;
  const uniqueChannels = uniqueBy(channels, (channel) => channel.id);
  const uniqueMembers = uniqueBy(members, (member) => member.user.id);

  await enqueueDatabaseWrite(async () => {
    await prisma.guild.upsert({
      where: { botAccountId_id: { botAccountId, id: guild.id } },
      create: {
        botAccountId,
        id: guild.id,
        name: guild.name,
        iconUrl: guild.iconURL({ size: 128 }),
      },
      update: {
        name: guild.name,
        iconUrl: guild.iconURL({ size: 128 }),
      },
    });

    for (const channelBatch of chunkArray(
      uniqueChannels,
      DATABASE_WRITE_BATCH_SIZE,
    )) {
      await runWithConcurrency(
        channelBatch,
        DATABASE_WRITE_CONCURRENCY,
        async (channel) => {
          await prisma.channel.upsert({
            where: { botAccountId_id: { botAccountId, id: channel.id } },
            create: {
              botAccountId,
              id: channel.id,
              guildId: channel.guildId,
              name: channel.name,
              type: String(channel.type),
              topic: "topic" in channel ? (channel.topic ?? null) : null,
            },
            update: {
              guildId: channel.guildId,
              name: channel.name,
              type: String(channel.type),
              topic: "topic" in channel ? (channel.topic ?? null) : null,
            },
          });
        },
      );
    }

    for (const memberBatch of chunkArray(
      uniqueMembers,
      DATABASE_WRITE_BATCH_SIZE,
    )) {
      await runWithConcurrency(
        memberBatch,
        DATABASE_WRITE_CONCURRENCY,
        async (member) => {
          await this.persistUserSnapshotDirect(
            member.user,
            member.displayName ?? null,
          );
        },
      );
    }

    for (const memberBatch of chunkArray(
      uniqueMembers,
      DATABASE_WRITE_BATCH_SIZE,
    )) {
      await runWithConcurrency(
        memberBatch,
        DATABASE_WRITE_CONCURRENCY,
        async (member) => {
          await prisma.presence.upsert({
            where: {
              botAccountId_userId: { botAccountId, userId: member.user.id },
            },
            create: {
              botAccountId,
              userId: member.user.id,
              status: member.presence?.status ?? "offline",
              activity: member.presence?.activities[0]?.name ?? null,
            },
            update: {
              status: member.presence?.status ?? "offline",
              activity: member.presence?.activities[0]?.name ?? null,
            },
          });
        },
      );
    }
  });
}

export async function persistPresenceSnapshot(this: BotSessionContext, member: GuildMember): Promise<void> {
  const botAccountId = this.account.id;
  await enqueueDatabaseWrite(async () => {
    await this.persistUserSnapshotDirect(
      member.user,
      member.displayName ?? null,
    );

    await prisma.presence.upsert({
      where: {
        botAccountId_userId: { botAccountId, userId: member.user.id },
      },
      create: {
        botAccountId,
        userId: member.user.id,
        status: member.presence?.status ?? "offline",
        activity: member.presence?.activities[0]?.name ?? null,
      },
      update: {
        status: member.presence?.status ?? "offline",
        activity: member.presence?.activities[0]?.name ?? null,
      },
    });
  });
}

export async function persistUserSnapshotDirect(this: BotSessionContext, 
  user: User,
  displayName: string | null,
): Promise<void> {
  const botAccountId = this.account.id;
  await prisma.user.upsert({
    where: { botAccountId_id: { botAccountId, id: user.id } },
    create: {
      botAccountId,
      id: user.id,
      username: user.username,
      displayName,
      avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
      bot: user.bot,
    },
    update: {
      username: user.username,
      displayName,
      avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
      bot: user.bot,
    },
  });
}

export async function persistMessageSnapshot(this: BotSessionContext, message: Message): Promise<void> {
  const botAccountId = this.account.id;
  const summary = normalizeMessage(message);
  const channel = message.channel;
  const isGuildMessage = isGuildBasedChannel(channel);
  const dmPeer = isGuildMessage ? null : resolveDirectMessagePeer(message);
  const guildId = isGuildMessage ? channel.guildId : DM_GUILD_ID;
  const channelName = isGuildMessage
    ? channel.name
    : (dmPeer?.globalName ??
      dmPeer?.username ??
      (message.author.id === this.client.user?.id
        ? "Direct message"
        : (message.author.globalName ?? message.author.username)));
  const channelType = isGuildMessage ? mapChannelType(channel) : "dm";
  const channelTopic = isGuildMessage
    ? "topic" in channel
      ? (channel.topic ?? null)
      : null
    : dmPeer
      ? `user:${dmPeer.id}`
      : null;
  const displayName = isGuildMessage
    ? (message.member?.displayName ?? null)
    : (message.author.globalName ?? null);

  await enqueueDatabaseWrite(async () => {
    await prisma.guild.upsert({
      where: { botAccountId_id: { botAccountId, id: guildId } },
      create: {
        botAccountId,
        id: guildId,
        name: isGuildMessage ? channel.guild.name : "Messages directs",
        iconUrl: isGuildMessage ? channel.guild.iconURL({ size: 128 }) : null,
      },
      update: {
        name: isGuildMessage ? channel.guild.name : "Messages directs",
        iconUrl: isGuildMessage ? channel.guild.iconURL({ size: 128 }) : null,
      },
    });

    await prisma.channel.upsert({
      where: { botAccountId_id: { botAccountId, id: message.channelId } },
      create: {
        botAccountId,
        id: message.channelId,
        guildId,
        name: channelName,
        type: channelType,
        topic: channelTopic,
      },
      update: {
        guildId,
        name: channelName,
        type: channelType,
        topic: channelTopic,
      },
    });

    await this.persistUserSnapshotDirect(message.author, displayName);

    if (dmPeer && dmPeer.id !== message.author.id) {
      await this.persistUserSnapshotDirect(dmPeer, dmPeer.globalName ?? null);
    }

    await prisma.message.upsert({
      where: { botAccountId_id: { botAccountId, id: message.id } },
      create: {
        botAccountId,
        id: message.id,
        channelId: message.channelId,
        authorId: message.author.id,
        authorTag: summary.authorTag,
        authorAvatarUrl: summary.authorAvatarUrl,
        content: message.content,
        createdAt: message.createdAt,
        editedAt: message.editedAt ?? null,
        pinned: message.pinned,
        type: summary.type ?? null,
        attachmentsJson: JSON.stringify(summary.attachments ?? []),
        embedsJson: JSON.stringify(summary.embeds ?? []),
        reactionsJson: JSON.stringify(summary.reactions ?? []),
        replyToMessageId: summary.replyToMessageId,
        system: summary.system ?? false,
      },
      update: {
        channelId: message.channelId,
        authorId: message.author.id,
        authorTag: summary.authorTag,
        authorAvatarUrl: summary.authorAvatarUrl,
        content: message.content,
        createdAt: message.createdAt,
        editedAt: message.editedAt ?? null,
        pinned: message.pinned,
        type: summary.type ?? null,
        attachmentsJson: JSON.stringify(summary.attachments ?? []),
        embedsJson: JSON.stringify(summary.embeds ?? []),
        reactionsJson: JSON.stringify(summary.reactions ?? []),
        replyToMessageId: summary.replyToMessageId,
        system: summary.system ?? false,
      },
    });
  });
}

export async function persistMessagesSnapshot(this: BotSessionContext, messages: Message[]): Promise<void> {
  for (const messageBatch of chunkArray(
    messages,
    DATABASE_WRITE_BATCH_SIZE,
  )) {
    await runWithConcurrency(
      messageBatch,
      DATABASE_WRITE_CONCURRENCY,
      (message) => this.persistMessageSnapshot(message),
    );
  }
}

export async function deleteGuildSnapshot(this: BotSessionContext, guildId: string): Promise<void> {
  await enqueueDatabaseWrite(() =>
    prisma.guild.deleteMany({
      where: { botAccountId: this.account.id, id: guildId },
    }),
  );
}

export async function deleteChannelSnapshot(this: BotSessionContext, channelId: string): Promise<void> {
  await enqueueDatabaseWrite(() =>
    prisma.channel.deleteMany({
      where: { botAccountId: this.account.id, id: channelId },
    }),
  );
}

export async function deleteMessageSnapshot(this: BotSessionContext, messageId: string): Promise<void> {
  await enqueueDatabaseWrite(() =>
    prisma.message.deleteMany({
      where: { botAccountId: this.account.id, id: messageId },
    }),
  );
}
