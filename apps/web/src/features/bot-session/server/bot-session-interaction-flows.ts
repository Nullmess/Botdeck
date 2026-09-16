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

type SendableDiscordChannel = {
  send(payload: unknown): Promise<unknown>;
};


// Méthodes extraites de BotSession.
// Ces fonctions utilisent le contrat interne BotSessionContext pour éviter les contextes non typés.

export function defaultLogEventConfigs(
  this: BotSessionContext,
    mode: "message" | "embed" = "message",
  ): Record<LogEventKey, LogEventConfig> {
    return Object.fromEntries(
      LOG_EVENT_KEYS.map((key) => [
        key,
        {
          enabled: true,
          mode,
          messageTemplate: DEFAULT_LOG_EVENT_MESSAGES[key],
        },
      ]),
    ) as Record<LogEventKey, LogEventConfig>;
  }


export function normalizeLogEmbedPages(
  this: BotSessionContext,
    key: LogEventKey,
    rawPages: unknown,
    fallbackContent: string,
  ): RuntimeEmbedPage[] {
    const runtime: ApplicationCommandRuntimeDefinition = {
      version: 1,
      response: {
        content: fallbackContent || DEFAULT_LOG_EVENT_MESSAGES[key],
        visibility: "public",
      },
      workflow: [
        {
          id: key,
          type: "set_logs_channel",
          label: LOG_EVENT_LABELS[key],
          metadata: { embedPages: Array.isArray(rawPages) ? rawPages : [] },
        },
      ],
    };
    return runtimeEmbedPages(
      runtime,
      fallbackContent || DEFAULT_LOG_EVENT_MESSAGES[key],
    );
  }


export function normalizeLogEventConfigs(
  this: BotSessionContext,
    value: unknown,
    mode: "message" | "embed" = "message",
  ): Record<LogEventKey, LogEventConfig> {
    const defaults = this.defaultLogEventConfigs(mode);
    const parsed = isRecord(value) ? value : {};
    for (const key of LOG_EVENT_KEYS) {
      const item = parsed[key];
      if (!isRecord(item)) continue;
      const messageTemplate =
        typeof item.messageTemplate === "string" && item.messageTemplate.trim()
          ? item.messageTemplate
          : DEFAULT_LOG_EVENT_MESSAGES[key];
      const eventMode = item.mode === "embed" ? "embed" : "message";
      defaults[key] = {
        enabled: item.enabled !== false,
        mode: eventMode,
        messageTemplate,
        embedPages:
          eventMode === "embed"
            ? this.normalizeLogEmbedPages(key, item.embedPages, messageTemplate)
            : undefined,
      };
    }
    return defaults;
  }


export function readLogEventConfigs(
  this: BotSessionContext,
    config: StoredLogConfig | null | undefined,
  ): Record<LogEventKey, LogEventConfig> {
    const parsed = safeJsonParse(config?.eventConfigsJson ?? "{}");
    return this.normalizeLogEventConfigs(parsed);
  }


export function logSetupTemplateValues(
  this: BotSessionContext,
    interaction: ChatInputCommandInteraction,
    channelId: string,
  ): Record<string, string> {
    return this.welcomeSetupTemplateValues(interaction, channelId);
  }


export function runtimeLogSetConfirmation(
  this: BotSessionContext,
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): string {
    const metadata = runtimeMetadata(runtime);
    const content =
      typeof metadata.logsSetConfirmation === "string" &&
      metadata.logsSetConfirmation.trim()
        ? metadata.logsSetConfirmation
        : runtime.response.content?.trim() ||
          "Le salon logs a été mis à jour: {channel.mention}.";
    return fillRuntimeTemplateFromValues(content, values);
  }


export function runtimeLogRemoveConfirmation(
  this: BotSessionContext,
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): string {
    const metadata = runtimeMetadata(runtime);
    const content =
      typeof metadata.logsRemoveConfirmation === "string" &&
      metadata.logsRemoveConfirmation.trim()
        ? metadata.logsRemoveConfirmation
        : "Le salon logs a été retiré pour {channel.mention}.";
    return fillRuntimeTemplateFromValues(content, values);
  }


