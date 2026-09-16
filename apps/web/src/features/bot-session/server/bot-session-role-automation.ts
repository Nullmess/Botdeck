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

function roleAutomationGuildShardId(guild: Guild): number {
  const shardId = (guild as any).shardId;
  return typeof shardId === "number" && Number.isFinite(shardId) ? shardId : 0;
}

function roleAutomationHasGatewayShard(client: Client, guild: Guild): boolean {
  const shards = (client as any).ws?.shards;
  if (!shards || typeof shards.has !== "function") return true;
  return shards.has(roleAutomationGuildShardId(guild));
}

async function safeFetchRoleAutomationMembers(
  context: BotSessionContext,
  guild: Guild,
) {
  if (!roleAutomationHasGatewayShard(context.client, guild)) return null;
  try {
    return await guild.members.fetch();
  } catch {
    return null;
  }
}

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

export function roleAutomationRuleToConfig(
  this: BotSessionContext,
    rule: StoredRoleAutomationRule,
  ): GuildRoleAutomationRuleConfig {
    const toIso = (value: Date | string | null | undefined) =>
      value instanceof Date ? value.toISOString() : (value ?? null);
    return {
      id: rule.id,
      guildId: rule.guildId,
      roleId: rule.roleId,
      enabled: rule.enabled,
      conditionMode: rule.conditionMode === "any" ? "any" : "all",
      minMessages: rule.minMessages,
      minVoiceSeconds: rule.minVoiceSeconds,
      minMemberAgeSeconds: rule.minMemberAgeSeconds,
      removeWhenInvalid: rule.removeWhenInvalid,
      ignoreBots: rule.ignoreBots,
      applyToExistingMembers: rule.applyToExistingMembers,
      createdAt: toIso(rule.createdAt),
      updatedAt: toIso(rule.updatedAt),
    };
  }


export function cacheRoleAutomationRules(
  this: BotSessionContext,
    guildId: string,
    rules: StoredRoleAutomationRule[],
  ): void {
    if (rules.length) this.roleAutomationRulesByGuild.set(guildId, rules);
    else this.roleAutomationRulesByGuild.delete(guildId);
  }


export async function repairRoleAutomationRuleStorage(
  this: BotSessionContext,
    guildId?: string,
  ): Promise<void> {
    try {
      const whereGuild = guildId ? ' AND "guildId" = ?' : "";
      const guildArg = guildId ? [guildId] : [];
      await prisma.$executeRawUnsafe(
        `UPDATE "GuildRoleAutomationRule" SET "minMessages" = NULL WHERE "botAccountId" = ?${whereGuild} AND "minMessages" IS NOT NULL AND ("minMessages" < 0 OR "minMessages" > ?)`,
        this.account.id,
        ...guildArg,
        ROLE_AUTOMATION_MAX_MESSAGES,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "GuildRoleAutomationRule" SET "minVoiceSeconds" = NULL WHERE "botAccountId" = ?${whereGuild} AND "minVoiceSeconds" IS NOT NULL AND ("minVoiceSeconds" < 0 OR "minVoiceSeconds" > ?)`,
        this.account.id,
        ...guildArg,
        ROLE_AUTOMATION_MAX_VOICE_SECONDS,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "GuildRoleAutomationRule" SET "minMemberAgeSeconds" = NULL WHERE "botAccountId" = ?${whereGuild} AND "minMemberAgeSeconds" IS NOT NULL AND ("minMemberAgeSeconds" < 0 OR "minMemberAgeSeconds" > ?)`,
        this.account.id,
        ...guildArg,
        ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS,
      );
    } catch (error) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Role automation storage cleanup skipped.",
        context: {
          botId: this.account.id,
          guildId,
          error:
            error instanceof Error
              ? error.message
              : "Unknown role automation cleanup failure",
        },
      });
    }
  }


