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

type StoredWelcomeConfig = {
  guildId: string;
  channelId: string;
  messageType: string;
  messageTemplate: string;
  embedPagesJson: string | null;
  enabled: boolean;
};

type StoredGoodbyeConfig = StoredWelcomeConfig;


// Méthodes extraites de BotSession.
// Ces fonctions utilisent le contrat interne BotSessionContext pour éviter les contextes non typés.

export function cacheWelcomeConfig(this: BotSessionContext, config: StoredWelcomeConfig): void {
    this.welcomeConfigsByGuild.set(config.guildId, config);
  }


export async function loadWelcomeConfigs(this: BotSessionContext): Promise<void> {
    const rows = await (
      prisma as unknown as {
        guildWelcomeConfig: {
          findMany: (args: unknown) => Promise<StoredWelcomeConfig[]>;
        };
      }
    ).guildWelcomeConfig.findMany({
      where: { botAccountId: this.account.id, enabled: true },
      select: {
        guildId: true,
        channelId: true,
        messageType: true,
        messageTemplate: true,
        embedPagesJson: true,
        enabled: true,
      },
    });
    this.welcomeConfigsByGuild.clear();
    for (const row of rows) this.cacheWelcomeConfig(row);
    if (rows.length) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: `Welcome listener active for ${rows.length} server${rows.length === 1 ? "" : "s"}.`,
        context: {
          botId: this.account.id,
          guildIds: rows.map((row) => row.guildId),
        },
      });
    }
  }


export async function saveWelcomeConfig(
  this: BotSessionContext,
    guildId: string,
    channelId: string,
    messageType: "message" | "embed",
    messageTemplate: string,
    embedPagesJson: string | null,
  ): Promise<void> {
    await (
      prisma as unknown as {
        guildWelcomeConfig: { upsert: (args: unknown) => Promise<unknown> };
      }
    ).guildWelcomeConfig.upsert({
      where: {
        botAccountId_guildId: { botAccountId: this.account.id, guildId },
      },
      create: {
        botAccountId: this.account.id,
        guildId,
        channelId,
        messageType,
        messageTemplate,
        embedPagesJson,
        enabled: Boolean(channelId.trim()),
      },
      update: {
        channelId,
        messageType,
        messageTemplate,
        embedPagesJson,
        enabled: Boolean(channelId.trim()),
      },
    });
    this.cacheWelcomeConfig({
      guildId,
      channelId,
      messageType,
      messageTemplate,
      embedPagesJson,
      enabled: Boolean(channelId.trim()),
    });
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Welcome automation armed.",
      context: { botId: this.account.id, guildId, channelId, messageType },
    });
  }


export async function removeWelcomeConfig(
  this: BotSessionContext,
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void> {
    await (
      prisma as unknown as {
        guildWelcomeConfig: { deleteMany: (args: unknown) => Promise<unknown> };
      }
    ).guildWelcomeConfig.deleteMany({
      where: {
        botAccountId: this.account.id,
        guildId,
        ...(channelId ? { channelId } : {}),
      },
    });
    this.welcomeConfigsByGuild.delete(guildId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Welcome channel removed.",
      context: { botId: this.account.id, guildId, channelId, reason },
    });
  }


export async function loadWelcomeConfig(
  this: BotSessionContext,
    guildId: string,
    force = false,
  ): Promise<StoredWelcomeConfig | null> {
    const cached = this.welcomeConfigsByGuild.get(guildId);
    if (cached && !force) return cached;
    const row = await (
      prisma as unknown as {
        guildWelcomeConfig: {
          findUnique: (args: unknown) => Promise<StoredWelcomeConfig | null>;
        };
      }
    ).guildWelcomeConfig.findUnique({
      where: {
        botAccountId_guildId: { botAccountId: this.account.id, guildId },
      },
      select: {
        guildId: true,
        channelId: true,
        messageType: true,
        messageTemplate: true,
        embedPagesJson: true,
        enabled: true,
      },
    });
    if (row) this.cacheWelcomeConfig(row);
    return row;
  }