export async function handleLogsSetupInteraction(
  this: BotSessionContext,
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Logs action ignored: not a slash command.",
        context: { botId: this.account.id },
      });
      return;
    }
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content: "Le salon logs doit être configuré depuis un serveur Discord.",
        ephemeral: true,
      });
      return;
    }
    const metadata = runtimeMetadata(runtime);
    const optionName =
      typeof metadata.logsChannelOption === "string" &&
      metadata.logsChannelOption.trim()
        ? metadata.logsChannelOption.trim()
        : "salon";
    const actionOption =
      interaction.options.getString("action")?.toLowerCase().trim() ?? "";
    const selectedChannel =
      interaction.options.getChannel(optionName) ?? interaction.channel;
    const previousConfig = await this.loadLogConfig(interaction.guildId);
    if (
      actionOption === "remove" ||
      actionOption === "delete" ||
      actionOption === "off"
    ) {
      const confirmationValues = this.logSetupTemplateValues(
        interaction,
        previousConfig?.channelId ?? selectedChannel?.id ?? "",
      );
      await this.removeLogConfig(
        interaction.guildId,
        "command-remove",
        previousConfig?.channelId,
      );
      await interaction.reply({
        content: this.runtimeLogRemoveConfirmation(runtime, confirmationValues),
        ephemeral: true,
      });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    if (
      !selectedChannel ||
      !("id" in selectedChannel) ||
      typeof selectedChannel.id !== "string"
    ) {
      await interaction.reply({
        content: `Choisis un salon texte avec l’option \`${optionName}\`.`,
        ephemeral: true,
      });
      return;
    }
    const channel =
      interaction.guild.channels.cache.get(selectedChannel.id) ??
      (await interaction.guild.channels
        .fetch(selectedChannel.id)
        .catch(() => null));
    const blockReason = this.channelSendBlockReason(
      channel,
      interaction.guild,
      metadata.logsDefaultMode === "embed",
    );
    if (blockReason) {
      await interaction.reply({
        content: `Le salon choisi n'est pas utilisable: ${blockReason}`,
        ephemeral: true,
      });
      return;
    }
    const sameChannelAlreadyEnabled =
      previousConfig?.enabled &&
      previousConfig.channelId === selectedChannel.id;
    if (sameChannelAlreadyEnabled) {
      const confirmationValues = this.logSetupTemplateValues(
        interaction,
        selectedChannel.id,
      );
      await this.removeLogConfig(
        interaction.guildId,
        "same-channel-toggle",
        selectedChannel.id,
      );
      await interaction.reply({
        content: this.runtimeLogRemoveConfirmation(runtime, confirmationValues),
        ephemeral: true,
      });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    const defaultMode =
      metadata.logsDefaultMode === "embed" ? "embed" : "message";
    const eventConfigsJson = JSON.stringify(
      this.normalizeLogEventConfigs(metadata.logsEventConfigs, defaultMode),
    );
    await this.saveLogConfig(
      interaction.guildId,
      selectedChannel.id,
      eventConfigsJson,
    );
    await interaction.reply({
      content: this.runtimeLogSetConfirmation(
        runtime,
        this.logSetupTemplateValues(interaction, selectedChannel.id),
      ),
      ephemeral: true,
    });
    await this.publishEphemeralInteractionReply(interaction, true);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Discord logs channel updated.",
      context: {
        botId: this.account.id,
        guildId: interaction.guildId,
        channelId: selectedChannel.id,
      },
    });
  }


export function formatRoleAutomationRule(
  this: BotSessionContext,
    rule: StoredRoleAutomationRule,
    guild: Guild,
  ): string {
    const role = guild.roles.cache.get(rule.roleId);
    const conditions: string[] = [];
    if (rule.minMessages) conditions.push(`${rule.minMessages} messages`);
    if (rule.minVoiceSeconds)
      conditions.push(`${Math.ceil(rule.minVoiceSeconds / 60)} min vocal`);
    if (rule.minMemberAgeSeconds)
      conditions.push(
        `${Math.ceil(rule.minMemberAgeSeconds / 86400)} j serveur`,
      );
    return `\`${rule.id.slice(0, 8)}\` ${rule.enabled ? "✅" : "⏸️"} ${role ? `<@&${role.id}>` : rule.roleId} — ${conditions.length ? conditions.join(rule.conditionMode === "any" ? " ou " : " + ") : "à l’arrivée"}`;
  }


