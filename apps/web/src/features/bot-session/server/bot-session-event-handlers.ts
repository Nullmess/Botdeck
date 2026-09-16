// Gestionnaires Discord branchés sur le client BotSession.

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
  Events,
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
  STARTUP_WARMUP_ENABLED,
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


export function attachHandlers(this: BotSessionContext): void {
  this.client.once(Events.ClientReady, async () => {
    this.status = "online";
    this.lastError = null;
    this.publishEvent({
      type: "hello",
      clientId: this.client.user?.id ?? this.account.id,
      sentAt: now(),
    });
    await this.updateAccount(this.account.id, {
      name: this.client.user?.username ?? this.account.name,
      discordUserId: this.client.user?.id ?? null,
      avatarUrl:
        this.client.user?.displayAvatarURL({ extension: "png", size: 128 }) ??
        null,
      lastConnectedAt: new Date(),
      lastError: null,
    });
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Bot connected.",
      context: {
        botId: this.account.id,
        botName: this.account.name,
        discordUserId: this.client.user?.id ?? null,
      },
    });
    try {
      await this.client.guilds.fetch().catch(() => undefined);
      await this.refreshDiscordState();
      if (!this.account.commandStudioDisabled) {
        await this.loadWelcomeConfigs();
        await this.loadGoodbyeConfigs();
        await this.loadLogConfigs();
        await this.loadRoleAutomationRules();
      }
      await Promise.all(
        this.client.guilds.cache.map((guild) =>
          this.publishGuildAutomationConfig(guild.id),
        ),
      );
      this.resolveReady?.();
      if (!this.account.commandStudioDisabled)
        this.startRoleAutomationScheduler();
      if (STARTUP_WARMUP_ENABLED) this.startWarmup();
    } catch (error) {
      this.status = "error";
      this.lastError =
        error instanceof Error ? error.message : "Failed to sync workspace";
      this.rejectReady?.(error);
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Bot connected, but initial Discord sync failed.",
        context: { botId: this.account.id, error: this.lastError },
      });
    }
  });

  this.client.on("interactionCreate", async (interaction) => {
    if (this.account.commandStudioDisabled) {
      // Bot externe: observation seule.
      const isBotdeckInteraction =
        (interaction.isButton() || interaction.isModalSubmit()) &&
        "customId" in interaction &&
        typeof interaction.customId === "string" &&
        interaction.customId.startsWith("botdeck:");
      if (
        isBotdeckInteraction ||
        interaction.isChatInputCommand() ||
        interaction.isUserContextMenuCommand() ||
        interaction.isMessageContextMenuCommand()
      ) {
        this.publishEvent({
          type: "audit.log",
          level: "debug",
          message: "Interaction ignorée: Slash Studio désactivé pour ce bot.",
          context: {
            botId: this.account.id,
            commandName:
              "commandName" in interaction ? interaction.commandName : null,
            guildId: interaction.guildId ?? null,
          },
        });
        return;
      }
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("botdeck:modalpage:")
    ) {
      try {
        const [, , token, page] = interaction.customId.split(":");
        const cached = token ? this.modalPageCache.get(token) : null;
        if (!cached || cached.expiresAt < Date.now()) {
          if (token) this.modalPageCache.delete(token);
          await interaction.reply({
            content:
              "Cette pagination a expiré. Relance la commande pour retrouver les pages.",
            ephemeral: true,
          });
          return;
        }
        await interaction.update(
          runtimeEmbedPagePayload(
            cached.embeds,
            Number.parseInt(page ?? "0", 10) || 0,
            `botdeck:modalpage:${token}`,
          ),
        );
      } catch (error) {
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to change modal response page.",
          context: {
            botId: this.account.id,
            error:
              error instanceof Error
                ? error.message
                : "Unknown modal pagination failure",
          },
        });
      }
      return;
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("botdeck:messageembedpage:")
    ) {
      try {
        const [, , token, page] = interaction.customId.split(":");
        const cached = token ? this.messageEmbedPageCache.get(token) : null;
        if (!cached || cached.expiresAt < Date.now()) {
          if (token) this.messageEmbedPageCache.delete(token);
          await interaction.reply({
            content:
              "Cette pagination a expiré. Renvoie l'embed depuis Botdeck pour retrouver les pages.",
            ephemeral: true,
          });
          return;
        }
        await interaction.update(
          messageEmbedPagePayload(
            cached.content,
            cached.embeds,
            Number.parseInt(page ?? "0", 10) || 0,
            `botdeck:messageembedpage:${token}`,
          ),
        );
      } catch (error) {
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to change sent embed page.",
          context: {
            botId: this.account.id,
            error:
              error instanceof Error
                ? error.message
                : "Unknown message embed pagination failure",
          },
        });
      }
      return;
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("botdeck:embedpage:")
    ) {
      try {
        const [, , commandId, page] = interaction.customId.split(":");
        const stored = await this.loadStoredCommandDefinition(commandId);
        const runtime = stored?.runtime ?? fallbackRuntimeForCommand("embed");
        await interaction.update(
          runtimeReplyPayload(
            runtime,
            runtime.response.content,
            commandId,
            Number.parseInt(page ?? "0", 10) || 0,
          ),
        );
      } catch (error) {
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to change embed page.",
          context: {
            botId: this.account.id,
            error:
              error instanceof Error
                ? error.message
                : "Unknown pagination failure",
          },
        });
      }
      return;
    }

    if (
      interaction.isModalSubmit() &&
      interaction.customId.startsWith("botdeck:command:")
    ) {
      try {
        const commandId = interaction.customId.replace(
          "botdeck:command:",
          "",
        );
        const stored = await this.loadStoredCommandDefinition(commandId);
        const runtime = stored?.runtime ?? fallbackRuntimeForCommand("modal");
        const fieldValues = Object.fromEntries(
          interaction.fields.fields.map((field) => [
            field.customId,
            "value" in field && typeof field.value === "string"
              ? field.value
              : "",
          ]),
        );
        const metadata = runtimeMetadata(runtime);
        const configuredField =
          typeof metadata.modalField === "string" &&
          metadata.modalField.trim()
            ? metadata.modalField.trim().slice(0, 45)
            : "query";
        const queryValue = String(
          fieldValues[configuredField] ?? Object.values(fieldValues)[0] ?? "",
        ).trim();
        const ephemeral = runtime.response.visibility !== "public";
        const modalResponses = runtimeModalResponses(runtime);
        const matchedResponses = modalResponses
          .map((response) => modalResponseMatchForQuery(response, queryValue))
          .filter(
            (match): match is RuntimeModalResponseMatch => match !== null,
          );
        if (matchedResponses.length) {
          const [firstMatch, ...followUps] = matchedResponses;
          await interaction.reply({
            ...this.modalResponsePayload(
              firstMatch.response,
              fieldValues,
              firstMatch.pageIndex,
            ),
            ephemeral,
          });
          for (const match of followUps) {
            await interaction.followUp({
              ...this.modalResponsePayload(
                match.response,
                fieldValues,
                match.pageIndex,
              ),
              ephemeral,
            });
          }
        } else if (modalResponses.length) {
          await interaction.reply({
            content: queryValue
              ? `Aucun résultat trouvé pour “${queryValue.slice(0, 80)}”.`
              : "Écris un mot à rechercher.",
            ephemeral,
          });
        } else {
          await interaction.reply({
            ...runtimeReplyPayload(
              runtime,
              fillRuntimeTemplateFromValues(
                runtime.response.content || "Reçu.",
                fieldValues,
              ),
            ),
            ephemeral,
          });
        }
        await this.publishEphemeralInteractionReply(interaction, ephemeral);
      } catch (error) {
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to answer command modal.",
          context: {
            botId: this.account.id,
            error:
              error instanceof Error
                ? error.message
                : "Unknown modal failure",
          },
        });
      }
      return;
    }

    if (
      !interaction.isChatInputCommand() &&
      !interaction.isUserContextMenuCommand() &&
      !interaction.isMessageContextMenuCommand()
    ) {
      return;
    }

    try {
      if (
        interaction.isChatInputCommand() &&
        ["reinitialiser-salon", "reset-channel", "purger-salon", "purge-channel"].includes(interaction.commandName)
      ) {
        await this.handleChannelRecreatePurgeInteraction(interaction);
        return;
      }

      const stored = await this.loadStoredCommandDefinition(
        interaction.commandId,
      );
      const runtime =
        stored?.runtime ?? fallbackRuntimeForCommand(interaction.commandName);
      const responseMode = runtimeResponseMode(runtime);
      if (responseMode === "welcome") {
        await this.handleWelcomeSetupInteraction(interaction, runtime);
        return;
      }
      if (responseMode === "goodbye") {
        await this.handleGoodbyeSetupInteraction(interaction, runtime);
        return;
      }
      if (responseMode === "logs") {
        await this.handleLogsSetupInteraction(interaction, runtime);
        return;
      }
      if (responseMode === "autorole") {
        await this.handleRoleAutomationInteraction(interaction, runtime);
        return;
      }
      if (isModerationResponseMode(responseMode)) {
        await this.handleModerationCommandInteraction(interaction, runtime);
        return;
      }
      if (
        responseMode === "modal" &&
        "showModal" in interaction &&
        typeof interaction.showModal === "function"
      ) {
        await interaction.showModal(
          runtimeModal(runtime, interaction.commandId),
        );
        return;
      }
      const ephemeral = runtime.response.visibility !== "public";
      await interaction.reply({
        ...runtimeReplyPayload(
          runtime,
          fillRuntimeTemplate(runtime.response.content, interaction),
          interaction.commandId,
        ),
        ephemeral,
      });
      await this.publishEphemeralInteractionReply(interaction, ephemeral);
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Application command interaction answered.",
        context: {
          botId: this.account.id,
          commandName: interaction.commandName,
          guildId: interaction.guildId ?? null,
        },
      });
    } catch (error) {
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to answer application command interaction.",
        context: {
          botId: this.account.id,
          commandName: interaction.commandName,
          error:
            error instanceof Error
              ? error.message
              : "Unknown interaction failure",
        },
      });
    }
  });

  this.client.on("guildCreate", async (guild) => {
    await this.refreshGuild(guild);
  });

  this.client.on("guildDelete", async (guild) => {
    await this.deleteGuildSnapshot(guild.id);
    await this.refreshDiscordState();
  });

  this.client.on("guildMemberAdd", async (member) => {
    if (this.account.commandStudioDisabled) return;
    try {
      await this.sendWelcomeMessage(member);
      await this.upsertMemberActivity(member.guild.id, member.id, {
        joinedAt: member.joinedAt ?? new Date(),
      }).catch(() => undefined);
      await this.evaluateRoleAutomationForMember(member, "join");
    } catch (error) {
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send welcome message.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          userId: member.id,
          error:
            error instanceof Error
              ? error.message
              : "Unknown welcome failure",
        },
      });
    }
  });

  this.client.on("guildMemberRemove", async (member) => {
    if (this.account.commandStudioDisabled) return;
    try {
      await this.sendGoodbyeMessage(member);
    } catch (error) {
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send goodbye message.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          userId: member.id,
          error:
            error instanceof Error
              ? error.message
              : "Unknown goodbye failure",
        },
      });
    }
    if (this.consumeRecentModerationLog(member.guild.id, "kick", member.id))
      return;
    const actor = await this.fetchAuditExecutor(
      member.guild,
      AuditLogEvent.MemberKick,
      member.id,
    );
    if (!actor) return;
    await this.sendModerationLog(
      member.guild,
      "kick",
      actor,
      {
        id: member.id,
        username: member.user?.username ?? member.displayName ?? member.id,
        displayName: member.displayName ?? member.user?.username ?? member.id,
      },
      "Aucune raison fournie",
    ).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send kick log.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          userId: member.id,
          error:
            error instanceof Error
              ? error.message
              : "Unknown kick log failure",
        },
      }),
    );
  });

  this.client.on("guildBanAdd", async (ban) => {
    if (this.consumeRecentModerationLog(ban.guild.id, "ban", ban.user.id))
      return;
    const actor = await this.fetchAuditExecutor(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id,
    );
    await this.sendModerationLog(
      ban.guild,
      "ban",
      actor,
      ban.user,
      ban.reason ?? "Aucune raison fournie",
    ).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send ban log.",
        context: {
          botId: this.account.id,
          guildId: ban.guild.id,
          userId: ban.user.id,
          error:
            error instanceof Error
              ? error.message
              : "Unknown ban log failure",
        },
      }),
    );
  });

  this.client.on("guildBanRemove", async (ban) => {
    if (this.consumeRecentModerationLog(ban.guild.id, "unban", ban.user.id))
      return;
    const actor = await this.fetchAuditExecutor(
      ban.guild,
      AuditLogEvent.MemberBanRemove,
      ban.user.id,
    );
    await this.sendModerationLog(
      ban.guild,
      "unban",
      actor,
      ban.user,
      ban.reason ?? "Aucune raison fournie",
    ).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send unban log.",
        context: {
          botId: this.account.id,
          guildId: ban.guild.id,
          userId: ban.user.id,
          error:
            error instanceof Error
              ? error.message
              : "Unknown unban log failure",
        },
      }),
    );
  });

  this.client.on("channelDelete", async (channel) => {
    const guildId =
      "guild" in channel && channel.guild ? channel.guild.id : null;
    if (!guildId) return;
    if (this.account.commandStudioDisabled) return;
    const config =
      this.welcomeConfigsByGuild.get(guildId) ??
      (await this.loadWelcomeConfig(guildId));
    if (config?.enabled && config.channelId === channel.id) {
      await this.removeWelcomeConfig(guildId, "channel-deleted", channel.id);
    }
    const goodbyeConfig =
      this.goodbyeConfigsByGuild.get(guildId) ??
      (await this.loadGoodbyeConfig(guildId));
    if (goodbyeConfig?.enabled && goodbyeConfig.channelId === channel.id) {
      await this.removeGoodbyeConfig(guildId, "channel-deleted", channel.id);
    }
    const logConfig =
      this.logConfigsByGuild.get(guildId) ??
      (await this.loadLogConfig(guildId));
    if (logConfig?.enabled && logConfig.channelId === channel.id) {
      await this.removeLogConfig(guildId, "channel-deleted", channel.id);
    }
  });

  this.client.on("channelCreate", async (channel) => {
    if (!isGuildBasedChannel(channel)) return;
    if (this.consumeChannelRecreateCreate?.(channel)) {
      await this.refreshGuild(channel.guild);
      return;
    }
    const actor = await this.fetchAuditExecutor(
      channel.guild,
      AuditLogEvent.ChannelCreate,
      channel.id,
    );
    await this.sendDiscordLog({
      key: "channel_create",
      guild: channel.guild,
      values: {
        ...this.baseLogValues(channel.guild, "channel_create", actor),
        ...this.channelValues(channel),
      },
    }).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send channel create log.",
        context: {
          botId: this.account.id,
          guildId: channel.guild.id,
          error:
            error instanceof Error ? error.message : "Unknown logs failure",
        },
      }),
    );
    await this.refreshGuild(channel.guild);
  });

  this.client.on("channelUpdate", async (oldChannel, channel) => {
    if (!isGuildBasedChannel(channel)) return;
    const oldName = isGuildBasedChannel(oldChannel) ? oldChannel.name : "";
    const newName = channel.name ?? "";

    // The public "channel updated" log is intentionally limited to name
    // changes. Discord also emits channelUpdate for position/category/order
    // changes; during a recreate purge, setting the new channel position can
    // update multiple neighbouring channels. Those updates are operational noise
    // and must not produce user-facing logs.
    if (!oldName || oldName === newName) {
      await this.refreshGuild(channel.guild);
      return;
    }

    const actor = await this.fetchAuditExecutor(
      channel.guild,
      AuditLogEvent.ChannelUpdate,
      channel.id,
    );
    await this.sendDiscordLog({
      key: "channel_update",
      guild: channel.guild,
      values: {
        ...this.baseLogValues(channel.guild, "channel_update", actor),
        ...this.channelValues(channel),
        "channel.before": oldName,
        "channel.after": newName,
      },
    }).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send channel update log.",
        context: {
          botId: this.account.id,
          guildId: channel.guild.id,
          error:
            error instanceof Error ? error.message : "Unknown logs failure",
        },
      }),
    );
    await this.refreshGuild(channel.guild);
  });

  this.client.on("channelDelete", async (channel) => {
    if (!isGuildBasedChannel(channel)) return;
    if (this.consumeChannelRecreateDelete?.(channel.id)) {
      await this.deleteChannelSnapshot(channel.id);
      await this.refreshDiscordState();
      return;
    }
    const actor = await this.fetchAuditExecutor(
      channel.guild,
      AuditLogEvent.ChannelDelete,
      channel.id,
    );
    await this.sendDiscordLog({
      key: "channel_delete",
      guild: channel.guild,
      values: {
        ...this.baseLogValues(channel.guild, "channel_delete", actor),
        ...this.channelValues(channel),
      },
    }).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to send channel delete log.",
        context: {
          botId: this.account.id,
          guildId: channel.guild.id,
          error:
            error instanceof Error ? error.message : "Unknown logs failure",
        },
      }),
    );
    await this.deleteChannelSnapshot(channel.id);
    await this.refreshDiscordState();
  });

  this.client.on("threadCreate", async (thread) => {
    const forumId = await this.forumIdForThread(thread);
    if (!forumId) return;
    this.publishEvent({
      type: "forumPost.created",
      forumId,
      post: normalizeForumPost(thread),
    });
  });

  this.client.on("threadUpdate", async (_oldThread, thread) => {
    const forumId = await this.forumIdForThread(thread);
    if (!forumId) return;
    this.publishEvent({
      type: "forumPost.updated",
      forumId,
      post: normalizeForumPost(thread),
    });
  });

  this.client.on("threadDelete", async (thread) => {
    const forumId = await this.forumIdForThread(thread);
    if (!forumId) return;
    this.publishEvent({
      type: "forumPost.deleted",
      forumId,
      postId: thread.id,
    });
  });

  this.client.on("roleCreate", (role) => {
    this.publishGuildRoles(role.guild);
  });

  this.client.on("roleUpdate", (_oldRole, role) => {
    this.publishGuildRoles(role.guild);
  });

  this.client.on("roleDelete", (role) => {
    this.publishGuildRoles(role.guild);
  });

  this.client.on("guildMemberUpdate", (_oldMember, member) => {
    this.publishEvent({
      type: "member.profile",
      profile: normalizeMemberProfile(member),
    });
  });

  this.client.on("messageCreate", async (message) => {
    if (!message.inGuild()) {
      this.publishDirectThread(message);
    }
    const summary = normalizeMessage(message);
    this.updateMessageCache(message.channelId, (current) => [
      ...current,
      summary,
    ]);
    await this.persistMessageSnapshot(message).catch(() => undefined);
    this.publishEvent({ type: "message.created", message: summary });
    await this.recordGuildMessageActivity(message).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Failed to update role automation message activity.",
        context: {
          botId: this.account.id,
          guildId: message.guildId ?? null,
          error:
            error instanceof Error
              ? error.message
              : "Unknown activity failure",
        },
      }),
    );
    await this.answerPrefixCommand(message).catch((error) => {
      this.publishEvent({
        type: "audit.log",
        level: "error",
        message: "Failed to answer prefix command.",
        context: {
          botId: this.account.id,
          error:
            error instanceof Error ? error.message : "Unknown prefix failure",
        },
      });
    });
  });

  this.client.on("messageUpdate", async (oldMessage, message) => {
    if (!message || message.partial) return;
    const summary = normalizeMessage(message);
    this.updateMessageCache(message.channelId, (current) =>
      current.some((item) => item.id === summary.id)
        ? current.map((item) => (item.id === summary.id ? summary : item))
        : [...current, summary],
    );
    await this.persistMessageSnapshot(message).catch(() => undefined);
    this.publishEvent({ type: "message.updated", message: summary });
    if (message.inGuild() && !message.author?.bot) {
      const oldContent =
        !oldMessage.partial && "content" in oldMessage
          ? oldMessage.content
          : "";
      await this.sendDiscordLog({
        key: "message_edit",
        guild: message.guild,
        values: {
          ...this.baseLogValues(
            message.guild,
            "message_edit",
            message.author,
          ),
          ...this.channelValues(message.channel),
          ...this.userValues("target", message.author),
          "message.id": message.id,
          "message.before": this.shortText(
            oldContent,
            "Message non disponible",
          ),
          "message.after": this.shortText(message.content, "Message vide"),
          "message.url": message.url,
        },
      }).catch((error) =>
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to send message edit log.",
          context: {
            botId: this.account.id,
            guildId: message.guildId,
            error:
              error instanceof Error ? error.message : "Unknown logs failure",
          },
        }),
      );
    }
  });

  this.client.on("messageDelete", async (message) => {
    if (!message.channelId) return;
    this.updateMessageCache(message.channelId, (current) =>
      current.filter((item) => item.id !== message.id),
    );
    await this.deleteMessageSnapshot(message.id);
    this.publishEvent({
      type: "message.deleted",
      channelId: message.channelId,
      messageId: message.id,
    });
    if (message.inGuild() && message.guild && message.channel) {
      const author = message.author ?? null;
      const actor = await this.fetchAuditExecutor(
        message.guild,
        AuditLogEvent.MessageDelete,
        author?.id ?? null,
      );
      await this.sendDiscordLog({
        key: "message_delete",
        guild: message.guild,
        values: {
          ...this.baseLogValues(
            message.guild,
            "message_delete",
            actor ?? author,
          ),
          ...this.channelValues(message.channel),
          ...this.userValues("target", author),
          "message.id": message.id,
          "message.before": this.shortText(
            message.content,
            "Message non disponible",
          ),
          "message.after": "",
          "message.url": message.guildId
            ? `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`
            : "",
        },
      }).catch((error) =>
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Failed to send message delete log.",
          context: {
            botId: this.account.id,
            guildId: message.guildId,
            error:
              error instanceof Error ? error.message : "Unknown logs failure",
          },
        }),
      );
    }
  });

  const publishReactionMessage = async (
    reaction: MessageReaction | PartialMessageReaction,
  ) => {
    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    const message = fullReaction.message.partial
      ? await fullReaction.message.fetch()
      : fullReaction.message;
    if (!message || !("author" in message)) return;
    const summary = normalizeMessage(message);
    this.updateMessageCache(message.channelId, (current) =>
      current.some((item) => item.id === summary.id)
        ? current.map((item) => (item.id === summary.id ? summary : item))
        : [...current, summary],
    );
    this.publishEvent({ type: "message.updated", message: summary });
  };

  this.client.on("messageReactionAdd", async (reaction) => {
    await publishReactionMessage(reaction).catch(() => undefined);
  });

  this.client.on("messageReactionRemove", async (reaction) => {
    await publishReactionMessage(reaction).catch(() => undefined);
  });

  this.client.on("messageReactionRemoveAll", async (message) => {
    if (message.partial) return;
    this.publishEvent({
      type: "message.updated",
      message: normalizeMessage(message),
    });
  });

  this.client.on("presenceUpdate", async (_oldPresence, newPresence) => {
    if (!newPresence.member) return;
    const snapshot = normalizePresence(newPresence.member);
    await this.persistPresenceSnapshot(newPresence.member).catch(
      () => undefined,
    );
    this.publishEvent({ type: "presence.updated", presence: snapshot });
  });

  this.client.on("voiceStateUpdate", (oldState, newState) => {
    const snapshot = normalizeVoiceState(newState);
    if (!snapshot) return;
    const voiceStates = this.voiceCache.get(snapshot.guildId) ?? [];
    this.voiceCache.set(
      snapshot.guildId,
      clamp(
        [
          ...voiceStates.filter((item) => item.userId !== snapshot.userId),
          snapshot,
        ],
        100,
      ),
    );
    this.publishEvent({ type: "voice.updated", state: snapshot });
    if (newState.member) {
      this.publishEvent({
        type: "member.profile",
        profile: normalizeMemberProfile(newState.member),
      });
    }
    void this.handleVoiceAutomation(
      oldState.guild?.id ?? null,
      oldState.id ?? null,
      oldState.channelId ?? null,
      newState.member ?? null,
      newState.guild?.id ?? null,
      newState.id ?? null,
      newState.channelId ?? null,
    ).catch((error) =>
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Failed to update role automation voice activity.",
        context: {
          botId: this.account.id,
          guildId: newState.guild?.id ?? oldState.guild?.id ?? null,
          userId: newState.id ?? oldState.id ?? null,
          error:
            error instanceof Error
              ? error.message
              : "Unknown voice activity failure",
        },
      }),
    );
  });
}
