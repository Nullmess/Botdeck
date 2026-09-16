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
import { CommandComposerPanelHeader, CommandExecutionStep, CommandIdentityStep, CommandBehaviorStep, CommandContentStep, CommandAccessStep, CommandBlockingErrors } from "./command-composer-steps";
import { Button } from "../../../components/ui/button";

export function CommandComposerPanel({
  draft,
  guildId,
  guildName,
  editing,
  text,
  validationErrors,
  serverAutomationConfig,
  onBack,
  onDraftChange,
  onSave,
}: {
  draft: ApplicationCommandDraft;
  guildId: string | null;
  guildName: string | null;
  editing: boolean;
  text: UiText;
  validationErrors: string[];
  serverAutomationConfig?: GuildAutomationConfig | null;
  onBack: () => void;
  onDraftChange: (draft: ApplicationCommandDraft) => void;
  onSave: () => void;
}) {
  const [step, setStep] = useState(0);
  const completeDraft = ensureCommandRuntime(draft);
  const runtime = completeDraft.runtime!;
  const metadata = commandRuntimeMetadata(completeDraft);
  const executionMode = commandExecutionModeFromDraft(completeDraft);
  const responseMode = commandResponseModeFromDraft(completeDraft);
  const prefix = typeof metadata.prefix === "string" ? metadata.prefix : "&";
  const update = <K extends keyof ApplicationCommandDraft>(
    key: K,
    value: ApplicationCommandDraft[K],
  ) => onDraftChange({ ...completeDraft, [key]: value });
  const updateResponse = (content: string) =>
    onDraftChange({
      ...completeDraft,
      runtime: {
        ...runtime,
        response: {
          ...runtime.response,
          content,
        },
      },
    });
  const updateResponseVisibility = (
    visibility: ApplicationCommandRuntimeDefinition["response"]["visibility"],
  ) =>
    onDraftChange({
      ...completeDraft,
      runtime: {
        ...runtime,
        response: {
          ...runtime.response,
          visibility,
        },
      },
    });
  const setScope = (scope: ApplicationCommandScope) =>
    onDraftChange({
      ...completeDraft,
      scope,
      guildId: scope === "guild" ? guildId : null,
    });
  const setExecutionMode = (mode: CommandExecutionMode) => {
    const nextType = mode === "prefix" ? "chat_input" : mode;
    const next = patchCommandRuntime(
      {
        ...completeDraft,
        type: nextType,
        description: nextType === "chat_input" ? completeDraft.description : "",
        options: nextType === "chat_input" ? completeDraft.options : [],
      },
      { executionMode: mode, prefix },
    );
    onDraftChange(
      mode === "prefix" && next.runtime?.response.visibility === "ephemeral"
        ? {
            ...next,
            runtime: {
              ...next.runtime,
              response: { ...next.runtime.response, visibility: "public" },
            },
          }
        : next,
    );
  };
  const setPrefix = (value: string) =>
    onDraftChange(
      patchCommandRuntime(completeDraft, {
        executionMode: "prefix",
        prefix: value || "&",
      }),
    );
  const setResponseMode = (mode: CommandResponseMode) => {
    let modePatch: Record<string, unknown> = { responseMode: mode };
    if (mode === "welcome") {
      modePatch = {
        responseMode: mode,
        welcomeChannelOption: "salon",
        welcomeMessageType: welcomeMessageTypeFromMetadata(metadata),
        welcomeMessage:
          typeof metadata.welcomeMessage === "string"
            ? metadata.welcomeMessage
            : i18nText("Bienvenue {user.mention} sur {guild.name} !"),
        welcomeRemoveConfirmation:
          typeof metadata.welcomeRemoveConfirmation === "string"
            ? metadata.welcomeRemoveConfirmation
            : i18nText("Le salon welcome a été retiré pour {channel.mention}."),
        ...automationMetadataPatch("welcome", serverAutomationConfig),
      };
    } else if (mode === "goodbye") {
      modePatch = {
        responseMode: mode,
        goodbyeChannelOption: "salon",
        goodbyeMessageType: goodbyeMessageTypeFromMetadata(metadata),
        goodbyeMessage:
          typeof metadata.goodbyeMessage === "string"
            ? metadata.goodbyeMessage
            : "👋 {user.displayName} a quitté {guild.name}. Nous sommes maintenant {member.count} membres.",
        goodbyeRemoveConfirmation:
          typeof metadata.goodbyeRemoveConfirmation === "string"
            ? metadata.goodbyeRemoveConfirmation
            : i18nText("Le salon goodbye a été retiré pour {channel.mention}."),
        ...automationMetadataPatch("goodbye", serverAutomationConfig),
      };
    } else if (mode === "logs") {
      modePatch = {
        responseMode: mode,
        logsChannelOption: "salon",
        logsSetConfirmation:
          typeof metadata.logsSetConfirmation === "string"
            ? metadata.logsSetConfirmation
            : "Le salon logs a été mis à jour: {channel.mention}.",
        logsRemoveConfirmation:
          typeof metadata.logsRemoveConfirmation === "string"
            ? metadata.logsRemoveConfirmation
            : "Le salon logs a été retiré pour {channel.mention}.",
        logsDefaultMode:
          typeof metadata.logsDefaultMode === "string"
            ? metadata.logsDefaultMode
            : "message",
        ...automationMetadataPatch("logs", serverAutomationConfig),
      };
    }
    let next = patchCommandRuntime(completeDraft, modePatch);
    if (mode === "modal" && !next.runtime?.response.content.trim()) {
      next = {
        ...next,
        runtime: {
          ...next.runtime!,
          response: {
            ...next.runtime!.response,
            content: "Recherche reçue pour {query}",
          },
        },
      };
    }
    if (mode === "welcome" || mode === "goodbye" || mode === "logs") {
      const hasEventChannel = next.options.some(
        (option) => option.name === "salon" && option.type === "channel",
      );
      next = {
        ...next,
        type: "chat_input",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        options: hasEventChannel
          ? next.options
          : [
              createComposerOption(
                "channel",
                "salon",
                mode === "welcome"
                  ? "Salon où envoyer les messages de bienvenue"
                  : mode === "goodbye"
                    ? "Salon où envoyer les messages de départ"
                    : "Salon où envoyer les logs",
                true,
              ),
              ...next.options,
            ],
        runtime: {
          ...next.runtime!,
          response: {
            ...next.runtime!.response,
            content: next.runtime?.response.content?.trim()
              ? next.runtime.response.content
              : mode === "welcome"
                ? i18nText("Le salon welcome a été mis à jour: {channel.mention}.")
                : mode === "goodbye"
                  ? i18nText("Le salon goodbye a été mis à jour: {channel.mention}.")
                  : "Le salon logs a été mis à jour: {channel.mention}.",
            visibility: "ephemeral",
          },
        },
      };
    }
    if (mode === "autorole") {
      next = {
        ...next,
        type: "chat_input",
        name: next.name || "autorole",
        description: next.description || "Manage automatic server roles",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "268435456",
        options: createAutoRoleCommandOptions(),
        runtime: {
          ...next.runtime!,
          response: {
            ...next.runtime!.response,
            content: next.runtime?.response.content?.trim()
              ? next.runtime.response.content
              : "Rôles automatiques mis à jour.",
            visibility: "ephemeral",
          },
        },
      };
    }
    if (mode === "ban" || mode === "unban" || mode === "kick") {
      const defaultContent =
        mode === "ban"
          ? "🔨 {target.mention} a été banni. Raison: {reason}"
          : mode === "unban"
            ? "✅ {target.mention} a été débanni. Raison: {reason}"
            : "👢 {target.mention} a été expulsé. Raison: {reason}";
      next = {
        ...next,
        type: "chat_input",
        name: next.name || mode,
        description:
          next.description ||
          (mode === "ban"
            ? "Ban a member"
            : mode === "unban"
              ? "Unban a user"
              : "Kick a member"),
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: mode === "kick" ? "2" : "4",
        options: createModerationCommandOptions(mode),
        runtime: {
          ...next.runtime!,
          response: {
            ...next.runtime!.response,
            content: next.runtime?.response.content?.trim()
              ? next.runtime.response.content
              : defaultContent,
            visibility: "ephemeral",
          },
        },
      };
      next = patchCommandRuntime(next, {
        responseMode: mode,
        moderationAction: mode,
        moderationResponseType:
          typeof metadata.moderationResponseType === "string"
            ? metadata.moderationResponseType
            : "message",
      });
    }
    onDraftChange(next);
  };
  const updateRuntimeMetadata = (patch: Record<string, unknown>) =>
    onDraftChange(patchCommandRuntime(completeDraft, patch));
  const setAvailability = (availability: CommandAvailability) => {
    const patch = commandAvailabilityPatch(availability);
    onDraftChange({
      ...completeDraft,
      ...patch,
      defaultMemberPermissions:
        availability === "dm" ? null : completeDraft.defaultMemberPermissions,
      guildId:
        patch.scope === "guild"
          ? guildId
          : patch.guildId === null
            ? null
            : completeDraft.guildId,
    });
  };
  const canContinue =
    step === 0
      ? executionMode.length > 0
      : step === 1
        ? completeDraft.name.trim().length > 0 &&
          (completeDraft.type !== "chat_input" ||
            completeDraft.description.trim().length > 0)
        : step === 2
          ? responseMode.length > 0
          : step === 3
            ? responseMode === "modal" ||
              responseMode === "welcome" ||
              responseMode === "goodbye" ||
              responseMode === "logs" ||
              runtime.response.content.trim().length > 0
            : validationErrors.length === 0;
  const slashText = slashLabels(text);
  const wizardText = wizardLabels(text);
  const requestSave = () => {
    if (validationErrors.length) return;
    onSave();
  };

  return (
    <div className="commandComposerShell isFeelGood">
      <section className="commandComposerMain isFeelGood">
        <CommandComposerPanelHeader
          draft={completeDraft}
          editing={editing}
          guildName={guildName}
          text={text}
          onBack={onBack}
        />

        <div className="commandFlowShell">
          <nav
            className="commandFlowSteps"
            aria-label={slashText.commandCreation}
          >
            {wizardText.creationSteps.map((label, index) => (
              <Button variant="unstyled"
                key={label}
                type="button"
                className={
                  step === index ? "isActive" : step > index ? "isDone" : ""
                }
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                {label}
              </Button>
            ))}
          </nav>

          <section className="commandFlowCard">
            {step === 0 ? (
              <CommandExecutionStep
                mode={executionMode}
                prefix={prefix}
                text={text}
                onPrefixChange={setPrefix}
                onModeChange={setExecutionMode}
              />
            ) : null}
            {step === 1 ? (
              <CommandIdentityStep
                draft={completeDraft}
                text={text}
                onUpdate={update}
              />
            ) : null}
            {step === 2 ? (
              <CommandBehaviorStep
                mode={responseMode}
                text={text}
                onModeChange={setResponseMode}
              />
            ) : null}
            {step === 3 ? (
              <CommandContentStep
                draft={completeDraft}
                responseMode={responseMode}
                response={runtime.response.content}
                metadata={metadata}
                text={text}
                onResponseChange={updateResponse}
                onMetadataChange={updateRuntimeMetadata}
              />
            ) : null}
            {step === 4 ? (
              <CommandAccessStep
                draft={completeDraft}
                text={text}
                guildId={guildId}
                visibility={runtime.response.visibility}
                onScopeChange={setScope}
                onAvailabilityChange={setAvailability}
                onUpdate={update}
                onVisibilityChange={updateResponseVisibility}
              />
            ) : null}
            {validationErrors.length && step === 4 ? (
              <CommandBlockingErrors validationErrors={validationErrors} />
            ) : null}
          </section>

          <div className="commandFlowActions">
            <Button variant="unstyled"
              type="button"
              className="secondaryButton"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              {slashText.previous}
            </Button>
            {step < wizardText.creationSteps.length - 1 ? (
              <Button variant="unstyled"
                type="button"
                onClick={() =>
                  setStep(
                    Math.min(wizardText.creationSteps.length - 1, step + 1),
                  )
                }
                disabled={!canContinue}
              >
                {slashText.next}
              </Button>
            ) : (
              <Button variant="unstyled"
                type="button"
                onClick={requestSave}
                disabled={validationErrors.length > 0}
              >
                {editing ? slashText.applyChanges : slashText.createAndApply}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// En-tête du compositeur commande.