export async function handleRoleAutomationInteraction(
  this: BotSessionContext,
    interaction: Interaction,
    _runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content:
          "Les rôles automatiques doivent être gérés depuis un serveur Discord.",
        ephemeral: true,
      });
      return;
    }
    const action = (
      interaction.options.getString("action") ?? "list"
    ).toLowerCase();
    if (action === "list") {
      const rules = await this.loadRoleAutomationRules(
        interaction.guildId,
        true,
      );
      const activeCount = rules.filter((rule) => rule.enabled).length;
      const content = rules.length
        ? [
            `Rôles automatiques (${activeCount} actif${activeCount > 1 ? "s" : ""} / ${rules.length}) :`,
            ...rules.map((rule) =>
              this.formatRoleAutomationRule(rule, interaction.guild as Guild),
            ),
          ].join("\n")
        : "Aucun rôle automatique configuré.";
      await interaction.reply({ content, ephemeral: true });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    if (action === "remove" || action === "delete") {
      const ruleId = interaction.options.getString("id")?.trim();
      if (!ruleId) {
        await interaction.reply({
          content: "Indique l'id court ou complet de la règle à supprimer.",
          ephemeral: true,
        });
        return;
      }
      const rules = await this.loadRoleAutomationRules(
        interaction.guildId,
        true,
      );
      const match = rules.find(
        (rule) => rule.id === ruleId || rule.id.startsWith(ruleId),
      );
      if (!match) {
        await interaction.reply({
          content:
            "Règle introuvable. Utilise `/autorole action:list` pour voir les ids.",
          ephemeral: true,
        });
        return;
      }
      await this.deleteGuildRoleAutomationRule(interaction.guildId, match.id);
      await interaction.reply({
        content: `Règle supprimée pour <@&${match.roleId}>.`,
        ephemeral: true,
      });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    if (action === "sync") {
      await interaction.deferReply({ ephemeral: true });
      await this.syncGuildRoleAutomation(interaction.guildId);
      await interaction.editReply({
        content: "Synchronisation des rôles automatiques terminée.",
      });
      return;
    }
    if (action === "add") {
      const role = interaction.options.getRole("role") as Role | null;
      if (!role) {
        await interaction.reply({
          content: "Choisis le rôle à attribuer.",
          ephemeral: true,
        });
        return;
      }
      const messages = interaction.options.getInteger("messages") ?? null;
      const voiceMinutes = interaction.options.getInteger("vocal_min") ?? null;
      const joinedDays =
        interaction.options.getInteger("anciennete_jours") ?? null;
      const mode =
        interaction.options.getString("mode") === "any" ? "any" : "all";
      await this.upsertGuildRoleAutomationRule(interaction.guildId, {
        roleId: role.id,
        enabled: true,
        conditionMode: mode,
        minMessages: messages,
        minVoiceSeconds: voiceMinutes ? voiceMinutes * 60 : null,
        minMemberAgeSeconds: joinedDays ? joinedDays * 86400 : null,
        removeWhenInvalid: false,
        ignoreBots: true,
        applyToExistingMembers: true,
      });
      await interaction.reply({
        content: `Rôle automatique créé pour <@&${role.id}>.`,
        ephemeral: true,
      });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    await interaction.reply({
      content: "Action inconnue. Utilise list, add, remove ou sync.",
      ephemeral: true,
    });
  }


export function moderationTemplateValues(
  this: BotSessionContext,
    guild: Guild,
    actor: User | null | undefined,
    target: ModerationTarget | null | undefined,
    action: ModerationAction,
    reason?: string | null,
  ): Record<string, string> {
    return buildModerationTemplateValues({
      guild,
      actor,
      target,
      action,
      reason,
      botUser: this.client.user,
    });
  }


export function rememberModerationLog(
  this: BotSessionContext,
    guildId: string,
    action: "ban" | "unban" | "kick",
    userId: string,
  ): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.recentModerationLogs) {
      if (expiresAt <= now) this.recentModerationLogs.delete(key);
    }
    this.recentModerationLogs.set(
      `${guildId}:${action}:${userId}`,
      now + 12000,
    );
  }


export function consumeRecentModerationLog(
  this: BotSessionContext,
    guildId: string,
    action: "ban" | "unban" | "kick",
    userId: string,
  ): boolean {
    const key = `${guildId}:${action}:${userId}`;
    const expiresAt = this.recentModerationLogs.get(key) ?? 0;
    if (expiresAt > Date.now()) {
      this.recentModerationLogs.delete(key);
      return true;
    }
    this.recentModerationLogs.delete(key);
    return false;
  }


export async function sendModerationLog(
  this: BotSessionContext,
    guild: Guild,
    action: "ban" | "unban" | "kick",
    actor: User | null | undefined,
    target:
      | User
      | { id: string; username?: string | null; displayName?: string | null }
      | null
      | undefined,
    reason?: string | null,
  ): Promise<void> {
    const key = moderationLogKey(action);
    const values = this.moderationTemplateValues(
      guild,
      actor,
      target,
      action,
      reason,
    );
    await this.sendDiscordLog({
      key,
      guild,
      values: {
        ...this.baseLogValues(guild, key, actor ?? null),
        ...values,
      },
    });
  }


export async function replyModerationResult(
  this: BotSessionContext,
    interaction: ChatInputCommandInteraction,
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): Promise<void> {
    const fallback =
      runtime.response.content?.trim() ||
      "✅ {action.name} effectué pour {target.mention}. Raison: {reason}";
    const content = fillRuntimeTemplateFromValues(fallback, values).slice(
      0,
      2000,
    );
    const ephemeral = runtime.response.visibility !== "public";
    if (moderationResponseType(runtime) === "embed") {
      const pages = moderationEmbedPages(runtime, fallback);
      await interaction.reply({
        embeds: pages
          .slice(0, 10)
          .map((page) => templateRuntimeEmbed(page, values)),
        ephemeral,
      });
    } else {
      await interaction.reply({ content, ephemeral });
    }
    await this.publishEphemeralInteractionReply(interaction, ephemeral);
  }


