// Surface interne typée utilisée par les slices extraites de BotSession.
// Elle remplace les anciens contextes non typés sans changer le comportement runtime.

import type {
  ApplicationCommandDraft,
  ApplicationCommandRuntimeDefinition,
  ApplicationCommandScope,
  ApplicationCommandSummary,
  BotAccountSummary,
  ClientEvent,
  EmbedPayload,
  GuildAutomationConfig,
  GuildAutomationKind,
  GuildAutomationMessageType,
  GuildRoleAutomationRuleConfig,
  MessageSummary,
  VoiceStateSummary,
  WorkspaceState,
} from "@botdeck/shared";
import type {
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Interaction,
  InteractionReplyOptions,
  Message,
  PartialGuildMember,
  PermissionsBitField,
  Role,
  User,
} from "discord.js";
import type {
  BotAccountRow,
  BotAccountUpdatePatch,
  MessageEmbedPageCacheEntry,
  RuntimeEmbedPage,
  RuntimeModalResponse,
} from "@/server/control-plane-helpers";
import type {
  LogEventConfig,
  LogEventKey,
  LogEventPayload,
  StoredLogConfig,
} from "./features/automation-logs";
import type {
  ModerationAction,
  ModerationTarget,
} from "./features/moderation";
import type {
  RoleAutomationRuleInput,
  StoredMemberActivity,
  StoredRoleAutomationRule,
} from "./features/role-automation";

export type StoredWelcomeConfig = {
  guildId: string;
  channelId: string;
  messageType: string;
  messageTemplate: string;
  embedPagesJson: string | null;
  enabled: boolean;
};

export type StoredGoodbyeConfig = StoredWelcomeConfig;

export type MemberActivityPatch = {
  messageDelta?: number;
  voiceDeltaSeconds?: number;
  joinedAt?: Date | null;
  lastMessageAt?: Date | null;
  lastVoiceAt?: Date | null;
};

export type RecreatePurgeOptions = {
  reason?: string;
  transcript?: boolean;
  finishMessage?: boolean;
  confirmation?: string;
  executorId?: string | null;
};

