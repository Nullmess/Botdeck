"use client";

// Composants Slash Studio extraits de slash-studio-widgets.tsx.


import { Select } from "../../../components/ui/field";
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
import { i18nText } from "@/features/workspace/core";

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


export function CommandAccessStep({
  draft,
  text,
  guildId,
  visibility,
  onScopeChange,
  onAvailabilityChange,
  onUpdate,
  onVisibilityChange,
}: {
  draft: ApplicationCommandDraft;
  text: UiText;
  guildId: string | null;
  visibility: ApplicationCommandRuntimeDefinition["response"]["visibility"];
  onScopeChange: (scope: ApplicationCommandScope) => void;
  onAvailabilityChange: (availability: CommandAvailability) => void;
  onUpdate: <K extends keyof ApplicationCommandDraft>(
    key: K,
    value: ApplicationCommandDraft[K],
  ) => void;
  onVisibilityChange: (
    visibility: ApplicationCommandRuntimeDefinition["response"]["visibility"],
  ) => void;
}) {
  const permissions = commandRequiredPermissions(draft);
  const availability = commandAvailabilityFromDraft(draft);
  return (
    <div className="commandFlowStep">
      <div className="commandFlowTitle">
        <span>{i18nText("Étape 5")}</span>
        <h2>{i18nText("Où et par qui ?")}</h2>
        <p>
          {i18nText("Choisis si la commande vit sur serveur, en DM, ou dans les deux contextes.")}
        </p>
      </div>
      <div className="commandFlowFields isTwoColumns">
        <label>
          <span>{i18nText("Disponibilité")}</span>
          <Select
            value={availability}
            onChange={(event) =>
              onAvailabilityChange(event.target.value as CommandAvailability)
            }
          >
            <option value="guild">{i18nText("Serveur uniquement")}</option>
            <option value="dm">{i18nText("DM uniquement")}</option>
            <option value="both">{i18nText("Serveur et DM")}</option>
          </Select>
        </label>
        <label>
          <span>{text.commandScope}</span>
          <Select
            value={draft.scope}
            onChange={(event) =>
              onScopeChange(event.target.value as ApplicationCommandScope)
            }
            disabled={availability !== "guild"}
          >
            <option value="global">{text.commandScopeGlobal}</option>
            <option value="guild" disabled={!guildId}>
              {text.commandScopeGuild}
            </option>
          </Select>
        </label>
        <label>
          <span>{text.defaultPermissions}</span>
          <Select
            value={draft.defaultMemberPermissions ?? ""}
            onChange={(event) =>
              onUpdate("defaultMemberPermissions", event.target.value || null)
            }
          >
            {permissionPresets.map((preset) => (
              <option key={preset.label} value={preset.value ?? ""}>
                {preset.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>{i18nText("Visibilité de la réponse")}</span>
          <Select
            value={visibility}
            onChange={(event) =>
              onVisibilityChange(
                event.target
                  .value as ApplicationCommandRuntimeDefinition["response"]["visibility"],
              )
            }
          >
            <option value="ephemeral">{i18nText("Éphémère")}</option>
            <option value="public">{i18nText("Publique")}</option>
          </Select>
        </label>
      </div>
      <div className="commandPermissionSummary">
        <div>
          <strong>{i18nText("Permissions bot nécessaires")}</strong>
          {permissions.bot.map((permission) => (
            <span key={permission}>{permission}</span>
          ))}
        </div>
        <div>
          <strong>{i18nText("Utilisateurs autorisés")}</strong>
          {permissions.users.map((permission) => (
            <span key={permission}>{permission}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Erreurs bloquantes commande.