export function guildAutomationConfig(this: BotSessionContext, guildId: string): GuildAutomationConfig {
    const welcome = this.welcomeConfigsByGuild.get(guildId) ?? null;
    const goodbye = this.goodbyeConfigsByGuild.get(guildId) ?? null;
    const logs = this.logConfigsByGuild.get(guildId) ?? null;
    const roleRules = this.roleAutomationRulesByGuild.get(guildId) ?? [];
    return {
      guildId,
      welcome: welcome
        ? {
            guildId,
            channelId: welcome.channelId,
            messageType: welcome.messageType === "embed" ? "embed" : "message",
            messageTemplate: welcome.messageTemplate,
            embedPagesJson: welcome.embedPagesJson,
            enabled: welcome.enabled,
          }
        : null,
      goodbye: goodbye
        ? {
            guildId,
            channelId: goodbye.channelId,
            messageType: goodbye.messageType === "embed" ? "embed" : "message",
            messageTemplate: goodbye.messageTemplate,
            embedPagesJson: goodbye.embedPagesJson,
            enabled: goodbye.enabled,
          }
        : null,
      logs: logs
        ? {
            guildId,
            channelId: logs.channelId,
            eventConfigsJson: logs.eventConfigsJson,
            enabled: logs.enabled,
          }
        : null,
      roleAutomation: {
        guildId,
        rules: roleRules.map((rule) => this.roleAutomationRuleToConfig(rule)),
      },
    };
  }


export async function publishGuildAutomationConfig(this: BotSessionContext, guildId: string): Promise<void> {
    await Promise.all([
      this.loadWelcomeConfig(guildId, true),
      this.loadGoodbyeConfig(guildId, true),
      this.loadLogConfig(guildId, true),
      this.loadRoleAutomationRules(guildId, true),
    ]);
    this.publishEvent({
      type: "state.guildAutomationConfig",
      guildId,
      config: this.guildAutomationConfig(guildId),
    });
  }


export async function syncGuildAutomationConfig(this: BotSessionContext, guildId: string): Promise<void> {
    await this.publishGuildAutomationConfig(guildId);
  }


export function parseAutomationEmbedPagesJson(
  this: BotSessionContext,
    value: string | null | undefined,
  ): string | null {
    if (!value?.trim()) return null;
    const parsed = safeJsonParse(value);
    if (!Array.isArray(parsed))
      throw new Error("Embed pages JSON must be an array.");
    return JSON.stringify(parsed);
  }


export function channelSendBlockReason(
  this: BotSessionContext,
    channel: unknown,
    guild: Guild | null | undefined,
    embed = false,
  ): string | null {
    if (
      !channel ||
      typeof channel !== "object" ||
      !("isTextBased" in channel) ||
      typeof channel.isTextBased !== "function" ||
      !channel.isTextBased() ||
      !("send" in channel) ||
      typeof channel.send !== "function"
    ) {
      return "Selected channel must be a text channel.";
    }
    const botMember = guild?.members.me ?? null;
    if (
      !botMember ||
      !("permissionsFor" in channel) ||
      typeof channel.permissionsFor !== "function"
    )
      return null;
    const permissions = channel.permissionsFor(botMember);
    if (!permissions) return "Unable to read bot permissions in this channel.";
    if (!permissions.has(PermissionFlagsBits.ViewChannel))
      return "The bot cannot view this channel.";
    if (!permissions.has(PermissionFlagsBits.SendMessages))
      return "The bot cannot send messages in this channel.";
    if (embed && !permissions.has(PermissionFlagsBits.EmbedLinks))
      return "The bot cannot send embeds in this channel.";
    return null;
  }


export async function resolveAutomationChannel(
  this: BotSessionContext,
    guildId: string,
    channelId: string,
    embed = false,
  ): Promise<void> {
    const guild =
      this.client.guilds.cache.get(guildId) ??
      (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) throw new Error("Server not found.");
    const channel =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null));
    const blockReason = this.channelSendBlockReason(channel, guild, embed);
    if (blockReason) throw new Error(blockReason);
  }


