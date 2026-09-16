// Session bot Discord

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
  consumeChannelRecreateCreate as consumeChannelRecreateCreateCache,
  consumeChannelRecreateDelete as consumeChannelRecreateDeleteCache,
  createMessageEmbedPageCache as createMessageEmbedPageCacheEntry,
  createModalPageCache as createModalPageCacheEntry,
  modalResponsePayload as modalResponsePayloadFromCache,
  rememberChannelRecreateCreate as rememberChannelRecreateCreateCache,
  rememberChannelRecreateDelete as rememberChannelRecreateDeleteCache,
} from "./bot-session-cache";

import {
  BotAccountRow,
  BotAccountUpdatePatch,
  DATABASE_WRITE_BATCH_SIZE,
  DATABASE_WRITE_CONCURRENCY,
  DM_GUILD_ID,
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_GOODBYE_MESSAGE,
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
  runtimeMetadata,
  runtimeModal,
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

import {
  cacheWelcomeConfig as cacheWelcomeConfigImpl,
  loadWelcomeConfigs as loadWelcomeConfigsImpl,
  saveWelcomeConfig as saveWelcomeConfigImpl,
  removeWelcomeConfig as removeWelcomeConfigImpl,
  loadWelcomeConfig as loadWelcomeConfigImpl,
  guildAutomationConfig as guildAutomationConfigImpl,
  publishGuildAutomationConfig as publishGuildAutomationConfigImpl,
  syncGuildAutomationConfig as syncGuildAutomationConfigImpl,
  parseAutomationEmbedPagesJson as parseAutomationEmbedPagesJsonImpl,
  channelSendBlockReason as channelSendBlockReasonImpl,
  resolveAutomationChannel as resolveAutomationChannelImpl,
  updateGuildAutomationConfig as updateGuildAutomationConfigImpl,
  removeGuildAutomationConfig as removeGuildAutomationConfigImpl,
  automationTestValues as automationTestValuesImpl,
  testGuildAutomationConfig as testGuildAutomationConfigImpl,
  cacheGoodbyeConfig as cacheGoodbyeConfigImpl,
  loadGoodbyeConfigs as loadGoodbyeConfigsImpl,
  saveGoodbyeConfig as saveGoodbyeConfigImpl,
  removeGoodbyeConfig as removeGoodbyeConfigImpl,
  loadGoodbyeConfig as loadGoodbyeConfigImpl,
  cacheLogConfig as cacheLogConfigImpl,
  loadLogConfigs as loadLogConfigsImpl,
  saveLogConfig as saveLogConfigImpl,
  removeLogConfig as removeLogConfigImpl,
  loadLogConfig as loadLogConfigImpl,
} from "./bot-session-automation-config";

import {
  roleAutomationRuleToConfig as roleAutomationRuleToConfigImpl,
  cacheRoleAutomationRules as cacheRoleAutomationRulesImpl,
  repairRoleAutomationRuleStorage as repairRoleAutomationRuleStorageImpl,
  loadRoleAutomationRules as loadRoleAutomationRulesImpl,
  resolveAssignableRole as resolveAssignableRoleImpl,
  normalizeRoleAutomationInput as normalizeRoleAutomationInputImpl,
  upsertGuildRoleAutomationRule as upsertGuildRoleAutomationRuleImpl,
  deleteGuildRoleAutomationRule as deleteGuildRoleAutomationRuleImpl,
  getMemberActivity as getMemberActivityImpl,
  upsertMemberActivity as upsertMemberActivityImpl,
  roleAutomationConditions as roleAutomationConditionsImpl,
  roleAutomationRuleMatches as roleAutomationRuleMatchesImpl,
  applyRoleAutomationRule as applyRoleAutomationRuleImpl,
  evaluateRoleAutomationForMember as evaluateRoleAutomationForMemberImpl,
  syncGuildRoleAutomation as syncGuildRoleAutomationImpl,
  testGuildRoleAutomation as testGuildRoleAutomationImpl,
  recordGuildMessageActivity as recordGuildMessageActivityImpl,
  startVoiceSession as startVoiceSessionImpl,
  closeVoiceSession as closeVoiceSessionImpl,
  flushLiveVoiceSessionsForGuild as flushLiveVoiceSessionsForGuildImpl,
  handleVoiceAutomation as handleVoiceAutomationImpl,
  startRoleAutomationScheduler as startRoleAutomationSchedulerImpl,
} from "./bot-session-role-automation";

import {
  defaultLogEventConfigs as defaultLogEventConfigsImpl,
  normalizeLogEmbedPages as normalizeLogEmbedPagesImpl,
  normalizeLogEventConfigs as normalizeLogEventConfigsImpl,
  readLogEventConfigs as readLogEventConfigsImpl,
  logSetupTemplateValues as logSetupTemplateValuesImpl,
  runtimeLogSetConfirmation as runtimeLogSetConfirmationImpl,
  runtimeLogRemoveConfirmation as runtimeLogRemoveConfirmationImpl,
  handleLogsSetupInteraction as handleLogsSetupInteractionImpl,
  formatRoleAutomationRule as formatRoleAutomationRuleImpl,
  handleRoleAutomationInteraction as handleRoleAutomationInteractionImpl,
  moderationTemplateValues as moderationTemplateValuesImpl,
  rememberModerationLog as rememberModerationLogImpl,
  consumeRecentModerationLog as consumeRecentModerationLogImpl,
  sendModerationLog as sendModerationLogImpl,
  replyModerationResult as replyModerationResultImpl,
  handleModerationCommandInteraction as handleModerationCommandInteractionImpl,
  handleChannelRecreatePurgeInteraction as handleChannelRecreatePurgeInteractionImpl,
  fetchAuditExecutor as fetchAuditExecutorImpl,
  shortText as shortTextImpl,
  userValues as userValuesImpl,
  baseLogValues as baseLogValuesImpl,
  channelValues as channelValuesImpl,
  sendDiscordLog as sendDiscordLogImpl,
  welcomeSetupTemplateValues as welcomeSetupTemplateValuesImpl,
  handleWelcomeSetupInteraction as handleWelcomeSetupInteractionImpl,
  sendWelcomeMessage as sendWelcomeMessageImpl,
  handleGoodbyeSetupInteraction as handleGoodbyeSetupInteractionImpl,
  goodbyeTemplateValuesForMember as goodbyeTemplateValuesForMemberImpl,
  sendGoodbyeMessage as sendGoodbyeMessageImpl,
} from "./bot-session-interaction-flows";

import {
  syncChannelHistory as syncChannelHistoryImpl,
  syncChannelPins as syncChannelPinsImpl,
  syncMessageContext as syncMessageContextImpl,
  openDirectThread as openDirectThreadImpl,
  publishDirectThread as publishDirectThreadImpl,
  sendMessage as sendMessageImpl,
  editMessage as editMessageImpl,
  deleteMessage as deleteMessageImpl,
  setMessagePinned as setMessagePinnedImpl,
  reactToMessage as reactToMessageImpl,
  unreactToMessage as unreactToMessageImpl,
} from "./bot-session-message-actions";

import {
  loadStoredCommandDefinition as loadStoredCommandDefinitionApplicationCommandImpl,
  answerPrefixCommand as answerPrefixCommandApplicationCommandImpl,
  isSqliteReadonlyError as isSqliteReadonlyErrorApplicationCommandImpl,
  logCommandStoreWriteFailure as logCommandStoreWriteFailureApplicationCommandImpl,
  persistCommandDefinition as persistCommandDefinitionApplicationCommandImpl,
  persistLocalPrefixCommandDefinition as persistLocalPrefixCommandDefinitionApplicationCommandImpl,
  ensureCommandStoreWritable as ensureCommandStoreWritableApplicationCommandImpl,
  hydrateCommandDefinitions as hydrateCommandDefinitionsApplicationCommandImpl,
  assertCommandStudioEnabled as assertCommandStudioEnabledApplicationCommandImpl,
  fetchApplicationCommands as fetchApplicationCommandsApplicationCommandImpl,
  createApplicationCommand as createApplicationCommandApplicationCommandImpl,
  updateApplicationCommand as updateApplicationCommandApplicationCommandImpl,
  deleteApplicationCommand as deleteApplicationCommandApplicationCommandImpl,
} from "./bot-session-application-commands";

import {
  refreshGuild as refreshGuildImpl,
  syncForumPosts as syncForumPostsImpl,
  createForumPost as createForumPostImpl,
  updateGuildProfile as updateGuildProfileImpl,
  fetchGuildMembers as fetchGuildMembersImpl,
  fetchGuildRoles as fetchGuildRolesImpl,
  fetchGuildInvites as fetchGuildInvitesImpl,
  createGuildInvite as createGuildInviteImpl,
  deleteGuildInvite as deleteGuildInviteImpl,
  fetchGuildBans as fetchGuildBansImpl,
  createGuildBan as createGuildBanImpl,
  deleteGuildBan as deleteGuildBanImpl,
  publishGuildMembers as publishGuildMembersImpl,
  refreshGuildRoles as refreshGuildRolesImpl,
  rolePermissionsFromPayload as rolePermissionsFromPayloadImpl,
  rolePermissionBitsFromPayload as rolePermissionBitsFromPayloadImpl,
  resolveEditableGuildRole as resolveEditableGuildRoleImpl,
  createGuildRole as createGuildRoleImpl,
  updateGuildRole as updateGuildRoleImpl,
  updateGuildRolePermissions as updateGuildRolePermissionsImpl,
  deleteGuildRole as deleteGuildRoleImpl,
  moveGuildChannel as moveGuildChannelImpl,
  createGuildCategory as createGuildCategoryImpl,
  deleteGuildChannel as deleteGuildChannelImpl,
  recreatePurgeGuildChannel as recreatePurgeGuildChannelImpl,
  deleteForumPost as deleteForumPostImpl,
  setForumPostArchived as setForumPostArchivedImpl,
  setForumPostLocked as setForumPostLockedImpl,
} from "./bot-session-guild-channels";

import {
  setPresence as setPresenceImpl,
  fetchUserProfile as fetchUserProfileImpl,
  fetchMemberProfile as fetchMemberProfileImpl,
  setMemberTimeout as setMemberTimeoutImpl,
  kickMember as kickMemberImpl,
  banMember as banMemberImpl,
  unbanMember as unbanMemberImpl,
  setMemberNickname as setMemberNicknameImpl,
  addMemberRole as addMemberRoleImpl,
  removeMemberRole as removeMemberRoleImpl,
  moveVoiceMember as moveVoiceMemberImpl,
  fetchGuildMember as fetchGuildMemberImpl,
  publishGuildRoles as publishGuildRolesImpl,
} from "./bot-session-members-presence";

import {
  persistGuildSnapshot as persistGuildSnapshotImpl,
  persistPresenceSnapshot as persistPresenceSnapshotImpl,
  persistUserSnapshotDirect as persistUserSnapshotDirectImpl,
  persistMessageSnapshot as persistMessageSnapshotImpl,
  persistMessagesSnapshot as persistMessagesSnapshotImpl,
  deleteGuildSnapshot as deleteGuildSnapshotImpl,
  deleteChannelSnapshot as deleteChannelSnapshotImpl,
  deleteMessageSnapshot as deleteMessageSnapshotImpl,
} from "./bot-session-persistence";

import { attachHandlers as attachHandlersImpl } from "./bot-session-event-handlers";
import type { BotSessionContext } from "./bot-session-context";
import {
  startBotSessionLifecycle,
  stopBotSessionLifecycle,
  type BotSessionLifecycleContext,
} from "./bot-session-lifecycle";


type StoredWelcomeConfig = {
  guildId: string;
  channelId: string;
  messageType: string;
  messageTemplate: string;
  embedPagesJson: string | null;
  enabled: boolean;
};

type StoredGoodbyeConfig = StoredWelcomeConfig;

// Session = bot connecté + mémoire.
export class BotSession {
  public readonly client: Client;
  public status: BotAccountSummary["status"] = "connecting";
  public lastError: string | null = null;
  private state: WorkspaceState = createWorkspaceState();

  private readonly messageCache = new Map<string, MessageSummary[]>();
  private readonly voiceCache = new Map<string, VoiceStateSummary[]>();
  private readonly modalPageCache = new Map<
    string,
    { expiresAt: number; embeds: RuntimeEmbedPage[] }
  >();
  private readonly messageEmbedPageCache = new Map<
    string,
    MessageEmbedPageCacheEntry
  >();
  private actionQueue: Promise<unknown> = Promise.resolve();
  private queuedActionCount = 0;
  private runningActionCount = 0;
  private warmupPromise: Promise<void> | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: unknown) => void) | null = null;
  private readonly welcomeConfigsByGuild = new Map<
    string,
    StoredWelcomeConfig
  >();
  private readonly goodbyeConfigsByGuild = new Map<
    string,
    StoredGoodbyeConfig
  >();
  private readonly logConfigsByGuild = new Map<string, StoredLogConfig>();
  private readonly roleAutomationRulesByGuild = new Map<
    string,
    StoredRoleAutomationRule[]
  >();
  private readonly liveVoiceSessions = new Map<
    string,
    { guildId: string; userId: string; channelId: string; startedAt: number }
  >();
  private readonly recentModerationLogs = new Map<string, number>();
  private readonly recentChannelRecreateDeletes = new Map<string, number>();
  private readonly recentChannelRecreateCreates = new Map<string, { expiresAt: number; name: string; parentId: string; type: string }>();
  private roleAutomationTimer: NodeJS.Timeout | null = null;


  private rememberChannelRecreateDelete(channelId: string): void {
    rememberChannelRecreateDeleteCache(this.recentChannelRecreateDeletes, channelId);
  }

  private consumeChannelRecreateDelete(channelId: string): boolean {
    return consumeChannelRecreateDeleteCache(this.recentChannelRecreateDeletes, channelId);
  }

  private rememberChannelRecreateCreate(guildId: string, snapshot: { name: string; parentId: string | null; type: string }): void {
    rememberChannelRecreateCreateCache(this.recentChannelRecreateCreates, guildId, snapshot);
  }

  private consumeChannelRecreateCreate(channel: { guildId?: string | null; name?: string; parentId?: string | null; type?: unknown }): boolean {
    return consumeChannelRecreateCreateCache(this.recentChannelRecreateCreates, channel);
  }

  private createModalPageCache(embeds: RuntimeEmbedPage[]): string {
    return createModalPageCacheEntry(this.modalPageCache, embeds);
  }

  private modalResponsePayload(response: RuntimeModalResponse, values: Record<string, string>, pageIndex = 0) {
    return modalResponsePayloadFromCache(this.modalPageCache, response, values, pageIndex);
  }

  private createMessageEmbedPageCache(content: string, embeds: Record<string, unknown>[]): string {
    return createMessageEmbedPageCacheEntry(this.messageEmbedPageCache, content, embeds);
  }

  private cacheWelcomeConfig(config: StoredWelcomeConfig): void {
    return cacheWelcomeConfigImpl.call(this as unknown as BotSessionContext, config);
  }

  private async loadWelcomeConfigs(): Promise<void> {
    return loadWelcomeConfigsImpl.call(this as unknown as BotSessionContext);
  }

  private async saveWelcomeConfig(
    guildId: string,
    channelId: string,
    messageType: "message" | "embed",
    messageTemplate: string,
    embedPagesJson: string | null,
  ): Promise<void> {
    return saveWelcomeConfigImpl.call(this as unknown as BotSessionContext, guildId, channelId, messageType, messageTemplate, embedPagesJson);
  }

  private async removeWelcomeConfig(
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void> {
    return removeWelcomeConfigImpl.call(this as unknown as BotSessionContext, guildId, reason, channelId);
  }

  private async loadWelcomeConfig(
    guildId: string,
    force = false,
  ): Promise<StoredWelcomeConfig | null> {
    return loadWelcomeConfigImpl.call(this as unknown as BotSessionContext, guildId, force);
  }

  private guildAutomationConfig(guildId: string): GuildAutomationConfig {
    return guildAutomationConfigImpl.call(this as unknown as BotSessionContext, guildId);
  }

  private async publishGuildAutomationConfig(guildId: string): Promise<void> {
    return publishGuildAutomationConfigImpl.call(this as unknown as BotSessionContext, guildId);
  }

  public async syncGuildAutomationConfig(guildId: string): Promise<void> {
    return syncGuildAutomationConfigImpl.call(this as unknown as BotSessionContext, guildId);
  }

  private parseAutomationEmbedPagesJson(
    value: string | null | undefined,
  ): string | null {
    return parseAutomationEmbedPagesJsonImpl.call(this as unknown as BotSessionContext, value);
  }

  private channelSendBlockReason(
    channel: unknown,
    guild: Guild | null | undefined,
    embed = false,
  ): string | null {
    return channelSendBlockReasonImpl.call(this as unknown as BotSessionContext, channel, guild, embed);
  }

  private async resolveAutomationChannel(
    guildId: string,
    channelId: string,
    embed = false,
  ): Promise<void> {
    return resolveAutomationChannelImpl.call(this as unknown as BotSessionContext, guildId, channelId, embed);
  }

  public async updateGuildAutomationConfig(args: {
    guildId: string;
    kind: GuildAutomationKind;
    channelId: string;
    messageType?: GuildAutomationMessageType;
    messageTemplate?: string;
    embedPagesJson?: string | null;
    eventConfigsJson?: string | null;
  }): Promise<void> {
    return updateGuildAutomationConfigImpl.call(this as unknown as BotSessionContext, args);
  }

  public async removeGuildAutomationConfig(
    guildId: string,
    kind: GuildAutomationKind,
  ): Promise<void> {
    return removeGuildAutomationConfigImpl.call(this as unknown as BotSessionContext, guildId, kind);
  }

  private automationTestValues(
    guild: Guild,
    kind: "welcome" | "goodbye",
  ): Record<string, string> {
    return automationTestValuesImpl.call(this as unknown as BotSessionContext, guild, kind);
  }

  public async testGuildAutomationConfig(
    guildId: string,
    kind: GuildAutomationKind,
  ): Promise<void> {
    return testGuildAutomationConfigImpl.call(this as unknown as BotSessionContext, guildId, kind);
  }

  private cacheGoodbyeConfig(config: StoredGoodbyeConfig): void {
    return cacheGoodbyeConfigImpl.call(this as unknown as BotSessionContext, config);
  }

  private async loadGoodbyeConfigs(): Promise<void> {
    return loadGoodbyeConfigsImpl.call(this as unknown as BotSessionContext);
  }

  private async saveGoodbyeConfig(
    guildId: string,
    channelId: string,
    messageType: "message" | "embed",
    messageTemplate: string,
    embedPagesJson: string | null,
  ): Promise<void> {
    return saveGoodbyeConfigImpl.call(this as unknown as BotSessionContext, guildId, channelId, messageType, messageTemplate, embedPagesJson);
  }

  private async removeGoodbyeConfig(
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void> {
    return removeGoodbyeConfigImpl.call(this as unknown as BotSessionContext, guildId, reason, channelId);
  }

  private async loadGoodbyeConfig(
    guildId: string,
    force = false,
  ): Promise<StoredGoodbyeConfig | null> {
    return loadGoodbyeConfigImpl.call(this as unknown as BotSessionContext, guildId, force);
  }

  private cacheLogConfig(config: StoredLogConfig): void {
    return cacheLogConfigImpl.call(this as unknown as BotSessionContext, config);
  }

  private async loadLogConfigs(): Promise<void> {
    return loadLogConfigsImpl.call(this as unknown as BotSessionContext);
  }

  private async saveLogConfig(
    guildId: string,
    channelId: string,
    eventConfigsJson: string | null,
  ): Promise<void> {
    return saveLogConfigImpl.call(this as unknown as BotSessionContext, guildId, channelId, eventConfigsJson);
  }

  private async removeLogConfig(
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void> {
    return removeLogConfigImpl.call(this as unknown as BotSessionContext, guildId, reason, channelId);
  }

  private async loadLogConfig(
    guildId: string,
    force = false,
  ): Promise<StoredLogConfig | null> {
    return loadLogConfigImpl.call(this as unknown as BotSessionContext, guildId, force);
  }

  private roleAutomationRuleToConfig(
    rule: StoredRoleAutomationRule,
  ): GuildRoleAutomationRuleConfig {
    return roleAutomationRuleToConfigImpl.call(this as unknown as BotSessionContext, rule);
  }

  private cacheRoleAutomationRules(
    guildId: string,
    rules: StoredRoleAutomationRule[],
  ): void {
    return cacheRoleAutomationRulesImpl.call(this as unknown as BotSessionContext, guildId, rules);
  }

  private async repairRoleAutomationRuleStorage(
    guildId?: string,
  ): Promise<void> {
    return repairRoleAutomationRuleStorageImpl.call(this as unknown as BotSessionContext, guildId);
  }

  private async loadRoleAutomationRules(
    guildId?: string,
    force = false,
  ): Promise<StoredRoleAutomationRule[]> {
    return loadRoleAutomationRulesImpl.call(this as unknown as BotSessionContext, guildId, force);
  }

  private async resolveAssignableRole(
    guildId: string,
    roleId: string,
  ): Promise<Role> {
    return resolveAssignableRoleImpl.call(this as unknown as BotSessionContext, guildId, roleId);
  }

  private normalizeRoleAutomationInput(
    input: RoleAutomationRuleInput,
  ): RoleAutomationRuleInput {
    return normalizeRoleAutomationInputImpl.call(this as unknown as BotSessionContext, input);
  }

  public async upsertGuildRoleAutomationRule(
    guildId: string,
    input: RoleAutomationRuleInput,
  ): Promise<void> {
    return upsertGuildRoleAutomationRuleImpl.call(this as unknown as BotSessionContext, guildId, input);
  }

  public async deleteGuildRoleAutomationRule(
    guildId: string,
    ruleId: string,
  ): Promise<void> {
    return deleteGuildRoleAutomationRuleImpl.call(this as unknown as BotSessionContext, guildId, ruleId);
  }

  private async getMemberActivity(
    guildId: string,
    userId: string,
  ): Promise<StoredMemberActivity | null> {
    return getMemberActivityImpl.call(this as unknown as BotSessionContext, guildId, userId);
  }

  private async upsertMemberActivity(
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
    return upsertMemberActivityImpl.call(this as unknown as BotSessionContext, guildId, userId, patch);
  }

  private roleAutomationConditions(
    rule: StoredRoleAutomationRule,
    member: GuildMember,
    activity: StoredMemberActivity | null,
  ): boolean[] {
    return roleAutomationConditionsImpl.call(this as unknown as BotSessionContext, rule, member, activity);
  }

  private roleAutomationRuleMatches(
    rule: StoredRoleAutomationRule,
    member: GuildMember,
    activity: StoredMemberActivity | null,
  ): boolean {
    return roleAutomationRuleMatchesImpl.call(this as unknown as BotSessionContext, rule, member, activity);
  }

  private async applyRoleAutomationRule(
    member: GuildMember,
    rule: StoredRoleAutomationRule,
  ): Promise<boolean> {
    return applyRoleAutomationRuleImpl.call(this as unknown as BotSessionContext, member, rule);
  }

  private async evaluateRoleAutomationForMember(
    member: GuildMember,
    reason: string,
  ): Promise<void> {
    return evaluateRoleAutomationForMemberImpl.call(this as unknown as BotSessionContext, member, reason);
  }

  public async syncGuildRoleAutomation(guildId: string): Promise<void> {
    return syncGuildRoleAutomationImpl.call(this as unknown as BotSessionContext, guildId);
  }

  public async testGuildRoleAutomation(
    guildId: string,
    ruleId?: string | null,
  ): Promise<void> {
    return testGuildRoleAutomationImpl.call(this as unknown as BotSessionContext, guildId, ruleId);
  }

  private async recordGuildMessageActivity(message: Message): Promise<void> {
    return recordGuildMessageActivityImpl.call(this as unknown as BotSessionContext, message);
  }

  private async startVoiceSession(
    guildId: string,
    userId: string,
    channelId: string,
  ): Promise<void> {
    return startVoiceSessionImpl.call(this as unknown as BotSessionContext, guildId, userId, channelId);
  }

  private async closeVoiceSession(
    guildId: string,
    userId: string,
  ): Promise<number> {
    return closeVoiceSessionImpl.call(this as unknown as BotSessionContext, guildId, userId);
  }

  private async flushLiveVoiceSessionsForGuild(guildId: string): Promise<void> {
    return flushLiveVoiceSessionsForGuildImpl.call(this as unknown as BotSessionContext, guildId);
  }

  private async handleVoiceAutomation(
    oldGuildId: string | null,
    oldUserId: string | null,
    oldChannelId: string | null,
    newMember: GuildMember | null,
    newGuildId: string | null,
    newUserId: string | null,
    newChannelId: string | null,
  ): Promise<void> {
    return handleVoiceAutomationImpl.call(this as unknown as BotSessionContext, oldGuildId, oldUserId, oldChannelId, newMember, newGuildId, newUserId, newChannelId);
  }

  private startRoleAutomationScheduler(): void {
    return startRoleAutomationSchedulerImpl.call(this as unknown as BotSessionContext);
  }

  private defaultLogEventConfigs(
    mode: "message" | "embed" = "message",
  ): Record<LogEventKey, LogEventConfig> {
    return defaultLogEventConfigsImpl.call(this as unknown as BotSessionContext, mode);
  }

  private normalizeLogEmbedPages(
    key: LogEventKey,
    rawPages: unknown,
    fallbackContent: string,
  ): RuntimeEmbedPage[] {
    return normalizeLogEmbedPagesImpl.call(this as unknown as BotSessionContext, key, rawPages, fallbackContent);
  }

  private normalizeLogEventConfigs(
    value: unknown,
    mode: "message" | "embed" = "message",
  ): Record<LogEventKey, LogEventConfig> {
    return normalizeLogEventConfigsImpl.call(this as unknown as BotSessionContext, value, mode);
  }

  private readLogEventConfigs(
    config: StoredLogConfig | null | undefined,
  ): Record<LogEventKey, LogEventConfig> {
    return readLogEventConfigsImpl.call(this as unknown as BotSessionContext, config);
  }

  private logSetupTemplateValues(
    interaction: ChatInputCommandInteraction,
    channelId: string,
  ): Record<string, string> {
    return logSetupTemplateValuesImpl.call(this as unknown as BotSessionContext, interaction, channelId);
  }

  private runtimeLogSetConfirmation(
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): string {
    return runtimeLogSetConfirmationImpl.call(this as unknown as BotSessionContext, runtime, values);
  }

  private runtimeLogRemoveConfirmation(
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): string {
    return runtimeLogRemoveConfirmationImpl.call(this as unknown as BotSessionContext, runtime, values);
  }

  private async handleLogsSetupInteraction(
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    return handleLogsSetupInteractionImpl.call(this as unknown as BotSessionContext, interaction, runtime);
  }

  private formatRoleAutomationRule(
    rule: StoredRoleAutomationRule,
    guild: Guild,
  ): string {
    return formatRoleAutomationRuleImpl.call(this as unknown as BotSessionContext, rule, guild);
  }

  private async handleRoleAutomationInteraction(
    interaction: Interaction,
    _runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    return handleRoleAutomationInteractionImpl.call(this as unknown as BotSessionContext, interaction, _runtime);
  }

  private moderationTemplateValues(
    guild: Guild,
    actor: User | null | undefined,
    target: ModerationTarget | null | undefined,
    action: ModerationAction,
    reason?: string | null,
  ): Record<string, string> {
    return moderationTemplateValuesImpl.call(this as unknown as BotSessionContext, guild, actor, target, action, reason);
  }

  private rememberModerationLog(
    guildId: string,
    action: "ban" | "unban" | "kick",
    userId: string,
  ): void {
    return rememberModerationLogImpl.call(this as unknown as BotSessionContext, guildId, action, userId);
  }

  private consumeRecentModerationLog(
    guildId: string,
    action: "ban" | "unban" | "kick",
    userId: string,
  ): boolean {
    return consumeRecentModerationLogImpl.call(this as unknown as BotSessionContext, guildId, action, userId);
  }

  private async sendModerationLog(
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
    return sendModerationLogImpl.call(this as unknown as BotSessionContext, guild, action, actor, target, reason);
  }

  private async replyModerationResult(
    interaction: ChatInputCommandInteraction,
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): Promise<void> {
    return replyModerationResultImpl.call(this as unknown as BotSessionContext, interaction, runtime, values);
  }

  private async handleModerationCommandInteraction(
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    return handleModerationCommandInteractionImpl.call(this as unknown as BotSessionContext, interaction, runtime);
  }

  private async handleChannelRecreatePurgeInteraction(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    return handleChannelRecreatePurgeInteractionImpl.call(this as unknown as BotSessionContext, interaction);
  }

  private async fetchAuditExecutor(
    guild: Guild,
    action: AuditLogEvent,
    targetId?: string | null,
  ): Promise<User | null> {
    return fetchAuditExecutorImpl.call(this as unknown as BotSessionContext, guild, action, targetId);
  }

  private shortText(value: unknown, fallback = "∅", max = 900): string {
    return shortTextImpl.call(this as unknown as BotSessionContext, value, fallback, max);
  }

  private userValues(
    prefix: string,
    user: User | null | undefined,
  ): Record<string, string> {
    return userValuesImpl.call(this as unknown as BotSessionContext, prefix, user);
  }

  private baseLogValues(
    guild: Guild,
    key: LogEventKey,
    actor?: User | null,
  ): Record<string, string> {
    return baseLogValuesImpl.call(this as unknown as BotSessionContext, guild, key, actor);
  }

  private channelValues(
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
    return channelValuesImpl.call(this as unknown as BotSessionContext, channel);
  }

  private async sendDiscordLog(payload: LogEventPayload): Promise<void> {
    return sendDiscordLogImpl.call(this as unknown as BotSessionContext, payload);
  }

  private welcomeSetupTemplateValues(
    interaction: ChatInputCommandInteraction,
    channelId: string,
  ): Record<string, string> {
    return welcomeSetupTemplateValuesImpl.call(this as unknown as BotSessionContext, interaction, channelId);
  }

  private async handleWelcomeSetupInteraction(
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    return handleWelcomeSetupInteractionImpl.call(this as unknown as BotSessionContext, interaction, runtime);
  }

  private async sendWelcomeMessage(member: GuildMember): Promise<void> {
    return sendWelcomeMessageImpl.call(this as unknown as BotSessionContext, member);
  }

  private async handleGoodbyeSetupInteraction(
    interaction: Interaction,
    runtime: ApplicationCommandRuntimeDefinition,
  ): Promise<void> {
    return handleGoodbyeSetupInteractionImpl.call(this as unknown as BotSessionContext, interaction, runtime);
  }

  private goodbyeTemplateValuesForMember(
    member: GuildMember | PartialGuildMember,
  ): Record<string, string> {
    return goodbyeTemplateValuesForMemberImpl.call(this as unknown as BotSessionContext, member);
  }

  private async sendGoodbyeMessage(
    member: GuildMember | PartialGuildMember,
  ): Promise<void> {
    return sendGoodbyeMessageImpl.call(this as unknown as BotSessionContext, member);
  }

  constructor(
    public readonly account: BotAccountRow,
    private readonly keyResolver: () => Buffer | null,
    private readonly publish: (event: ClientEvent) => void,
    private readonly updateAccount: (
      accountId: string,
      patch: BotAccountUpdatePatch,
    ) => Promise<void>,
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
      ],
    });
  }

  private publishEvent(event: ClientEvent): void {
    this.state = applyWorkspaceEvent(this.state, event);
    this.publish(event);
  }

  private publishQueueEvent(
    actionId: string,
    label: string,
    status: "queued" | "running" | "completed" | "failed",
    message?: string | null,
  ): void {
    this.publishEvent({
      type: "sync.queue",
      botId: this.account.id,
      actionId,
      label,
      status,
      pending: Math.max(0, this.queuedActionCount),
      running: Math.max(0, this.runningActionCount),
      message: message ?? null,
      updatedAt: now(),
    });
  }

  private setMessageCache(channelId: string, messages: MessageSummary[]): void {
    if (!channelId) return;
    const next = clamp(messages, MESSAGE_CACHE_PER_CHANNEL_LIMIT);
    this.messageCache.set(channelId, next);
    const keys = [...this.messageCache.keys()];
    if (keys.length > MESSAGE_CACHE_CHANNEL_LIMIT) {
      for (const key of keys.slice(
        0,
        keys.length - MESSAGE_CACHE_CHANNEL_LIMIT,
      )) {
        this.messageCache.delete(key);
      }
    }
  }

  private updateMessageCache(
    channelId: string,
    updater: (current: MessageSummary[]) => MessageSummary[],
  ): void {
    const current = this.messageCache.get(channelId) ?? [];
    this.setMessageCache(channelId, updater(current));
  }

  private upsertMessageSummary(summary: MessageSummary): void {
    this.updateMessageCache(summary.channelId, (current) =>
      current.some((item) => item.id === summary.id)
        ? current.map((item) => (item.id === summary.id ? summary : item))
        : [...current, summary],
    );
  }

  private async publishEphemeralInteractionReply(
    interaction: Interaction,
    ephemeral: boolean,
  ): Promise<void> {
    const message = await fetchInteractionReplyMessage(interaction).catch(
      () => null,
    );
    if (!message) return;
    const summary = {
      ...normalizeMessage(message),
      ephemeral: ephemeral || messageIsEphemeral(message),
    };
    this.upsertMessageSummary(summary);
    await this.persistMessageSnapshot(message).catch(() => undefined);
    this.publishEvent({ type: "message.updated", message: summary });
  }

  private isForumLikeChannel(
    channel: unknown,
  ): channel is { id: string; type: ChannelType; threads: unknown } {
    if (
      !channel ||
      typeof channel !== "object" ||
      !("type" in channel) ||
      !("threads" in channel)
    )
      return false;
    const type = (channel as { type: ChannelType }).type;
    return type === ChannelType.GuildForum || type === ChannelType.GuildMedia;
  }

  private async forumIdForThread(thread: {
    parentId: string | null;
    parent?: unknown;
    guild?: { channels?: { fetch?: (id: string) => Promise<unknown> } };
  }): Promise<string | null> {
    if (!thread.parentId) return null;
    if (this.isForumLikeChannel(thread.parent)) return thread.parentId;
    const parent = await thread.guild?.channels
      ?.fetch?.(thread.parentId)
      .catch(() => null);
    return this.isForumLikeChannel(parent) ? thread.parentId : null;
  }

  public hydrate(state: WorkspaceState): void {
    this.state = state;
    for (const [channelId, messages] of Object.entries(
      state.messagesByChannel,
    )) {
      this.setMessageCache(channelId, messages);
    }
  }

  public snapshot(): WorkspaceState {
    return this.state;
  }

  public async refreshWorkspace(): Promise<void> {
    if (this.status !== "online") return;
    await this.refreshDiscordState();
  }

  public async start(): Promise<void> {
    return startBotSessionLifecycle(this as unknown as BotSessionLifecycleContext);
  }

  public async stop(): Promise<void> {
    return stopBotSessionLifecycle(this as unknown as BotSessionLifecycleContext);
  }

  public enqueueAction<T>(label: string, action: () => Promise<T>): Promise<T> {
    const actionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.queuedActionCount += 1;
    this.publishQueueEvent(actionId, label, "queued");

    const run = async () => {
      this.queuedActionCount = Math.max(0, this.queuedActionCount - 1);
      this.runningActionCount += 1;
      this.publishQueueEvent(actionId, label, "running");
      let lastError: unknown;
      try {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const result = await action();
            await delay(180);
            this.publishQueueEvent(actionId, label, "completed");
            return result;
          } catch (error) {
            lastError = error;
            const normalized = normalizeDiscordError(error, label);
            if (!normalized.retryable || attempt === 3) break;
            await delay(500 * attempt);
          }
        }
        const normalized = normalizeDiscordError(lastError, label);
        this.publishQueueEvent(
          actionId,
          label,
          "failed",
          `${normalized.userMessage} (${normalized.code})`,
        );
        throw lastError;
      } finally {
        this.runningActionCount = Math.max(0, this.runningActionCount - 1);
      }
    };

    const queued = this.actionQueue.then(run, run);
    this.actionQueue = queued.catch((error) => {
      const normalized = normalizeDiscordError(error, label);
      this.publishEvent({
        type: "audit.log",
        level: normalized.retryable ? "warn" : "error",
        message: "Queued Discord action failed.",
        context: {
          botId: this.account.id,
          botName: this.account.name,
          action: label,
          errorCode: normalized.code,
          error: normalized.userMessage,
          technicalError: normalized.technicalMessage,
        },
      });
    });
    return queued;
  }
  private attachHandlers(): void
  {
    return attachHandlersImpl.call(this as unknown as BotSessionContext);
  }


  private async refreshDiscordState(): Promise<void> {
    await this.client.guilds.fetch().catch(() => undefined);
    const guildCollection = this.client.guilds.cache;
    const retainedDmChannels = this.state.channelsByGuild[DM_GUILD_ID] ?? [];
    this.state = {
      ...createWorkspaceState({
        connected: this.state.connected,
        botClientId: this.state.botClientId,
        selectedBotId: this.state.selectedBotId,
        selectedGuildId: this.state.selectedGuildId,
        selectedChannelId: this.state.selectedChannelId,
        lastSyncAt: this.state.lastSyncAt,
        bots: this.state.bots,
        messagesByChannel: this.state.messagesByChannel,
        pinnedMessagesByChannel: this.state.pinnedMessagesByChannel,
        usersById: this.state.usersById,
        rolesByGuildId: this.state.rolesByGuildId,
        guildAutomationConfigsByGuildId:
          this.state.guildAutomationConfigsByGuildId,
        memberProfilesByKey: this.state.memberProfilesByKey,
        presencesByUserId: this.state.presencesByUserId,
        voiceByGuildId: this.state.voiceByGuildId,
        logs: this.state.logs,
      }),
      channelsByGuild: retainedDmChannels.length
        ? { [DM_GUILD_ID]: retainedDmChannels }
        : {},
      guilds: [],
    };

    const guilds = Array.from(guildCollection.values()).map(normalizeGuild);
    this.publishEvent({ type: "state.guilds", guilds });

    const syncResults: { channelCount: number; userIds: string[] }[] = [];
    await runWithConcurrency(
      Array.from(guildCollection.values()),
      WARMUP_GUILD_CONCURRENCY,
      async (guild) => {
        syncResults.push(await this.refreshGuild(guild));
      },
    );

    const channelTotal = syncResults.reduce(
      (total, result) => total + result.channelCount,
      0,
    );
    const userTotal = new Set(syncResults.flatMap((result) => result.userIds))
      .size;
    if (!guilds.length) {
      this.publishEvent({
        type: "audit.log",
        level: "warn",
        message: "No guilds were returned by Discord for this bot session.",
        context: {
          botId: this.account.id,
          botName: this.account.name,
        },
      });
    }
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: `Workspace synced: ${guilds.length} server${guilds.length === 1 ? "" : "s"} / ${channelTotal} channel${channelTotal === 1 ? "" : "s"}.`,
      context: {
        botId: this.account.id,
        botName: this.account.name,
        guildCount: guilds.length,
        channelCount: channelTotal,
      },
    });
    this.publishEvent({
      type: "workspace.ready",
      botId: this.account.id,
      readyAt: now(),
      guildIds: guilds.map((guild) => guild.id),
      guildCount: guilds.length,
      channelCount: channelTotal,
      userCount: userTotal,
    });
  }

  private startWarmup(): void {
    if (this.warmupPromise) return;
    this.warmupPromise = this.warmupWorkspace().finally(() => {
      this.warmupPromise = null;
    });
  }

  private async warmupWorkspace(): Promise<void> {
    const guilds = Array.from(this.client.guilds.cache.values());
    const channels = guilds.flatMap((guild) =>
      Array.from(guild.channels.cache.values())
        .filter(
          (channel): channel is GuildBasedChannel =>
            isGuildBasedChannel(channel) && channel.isTextBased(),
        )
        .sort(compareGuildChannels),
    );

    if (!channels.length) return;
    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: `Background warmup started for ${channels.length} text channel${channels.length === 1 ? "" : "s"}.`,
      context: {
        botId: this.account.id,
        botName: this.account.name,
        channelCount: channels.length,
      },
    });

    let syncedCount = 0;
    await runWithConcurrency(
      channels,
      WARMUP_CHANNEL_CONCURRENCY,
      async (channel) => {
        try {
          await this.syncChannelHistory(channel.id, WARMUP_HISTORY_LIMIT);
          syncedCount += 1;
        } catch (error) {
          this.publishEvent({
            type: "audit.log",
            level: "warn",
            message: `Could not warm #${channel.name}.`,
            context: {
              botId: this.account.id,
              botName: this.account.name,
              guildId: channel.guildId,
              channelId: channel.id,
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown channel warmup failure",
            },
          });
        }
      },
    );

    this.publishEvent({
      type: "audit.log",
      level: "info",
      message: `Background warmup finished: ${syncedCount}/${channels.length} channel${channels.length === 1 ? "" : "s"}.`,
      context: {
        botId: this.account.id,
        botName: this.account.name,
        channelCount: channels.length,
        syncedCount,
      },
    });
  }
  private async refreshGuild(
    guild: Guild,
  ): Promise<{ channelCount: number; userIds: string[] }>
  {
    return refreshGuildImpl.call(this as unknown as BotSessionContext, guild);
  }

  public async syncForumPosts(
    forumId: string,
    includeArchived = true,
  ): Promise<void>
  {
    return syncForumPostsImpl.call(this as unknown as BotSessionContext, forumId, includeArchived);
  }

  public async createForumPost(
    forumId: string,
    title: string,
    content: string,
    tagIds: string[] = [],
  ): Promise<void>
  {
    return createForumPostImpl.call(this as unknown as BotSessionContext, forumId, title, content, tagIds);
  }

  public async updateGuildProfile(
    guildId: string,
    patch: {
      name?: string;
      description?: string | null;
      iconDataUrl?: string | null;
    },
  ): Promise<void>
  {
    return updateGuildProfileImpl.call(this as unknown as BotSessionContext, guildId, patch);
  }

  public async fetchGuildMembers(guildId: string): Promise<void>
  {
    return fetchGuildMembersImpl.call(this as unknown as BotSessionContext, guildId);
  }

  public async fetchGuildRoles(guildId: string): Promise<void>
  {
    return fetchGuildRolesImpl.call(this as unknown as BotSessionContext, guildId);
  }

  public async fetchGuildInvites(guildId: string): Promise<void>
  {
    return fetchGuildInvitesImpl.call(this as unknown as BotSessionContext, guildId);
  }

  public async createGuildInvite(
    guildId: string,
    channelId: string,
    options: { maxAge?: number; maxUses?: number; temporary?: boolean; unique?: boolean; reason?: string } = {},
  ): Promise<void>
  {
    return createGuildInviteImpl.call(this as unknown as BotSessionContext, guildId, channelId, options);
  }

  public async deleteGuildInvite(guildId: string, code: string): Promise<void>
  {
    return deleteGuildInviteImpl.call(this as unknown as BotSessionContext, guildId, code);
  }

  public async fetchGuildBans(guildId: string): Promise<void> { return fetchGuildBansImpl.call(this as unknown as BotSessionContext, guildId); }

  public async createGuildBan(guildId: string, userId: string, options: { reason?: string; deleteMessageSeconds?: number } = {}): Promise<void> { return createGuildBanImpl.call(this as unknown as BotSessionContext, guildId, userId, options); }

  public async deleteGuildBan(guildId: string, userId: string, reason?: string): Promise<void> { return deleteGuildBanImpl.call(this as unknown as BotSessionContext, guildId, userId, reason); }


  private async publishGuildMembers(guildId: string): Promise<void>
  {
    return publishGuildMembersImpl.call(this as unknown as BotSessionContext, guildId);
  }

  private async refreshGuildRoles(guild: Guild): Promise<void>
  {
    return refreshGuildRolesImpl.call(this as unknown as BotSessionContext, guild);
  }

  private rolePermissionsFromPayload(
    value?: string | null,
  ): PermissionsBitField | undefined
  {
    return rolePermissionsFromPayloadImpl.call(this as unknown as BotSessionContext, value);
  }

  private rolePermissionBitsFromPayload(value: string): bigint
  {
    return rolePermissionBitsFromPayloadImpl.call(this as unknown as BotSessionContext, value);
  }

  private async resolveEditableGuildRole(
    guildId: string,
    roleId: string,
  ): Promise<{ guild: Guild; role: Role }>
  {
    return resolveEditableGuildRoleImpl.call(this as unknown as BotSessionContext, guildId, roleId);
  }

  public async createGuildRole(
    guildId: string,
    payload: {
      name: string;
      color?: string | null;
      permissions?: string;
      hoist?: boolean;
      mentionable?: boolean;
    },
  ): Promise<void>
  {
    return createGuildRoleImpl.call(this as unknown as BotSessionContext, guildId, payload);
  }

  public async updateGuildRole(
    guildId: string,
    roleId: string,
    payload: {
      name?: string;
      color?: string | null;
      permissions?: string;
      hoist?: boolean;
      mentionable?: boolean;
    },
  ): Promise<void>
  {
    return updateGuildRoleImpl.call(this as unknown as BotSessionContext, guildId, roleId, payload);
  }

  public async updateGuildRolePermissions(
    guildId: string,
    roleId: string,
    permissions: string,
  ): Promise<void>
  {
    return updateGuildRolePermissionsImpl.call(this as unknown as BotSessionContext, guildId, roleId, permissions);
  }

  public async deleteGuildRole(guildId: string, roleId: string): Promise<void>
  {
    return deleteGuildRoleImpl.call(this as unknown as BotSessionContext, guildId, roleId);
  }

  public async moveGuildChannel(
    guildId: string,
    channelId: string,
    targetId: string | null,
    placement: "before" | "after" | "inside",
  ): Promise<void>
  {
    return moveGuildChannelImpl.call(this as unknown as BotSessionContext, guildId, channelId, targetId, placement);
  }

  public async createGuildCategory(
    guildId: string,
    name: string,
  ): Promise<void>
  {
    return createGuildCategoryImpl.call(this as unknown as BotSessionContext, guildId, name);
  }

  public async deleteGuildChannel(
    guildId: string,
    channelId: string,
  ): Promise<void>
  {
    return deleteGuildChannelImpl.call(this as unknown as BotSessionContext, guildId, channelId);
  }

  public async recreatePurgeGuildChannel(
    guildId: string,
    channelId: string,
    options: { reason?: string; transcript?: boolean; finishMessage?: boolean; confirmation?: string; executorId?: string | null } = {},
  ): Promise<void>
  {
    return recreatePurgeGuildChannelImpl.call(this as unknown as BotSessionContext, guildId, channelId, options);
  }

  public async deleteForumPost(threadId: string): Promise<void>
  {
    return deleteForumPostImpl.call(this as unknown as BotSessionContext, threadId);
  }

  public async setForumPostArchived(
    threadId: string,
    archived: boolean,
  ): Promise<void>
  {
    return setForumPostArchivedImpl.call(this as unknown as BotSessionContext, threadId, archived);
  }

  public async setForumPostLocked(
    threadId: string,
    locked: boolean,
  ): Promise<void>
  {
    return setForumPostLockedImpl.call(this as unknown as BotSessionContext, threadId, locked);
  }


  public async syncChannelHistory(
    channelId: string,
    limit = 50,
  ): Promise<void> {
    return syncChannelHistoryImpl.call(this as unknown as BotSessionContext, channelId, limit);
  }

  public async syncChannelPins(channelId: string): Promise<void> {
    return syncChannelPinsImpl.call(this as unknown as BotSessionContext, channelId);
  }

  public async syncMessageContext(
    channelId: string,
    messageId: string,
    limit = 80,
  ): Promise<void> {
    return syncMessageContextImpl.call(this as unknown as BotSessionContext, channelId, messageId, limit);
  }

  public async openDirectThread(userId: string, limit = 50): Promise<void> {
    return openDirectThreadImpl.call(this as unknown as BotSessionContext, userId, limit);
  }

  private publishDirectThread(message: Message): void {
    return publishDirectThreadImpl.call(this as unknown as BotSessionContext, message);
  }

  public async sendMessage(
    channelId: string,
    content: string,
    replyToMessageId?: string,
    attachments: { filename: string; data: string }[] = [],
    embeds: EmbedPayload[] = [],
    embedPagination = false,
  ): Promise<void> {
    return sendMessageImpl.call(
      this as unknown as BotSessionContext,
      channelId,
      content,
      replyToMessageId,
      attachments,
      embeds,
      embedPagination,
    );
  }

  public async editMessage(
    channelId: string,
    messageId: string,
    content: string,
  ): Promise<void> {
    return editMessageImpl.call(this as unknown as BotSessionContext, channelId, messageId, content);
  }

  public async deleteMessage(
    channelId: string,
    messageId: string,
  ): Promise<void> {
    return deleteMessageImpl.call(this as unknown as BotSessionContext, channelId, messageId);
  }

  public async setMessagePinned(
    channelId: string,
    messageId: string,
    pinned: boolean,
  ): Promise<void> {
    return setMessagePinnedImpl.call(this as unknown as BotSessionContext, channelId, messageId, pinned);
  }

  public async reactToMessage(
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    return reactToMessageImpl.call(this as unknown as BotSessionContext, channelId, messageId, emoji);
  }

  public async unreactToMessage(
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<void> {
    return unreactToMessageImpl.call(this as unknown as BotSessionContext, channelId, messageId, emoji);
  }

  private async loadStoredCommandDefinition(
    commandId: string,
  ): Promise<{
    draft: ApplicationCommandDraft | null;
    runtime: ApplicationCommandRuntimeDefinition | null;
  } | null> {
    return loadStoredCommandDefinitionApplicationCommandImpl.call(this as unknown as BotSessionContext, commandId);
  }

  private async answerPrefixCommand(message: Message): Promise<void> {
    return answerPrefixCommandApplicationCommandImpl.call(this as unknown as BotSessionContext, message);
  }

  private isSqliteReadonlyError(error: unknown): boolean {
    return isSqliteReadonlyErrorApplicationCommandImpl.call(this as unknown as BotSessionContext, error);
  }

  private async logCommandStoreWriteFailure(error: unknown): Promise<void> {
    return logCommandStoreWriteFailureApplicationCommandImpl.call(this as unknown as BotSessionContext, error);
  }

  private async persistCommandDefinition(
    commandId: string,
    draft: ApplicationCommandDraft,
    summary: ApplicationCommandSummary,
  ): Promise<ApplicationCommandSummary> {
    return persistCommandDefinitionApplicationCommandImpl.call(this as unknown as BotSessionContext, commandId, draft, summary);
  }

  private async persistLocalPrefixCommandDefinition(
    draft: ApplicationCommandDraft,
    commandId?: string | null,
  ): Promise<ApplicationCommandSummary> {
    return persistLocalPrefixCommandDefinitionApplicationCommandImpl.call(this as unknown as BotSessionContext, draft, commandId);
  }

  private async ensureCommandStoreWritable(): Promise<void> {
    return ensureCommandStoreWritableApplicationCommandImpl.call(this as unknown as BotSessionContext);
  }

  private async hydrateCommandDefinitions(
    commands: ApplicationCommandSummary[],
  ): Promise<ApplicationCommandSummary[]> {
    return hydrateCommandDefinitionsApplicationCommandImpl.call(this as unknown as BotSessionContext, commands);
  }

  private assertCommandStudioEnabled(): void {
    return assertCommandStudioEnabledApplicationCommandImpl.call(this as unknown as BotSessionContext);
  }

  public async fetchApplicationCommands(
    guildId?: string | null,
    allGuilds = false,
  ): Promise<{
    globalCommands: ApplicationCommandSummary[];
    guildCommands: ApplicationCommandSummary[];
    partialError?: string | null;
  }> {
    return fetchApplicationCommandsApplicationCommandImpl.call(this as unknown as BotSessionContext, guildId, allGuilds);
  }

  public async createApplicationCommand(
    draft: ApplicationCommandDraft,
  ): Promise<ApplicationCommandSummary> {
    return createApplicationCommandApplicationCommandImpl.call(this as unknown as BotSessionContext, draft);
  }

  public async updateApplicationCommand(
    commandId: string,
    draft: ApplicationCommandDraft,
  ): Promise<ApplicationCommandSummary> {
    return updateApplicationCommandApplicationCommandImpl.call(this as unknown as BotSessionContext, commandId, draft);
  }

  public async deleteApplicationCommand(
    commandId: string,
    scope: ApplicationCommandScope,
    guildId?: string | null,
  ): Promise<void> {
    return deleteApplicationCommandApplicationCommandImpl.call(this as unknown as BotSessionContext, commandId, scope, guildId);
  }
  public async setPresence(
    status: "online" | "idle" | "dnd" | "offline",
    activityOrActivities?:
      | Extract<ClientCommand, { type: "presence.set" }>["activity"]
      | Extract<ClientCommand, { type: "presence.set" }>["activities"],
  ): Promise<void>
  {
    return setPresenceImpl.call(this as unknown as BotSessionContext, status, activityOrActivities);
  }

  public async fetchUserProfile(userId: string): Promise<void>
  {
    return fetchUserProfileImpl.call(this as unknown as BotSessionContext, userId);
  }

  public async fetchMemberProfile(
    guildId: string,
    userId: string,
  ): Promise<void>
  {
    return fetchMemberProfileImpl.call(this as unknown as BotSessionContext, guildId, userId);
  }

  public async setMemberTimeout(
    guildId: string,
    userId: string,
    until: string | null,
    reason?: string,
  ): Promise<void>
  {
    return setMemberTimeoutImpl.call(this as unknown as BotSessionContext, guildId, userId, until, reason);
  }

  public async kickMember(
    guildId: string,
    userId: string,
    reason?: string,
  ): Promise<void>
  {
    return kickMemberImpl.call(this as unknown as BotSessionContext, guildId, userId, reason);
  }

  public async banMember(
    guildId: string,
    userId: string,
    reason?: string,
    deleteMessageSeconds = 0,
  ): Promise<void>
  {
    return banMemberImpl.call(this as unknown as BotSessionContext, guildId, userId, reason, deleteMessageSeconds);
  }

  public async unbanMember(
    guildId: string,
    userId: string,
    reason?: string,
  ): Promise<void>
  {
    return unbanMemberImpl.call(this as unknown as BotSessionContext, guildId, userId, reason);
  }

  public async setMemberNickname(
    guildId: string,
    userId: string,
    nickname: string | null,
  ): Promise<void>
  {
    return setMemberNicknameImpl.call(this as unknown as BotSessionContext, guildId, userId, nickname);
  }

  public async addMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<void>
  {
    return addMemberRoleImpl.call(this as unknown as BotSessionContext, guildId, userId, roleId);
  }

  public async removeMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<void>
  {
    return removeMemberRoleImpl.call(this as unknown as BotSessionContext, guildId, userId, roleId);
  }

  public async moveVoiceMember(
    guildId: string,
    userId: string,
    channelId: string | null,
  ): Promise<void>
  {
    return moveVoiceMemberImpl.call(this as unknown as BotSessionContext, guildId, userId, channelId);
  }

  private async fetchGuildMember(
    guildId: string,
    userId: string,
  ): Promise<GuildMember>
  {
    return fetchGuildMemberImpl.call(this as unknown as BotSessionContext, guildId, userId);
  }

  private publishGuildRoles(guild: Guild): void
  {
    return publishGuildRolesImpl.call(this as unknown as BotSessionContext, guild);
  }

  private async persistGuildSnapshot(
    guild: Guild,
    channels: GuildBasedChannel[],
    members: GuildMember[],
  ): Promise<void>
  {
    return persistGuildSnapshotImpl.call(this as unknown as BotSessionContext, guild, channels, members);
  }

  private async persistPresenceSnapshot(member: GuildMember): Promise<void>
  {
    return persistPresenceSnapshotImpl.call(this as unknown as BotSessionContext, member);
  }

  private async persistUserSnapshotDirect(
    user: User,
    displayName: string | null,
  ): Promise<void>
  {
    return persistUserSnapshotDirectImpl.call(this as unknown as BotSessionContext, user, displayName);
  }

  private async persistMessageSnapshot(message: Message): Promise<void>
  {
    return persistMessageSnapshotImpl.call(this as unknown as BotSessionContext, message);
  }

  private async persistMessagesSnapshot(messages: Message[]): Promise<void>
  {
    return persistMessagesSnapshotImpl.call(this as unknown as BotSessionContext, messages);
  }

  private async deleteGuildSnapshot(guildId: string): Promise<void>
  {
    return deleteGuildSnapshotImpl.call(this as unknown as BotSessionContext, guildId);
  }

  private async deleteChannelSnapshot(channelId: string): Promise<void>
  {
    return deleteChannelSnapshotImpl.call(this as unknown as BotSessionContext, channelId);
  }

  private async deleteMessageSnapshot(messageId: string): Promise<void>
  {
    return deleteMessageSnapshotImpl.call(this as unknown as BotSessionContext, messageId);
  }

}