export async function loadRoleAutomationRules(
  this: BotSessionContext,
    guildId?: string,
    force = false,
  ): Promise<StoredRoleAutomationRule[]> {
    if (guildId && !force && this.roleAutomationRulesByGuild.has(guildId))
      return this.roleAutomationRulesByGuild.get(guildId) ?? [];
    await this.repairRoleAutomationRuleStorage(guildId);
    const findRules = () =>
      (
        prisma as unknown as {
          guildRoleAutomationRule: {
            findMany: (args: unknown) => Promise<StoredRoleAutomationRule[]>;
          };
        }
      ).guildRoleAutomationRule.findMany({
        where: {
          botAccountId: this.account.id,
          ...(guildId ? { guildId } : {}),
        },
        select: {
          id: true,
          guildId: true,
          roleId: true,
          enabled: true,
          conditionMode: true,
          minMessages: true,
          minVoiceSeconds: true,
          minMemberAgeSeconds: true,
          removeWhenInvalid: true,
          ignoreBots: true,
          applyToExistingMembers: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
      });
    let rows: StoredRoleAutomationRule[];
    try {
      rows = await findRules();
    } catch (error) {
      await this.repairRoleAutomationRuleStorage(guildId);
      rows = await findRules();
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "Role automation rules were repaired before loading.",
        context: {
          botId: this.account.id,
          guildId,
          error:
            error instanceof Error
              ? error.message
              : "Unknown role automation read failure",
        },
      });
    }
    if (guildId) this.cacheRoleAutomationRules(guildId, rows);
    else {
      this.roleAutomationRulesByGuild.clear();
      const grouped = new Map<string, StoredRoleAutomationRule[]>();
      for (const row of rows)
        grouped.set(row.guildId, [...(grouped.get(row.guildId) ?? []), row]);
      for (const [key, items] of grouped)
        this.cacheRoleAutomationRules(key, items);
    }
    if (!guildId && rows.length) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: `Role automation active for ${new Set(rows.map((row) => row.guildId)).size} server${rows.length === 1 ? "" : "s"}.`,
        context: { botId: this.account.id, ruleCount: rows.length },
      });
    }
    return rows;
  }


export async function resolveAssignableRole(
  this: BotSessionContext,
    guildId: string,
    roleId: string,
  ): Promise<Role> {
    const guild =
      this.client.guilds.cache.get(guildId) ??
      (await withRoleAutomationTimeout(
        this.client.guilds.fetch(guildId).catch(() => null),
        "Server lookup",
      ));
    if (!guild) throw new Error("Server not found.");
    const role =
      guild.roles.cache.get(roleId) ??
      (await withRoleAutomationTimeout(
        guild.roles.fetch(roleId).catch(() => null),
        "Role lookup",
      ));
    if (!role) throw new Error("Role not found.");
    if (role.managed)
      throw new Error(
        "This role is managed by an integration and cannot be assigned.",
      );
    if (role.id === guild.id)
      throw new Error("The @everyone role cannot be assigned.");
    const me =
      guild.members.me ??
      (await withRoleAutomationTimeout(
        guild.members.fetchMe().catch(() => null),
        "Bot member lookup",
      ));
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles))
      throw new Error("The bot needs Manage Roles permission.");
    if (role.position >= me.roles.highest.position)
      throw new Error(
        "The role is above the bot role or cannot be managed by this bot.",
      );
    if (!role.editable)
      throw new Error("The role cannot be managed by this bot.");
    return role;
  }


export function normalizeRoleAutomationInput(
  this: BotSessionContext,
    input: RoleAutomationRuleInput,
  ): RoleAutomationRuleInput {
    const normalizePositive = (
      value: number | null | undefined,
      max: number,
    ) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
        return null;
      return Math.min(Math.floor(value), max);
    };
    return {
      ...input,
      conditionMode: input.conditionMode === "any" ? "any" : "all",
      minMessages: normalizePositive(
        input.minMessages,
        ROLE_AUTOMATION_MAX_MESSAGES,
      ),
      minVoiceSeconds: normalizePositive(
        input.minVoiceSeconds,
        ROLE_AUTOMATION_MAX_VOICE_SECONDS,
      ),
      minMemberAgeSeconds: normalizePositive(
        input.minMemberAgeSeconds,
        ROLE_AUTOMATION_MAX_MEMBER_AGE_SECONDS,
      ),
    };
  }


