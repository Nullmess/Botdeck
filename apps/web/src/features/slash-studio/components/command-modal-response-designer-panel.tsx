"use client";

// Composants Slash Studio extraits de slash-studio-widgets.tsx.


import { Input } from "../../../components/ui/field";
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

import { CommandModalResponseInlineEditor } from "./command-modal-response-inline-editor";
import { Button } from "../../../components/ui/button";

export function CommandModalResponseDesigner({
  draft,
  modalTitle,
  modalField,
  metadata,
  onMetadataChange,
}: {
  draft: ApplicationCommandDraft;
  modalTitle: string;
  modalField: string;
  metadata: Record<string, unknown>;
  onMetadataChange: (patch: Record<string, unknown>) => void;
}) {
  const responses = modalResponsesFromMetadata(draft, metadata);
  const variableName = modalField || "query";
  const saveResponses = (nextResponses: CommandModalResponseDraft[]) => {
    const normalized = nextResponses
      .slice(0, MAX_MODAL_RESPONSE_CARDS)
      .map(serializeModalResponseDraft);
    // Modal: éviter onResponseChange.
    // Sinon brouillon ancien, métadonnées perdues.
    onMetadataChange({ modalResponses: normalized, responseMode: "modal" });
  };
  const addResponse = (kind: CommandModalResponseKind) => {
    if (responses.length >= MAX_MODAL_RESPONSE_CARDS) return;
    saveResponses([...responses, createModalResponseDraft(draft, kind)]);
  };
  const updateResponse = (nextResponse: CommandModalResponseDraft) => {
    saveResponses(
      responses.map((item) =>
        item.id === nextResponse.id ? nextResponse : item,
      ),
    );
  };
  const removeResponse = (responseId: string) => {
    saveResponses(responses.filter((item) => item.id !== responseId));
  };
  return (
    <div className="commandFlowFields commandModalDesigner">
      <div className="commandModalSetupGrid">
        <label>
          <span>{i18nText("Titre du modal")}</span>
          <Input
            value={modalTitle}
            maxLength={45}
            onChange={(event) =>
              onMetadataChange({
                modalTitle: event.target.value,
                responseMode: "modal",
              })
            }
          />
        </label>
        <label>
          <span>{i18nText("Champ demandé")}</span>
          <Input
            value={modalField}
            maxLength={45}
            onChange={(event) =>
              onMetadataChange({
                modalField: event.target.value,
                responseMode: "modal",
              })
            }
            placeholder={i18nText("query")}
          />
        </label>
      </div>
      <div className="commandModalResponseHeader">
        <div>
          <strong>{i18nText("Résultats de recherche")}</strong>
          <small>
            {i18nText("Le texte saisi dans")} <code>{variableName}</code> {i18nText("sert de recherche. Botdeck envoie seulement les cartes qui contiennent ce mot dans leur nom, mots-clés ou contenu.")}
          </small>
        </div>
        <span>
          {responses.length}/{MAX_MODAL_RESPONSE_CARDS} {i18nText("cartes")}
        </span>
      </div>
      <div className="commandModalInlineList">
        {responses.map((item, index) => (
          <CommandModalResponseInlineEditor
            key={item.id}
            draft={draft}
            response={item}
            index={index}
            variableName={variableName}
            onChange={updateResponse}
            onRemove={() => removeResponse(item.id)}
          />
        ))}
        {responses.length < MAX_MODAL_RESPONSE_CARDS ? (
          <div
            className="commandModalAddCard"
            aria-label={i18nText("Ajouter une réponse après soumission")}
          >
            <strong>+</strong>
            <span>{i18nText("Ajouter une réponse")}</span>
            <small>{i18nText("Choisis directement le type de carte à ajouter.")}</small>
            <div className="commandModalAddChoices">
              <Button variant="unstyled" type="button" onClick={() => addResponse("message")}>
                {i18nText("Message")}
              </Button>
              <Button variant="unstyled" type="button" onClick={() => addResponse("embed")}>
                {i18nText("Embed")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <p className="commandFlowNote">
        {i18nText("Maximum Botdeck :")} {MAX_MODAL_RESPONSE_CARDS} {i18nText("cartes de résultat. Exemple : si l’utilisateur cherche “crotte”, seules les cartes contenant “crotte” seront envoyées. Côté Discord, un message peut contenir jusqu'à 10 embeds et chaque embed peut avoir 25 fields ; Botdeck limite volontairement ce builder pour garder un flux simple.")}
      </p>
    </div>
  );
}

// Éditeur inline de réponse modale.
