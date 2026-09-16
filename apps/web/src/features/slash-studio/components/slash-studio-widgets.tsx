"use client";

// Slash Studio commandes Discord


export { BotHealthDashboardPanel } from "./bot-health-dashboard-panel";
export { SlashStudioEmbedEditor } from "./slash-studio-automation-editor";

export { SlashCommandsPanel } from "./slash-commands-panel";
export { CommandComposerPanel } from "./command-composer-panel";
export {
  CommandComposerPanelHeader,
  CommandExecutionStep,
  CommandIdentityStep,
  CommandBehaviorStep,
  CommandContentStep,
  CommandAccessStep,
  CommandBlockingErrors,
} from "./command-composer-steps";
export {
  CommandModalResponseDesigner,
  CommandModalResponseInlineEditor,
} from "./command-modal-response-designer";
export { CommandAdvancedDrawer } from "./command-advanced-drawer";
export {
  SlashCommandWizard,
  CommandOverview,
  CommandMetric,
} from "./slash-command-wizard";
export {
  SlashCommandBuilder,
  CommandMultiSelect,
  SlashCommandOptionsEditor,
  ChoiceEditor,
} from "./slash-command-builder";
export {
  CommandWorkflowTab,
  CommandResponseTab,
  CommandEmbedBuilderTab,
  CommandComponentsTab,
  CommandModalsTab,
  CommandConditionsTab,
  CommandActionsTab,
  CommandVariablesTab,
  CommandTestPreviewTab,
  CommandAdvancedJsonTab,
} from "./command-tabs";
export {
  SlashCommandJsonPanel,
  SlashCommandDeleteModal,
} from "./slash-command-json-panel";

export {
  applyCommandTemplate,
  buildRuntimeDefinition,
  commandDisplayName,
  commandIntentToDraft,
  commandNameFromIntent,
  commandPrefixFromSummary,
  commandRuntimeMetadataFromRuntime,
  commandSummaryTypeLabel,
  commandTypeLabel,
  createAutoRoleCommandOptions,
  createComposerOption,
  createModalResponseDraft,
  createModerationCommandOptions,
  createRuntimeDefinition,
  ensureCommandRuntime,
  isDiscordSnowflakeId,
  isPrefixCommandSummary,
  modalResponsesFromMetadata,
  patchCommandRuntime,
  runtimeKindFromDraft,
  serializeModalResponseDraft,
  validateCommandDraft,
} from "./slash-studio-command-factory";

export {
  DEFAULT_LOG_EVENT_MESSAGES,
  DISCORD_EMBED_LIMITS,
  LOG_EVENT_KEYS,
  LOG_EVENT_LABELS,
  MAX_MODAL_RESPONSE_CARDS,
  commandAvailabilityFromDraft,
  commandAvailabilityPatch,
  commandCreationSteps,
  commandExecutionModeFromDraft,
  commandPermissionPresetLabel,
  commandRequiredPermissions,
  commandResponseModeFromDraft,
  commandRuntimeActionType,
  commandRuntimeMetadata,
  createEmbedFieldDraft,
  createEmbedPageDraft,
  draftCommandDisplayName,
  embedLimitTone,
  embedPageTextLength,
  embedPagesFromMetadata,
  goodbyeEmbedPagesFromMetadata,
  goodbyeMessageTypeFromMetadata,
  getCommandDraftSummary,
  logEventConfigsFromMetadata,
  moderationEmbedPagesFromMetadata,
  moderationResponseTypeFromMetadata,
  normalizeEmbedColor,
  serializeLogEventConfigs,
  welcomeEmbedPagesFromMetadata,
  welcomeMessageTypeFromMetadata,
  type CommandAvailability,
  type CommandDraftSummary,
  type CommandEmbedFieldDraft,
  type CommandEmbedPageDraft,
  type CommandExecutionMode,
  type CommandModalResponseDraft,
  type CommandModalResponseKind,
  type CommandResponseMode,
  type LogEventConfigDraft,
  type LogMessageType,
  type WelcomeMessageType,
} from "./slash-studio-command-runtime";

export {
  MarkdownField,
  MarkdownTextarea,
  MarkdownToolbar,
  MarkdownVisualField,
} from "./slash-studio-markdown-fields";