export async function handleModerationCommandInteraction(
  this: BotSessionContext,
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content:
          "Cette commande de modération doit être utilisée dans un serveur Discord.",
        ephemeral: true,
      });
      return;
    }
    const action = moderationActionFromRuntime(runtime);
    const reason =
      (
        interaction.options.getString("raison") ??
        interaction.options.getString("reason") ??
        ""
      ).trim() || "Aucune raison fournie";
    const userOptionName = action === "unban" ? "user_id" : "membre";
    const requiredPermission =
      action === "kick"
        ? PermissionFlagsBits.KickMembers
        : PermissionFlagsBits.BanMembers;
    if (!interaction.memberPermissions?.has(requiredPermission)) {
      await interaction.reply({
        content:
          action === "kick"
            ? "Tu n'as pas la permission Kick Members."
            : "Tu n'as pas la permission Ban Members.",
        ephemeral: true,
      });
      return;
    }
    if (!interaction.guild.members.me?.permissions.has(requiredPermission)) {
      await interaction.reply({
        content:
          action === "kick"
            ? "Le bot n'a pas la permission Kick Members."
            : "Le bot n'a pas la permission Ban Members.",
        ephemeral: true,
      });
      return;
    }
    if (action === "unban") {
      const userId = interaction.options.getString(userOptionName)?.trim();
      if (!userId || !/^\d{17,20}$/.test(userId)) {
        await interaction.reply({
          content: "Indique un ID utilisateur Discord valide à débannir.",
          ephemeral: true,
        });
        return;
      }
      const targetUser = await this.client.users
        .fetch(userId)
        .catch(() => ({ id: userId, username: userId, displayName: userId }));
      await interaction.guild.bans.remove(userId, reason);
      this.rememberModerationLog(interaction.guild.id, "unban", userId);
      const values = this.moderationTemplateValues(
        interaction.guild,
        interaction.user,
        targetUser,
        "unban",
        reason,
      );
      await this.replyModerationResult(interaction, runtime, values);
      await this.sendModerationLog(
        interaction.guild,
        "unban",
        interaction.user,
        targetUser,
        reason,
      ).catch((error) =>
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to send unban log.",
          context: {
            botId: this.account.id,
            guildId: interaction.guildId,
            error:
              error instanceof Error
                ? error.message
                : "Unknown moderation log failure",
          },
        }),
      );
      return;
    }
    const targetUser =
      interaction.options.getUser(userOptionName) ??
      interaction.options.getUser("user");
    if (!targetUser) {
      await interaction.reply({
        content: "Choisis le membre cible.",
        ephemeral: true,
      });
      return;
    }
    if (
      targetUser.id === interaction.user.id ||
      targetUser.id === this.client.user?.id
    ) {
      await interaction.reply({
        content: "Cette cible ne peut pas être modérée avec cette commande.",
        ephemeral: true,
      });
      return;
    }
    const targetMember = await interaction.guild.members
      .fetch(targetUser.id)
      .catch(() => null);
    if (action === "kick" && !targetMember) {
      await interaction.reply({
        content: "Ce membre n'est pas présent sur le serveur.",
        ephemeral: true,
      });
      return;
    }
    if (
      targetMember &&
      interaction.guild.members.me &&
      targetMember.roles.highest.position >=
        interaction.guild.members.me.roles.highest.position
    ) {
      await interaction.reply({
        content: "Le rôle de la cible est au-dessus ou égal au rôle du bot.",
        ephemeral: true,
      });
      return;
    }
    if (action === "kick") {
      await targetMember!.kick(reason);
      this.rememberModerationLog(interaction.guild.id, "kick", targetUser.id);
    } else {
      await interaction.guild.members.ban(targetUser.id, {
        reason,
        deleteMessageSeconds: 0,
      });
      this.rememberModerationLog(interaction.guild.id, "ban", targetUser.id);
    }
    await this.publishGuildMembers(interaction.guild.id);
    const values = this.moderationTemplateValues(
      interaction.guild,
      interaction.user,
      targetUser,
      action,
      reason,
    );
    await this.replyModerationResult(interaction, runtime, values);
    await this.sendModerationLog(
      interaction.guild,
      action,
      interaction.user,
      targetUser,
      reason,
    ).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send moderation log.",
        context: {
          botId: this.account.id,
          guildId: interaction.guildId,
          action,
          error:
            error instanceof Error
              ? error.message
              : "Unknown moderation log failure",
        },
      }),
    );
  }


export async function fetchAuditExecutor(
  this: BotSessionContext,
    guild: Guild,
    action: AuditLogEvent,
    targetId?: string | null,
  ): Promise<User | null> {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog))
      return null;
    const logs = await guild
      .fetchAuditLogs({ type: action, limit: 6 })
      .catch(() => null);
    const entry = logs?.entries.find((item) => {
      const target = item.target as { id?: string } | null;
      const created = item.createdTimestamp ?? 0;
      const recent = Date.now() - created < 15000;
      return recent && (!targetId || target?.id === targetId);
    });
    const executor = entry?.executor;
    return executor &&
      "username" in executor &&
      typeof executor.username === "string"
      ? (executor as User)
      : null;
  }


export function shortText(this: BotSessionContext, value: unknown, fallback = "∅", max = 900): string {
    const text =
      typeof value === "string" && value.trim() ? value.trim() : fallback;
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }


export function userValues(
  this: BotSessionContext,
    prefix: string,
    user: User | null | undefined,
  ): Record<string, string> {
    const name = user?.username ?? "Inconnu";
    return {
      [`${prefix}.id`]: user?.id ?? "",
      [`${prefix}.name`]: name,
      [`${prefix}.username`]: name,
      [`${prefix}.displayName`]: user?.displayName ?? name,
      [`${prefix}.mention`]: user ? `<@${user.id}>` : "Inconnu",
      [`${prefix}.avatar`]: user?.displayAvatarURL({ size: 512 }) ?? "",
      [`${prefix}.avatarUrl`]: user?.displayAvatarURL({ size: 512 }) ?? "",
    };
  }


export function baseLogValues(
  this: BotSessionContext,
    guild: Guild,
    key: LogEventKey,
    actor?: User | null,
  ): Record<string, string> {
    const botUser = this.client.user;
    return {
      "event.key": key,
      "event.name": LOG_EVENT_LABELS[key],
      "event.date": new Date().toISOString(),
      "guild.id": guild.id,
      "guild.name": guild.name,
      "guild.icon": guild.iconURL({ size: 512 }) ?? "",
      "guild.iconUrl": guild.iconURL({ size: 512 }) ?? "",
      "bot.id": botUser?.id ?? "",
      "bot.name": botUser?.username ?? "Bot",
      "bot.username": botUser?.username ?? "Bot",
      "bot.mention": botUser ? `<@${botUser.id}>` : "Bot",
      "bot.avatar": botUser?.displayAvatarURL({ size: 512 }) ?? "",
      "bot.avatarUrl": botUser?.displayAvatarURL({ size: 512 }) ?? "",
      ...this.userValues("actor", actor ?? null),
    };
  }


export function channelValues(
  this: BotSessionContext,
    channel:
      | {
          id: string;
          name?: string | null;
          toString?: () => string;
          type?: unknown;
        }
      | null
      | undefined,
  ): Record<string, string> {
    const id = channel?.id ?? "";
    const name = channel?.name ?? "Salon inconnu";
    return {
      "channel.id": id,
      "channel.name": name,
      "channel.mention": id ? `<#${id}>` : name,
      "channel.type": channel && "type" in channel ? String(channel.type) : "",
    };
  }


export async function sendDiscordLog(this: BotSessionContext, payload: LogEventPayload): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Discord log event detected.",
      context: {
        botId: this.account.id,
        guildId: payload.guild.id,
        event: payload.key,
      },
    });
    const config = await this.loadLogConfig(payload.guild.id, true);
    if (!config?.enabled || !config.channelId?.trim()) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Discord log event ignored: no active logs automation.",
        context: {
          botId: this.account.id,
          guildId: payload.guild.id,
          event: payload.key,
        },
      });
      return;
    }
    const eventConfig = this.readLogEventConfigs(config)[payload.key];
    if (!eventConfig.enabled) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Discord log event ignored: event disabled.",
        context: {
          botId: this.account.id,
          guildId: payload.guild.id,
          event: payload.key,
          channelId: config.channelId,
        },
      });
      return;
    }
    const logChannel =
      payload.guild.channels.cache.get(config.channelId) ??
      (await payload.guild.channels.fetch(config.channelId).catch(() => null));
    const blockReason = this.channelSendBlockReason(
      logChannel,
      payload.guild,
      eventConfig.mode === "embed",
    );
    if (blockReason) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Discord logs channel unavailable.",
        context: {
          botId: this.account.id,
          guildId: payload.guild.id,
          channelId: config.channelId,
          event: payload.key,
          reason: blockReason,
        },
      });
      await this.removeLogConfig(
        payload.guild.id,
        "channel-unavailable",
        config.channelId,
      );
      return;
    }
    const content = fillRuntimeTemplateFromValues(
      eventConfig.messageTemplate || DEFAULT_LOG_EVENT_MESSAGES[payload.key],
      payload.values,
    ).slice(0, 2000);
    if (eventConfig.mode === "embed") {
      const pages = eventConfig.embedPages?.length
        ? eventConfig.embedPages
        : [
            {
              title: "{event.name}",
              description:
                eventConfig.messageTemplate ||
                DEFAULT_LOG_EVENT_MESSAGES[payload.key],
              color: 0x35f2c4,
              fields: [],
            },
          ];
      const embeds = pages
        .slice(0, 10)
        .map((page) => templateRuntimeEmbed(page, payload.values));
      await (logChannel as SendableDiscordChannel).send({ embeds });
    } else {
      await (logChannel as SendableDiscordChannel).send({ content });
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Discord log message sent.",
      context: {
        botId: this.account.id,
        guildId: payload.guild.id,
        channelId: config.channelId,
        event: payload.key,
        mode: eventConfig.mode,
      },
    });
  }


