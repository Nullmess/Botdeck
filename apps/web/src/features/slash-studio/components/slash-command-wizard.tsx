"use client";

// Composants Slash Studio extraits de slash-studio-widgets.tsx.


import { Input, Select } from "../../../components/ui/field";
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
import { SlashCommandOptionsEditor } from "./slash-command-builder";
import { CommandWorkflowTab } from "./command-tabs";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";

export function SlashCommandWizard({
  draft,
  guildId,
  step,
  text,
  validationErrors,
  onDraftChange,
  onStepChange,
  onOpenEditor,
  onSave,
}: {
  draft: ApplicationCommandDraft;
  guildId: string | null;
  step: number;
  text: UiText;
  validationErrors: string[];
  onDraftChange: (draft: ApplicationCommandDraft) => void;
  onStepChange: (step: number) => void;
  onOpenEditor: () => void;
  onSave: () => void;
}) {
  const update = <K extends keyof ApplicationCommandDraft>(
    key: K,
    value: ApplicationCommandDraft[K],
  ) => onDraftChange({ ...draft, [key]: value });
  const setScope = (scope: ApplicationCommandScope) =>
    onDraftChange({
      ...draft,
      scope,
      guildId: scope === "guild" ? guildId : null,
    });
  const slashText = slashLabels(text);
  const steps = [
    text.commandType,
    text.commandName,
    text.commandOptionsBuilder,
    text.saveCommand,
  ];
  return (
    <section className="commandWizard">
      <div className="commandWizardSteps">
        {steps.map((label, index) => (
          <Button variant="unstyled"
            key={label}
            type="button"
            className={
              step === index + 1 ? "isActive" : step > index + 1 ? "isDone" : ""
            }
            onClick={() => onStepChange(index + 1)}
          >
            {index + 1}. {label}
          </Button>
        ))}
      </div>
      <div className="commandWizardBody">
        {step === 1 ? (
          <div className="commandStudioChoiceGrid">
            {commandDraftTypes.map((item) => (
              <Button variant="unstyled"
                key={item.value}
                type="button"
                className={draft.type === item.value ? "isSelected" : ""}
                onClick={() => update("type", item.value)}
              >
                <strong>{commandTypeLabel(item.value, text)}</strong>
                <span>
                  {item.value === "chat_input"
                    ? slashText.slashTypeHelp
                    : item.value === "user"
                      ? slashText.userTypeHelp
                      : slashText.messageTypeHelp}
                </span>
              </Button>
            ))}
            <label>
              <span>{text.commandScope}</span>
              <Select
                value={draft.scope}
                onChange={(event) =>
                  setScope(event.target.value as ApplicationCommandScope)
                }
              >
                <option value="global">{text.commandScopeGlobal}</option>
                <option value="guild">{text.commandScopeGuild}</option>
              </Select>
            </label>
          </div>
        ) : null}
        {step === 2 ? (
          <div className="slashCommandFormGrid">
            <label>
              <span>{text.commandName}</span>
              <Input
                value={draft.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            {draft.type === "chat_input" ? (
              <label>
                <span>{text.commandDescription}</span>
                <Input
                  value={draft.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  maxLength={100}
                />
              </label>
            ) : null}
            <label>
              <span>{text.defaultPermissions}</span>
              <Select
                value={draft.defaultMemberPermissions ?? ""}
                onChange={(event) =>
                  update("defaultMemberPermissions", event.target.value || null)
                }
              >
                {permissionPresets.map((preset) => (
                  <option key={preset.label} value={preset.value ?? ""}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        ) : null}
        {step === 3 ? (
          draft.type === "chat_input" ? (
            <SlashCommandOptionsEditor
              options={draft.options}
              text={text}
              depth={0}
              onChange={(options) => update("options", options)}
            />
          ) : (
            <div className="slashCommandsEmpty">
              {slashText.noDiscordArguments}
            </div>
          )
        ) : null}
        {step === 4 ? (
          <CommandOverview
            draft={draft}
            command={null}
            guildName={null}
            text={text}
            validationErrors={validationErrors}
            onSave={onSave}
            onDuplicate={() =>
              onDraftChange({
                ...draft,
                id: null,
                name: `${draft.name}-copy`.slice(0, 32),
              })
            }
            onExport={onOpenEditor}
          />
        ) : null}
      </div>
      {validationErrors.length ? (
        <div className="slashCommandValidationList">
          <strong>{text.commandValidationTitle}</strong>
          {validationErrors.slice(0, 4).map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      <div className="slashCommandActions">
        <Button variant="unstyled"
          type="button"
          disabled={step === 1}
          onClick={() => onStepChange(Math.max(1, step - 1))}
        >
          {slashText.previous}
        </Button>
        {step < steps.length ? (
          <Button variant="unstyled"
            type="button"
            onClick={() => onStepChange(Math.min(steps.length, step + 1))}
          >
            {slashText.next}
          </Button>
        ) : (
          <Button variant="unstyled"
            type="button"
            onClick={onSave}
            disabled={validationErrors.length > 0}
          >
            {text.saveCommand}
          </Button>
        )}
        <Button variant="unstyled" type="button" onClick={onOpenEditor}>
          {slashText.openFullEditor}
        </Button>
      </div>
    </section>
  );
}

// Vue d’ensemble commande.


export function CommandOverview({
  draft,
  command,
  guildName,
  text,
  validationErrors,
  onSave,
  onDuplicate,
  onExport,
}: {
  draft: ApplicationCommandDraft;
  command: ApplicationCommandSummary | null;
  guildName: string | null;
  text: UiText;
  validationErrors: string[];
  onSave: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}) {
  const slashText = slashLabels(text);
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{slashText.overview}</p>
          <h3>{draftCommandDisplayName(draft)}</h3>
          <p>{draft.description || commandTypeLabel(draft.type, text)}</p>
        </div>
        <div className="slashCommandActions">
          <Button variant="unstyled"
            type="button"
            onClick={onSave}
            disabled={validationErrors.length > 0}
          >
            {text.saveCommand}
          </Button>
          <Button variant="unstyled" type="button">{slashText.test}</Button>
          <Button variant="unstyled" type="button">{slashText.disable}</Button>
          <Button variant="unstyled" type="button" onClick={onDuplicate}>
            {text.duplicateCommand}
          </Button>
          <Button variant="unstyled" type="button" onClick={onExport}>
            {slashText.export}
          </Button>
        </div>
      </div>
      <div className="commandStudioMetricGrid">
        <CommandMetric
          label={slashText.type}
          value={
            commandExecutionModeFromDraft(draft) === "prefix"
              ? slashText.textPrefixCommand
              : commandTypeLabel(draft.type, text)
          }
        />
        <CommandMetric
          label={slashText.state}
          value={slashText.enabled}
          tone="good"
        />
        <CommandMetric
          label={slashText.scope}
          value={
            draft.scope === "global"
              ? text.commandScopeGlobal
              : text.commandScopeGuild
          }
        />
        <CommandMetric
          label={slashText.bot}
          value={command?.applicationId ?? slashText.activeBot}
        />
        <CommandMetric
          label={slashText.guild}
          value={
            draft.scope === "guild"
              ? (guildName ?? draft.guildId ?? text.currentServer)
              : slashText.allGuilds
          }
        />
        <CommandMetric
          label={
            commandExecutionModeFromDraft(draft) === "prefix"
              ? slashText.lastLocalSave
              : slashText.lastDiscordSync
          }
          value={
            command?.updatedAt
              ? formatTime(command.updatedAt)
              : slashText.notSyncedYet
          }
        />
        <CommandMetric
          label={slashText.lastError}
          value={validationErrors[0] ?? slashText.noError}
          tone={validationErrors.length ? "bad" : "good"}
        />
      </div>
      <CommandWorkflowTab draft={draft} text={text} compact />
    </Panel>
  );
}

// Métrique commande.


export function CommandMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className={`commandStudioMetric${tone ? ` is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// Assistant: étapes, validation, rendu.