function logEventConfigsForStorage(
  value: unknown,
  normalized: Record<LogEventKey, LogEventConfig>,
): Record<LogEventKey, {
  enabled: boolean;
  mode: "message" | "embed";
  messageTemplate: string;
  embedPages?: unknown[];
}> {
  const parsed = isRecord(value) ? value : {};
  return Object.fromEntries(LOG_EVENT_KEYS.map((key) => {
    const item = isRecord(parsed[key]) ? parsed[key] : {};
    const mode = item.mode === "embed" ? "embed" : "message";
    const result: {
      enabled: boolean;
      mode: "message" | "embed";
      messageTemplate: string;
      embedPages?: unknown[];
    } = {
      enabled: item.enabled !== false,
      mode,
      messageTemplate: typeof item.messageTemplate === "string" && item.messageTemplate.trim()
        ? item.messageTemplate
        : normalized[key].messageTemplate,
    };
    if (mode === "embed") {
      // Conserver le format éditeur côté UI.
      // La normalisation Discord se fait à l'envoi du log, pas au stockage.
      // Sinon des champs comme imageUrl/thumbnailUrl avec {actor.avatar}
      // reviennent transformés, et la barre "modifications non enregistrées" reste visible.
      result.embedPages = Array.isArray(item.embedPages)
        ? item.embedPages.slice(0, 10).filter((page) => isRecord(page))
        : [];
    }
    return [key, result];
  })) as Record<LogEventKey, {
    enabled: boolean;
    mode: "message" | "embed";
    messageTemplate: string;
    embedPages?: unknown[];
  }>;
}

export async function updateGuildAutomationConfig(this: BotSessionContext, args: {
    guildId: string;
    kind: GuildAutomationKind;
    channelId: string;
    messageType?: GuildAutomationMessageType;
    messageTemplate?: string;
    embedPagesJson?: string | null;
    eventConfigsJson?: string | null;
  }): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne modifie pas les modèles ou automatisations serveur de ce bot.",
      );
    }
    const requestedMessageType =
      args.messageType === "embed" ? "embed" : "message";
    let normalizedLogEventConfigs: Record<LogEventKey, LogEventConfig> | null =
      null;
    let logEventConfigsToStore: ReturnType<typeof logEventConfigsForStorage> | null = null;
    if (args.kind === "logs") {
      const parsed = safeJsonParse(args.eventConfigsJson?.trim() || "{}");
      normalizedLogEventConfigs = this.normalizeLogEventConfigs(parsed);
      logEventConfigsToStore = logEventConfigsForStorage(parsed, normalizedLogEventConfigs);
    }
    const requiresEmbedLinks =
      args.kind === "logs"
        ? Boolean(
            normalizedLogEventConfigs &&
            Object.values(normalizedLogEventConfigs).some(
              (config) => config.enabled && config.mode === "embed",
            ),
          )
        : requestedMessageType === "embed";
    if (args.channelId.trim()) {
      await this.resolveAutomationChannel(
        args.guildId,
        args.channelId,
        requiresEmbedLinks,
      );
    }
    if (args.kind === "welcome") {
      const messageType = requestedMessageType;
      const messageTemplate =
        args.messageTemplate?.trim() || DEFAULT_WELCOME_MESSAGE;
      await this.saveWelcomeConfig(
        args.guildId,
        args.channelId,
        messageType,
        messageTemplate,
        messageType === "embed"
          ? this.parseAutomationEmbedPagesJson(args.embedPagesJson)
          : null,
      );
    } else if (args.kind === "goodbye") {
      const messageType = requestedMessageType;
      const messageTemplate =
        args.messageTemplate?.trim() || DEFAULT_GOODBYE_MESSAGE;
      await this.saveGoodbyeConfig(
        args.guildId,
        args.channelId,
        messageType,
        messageTemplate,
        messageType === "embed"
          ? this.parseAutomationEmbedPagesJson(args.embedPagesJson)
          : null,
      );
    } else {
      const eventConfigsJson = JSON.stringify(
        logEventConfigsToStore ?? this.defaultLogEventConfigs(),
      );
      await this.saveLogConfig(args.guildId, args.channelId, eventConfigsJson);
    }
    await this.publishGuildAutomationConfig(args.guildId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Server automation updated.",
      context: {
        botId: this.account.id,
        guildId: args.guildId,
        kind: args.kind,
        channelId: args.channelId,
      },
    });
  }