export function welcomeSetupTemplateValues(
  this: BotSessionContext,
    interaction: ChatInputCommandInteraction,
    channelId: string,
  ): Record<string, string> {
    const botUser = this.client.user;
    const guildIconUrl = interaction.guild?.iconURL({ size: 512 }) ?? "";
    const botAvatarUrl = botUser?.displayAvatarURL({ size: 512 }) ?? "";
    const botName = botUser?.username ?? "Bot";
    return {
      "channel.id": channelId,
      "channel.mention": `<#${channelId}>`,
      "guild.id": interaction.guildId ?? "",
      "guild.name": interaction.guild?.name ?? "",
      "guild.icon": guildIconUrl,
      "guild.iconUrl": guildIconUrl,
      "bot.id": botUser?.id ?? "",
      "bot.name": botName,
      "bot.username": botName,
      "bot.mention": botUser ? `<@${botUser.id}>` : botName,
      "bot.avatar": botAvatarUrl,
      "bot.avatarUrl": botAvatarUrl,
      "user.mention": `<@${interaction.user.id}>`,
      "user.id": interaction.user.id,
      "user.name": interaction.user.username,
      "user.displayName":
        interaction.user.displayName ?? interaction.user.username,
    };
  }


export async function handleWelcomeSetupInteraction(
  this: BotSessionContext,
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Welcome action ignored: not a slash command.",
        context: { botId: this.account.id },
      });
      return;
    }
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content:
          "Le salon welcome doit être configuré depuis un serveur Discord.",
        ephemeral: true,
      });
      return;
    }
    const metadata = runtimeMetadata(runtime);
    const optionName =
      typeof metadata.welcomeChannelOption === "string" &&
      metadata.welcomeChannelOption.trim()
        ? metadata.welcomeChannelOption.trim()
        : "salon";
    const selectedChannel =
      interaction.options.getChannel(optionName) ?? interaction.channel;
    if (
      !selectedChannel ||
      !("id" in selectedChannel) ||
      typeof selectedChannel.id !== "string"
    ) {
      await interaction.reply({
        content: `Choisis un salon texte avec l’option \`${optionName}\`.`,
        ephemeral: true,
      });
      return;
    }
    const channel =
      interaction.guild.channels.cache.get(selectedChannel.id) ??
      (await interaction.guild.channels
        .fetch(selectedChannel.id)
        .catch(() => null));
    const blockReason = this.channelSendBlockReason(
      channel,
      interaction.guild,
      runtimeWelcomeMessageType(runtime) === "embed",
    );
    if (blockReason) {
      await interaction.reply({
        content: `Le salon choisi n'est pas utilisable: ${blockReason}`,
        ephemeral: true,
      });
      return;
    }
    const previousConfig = await this.loadWelcomeConfig(interaction.guildId);
    const sameChannelAlreadyEnabled =
      previousConfig?.enabled &&
      previousConfig.channelId === selectedChannel.id;
    if (sameChannelAlreadyEnabled) {
      const confirmationValues = this.welcomeSetupTemplateValues(
        interaction,
        selectedChannel.id,
      );
      await this.removeWelcomeConfig(
        interaction.guildId,
        "same-channel-toggle",
        selectedChannel.id,
      );
      await interaction.reply({
        content: runtimeWelcomeRemoveConfirmation(runtime, confirmationValues),
        ephemeral: true,
      });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    const messageTemplate = runtimeWelcomeMessage(runtime);
    const messageType = runtimeWelcomeMessageType(runtime);
    const welcomeMetadata = runtimeMetadata(runtime);
    const rawWelcomeEmbedPages = Array.isArray(
      welcomeMetadata.welcomeEmbedPages,
    )
      ? welcomeMetadata.welcomeEmbedPages
      : [];
    const embedPagesJson =
      messageType === "embed"
        ? JSON.stringify(
            rawWelcomeEmbedPages.length
              ? rawWelcomeEmbedPages
              : runtimeWelcomeEmbedPages(runtime),
          )
        : null;
    await this.saveWelcomeConfig(
      interaction.guildId,
      selectedChannel.id,
      messageType,
      messageTemplate,
      embedPagesJson,
    );
    const confirmation = runtimeWelcomeSetConfirmation(
      runtime,
      this.welcomeSetupTemplateValues(interaction, selectedChannel.id),
    );
    await interaction.reply({ content: confirmation, ephemeral: true });
    await this.publishEphemeralInteractionReply(interaction, true);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Welcome channel updated.",
      context: {
        botId: this.account.id,
        guildId: interaction.guildId,
        channelId: selectedChannel.id,
      },
    });
  }


