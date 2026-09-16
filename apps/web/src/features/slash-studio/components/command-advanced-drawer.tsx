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
import { SlashCommandBuilder } from "./slash-command-builder";
import { CommandResponseTab, CommandTestPreviewTab, CommandAdvancedJsonTab } from "./command-tabs";
import { Button } from "../../../components/ui/button";
import { Tabs, TabButton } from "../../../components/ui/tabs";

export function CommandAdvancedDrawer({
  draft,
  guildId,
  editing,
  text,
  validationErrors,
  activeTab,
  importJson,
  importMessage,
  onTabChange,
  onDraftChange,
  onSave,
  onReset,
  onImportChange,
  onValidateImport,
  onLoadImport,
  onCreateFromImport,
}: {
  draft: ApplicationCommandDraft;
  guildId: string | null;
  editing: boolean;
  text: UiText;
  validationErrors: string[];
  activeTab: Exclude<CommandStudioTab, "home" | "composer">;
  importJson: string;
  importMessage: string | null;
  onTabChange: (tab: Exclude<CommandStudioTab, "home" | "composer">) => void;
  onDraftChange: (draft: ApplicationCommandDraft) => void;
  onSave: () => void;
  onReset: () => void;
  onImportChange: (value: string) => void;
  onValidateImport: () => ApplicationCommandDraft | null;
  onLoadImport: () => void;
  onCreateFromImport: () => void;
}) {
  const tabs = commandStudioTabs.filter(
    (
      item,
    ): item is {
      key: Exclude<CommandStudioTab, "home" | "composer">;
      label: string;
    } => item.key !== "home" && item.key !== "composer",
  );
  return (
    <section className="commandAdvancedDrawer">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Avancé")}</p>
          <h3>{i18nText("Seulement quand c'est nécessaire")}</h3>
          <p>
            {i18nText("Options Discord, réponse, test local et JSON. Pas de détour dans le flux principal.")}
          </p>
        </div>
        <Button variant="unstyled" type="button" className="ghostButton" onClick={onReset}>
          {i18nText("Réinitialiser")}
        </Button>
      </div>
      <Tabs as="nav" className="commandAdvancedTabs" aria-label={i18nText("Sections avancées") }>
        {tabs.map((item) => (
          <TabButton
            key={item.key}
            type="button"
            active={activeTab === item.key}
            onClick={() => onTabChange(item.key)}
          >
            {item.label}
          </TabButton>
        ))}
      </Tabs>
      {activeTab === "structure" ? (
        <SlashCommandBuilder
          draft={draft}
          guildId={guildId}
          editing={editing}
          text={text}
          validationErrors={validationErrors}
          onDraftChange={onDraftChange}
          onSave={onSave}
          onReset={onReset}
        />
      ) : null}
      {activeTab === "response" ? (
        <CommandResponseTab draft={draft} onDraftChange={onDraftChange} />
      ) : null}
      {activeTab === "test" ? (
        <CommandTestPreviewTab
          draft={draft}
          validationErrors={validationErrors}
        />
      ) : null}
      {activeTab === "json" ? (
        <CommandAdvancedJsonTab
          draft={draft}
          importJson={importJson}
          importMessage={importMessage}
          text={text}
          onImportChange={onImportChange}
          onValidate={onValidateImport}
          onLoad={onLoadImport}
          onCreate={onCreateFromImport}
        />
      ) : null}
    </section>
  );
}

// Assistant slash commande.