export async function removeGuildAutomationConfig(
  this: BotSessionContext,
    guildId: string,
    kind: GuildAutomationKind,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne modifie pas les modèles ou automatisations serveur de ce bot.",
      );
    }
    if (kind === "welcome")
      await this.removeWelcomeConfig(guildId, "server-settings");
    else if (kind === "goodbye")
      await this.removeGoodbyeConfig(guildId, "server-settings");
    else await this.removeLogConfig(guildId, "server-settings");
    await this.publishGuildAutomationConfig(guildId);
  }


export function automationTestValues(
  this: BotSessionContext,
    guild: Guild,
    kind: "welcome" | "goodbye",
  ): Record<string, string> {
    const botUser = this.client.user;
    const now = new Date();
    const iso = now.toISOString();
    const guildIconUrl = guild.iconURL({ size: 512 }) ?? "";
    const botAvatarUrl = botUser?.displayAvatarURL({ size: 512 }) ?? "";
    const botName = botUser?.username ?? "Bot";
    return {
      "user.id": botUser?.id ?? "0",
      "user.name": botName,
      "user.username": botName,
      "user.displayName": botName,
      "user.mention": botUser ? `<@${botUser.id}>` : "@Bot",
      "user.avatar": botAvatarUrl,
      "user.avatarUrl": botAvatarUrl,
      "guild.id": guild.id,
      "guild.name": guild.name,
      "guild.icon": guildIconUrl,
      "guild.iconUrl": guildIconUrl,
      "bot.id": botUser?.id ?? "",
      "bot.name": botName,
      "bot.username": botName,
      "bot.mention": botUser ? `<@${botUser.id}>` : botName,
      "bot.avatar": botAvatarUrl,
      "bot.avatarUrl": botAvatarUrl,
      "member.count": String(
        guild.memberCount ?? guild.members.cache.size ?? 0,
      ),
      "member.joinedAt": iso,
      "member.joinedDate": now.toLocaleDateString("fr-FR"),
      "member.joinedTime": now.toLocaleTimeString("fr-FR"),
      "member.joinedRelative": `<t:${Math.floor(now.getTime() / 1000)}:R>`,
      "member.leftAt": iso,
      "member.leftDate": now.toLocaleDateString("fr-FR"),
      "member.leftTime": now.toLocaleTimeString("fr-FR"),
      "member.leftRelative": `<t:${Math.floor(now.getTime() / 1000)}:R>`,
      "event.name": kind === "welcome" ? "Test welcome" : "Test goodbye",
      "event.date": iso,
    };
  }


export async function testGuildAutomationConfig(
  this: BotSessionContext,
    guildId: string,
    kind: GuildAutomationKind,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne teste pas les automatisations serveur de ce bot.",
      );
    }
    const guild =
      this.client.guilds.cache.get(guildId) ??
      (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) throw new Error("Server not found.");
    if (kind === "welcome") {
      const config = await this.loadWelcomeConfig(guildId, true);
      if (!config?.enabled)
        throw new Error("Welcome automation is not active.");
      const channel =
        guild.channels.cache.get(config.channelId) ??
        (await guild.channels.fetch(config.channelId).catch(() => null));
      const blockReason = this.channelSendBlockReason(
        channel,
        guild,
        config.messageType === "embed",
      );
      if (blockReason) throw new Error(blockReason);
      const sendableChannel = channel as {
        send: (payload: unknown) => Promise<unknown>;
      };
      const values = this.automationTestValues(guild, "welcome");
      if (config.messageType === "embed") {
        const pages = storedWelcomeEmbedPages(
          config.embedPagesJson,
          config.messageTemplate || DEFAULT_WELCOME_MESSAGE,
        );
        await sendableChannel.send({
          embeds: pages
            .slice(0, 10)
            .map((page) => templateRuntimeEmbed(page, values)),
        });
      } else {
        await sendableChannel.send({
          content: fillRuntimeTemplateFromValues(
            config.messageTemplate || DEFAULT_WELCOME_MESSAGE,
            values,
          ),
        });
      }
    } else if (kind === "goodbye") {
      const config = await this.loadGoodbyeConfig(guildId, true);
      if (!config?.enabled)
        throw new Error("Goodbye automation is not active.");
      const channel =
        guild.channels.cache.get(config.channelId) ??
        (await guild.channels.fetch(config.channelId).catch(() => null));
      const blockReason = this.channelSendBlockReason(
        channel,
        guild,
        config.messageType === "embed",
      );
      if (blockReason) throw new Error(blockReason);
      const sendableChannel = channel as {
        send: (payload: unknown) => Promise<unknown>;
      };
      const values = this.automationTestValues(guild, "goodbye");
      if (config.messageType === "embed") {
        const pages = storedGoodbyeEmbedPages(
          config.embedPagesJson,
          config.messageTemplate || DEFAULT_GOODBYE_MESSAGE,
        );
        await sendableChannel.send({
          embeds: pages
            .slice(0, 10)
            .map((page) => templateRuntimeEmbed(page, values)),
        });
      } else {
        await sendableChannel.send({
          content: fillRuntimeTemplateFromValues(
            config.messageTemplate || DEFAULT_GOODBYE_MESSAGE,
            values,
          ),
        });
      }
    } else {
      const config = await this.loadLogConfig(guildId, true);
      if (!config?.enabled) throw new Error("Logs automation is not active.");
      await this.sendDiscordLog({
        key: "message_edit",
        guild,
        values: {
          ...this.baseLogValues(
            guild,
            "message_edit",
            this.client.user ?? null,
          ),
          ...this.channelValues(
            guild.channels.cache.get(
              config.channelId,
            ) as GuildBasedChannel | null,
          ),
          ...this.userValues("target", this.client.user ?? null),
          "message.id": "test",
          "message.before": "Ancien contenu de test",
          "message.after": "Nouveau contenu de test",
          "message.url": "",
        },
      });
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Server automation test message sent.",
      context: { botId: this.account.id, guildId, kind },
    });
  }


