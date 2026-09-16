"use client";

// Composants Slash Studio extraits de slash-studio-widgets.tsx.


import {
  type ApplicationCommandDraft,
  type ApplicationCommandDraftOption,
  type ApplicationCommandRuntimeDefinition,
  type ApplicationCommandScope,
  type ApplicationCommandSummary,
  type BotAccountSummary,
  type GuildAutomationConfig,
  type WorkspaceState,
} from "@botdeck/shared";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  GOODBYE_VARIABLES,
  LOG_EVENT_VARIABLES,
  MODERATION_VARIABLES,
  WELCOME_VARIABLES,
  previewExampleLabel,
  replaceLogPreviewAliases,
  replaceModerationPreviewAliases,
  replaceWelcomePreviewAliases,
  type LogEventKey,
} from "./slash-studio-template-variables";

import {
  ActivityChoice,
  BotCustomStatusState,
  BotSettingsState,
  clearStoredSlashCommandDraft,
  formatTime,
  readStoredSlashCommandDraft,
  renderMessageContent,
  SlashStudioContext,
  SlashSyncState,
  uiText,
  UiText,
  writeStoredSlashCommandDraft,
} from "@/features/workspace/core";

import { botOpsText, slashLabels, slashStudioText, wizardLabels } from "./slash-studio-text";

import {
  commandDraftTypeFromSummary,
  commandDraftTypes,
  commandOptionTypes,
  commandSummaryToDraft,
  createDraftOption,
  createEmptyCommandDraft,
  importedJsonToDraft,
  isRecord,
  permissionPresets,
  recordFromUnknown,
} from "./slash-studio-command-drafts";

import {
  actionLibrary,
  commandStudioTabs,
  commandTemplates,
  commandVariables,
  type CommandStudioTab,
  type CommandTemplateKey,
  workflowBlocks,
} from "./slash-studio-catalog";

import {
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

import {
  MarkdownField,
  MarkdownTextarea,
  MarkdownToolbar,
  MarkdownVisualField,
} from "./slash-studio-markdown-fields";

import {
  CommandEmbedPreviewPanel,
  safePreviewImageUrl,
} from "./slash-studio-embed-preview";

import {
  CommandVariablePreviewList,
  automationMetadataPatch,
} from "./slash-studio-automation-editor";

import {
  applyCommandTemplate,
  buildRuntimeDefinition,
  commandDisplayName,
  commandIntentToDraft,
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
  isPrefixCommandSummary,
  modalResponsesFromMetadata,
  patchCommandRuntime,
  runtimeKindFromDraft,
  serializeModalResponseDraft,
  validateCommandDraft,
} from "./slash-studio-command-factory";
import { Button } from "../../../components/ui/button";
import { Modal } from "../../../components/ui/modal";

export function SlashCommandJsonPanel({
  command,
  text,
  onClose,
}: {
  command: ApplicationCommandSummary;
  text: UiText;
  onClose: () => void;
}) {
  return (
    <Modal
      as="div"
      backdropClassName="slashCommandJsonOverlay"
      surfaceClassName="slashCommandJsonPanel"
      aria-label={text.commandJson}
      onClose={onClose}
    >
        <div className="slashCommandsPanelHeader">
          <div>
            <p className="permissionPanelEyebrow">{text.commandJson}</p>
            <h2>/{command.name}</h2>
          </div>
          <Button variant="unstyled"
            className="permissionPanelClose"
            type="button"
            onClick={onClose}
            aria-label={text.close}
          >
            ×
          </Button>
        </div>
        <pre>{JSON.stringify(command.raw, null, 2)}</pre>
    </Modal>
  );
}

// Suppression commande slash.


export function SlashCommandDeleteModal({
  command,
  text,
  onCancel,
  onConfirm,
}: {
  command: ApplicationCommandSummary;
  text: UiText;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      as="div"
      backdropClassName="slashCommandJsonOverlay"
      surfaceClassName="slashCommandDeleteCard"
      aria-label={text.deleteCommand}
      onClose={onCancel}
    >
        <p className="permissionPanelEyebrow">{text.deleteCommand}</p>
        <h2>{text.confirmDeleteCommand(command.name)}</h2>
        <p>
          {command.scope === "global"
            ? text.globalCommands
            : text.guildCommands}
        </p>
        <div className="slashCommandDeleteActions">
          <Button variant="unstyled" type="button" onClick={onCancel}>
            {text.cancel}
          </Button>
          <Button variant="unstyled" type="button" className="dangerButton" onClick={onConfirm}>
            {text.deleteCommand}
          </Button>
        </div>
    </Modal>
  );
}