export type ChannelRecreateSnapshot = {
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

export type ChannelLogValueSource = {
  id: string;
  name?: string | null;
  toString?: () => string;
  type?: unknown;
};

export type GuildRoleMutationInput = {
  guildId: string;
  name: string;
  color?: string | null;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string[] | string | null;
  reason?: string | null;
};

export type GuildRoleUpdateInput = Partial<GuildRoleMutationInput> & {
  guildId: string;
  roleId: string;
};

export type GuildChannelUpdateInput = {
  guildId: string;
  channelId: string;
  name?: string;
  topic?: string | null;
  nsfw?: boolean;
  rateLimitPerUser?: number | null;
  userLimit?: number | null;
  bitrate?: number | null;
  parentId?: string | null;
  position?: number;
  reason?: string | null;
};

export interface BotSessionContext {
  readonly account: BotAccountRow;
  readonly client: Client;
  status: BotAccountSummary["status"];
  lastError: string | null;
  state: WorkspaceState;
  messageCache: Map<string, MessageSummary[]>;
  voiceCache: Map<string, VoiceStateSummary[]>;
  modalPageCache: Map<string, { expiresAt: number; embeds: RuntimeEmbedPage[] }>;
  messageEmbedPageCache: Map<string, MessageEmbedPageCacheEntry>;
  actionQueue: Promise<unknown>;
  queuedActionCount: number;
  runningActionCount: number;
  warmupPromise: Promise<void> | null;
  readyPromise: Promise<void> | null;
  resolveReady: (() => void) | null;
  rejectReady: ((error: unknown) => void) | null;
  welcomeConfigsByGuild: Map<string, StoredWelcomeConfig>;
  goodbyeConfigsByGuild: Map<string, StoredGoodbyeConfig>;
  logConfigsByGuild: Map<string, StoredLogConfig>;
  roleAutomationRulesByGuild: Map<string, StoredRoleAutomationRule[]>;
  liveVoiceSessions: Map<
    string,
    { guildId: string; userId: string; channelId: string; startedAt: number }
  >;
  recentModerationLogs: Map<string, number>;
  recentChannelRecreateDeletes: Map<string, number>;
  recentChannelRecreateCreates: Map<
    string,
    { expiresAt: number; name: string; parentId: string; type: string }
  >;
  roleAutomationTimer: NodeJS.Timeout | null;

  updateAccount(...args: unknown[]): Promise<void>;

  rememberChannelRecreateDelete(channelId: string): void;
  consumeChannelRecreateDelete(channelId: string): boolean;
  rememberChannelRecreateCreate(
    guildId: string,
    snapshot: ChannelRecreateSnapshot,
  ): void;
  consumeChannelRecreateCreate(channel: ChannelRecreateCandidate): boolean;
  createModalPageCache(embeds: RuntimeEmbedPage[]): string;
  modalResponsePayload(
    response: RuntimeModalResponse,
    values: Record<string, string>,
    pageIndex?: number,
  ): InteractionReplyOptions;
  createMessageEmbedPageCache(
    content: string,
    embeds: Record<string, unknown>[],
  ): string;

  cacheWelcomeConfig(config: StoredWelcomeConfig): void;
  loadWelcomeConfigs(): Promise<void>;
  saveWelcomeConfig(
    guildId: string,
    channelId: string,
    messageType: "message" | "embed",
    messageTemplate: string,
    embedPagesJson: string | null,
  ): Promise<void>;
  removeWelcomeConfig(
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void>;
  loadWelcomeConfig(
    guildId: string,
    force?: boolean,
  ): Promise<StoredWelcomeConfig | null>;

  guildAutomationConfig(guildId: string): GuildAutomationConfig;
  publishGuildAutomationConfig(...args: unknown[]): Promise<void>;
  syncGuildAutomationConfig(...args: unknown[]): Promise<void>;
  parseAutomationEmbedPagesJson(value: string | null | undefined): string | null;
  channelSendBlockReason(
    channel: unknown,
    guild: Guild | null | undefined,
    embed?: boolean,
  ): string | null;
  resolveAutomationChannel(...args: unknown[]): Promise<void>;
  updateGuildAutomationConfig(...args: unknown[]): Promise<void>;
  removeGuildAutomationConfig(...args: unknown[]): Promise<void>;
  automationTestValues(guild: Guild, kind: "welcome" | "goodbye"): Record<string, string>;
  testGuildAutomationConfig(...args: unknown[]): Promise<void>;

  cacheGoodbyeConfig(config: StoredGoodbyeConfig): void;
  loadGoodbyeConfigs(): Promise<void>;
  saveGoodbyeConfig(
    guildId: string,
    channelId: string,
    messageType: "message" | "embed",
    messageTemplate: string,
    embedPagesJson: string | null,
  ): Promise<void>;
  removeGoodbyeConfig(
    guildId: string,
    reason: string,
    channelId?: string,
  ): Promise<void>;
  loadGoodbyeConfig(
    guildId: string,
    force?: boolean,
  ): Promise<StoredGoodbyeConfig | null>;

  cacheLogConfig(config: StoredLogConfig): void;
  loadLogConfigs(): Promise<void>;
  saveLogConfig(
    guildId: string,
    channelId: string,
    eventConfigsJson: string | null,
  ): Promise<void>;
  removeLogConfig(guildId: string, reason: string, channelId?: string): Promise<void>;
  loadLogConfig(guildId: string, force?: boolean): Promise<StoredLogConfig | null>;

  roleAutomationRuleToConfig(
    rule: StoredRoleAutomationRule,
  ): GuildRoleAutomationRuleConfig;
  cacheRoleAutomationRules(guildId: string, rules: StoredRoleAutomationRule[]): void;
  repairRoleAutomationRuleStorage(guildId?: string): Promise<void>;
  loadRoleAutomationRules(...args: unknown[]): Promise<StoredRoleAutomationRule[]>;
  resolveAssignableRole(...args: unknown[]): Promise<Role>;
  normalizeRoleAutomationInput(input: RoleAutomationRuleInput): RoleAutomationRuleInput;
  upsertGuildRoleAutomationRule(...args: unknown[]): Promise<void>;
  deleteGuildRoleAutomationRule(...args: unknown[]): Promise<void>;
  getMemberActivity(...args: unknown[]): Promise<StoredMemberActivity | null>;
  upsertMemberActivity(...args: unknown[]): Promise<void>;
  roleAutomationConditions(
    rule: StoredRoleAutomationRule,
    member: GuildMember,
    activity: StoredMemberActivity | null,
  ): boolean[];
  roleAutomationRuleMatches(
    rule: StoredRoleAutomationRule,
    member: GuildMember,
    activity: StoredMemberActivity | null,
  ): boolean;
  applyRoleAutomationRule(...args: unknown[]): Promise<boolean>;
  evaluateRoleAutomationForMember(...args: unknown[]): Promise<void>;
  syncGuildRoleAutomation(...args: unknown[]): Promise<void>;
  testGuildRoleAutomation(...args: unknown[]): Promise<void>;
  recordGuildMessageActivity(...args: unknown[]): Promise<void>;
  startVoiceSession(...args: unknown[]): Promise<unknown>;
  closeVoiceSession(...args: unknown[]): Promise<number>;
  flushLiveVoiceSessionsForGuild(...args: unknown[]): Promise<void>;
  handleVoiceAutomation(...args: unknown[]): Promise<void>;
  startRoleAutomationScheduler(): void;

  defaultLogEventConfigs(mode?: "message" | "embed"): Record<LogEventKey, LogEventConfig>;
  normalizeLogEmbedPages(
    key: LogEventKey,
    rawPages: unknown,
    fallbackContent: string,
  ): RuntimeEmbedPage[];
  normalizeLogEventConfigs(
    value: unknown,
    mode?: "message" | "embed",
  ): Record<LogEventKey, LogEventConfig>;
  readLogEventConfigs(config: StoredLogConfig | null | undefined): Record<LogEventKey, LogEventConfig>;
  logSetupTemplateValues(
    interaction: ChatInputCommandInteraction,
    channelId: string,
  ): Record<string, string>;
  runtimeLogSetConfirmation(
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): string;
  runtimeLogRemoveConfirmation(
    runtime: ApplicationCommandRuntimeDefinition,
    values: Record<string, string>,
  ): string;
  handleLogsSetupInteraction(...args: unknown[]): Promise<void>;
  formatRoleAutomationRule(rule: StoredRoleAutomationRule, guild: Guild): string;
  handleRoleAutomationInteraction(...args: unknown[]): Promise<void>;
  moderationTemplateValues(
    guild: Guild,
    actor: User | null | undefined,
    target: ModerationTarget | null | undefined,
    action: ModerationAction,
    reason?: string | null,
  ): Record<string, string>;
  rememberModerationLog(
    guildId: string,
    action: "ban" | "unban" | "kick",
    userId: string,
  ): void;
  consumeRecentModerationLog(
    guildId: string,
    action: "ban" | "unban" | "kick",
    userId: string,
  ): boolean;
  sendModerationLog(...args: unknown[]): Promise<void>;
  replyModerationResult(...args: unknown[]): Promise<void>;
  handleModerationCommandInteraction(...args: unknown[]): Promise<void>;
  handleChannelRecreatePurgeInteraction(...args: unknown[]): Promise<void>;
  fetchAuditExecutor(...args: unknown[]): Promise<User | null>;
  shortText(value: unknown, fallback?: string, max?: number): string;
  userValues(prefix: string, user: User | null | undefined): Record<string, string>;
  baseLogValues(guild: Guild, key: LogEventKey, actor?: User | null): Record<string, string>;
  channelValues(channel: ChannelLogValueSource | null | undefined): Record<string, string>;
  sendDiscordLog(...args: unknown[]): Promise<void>;
  welcomeSetupTemplateValues(
    interaction: ChatInputCommandInteraction,
    channelId: string,
  ): Record<string, string>;
  handleWelcomeSetupInteraction(...args: unknown[]): Promise<void>;
  sendWelcomeMessage(...args: unknown[]): Promise<void>;
  handleGoodbyeSetupInteraction(...args: unknown[]): Promise<void>;
  goodbyeTemplateValuesForMember(member: GuildMember | PartialGuildMember): Record<string, string>;
  sendGoodbyeMessage(...args: unknown[]): Promise<void>;

  publishEvent(event: ClientEvent): void;
  publishQueueEvent(...args: unknown[]): void;
  setMessageCache(channelId: string, messages: MessageSummary[]): void;
  updateMessageCache(
    channelId: string,
    updater: (current: MessageSummary[]) => MessageSummary[],
  ): void;
  upsertMessageSummary(summary: MessageSummary): void;
  publishEphemeralInteractionReply(...args: unknown[]): Promise<void>;
  isForumLikeChannel(...args: unknown[]): boolean;
  forumIdForThread(...args: unknown[]): Promise<string | null>;
  hydrate(state: WorkspaceState): void;
  snapshot(): WorkspaceState;
  refreshWorkspace(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueueAction<T>(...args: unknown[]): Promise<T>;
  attachHandlers(): void;
  refreshDiscordState(): Promise<void>;
  startWarmup(): void;
  warmupWorkspace(): Promise<void>;

  refreshGuild(...args: unknown[]): Promise<void>;
  syncForumPosts(...args: unknown[]): Promise<void>;
  createForumPost(...args: unknown[]): Promise<void>;
  updateGuildProfile(...args: unknown[]): Promise<void>;
  fetchGuildMembers(...args: unknown[]): Promise<void>;
  fetchGuildRoles(...args: unknown[]): Promise<void>;
  fetchGuildInvites(...args: unknown[]): Promise<void>;
  createGuildInvite(...args: unknown[]): Promise<void>;
  deleteGuildInvite(...args: unknown[]): Promise<void>;
  fetchGuildBans(...args: unknown[]): Promise<void>;
  createGuildBan(...args: unknown[]): Promise<void>;
  deleteGuildBan(...args: unknown[]): Promise<void>;
  publishGuildMembers(...args: unknown[]): Promise<void>;
  refreshGuildRoles(...args: unknown[]): Promise<void>;
  rolePermissionsFromPayload(value?: string | null): PermissionsBitField | undefined;
  rolePermissionBitsFromPayload(value: string): bigint;
  resolveEditableGuildRole(...args: unknown[]): Promise<{ guild: Guild; role: Role }>;
  createGuildRole(...args: unknown[]): Promise<void>;
  updateGuildRole(...args: unknown[]): Promise<void>;
  updateGuildRolePermissions(...args: unknown[]): Promise<void>;
  deleteGuildRole(...args: unknown[]): Promise<void>;
  moveGuildChannel(...args: unknown[]): Promise<void>;
  createGuildCategory(...args: unknown[]): Promise<void>;
  deleteGuildChannel(...args: unknown[]): Promise<void>;
  recreatePurgeGuildChannel(...args: unknown[]): Promise<void>;
  deleteForumPost(...args: unknown[]): Promise<void>;
  setForumPostArchived(...args: unknown[]): Promise<void>;
  setForumPostLocked(...args: unknown[]): Promise<void>;

  syncChannelHistory(...args: unknown[]): Promise<void>;
  syncChannelPins(...args: unknown[]): Promise<void>;
  syncMessageContext(...args: unknown[]): Promise<void>;
  openDirectThread(...args: unknown[]): Promise<void>;
  publishDirectThread(...args: unknown[]): void;
  sendMessage(...args: unknown[]): Promise<void>;
  editMessage(...args: unknown[]): Promise<void>;
  deleteMessage(...args: unknown[]): Promise<void>;
  setMessagePinned(...args: unknown[]): Promise<void>;
  reactToMessage(...args: unknown[]): Promise<void>;
  unreactToMessage(...args: unknown[]): Promise<void>;

  loadStoredCommandDefinition(commandId: string): Promise<{
    draft: ApplicationCommandDraft | null;
    runtime: ApplicationCommandRuntimeDefinition | null;
  } | null>;
  answerPrefixCommand(message: Message): Promise<void>;
  isSqliteReadonlyError(error: unknown): boolean;
  logCommandStoreWriteFailure(error: unknown): Promise<void>;
  persistCommandDefinition(...args: unknown[]): Promise<ApplicationCommandSummary>;
  persistLocalPrefixCommandDefinition(...args: unknown[]): Promise<ApplicationCommandSummary>;
  ensureCommandStoreWritable(): Promise<void>;
  hydrateCommandDefinitions(...args: unknown[]): Promise<ApplicationCommandSummary[]>;
  assertCommandStudioEnabled(): void;
  fetchApplicationCommands(...args: unknown[]): Promise<void>;
  createApplicationCommand(...args: unknown[]): Promise<ApplicationCommandSummary>;
  updateApplicationCommand(...args: unknown[]): Promise<ApplicationCommandSummary>;
  deleteApplicationCommand(...args: unknown[]): Promise<void>;

  setPresence(...args: unknown[]): Promise<void>;
  fetchUserProfile(...args: unknown[]): Promise<void>;
  fetchMemberProfile(...args: unknown[]): Promise<void>;
  setMemberTimeout(...args: unknown[]): Promise<void>;
  kickMember(...args: unknown[]): Promise<void>;
  banMember(...args: unknown[]): Promise<void>;
  unbanMember(...args: unknown[]): Promise<void>;
  setMemberNickname(...args: unknown[]): Promise<void>;
  addMemberRole(...args: unknown[]): Promise<void>;
  removeMemberRole(...args: unknown[]): Promise<void>;
  moveVoiceMember(...args: unknown[]): Promise<void>;
  fetchGuildMember(...args: unknown[]): Promise<GuildMember>;
  publishGuildRoles(guild: Guild): void;

  persistGuildSnapshot(...args: unknown[]): Promise<void>;
  persistPresenceSnapshot(...args: unknown[]): Promise<void>;
  persistUserSnapshotDirect(...args: unknown[]): Promise<void>;
  persistMessageSnapshot(...args: unknown[]): Promise<void>;
  persistMessagesSnapshot(...args: unknown[]): Promise<void>;
  deleteGuildSnapshot(...args: unknown[]): Promise<void>;
  deleteChannelSnapshot(...args: unknown[]): Promise<void>;
  deleteMessageSnapshot(...args: unknown[]): Promise<void>;
}
