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
import { CommandModalResponseDesigner } from "./command-modal-response-designer";
import { Button } from "../../../components/ui/button";


export function CommandBehaviorStep({
  mode,
  text,
  onModeChange,
}: {
  mode: CommandResponseMode;
  text: UiText;
  onModeChange: (mode: CommandResponseMode) => void;
}) {
  const wizardText = wizardLabels(text);
  const modes: Array<{
    value: CommandResponseMode;
    title: string;
    description: string;
  }> = [
    { value: "message", ...wizardText.responseModes.message },
    { value: "embed", ...wizardText.responseModes.embed },
    { value: "modal", ...wizardText.responseModes.modal },
    { value: "welcome", ...wizardText.responseModes.welcome },
    { value: "goodbye", ...wizardText.responseModes.goodbye },
    { value: "logs", ...wizardText.responseModes.logs },
    { value: "autorole", ...wizardText.responseModes.autorole },
    { value: "ban", ...wizardText.responseModes.ban },
    { value: "unban", ...wizardText.responseModes.unban },
    { value: "kick", ...wizardText.responseModes.kick },
  ];
  return (
    <div className="commandFlowStep">
      <div className="commandFlowTitle">
        <span>{wizardText.step3}</span>
        <h2>{wizardText.step3Title}</h2>
        <p>{wizardText.step3Help}</p>
      </div>
      <div className="commandExecutionGrid isBehavior">
        {modes.map((item) => (
          <Button variant="unstyled"
            key={item.value}
            type="button"
            className={mode === item.value ? "isSelected" : ""}
            onClick={() => onModeChange(item.value)}
          >
            <strong>
              {item.value === "message"
                ? "T"
                : item.value === "embed"
                  ? "E"
                  : item.value === "modal"
                    ? "M"
                    : item.value === "welcome"
                      ? "W"
                      : item.value === "goodbye"
                        ? "G"
                        : item.value === "autorole"
                          ? "R"
                          : item.value === "ban"
                            ? "B"
                            : item.value === "unban"
                              ? "U"
                              : item.value === "kick"
                                ? "K"
                                : "L"}
            </strong>
            <span>{item.title}</span>
            <small>{item.description}</small>
          </Button>
        ))}
      </div>
    </div>
  );
}

// Étape contenu commande.