export async function upsertGuildRoleAutomationRule(
  this: BotSessionContext,
    guildId: string,
    input: RoleAutomationRuleInput,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne modifie pas les rôles automatiques de ce bot.",
      );
    }
    const normalized = this.normalizeRoleAutomationInput(input);
    void this.resolveAssignableRole(guildId, normalized.roleId).catch(
      (error) => {
        this.publishEvent({
          type: "audit.log",
          level: "warn",
          message:
            "Role automation target role could not be fully verified after save.",
          context: {
            botId: this.account.id,
            guildId,
            roleId: normalized.roleId,
            error:
              error instanceof Error
                ? error.message
                : "Unknown role automation validation failure",
          },
        });
      },
    );
    await (
      prisma as unknown as {
        guildRoleAutomationRule: {
          upsert: (args: unknown) => Promise<unknown>;
          create: (args: unknown) => Promise<unknown>;
        };
      }
    ).guildRoleAutomationRule[normalized.ruleId ? "upsert" : "create"](
      normalized.ruleId
        ? {
            where: { id: normalized.ruleId },
            create: {
              botAccountId: this.account.id,
              guildId,
              roleId: normalized.roleId,
              enabled: normalized.enabled,
              conditionMode: normalized.conditionMode,
              minMessages: normalized.minMessages,
              minVoiceSeconds: normalized.minVoiceSeconds,
              minMemberAgeSeconds: normalized.minMemberAgeSeconds,
              removeWhenInvalid: normalized.removeWhenInvalid,
              ignoreBots: normalized.ignoreBots,
              applyToExistingMembers: normalized.applyToExistingMembers,
            },
            update: {
              roleId: normalized.roleId,
              enabled: normalized.enabled,
              conditionMode: normalized.conditionMode,
              minMessages: normalized.minMessages,
              minVoiceSeconds: normalized.minVoiceSeconds,
              minMemberAgeSeconds: normalized.minMemberAgeSeconds,
              removeWhenInvalid: normalized.removeWhenInvalid,
              ignoreBots: normalized.ignoreBots,
              applyToExistingMembers: normalized.applyToExistingMembers,
            },
          }
        : {
            data: {
              botAccountId: this.account.id,
              guildId,
              roleId: normalized.roleId,
              enabled: normalized.enabled,
              conditionMode: normalized.conditionMode,
              minMessages: normalized.minMessages,
              minVoiceSeconds: normalized.minVoiceSeconds,
              minMemberAgeSeconds: normalized.minMemberAgeSeconds,
              removeWhenInvalid: normalized.removeWhenInvalid,
              ignoreBots: normalized.ignoreBots,
              applyToExistingMembers: normalized.applyToExistingMembers,
            },
          },
    );
    await this.loadRoleAutomationRules(guildId, true);
    await this.publishGuildAutomationConfig(guildId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Role automation rule saved.",
      context: { botId: this.account.id, guildId, roleId: normalized.roleId },
    });
    if (normalized.applyToExistingMembers)
      void this.syncGuildRoleAutomation(guildId).catch((error) =>
        this.publishEvent({
          type: "audit.log",
          level: "error",
          message: "Role automation sync failed after save.",
          context: {
            botId: this.account.id,
            guildId,
            error:
              error instanceof Error
                ? error.message
                : "Unknown role automation failure",
          },
        }),
      );
  }


export async function deleteGuildRoleAutomationRule(
  this: BotSessionContext,
    guildId: string,
    ruleId: string,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne modifie pas les rôles automatiques de ce bot.",
      );
    }
    await (
      prisma as unknown as {
        guildRoleAutomationRule: {
          deleteMany: (args: unknown) => Promise<unknown>;
        };
      }
    ).guildRoleAutomationRule.deleteMany({
      where: { botAccountId: this.account.id, guildId, id: ruleId },
    });
    await this.loadRoleAutomationRules(guildId, true);
    await this.publishGuildAutomationConfig(guildId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Role automation rule deleted.",
      context: { botId: this.account.id, guildId, ruleId },
    });
  }


export async function getMemberActivity(
  this: BotSessionContext,
    guildId: string,
    userId: string,
  ): Promise<StoredMemberActivity | null> {
    return (
      prisma as unknown as {
        guildMemberActivity: {
          findUnique: (args: unknown) => Promise<StoredMemberActivity | null>;
        };
      }
    ).guildMemberActivity.findUnique({
      where: {
        botAccountId_guildId_userId: {
          botAccountId: this.account.id,
          guildId,
          userId,
        },
      },
      select: {
        guildId: true,
        userId: true,
        messageCount: true,
        voiceSeconds: true,
        joinedAt: true,
      },
    });
  }