export function cacheGoodbyeConfig(this: BotSessionContext, config: StoredGoodbyeConfig): void {
    this.goodbyeConfigsByGuild.set(config.guildId, config);
  }


export async function loadGoodbyeConfigs(this: BotSessionContext): Promise<void> {
    const rows = await (
      prisma as unknown as {
        guildGoodbyeConfig: {
          findMany: (args: unknown) => Promise<StoredGoodbyeConfig[]>;
        };
      }
    ).guildGoodbyeConfig.findMany({
      where: { botAccountId: this.account.id, enabled: true },
      select: {
        guildId: true,
        channelId: true,
        messageType: true,
        messageTemplate: true,
        embedPagesJson: true,
        enabled: true,
      },
    });
    this.goodbyeConfigsByGuild.clear();
    for (const row of rows) this.cacheGoodbyeConfig(row);
    if (rows.length) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: `Goodbye listener active for ${rows.length} server${rows.length === 1 ? "" : "s"}.`,
        context: {
          botId: this.account.id,
          guildIds: rows.map((row) => row.guildId),
        },
      });
    }
  }


export async function saveGoodbyeConfig(
  this: BotSessionContext,
    guildId: string,
    channelId: string,
    messageType: "message" | "embed",
    messageTemplate: string,
    embedPagesJson: string | null,
  ): Promise<void> {
    await (
      prisma as unknown as {
        guildGoodbyeConfig: { upsert: (args: unknown) => Promise<unknown> };
      }
    ).guildGoodbyeConfig.upsert({
      where: {
        botAccountId_guildId: { botAccountId: this.account.id, guildId },
      },
      create: {
        botAccountId: this.account.id,
        guildId,
        channelId,
        messageType,
        messageTemplate,
        embedPagesJson,
        enabled: Boolean(channelId.trim()),
      },
      update: {
        channelId,
        messageType,
        messageTemplate,
        embedPagesJson,
        enabled: Boolean(channelId.trim()),
      },
    });
    this.cacheGoodbyeConfig({
      guildId,
      channelId,
      messageType,
      messageTemplate,
      embedPagesJson,
      enabled: Boolean(channelId.trim()),
    });
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Goodbye automation armed.",
      context: { botId: this.account.id, guildId, channelId, messageType },
    });
  }


export async function removeGoodbyeConfig(
  this: BotSessionContext,
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void> {
    await (
      prisma as unknown as {
        guildGoodbyeConfig: { deleteMany: (args: unknown) => Promise<unknown> };
      }
    ).guildGoodbyeConfig.deleteMany({
      where: {
        botAccountId: this.account.id,
        guildId,
        ...(channelId ? { channelId } : {}),
      },
    });
    this.goodbyeConfigsByGuild.delete(guildId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Goodbye channel removed.",
      context: { botId: this.account.id, guildId, channelId, reason },
    });
  }