export async function sendWelcomeMessage(this: BotSessionContext, member: GuildMember): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    const freshMember = member.partial
      ? await member.fetch().catch(() => member)
      : member;
    const config = await this.loadWelcomeConfig(freshMember.guild.id, true);
    if (!config?.enabled || !config.channelId?.trim()) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Welcome event ignored: no active welcome automation.",
        context: {
          botId: this.account.id,
          guildId: freshMember.guild.id,
          userId: freshMember.id,
        },
      });
      return;
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Welcome member join detected.",
      context: {
        botId: this.account.id,
        guildId: freshMember.guild.id,
        channelId: config.channelId,
        userId: freshMember.id,
      },
    });
    const channel =
      freshMember.guild.channels.cache.get(config.channelId) ??
      (await freshMember.guild.channels
        .fetch(config.channelId)
        .catch(() => null));
    const blockReason = this.channelSendBlockReason(
      channel,
      freshMember.guild,
      config.messageType === "embed",
    );
    if (blockReason) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Welcome channel unavailable.",
        context: {
          botId: this.account.id,
          guildId: freshMember.guild.id,
          channelId: config.channelId,
          reason: blockReason,
        },
      });
      await this.removeWelcomeConfig(
        freshMember.guild.id,
        "channel-unavailable",
        config.channelId,
      );
      return;
    }
    if (config.messageType === "embed") {
      const values = welcomeTemplateValues(freshMember);
      const pages = storedWelcomeEmbedPages(
        config.embedPagesJson,
        config.messageTemplate || DEFAULT_WELCOME_MESSAGE,
      );
      const embeds = pages
        .slice(0, 10)
        .map((page) => templateRuntimeEmbed(page, values));
      await (channel as SendableDiscordChannel).send({ embeds });
    } else {
      await (channel as SendableDiscordChannel).send({
        content: fillWelcomeTemplate(
          config.messageTemplate || DEFAULT_WELCOME_MESSAGE,
          freshMember,
        ),
      });
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Welcome message sent.",
      context: {
        botId: this.account.id,
        guildId: freshMember.guild.id,
        channelId: config.channelId,
        userId: freshMember.id,
        messageType: config.messageType,
      },
    });
  }


export async function handleGoodbyeSetupInteraction(
  this: BotSessionContext,
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    if (!interaction.isChatInputCommand()) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Goodbye action ignored: not a slash command.",
        context: { botId: this.account.id },
      });
      return;
    }
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({
        content:
          "Le salon goodbye doit être configuré depuis un serveur Discord.",
        ephemeral: true,
      });
      return;
    }
    const metadata = runtimeMetadata(runtime);
    const optionName =
      typeof metadata.goodbyeChannelOption === "string" &&
      metadata.goodbyeChannelOption.trim()
        ? metadata.goodbyeChannelOption.trim()
        : "salon";
    const selectedChannel =
      interaction.options.getChannel(optionName) ?? interaction.channel;
    if (
      !selectedChannel ||
      !("id" in selectedChannel) ||
      typeof selectedChannel.id !== "string"
    ) {
      await interaction.reply({
        content: `Choisis un salon texte avec l’option \`${optionName}\`.`,
        ephemeral: true,
      });
      return;
    }
    const channel =
      interaction.guild.channels.cache.get(selectedChannel.id) ??
      (await interaction.guild.channels
        .fetch(selectedChannel.id)
        .catch(() => null));
    const blockReason = this.channelSendBlockReason(
      channel,
      interaction.guild,
      runtimeGoodbyeMessageType(runtime) === "embed",
    );
    if (blockReason) {
      await interaction.reply({
        content: `Le salon choisi n'est pas utilisable: ${blockReason}`,
        ephemeral: true,
      });
      return;
    }
    const previousConfig = await this.loadGoodbyeConfig(interaction.guildId);
    const sameChannelAlreadyEnabled =
      previousConfig?.enabled &&
      previousConfig.channelId === selectedChannel.id;
    if (sameChannelAlreadyEnabled) {
      const confirmationValues = this.welcomeSetupTemplateValues(
        interaction,
        selectedChannel.id,
      );
      await this.removeGoodbyeConfig(
        interaction.guildId,
        "same-channel-toggle",
        selectedChannel.id,
      );
      await interaction.reply({
        content: runtimeGoodbyeRemoveConfirmation(runtime, confirmationValues),
        ephemeral: true,
      });
      await this.publishEphemeralInteractionReply(interaction, true);
      return;
    }
    const messageTemplate = runtimeGoodbyeMessage(runtime);
    const messageType = runtimeGoodbyeMessageType(runtime);
    const goodbyeMetadata = runtimeMetadata(runtime);
    const rawGoodbyeEmbedPages = Array.isArray(
      goodbyeMetadata.goodbyeEmbedPages,
    )
      ? goodbyeMetadata.goodbyeEmbedPages
      : [];
    const embedPagesJson =
      messageType === "embed"
        ? JSON.stringify(
            rawGoodbyeEmbedPages.length
              ? rawGoodbyeEmbedPages
              : runtimeGoodbyeEmbedPages(runtime),
          )
        : null;
    await this.saveGoodbyeConfig(
      interaction.guildId,
      selectedChannel.id,
      messageType,
      messageTemplate,
      embedPagesJson,
    );
    const confirmation = runtimeGoodbyeSetConfirmation(
      runtime,
      this.welcomeSetupTemplateValues(interaction, selectedChannel.id),
    );
    await interaction.reply({ content: confirmation, ephemeral: true });
    await this.publishEphemeralInteractionReply(interaction, true);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Goodbye channel updated.",
      context: {
        botId: this.account.id,
        guildId: interaction.guildId,
        channelId: selectedChannel.id,
      },
    });
  }