export async function upsertMemberActivity(
  this: BotSessionContext,
    guildId: string,
    userId: string,
    patch: {
      messageDelta?: number;
      voiceDeltaSeconds?: number;
      joinedAt?: Date | null;
      lastMessageAt?: Date | null;
      lastVoiceAt?: Date | null;
    },
  ): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    const existing = await this.getMemberActivity(guildId, userId);
    await (
      prisma as unknown as {
        guildMemberActivity: { upsert: (args: unknown) => Promise<unknown> };
      }
    ).guildMemberActivity.upsert({
      where: {
        botAccountId_guildId_userId: {
          botAccountId: this.account.id,
          guildId,
          userId,
        },
      },
      create: {
        botAccountId: this.account.id,
        guildId,
        userId,
        messageCount: Math.max(0, patch.messageDelta ?? 0),
        voiceSeconds: Math.max(0, patch.voiceDeltaSeconds ?? 0),
        joinedAt: patch.joinedAt ?? null,
        lastMessageAt: patch.lastMessageAt ?? null,
        lastVoiceAt: patch.lastVoiceAt ?? null,
      },
      update: {
        messageCount: Math.max(
          0,
          (existing?.messageCount ?? 0) + (patch.messageDelta ?? 0),
        ),
        voiceSeconds: Math.max(
          0,
          (existing?.voiceSeconds ?? 0) + (patch.voiceDeltaSeconds ?? 0),
        ),
        ...(patch.joinedAt ? { joinedAt: patch.joinedAt } : {}),
        ...(patch.lastMessageAt ? { lastMessageAt: patch.lastMessageAt } : {}),
        ...(patch.lastVoiceAt ? { lastVoiceAt: patch.lastVoiceAt } : {}),
      },
    });
  }


export function roleAutomationConditions(
  this: BotSessionContext,
    rule: StoredRoleAutomationRule,
    member: GuildMember,
    activity: StoredMemberActivity | null,
  ): boolean[] {
    const conditions: boolean[] = [];
    if (rule.minMessages && rule.minMessages > 0)
      conditions.push((activity?.messageCount ?? 0) >= rule.minMessages);
    if (rule.minVoiceSeconds && rule.minVoiceSeconds > 0)
      conditions.push((activity?.voiceSeconds ?? 0) >= rule.minVoiceSeconds);
    if (rule.minMemberAgeSeconds && rule.minMemberAgeSeconds > 0) {
      const joined =
        member.joinedAt?.getTime?.() ??
        (activity?.joinedAt ? Date.parse(String(activity.joinedAt)) : NaN);
      conditions.push(
        Number.isFinite(joined) &&
          Date.now() - joined >= rule.minMemberAgeSeconds * 1000,
      );
    }
    return conditions;
  }


export function roleAutomationRuleMatches(
  this: BotSessionContext,
    rule: StoredRoleAutomationRule,
    member: GuildMember,
    activity: StoredMemberActivity | null,
  ): boolean {
    const conditions = this.roleAutomationConditions(rule, member, activity);
    if (!conditions.length) return true;
    return rule.conditionMode === "any"
      ? conditions.some(Boolean)
      : conditions.every(Boolean);
  }


export async function applyRoleAutomationRule(
  this: BotSessionContext,
    member: GuildMember,
    rule: StoredRoleAutomationRule,
  ): Promise<boolean> {
    if (!rule.enabled) return false;
    if (rule.ignoreBots && member.user.bot) return false;
    const role =
      member.guild.roles.cache.get(rule.roleId) ??
      (await member.guild.roles.fetch(rule.roleId).catch(() => null));
    if (!role || role.managed || !role.editable) return false;
    await this.upsertMemberActivity(member.guild.id, member.id, {
      joinedAt: member.joinedAt ?? null,
    }).catch(() => undefined);
    const activity = await this.getMemberActivity(
      member.guild.id,
      member.id,
    ).catch(() => null);
    const matches = this.roleAutomationRuleMatches(rule, member, activity);
    const hasRole = member.roles.cache.has(rule.roleId);
    if (matches && !hasRole) {
      await member.roles.add(role, "BotDeck role automation");
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Role automation assigned role.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          userId: member.id,
          roleId: rule.roleId,
          ruleId: rule.id,
        },
      });
      return true;
    }
    if (!matches && hasRole && rule.removeWhenInvalid) {
      await member.roles.remove(
        role,
        "BotDeck role automation: conditions no longer valid",
      );
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Role automation removed role.",
        context: {
          botId: this.account.id,
          guildId: member.guild.id,
          userId: member.id,
          roleId: rule.roleId,
          ruleId: rule.id,
        },
      });
      return true;
    }
    return false;
  }