export async function loadGoodbyeConfig(
  this: BotSessionContext,
    guildId: string,
    force = false,
  ): Promise<StoredGoodbyeConfig | null> {
    const cached = this.goodbyeConfigsByGuild.get(guildId);
    if (cached && !force) return cached;
    const row = await (
      prisma as unknown as {
        guildGoodbyeConfig: {
          findUnique: (args: unknown) => Promise<StoredGoodbyeConfig | null>;
        };
      }
    ).guildGoodbyeConfig.findUnique({
      where: {
        botAccountId_guildId: { botAccountId: this.account.id, guildId },
      },
      select: {
        guildId: true,
        channelId: true,
        messageType: true,
        messageTemplate: true,
        embedPagesJson: true,
        enabled: true,
      },
    });
    if (row) this.cacheGoodbyeConfig(row);
    return row;
  }


export function cacheLogConfig(this: BotSessionContext, config: StoredLogConfig): void {
    if (config.enabled) this.logConfigsByGuild.set(config.guildId, config);
    else this.logConfigsByGuild.delete(config.guildId);
  }


export async function loadLogConfigs(this: BotSessionContext): Promise<void> {
    const rows = await (
      prisma as unknown as {
        guildLogConfig: {
          findMany: (args: unknown) => Promise<StoredLogConfig[]>;
        };
      }
    ).guildLogConfig.findMany({
      where: { botAccountId: this.account.id, enabled: true },
      select: {
        guildId: true,
        channelId: true,
        eventConfigsJson: true,
        enabled: true,
      },
    });
    this.logConfigsByGuild.clear();
    for (const row of rows) this.cacheLogConfig(row);
    if (rows.length) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: `Discord logs listener active for ${rows.length} server${rows.length === 1 ? "" : "s"}.`,
        context: {
          botId: this.account.id,
          guildIds: rows.map((row) => row.guildId),
        },
      });
    }
  }


export async function saveLogConfig(
  this: BotSessionContext,
    guildId: string,
    channelId: string,
    eventConfigsJson: string | null,
  ): Promise<void> {
    await (
      prisma as unknown as {
        guildLogConfig: { upsert: (args: unknown) => Promise<unknown> };
      }
    ).guildLogConfig.upsert({
      where: {
        botAccountId_guildId: { botAccountId: this.account.id, guildId },
      },
      create: {
        botAccountId: this.account.id,
        guildId,
        channelId,
        eventConfigsJson,
        enabled: true,
      },
      update: { channelId, eventConfigsJson, enabled: true },
    });
    this.cacheLogConfig({
      guildId,
      channelId,
      eventConfigsJson,
      enabled: true,
    });
  }


export async function removeLogConfig(
  this: BotSessionContext,
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void> {
    await (
      prisma as unknown as {
        guildLogConfig: { deleteMany: (args: unknown) => Promise<unknown> };
      }
    ).guildLogConfig.deleteMany({
      where: {
        botAccountId: this.account.id,
        guildId,
        ...(channelId ? { channelId } : {}),
      },
    });
    this.logConfigsByGuild.delete(guildId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Discord logs channel removed.",
      context: { botId: this.account.id, guildId, channelId, reason },
    });
  }


export async function loadLogConfig(
  this: BotSessionContext,
    guildId: string,
    force = false,
  ): Promise<StoredLogConfig | null> {
    const cached = this.logConfigsByGuild.get(guildId);
    if (cached && !force) return cached;
    const row = await (
      prisma as unknown as {
        guildLogConfig: {
          findUnique: (args: unknown) => Promise<StoredLogConfig | null>;
        };
      }
    ).guildLogConfig.findUnique({
      where: {
        botAccountId_guildId: { botAccountId: this.account.id, guildId },
      },
      select: {
        guildId: true,
        channelId: true,
        eventConfigsJson: true,
        enabled: true,
      },
    });
    if (row) this.cacheLogConfig(row);
    else this.logConfigsByGuild.delete(guildId);
    return row;
  }