export function goodbyeTemplateValuesForMember(
  this: BotSessionContext,
    member: GuildMember | PartialGuildMember,
  ): Record<string, string> {
    try {
      if (!(member as PartialGuildMember).partial)
        return goodbyeTemplateValues(member as GuildMember);
    } catch {
      // Fallback below.
    }
    const user = (member as PartialGuildMember).user;
    const guild = member.guild;
    const botUser = guild.client.user;
    const botAvatarUrl = botUser?.displayAvatarURL({ size: 512 }) ?? "";
    const botName = botUser?.username ?? "Bot";
    const guildIconUrl = guild.iconURL({ size: 512 }) ?? "";
    const leftAt = new Date();
    const leftDateTime = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(leftAt);
    const leftDate = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeZone: "Europe/Paris",
    }).format(leftAt);
    const leftTime = new Intl.DateTimeFormat("fr-FR", {
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(leftAt);
    const username = user?.username ?? `Utilisateur ${member.id}`;
    const displayName =
      (member as PartialGuildMember).displayName ??
      user?.globalName ??
      username;
    const avatarUrl = user?.displayAvatarURL({ size: 512 }) ?? "";
    return {
      "user.mention": `<@${member.id}>`,
      "user.id": member.id,
      "user.name": username,
      "user.displayName": displayName,
      "user.avatar": avatarUrl,
      "user.avatarUrl": avatarUrl,
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
      "member.count": String(guild.memberCount || ""),
      "member.joinedAt": "Inconnu",
      "member.joinedDate": "Inconnu",
      "member.joinedTime": "Inconnu",
      "member.joinedRelative": "Inconnu",
      "member.leftAt": leftDateTime,
      "member.leftDate": leftDate,
      "member.leftTime": leftTime,
      "member.leftRelative": "à l’instant",
    };
  }


export async function sendGoodbyeMessage(
  this: BotSessionContext,
    member: GuildMember | PartialGuildMember,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    const config = await this.loadGoodbyeConfig(member.guild.id, true);
    if (!config?.enabled || !config.channelId?.trim()) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Goodbye event ignored: no active goodbye automation.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          userId: member.id,
          partial: (member as PartialGuildMember).partial,
        },
      });
      return;
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Goodbye member leave detected.",
      context: {
        botId: this.account.id,
        guildId: member.guild.id,
        channelId: config.channelId,
        userId: member.id,
        partial: (member as PartialGuildMember).partial,
      },
    });
    const channel =
      member.guild.channels.cache.get(config.channelId) ??
      (await member.guild.channels.fetch(config.channelId).catch(() => null));
    const blockReason = this.channelSendBlockReason(
      channel,
      member.guild,
      config.messageType === "embed",
    );
    if (blockReason) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Goodbye channel unavailable.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          channelId: config.channelId,
          reason: blockReason,
        },
      });
      await this.removeGoodbyeConfig(
        member.guild.id,
        "channel-unavailable",
        config.channelId,
      );
      return;
    }
    const values = this.goodbyeTemplateValuesForMember(member);
    if (config.messageType === "embed") {
      const pages = storedGoodbyeEmbedPages(
        config.embedPagesJson,
        config.messageTemplate || DEFAULT_GOODBYE_MESSAGE,
      );
      const embeds = pages
        .slice(0, 10)
        .map((page) => templateRuntimeEmbed(page, values));
      await (channel as SendableDiscordChannel).send({ embeds });
    } else {
      await (channel as SendableDiscordChannel).send({
        content: fillRuntimeTemplateFromValues(
          config.messageTemplate || DEFAULT_GOODBYE_MESSAGE,
          values,
        ),
      });
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Goodbye message sent.",
      context: {
        botId: this.account.id,
        guildId: member.guild.id,
        channelId: config.channelId,
        userId: member.id,
        messageType: config.messageType,
      },
    });
  }

export async function handleChannelRecreatePurgeInteraction(
  this: BotSessionContext,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "Cette commande doit être utilisée dans un serveur.", ephemeral: true });
    return;
  }
  const options = interaction.options as any;
  const selectedChannel =
    options.getChannel?.("salon", false) ??
    options.getChannel?.("channel", false) ??
    null;
  const channelId = selectedChannel?.id ?? interaction.channelId;
  const confirmation =
    options.getString?.("confirmation", false) ??
    options.getString?.("confirm", false) ??
    "";
  const reason =
    options.getString?.("raison", false) ??
    options.getString?.("reason", false) ??
    "";
  await interaction.deferReply({ ephemeral: true });
  try {
    await this.recreatePurgeGuildChannel(interaction.guildId, channelId, {
      reason,
      transcript: false,
      finishMessage: false,
      confirmation,
      executorId: interaction.user.id,
    });
    await interaction.editReply({
      content: "Réinitialisation terminée.",
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ Réinitialisation impossible: ${error instanceof Error ? error.message : "erreur inconnue"}`,
    });
  }
}