export async function evaluateRoleAutomationForMember(
  this: BotSessionContext,
    member: GuildMember,
    reason: string,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    const rules = await this.loadRoleAutomationRules(member.guild.id);
    if (!rules.length) return;
    let changed = false;
    for (const rule of rules) {
      changed =
        (await this.applyRoleAutomationRule(member, rule).catch((error) => {
          this.publishEvent({
            type: "audit.log",
            level: "warn",
            message: "Role automation rule failed for member.",
            context: {
              botId: this.account.id,
              guildId: member.guild.id,
              userId: member.id,
              ruleId: rule.id,
              reason,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown role automation failure",
            },
          });
          return false;
        })) || changed;
    }
    if (changed)
      this.publishEvent({
        type: "member.profile",
        profile: normalizeMemberProfile(member),
      });
  }


export async function syncGuildRoleAutomation(this: BotSessionContext, guildId: string): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne synchronise pas les rôles automatiques de ce bot.",
      );
    }
    const guild =
      this.client.guilds.cache.get(guildId) ??
      (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) throw new Error("Server not found.");
    const rules = await this.loadRoleAutomationRules(guildId, true);
    await this.flushLiveVoiceSessionsForGuild(guildId);
    if (!rules.some((rule) => rule.enabled)) {
      this.publishEvent({
        type: "audit.log",
        level: "info",
        message: "Role automation sync skipped: no active rules.",
        context: { botId: this.account.id, guildId },
      });
      return;
    }
    const members = await safeFetchRoleAutomationMembers(this, guild);
    if (!members) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message:
          "Role automation sync skipped: Discord members could not be fetched safely.",
        context: {
          botId: this.account.id,
          guildId,
          shardId: roleAutomationGuildShardId(guild),
        },
      });
      return;
    }
    let scanned = 0;
    for (const member of members.values()) {
      scanned += 1;
      await this.evaluateRoleAutomationForMember(member, "sync");
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Role automation sync completed.",
      context: {
        botId: this.account.id,
        guildId,
        scanned,
        ruleCount: rules.length,
      },
    });
  }


export async function testGuildRoleAutomation(
  this: BotSessionContext,
    guildId: string,
    ruleId?: string | null,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) {
      throw new Error(
        "Mode lecture seule actif : Botdeck ne teste pas les rôles automatiques de ce bot.",
      );
    }
    const guild =
      this.client.guilds.cache.get(guildId) ??
      (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) throw new Error("Server not found.");
    const rules = await this.loadRoleAutomationRules(guildId, true);
    const selected = ruleId
      ? rules.filter((rule) => rule.id === ruleId)
      : rules.filter((rule) => rule.enabled);
    if (!selected.length) throw new Error("No role automation rule found.");
    for (const rule of selected)
      await this.resolveAssignableRole(guildId, rule.roleId);
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: "Role automation test passed.",
      context: { botId: this.account.id, guildId, ruleCount: selected.length },
    });
  }


export async function recordGuildMessageActivity(this: BotSessionContext, message: Message): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    if (!message.inGuild() || message.author.bot) return;
    await this.upsertMemberActivity(message.guildId, message.author.id, {
      messageDelta: 1,
      lastMessageAt: new Date(),
      joinedAt: message.member?.joinedAt ?? null,
    });
    if (message.member)
      await this.evaluateRoleAutomationForMember(message.member, "message");
  }


export async function startVoiceSession(
  this: BotSessionContext,
    guildId: string,
    userId: string,
    channelId: string,
  ): Promise<void> {
    const key = `${guildId}:${userId}`;
    const startedAt = Date.now();
    this.liveVoiceSessions.set(key, { guildId, userId, channelId, startedAt });
    await (
      prisma as unknown as {
        guildVoiceSession: { upsert: (args: unknown) => Promise<unknown> };
      }
    ).guildVoiceSession
      .upsert({
        where: {
          botAccountId_guildId_userId: {
            botAccountId: this.account.id,
            guildId,
            userId,
          },
        },
        create: {
          botAccountId: this.account.id,
          guildId,
          userId,
          channelId,
          startedAt: new Date(startedAt),
        },
        update: { channelId, startedAt: new Date(startedAt) },
      })
      .catch(() => undefined);
  }


export async function closeVoiceSession(
  this: BotSessionContext,
    guildId: string,
    userId: string,
  ): Promise<number> {
    const key = `${guildId}:${userId}`;
    const current = this.liveVoiceSessions.get(key);
    this.liveVoiceSessions.delete(key);
    let startedAt = current?.startedAt ?? 0;
    if (!startedAt) {
      const stored = await (
        prisma as unknown as {
          guildVoiceSession: {
            findUnique: (
              args: unknown,
            ) => Promise<{ startedAt: Date | string } | null>;
          };
        }
      ).guildVoiceSession
        .findUnique({
          where: {
            botAccountId_guildId_userId: {
              botAccountId: this.account.id,
              guildId,
              userId,
            },
          },
          select: { startedAt: true },
        })
        .catch(() => null);
      startedAt = stored?.startedAt ? Date.parse(String(stored.startedAt)) : 0;
    }
    await (
      prisma as unknown as {
        guildVoiceSession: { deleteMany: (args: unknown) => Promise<unknown> };
      }
    ).guildVoiceSession
      .deleteMany({ where: { botAccountId: this.account.id, guildId, userId } })
      .catch(() => undefined);
    return startedAt
      ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      : 0;
  }


export async function flushLiveVoiceSessionsForGuild(this: BotSessionContext, guildId: string): Promise<void> {
    const now = Date.now();
    for (const [key, session] of this.liveVoiceSessions) {
      if (session.guildId !== guildId) continue;
      const delta = Math.max(0, Math.floor((now - session.startedAt) / 1000));
      if (delta <= 0) continue;
      this.liveVoiceSessions.set(key, { ...session, startedAt: now });
      await this.upsertMemberActivity(guildId, session.userId, {
        voiceDeltaSeconds: delta,
        lastVoiceAt: new Date(now),
      });
      await (
        prisma as unknown as {
          guildVoiceSession: {
            updateMany: (args: unknown) => Promise<unknown>;
          };
        }
      ).guildVoiceSession
        .updateMany({
          where: {
            botAccountId: this.account.id,
            guildId,
            userId: session.userId,
          },
          data: { startedAt: new Date(now), channelId: session.channelId },
        })
        .catch(() => undefined);
    }
  }


export async function handleVoiceAutomation(
  this: BotSessionContext,
    oldGuildId: string | null,
    oldUserId: string | null,
    oldChannelId: string | null,
    newMember: GuildMember | null,
    newGuildId: string | null,
    newUserId: string | null,
    newChannelId: string | null,
  ): Promise<void> {
    if (this.account.commandStudioDisabled) return;
    if (
      oldGuildId &&
      oldUserId &&
      oldChannelId &&
      oldChannelId !== newChannelId
    ) {
      const delta = await this.closeVoiceSession(oldGuildId, oldUserId);
      if (delta > 0)
        await this.upsertMemberActivity(oldGuildId, oldUserId, {
          voiceDeltaSeconds: delta,
          lastVoiceAt: new Date(),
          joinedAt: newMember?.joinedAt ?? null,
        });
    }
    if (
      newGuildId &&
      newUserId &&
      newChannelId &&
      oldChannelId !== newChannelId
    ) {
      await this.startVoiceSession(newGuildId, newUserId, newChannelId);
    }
    if (newMember)
      await this.evaluateRoleAutomationForMember(newMember, "voice");
  }


export function startRoleAutomationScheduler(this: BotSessionContext): void {
    if (this.account.commandStudioDisabled) return;
    if (this.roleAutomationTimer) return;
    this.roleAutomationTimer = setInterval(
      () => {
        for (const guildId of this.roleAutomationRulesByGuild.keys()) {
          void this.syncGuildRoleAutomation(guildId).catch((error) =>
            this.publishEvent({
              type: "audit.log",
              level: "warn",
              message: "Scheduled role automation sync failed.",
              context: {
                botId: this.account.id,
                guildId,
                error:
                  error instanceof Error
                    ? error.message
                    : "Unknown role automation failure",
              },
            }),
          );
        }
      },
      15 * 60 * 1000,
    );
  }
