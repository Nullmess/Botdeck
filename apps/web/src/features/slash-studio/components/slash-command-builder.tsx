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
import { Button } from "../../../components/ui/button";

export function SlashCommandBuilder({
  draft,
  guildId,
  editing,
  text,
  validationErrors,
  onDraftChange,
  onSave,
  onReset,
}: {
  draft: ApplicationCommandDraft;
  guildId: string | null;
  editing: boolean;
  text: UiText;
  validationErrors: string[];
  onDraftChange: (draft: ApplicationCommandDraft) => void;
  onSave: () => void;
  onReset: () => void;
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
  return (
    <section className="slashCommandBuilder">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Structure Discord")}</p>
          <h3>{i18nText("Definition officielle")}</h3>
          <p>
            {i18nText("Validation live des limites Discord: nom, description, options, choices, permissions, contextes et installations.")}
          </p>
        </div>
      </div>
      <div className="slashCommandFormGrid">
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
        <label>
          <span>{text.commandType}</span>
          <Select
            value={draft.type}
            onChange={(event) =>
              update(
                "type",
                event.target.value as ApplicationCommandDraft["type"],
              )
            }
          >
            {commandDraftTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
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
              onChange={(event) => update("description", event.target.value)}
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
        <label>
          <span>{text.defaultPermissions} {i18nText("raw")}</span>
          <Input
            value={draft.defaultMemberPermissions ?? ""}
            onChange={(event) =>
              update("defaultMemberPermissions", event.target.value || null)
            }
            placeholder={i18nText("bitfield string")}
          />
        </label>
      </div>
      <div className="slashCommandToggleGrid">
        <label>
          <Input
            type="checkbox"
            checked={draft.nsfw === true}
            onChange={(event) => update("nsfw", event.target.checked)}
          />{" "}
          {text.nsfwCommand}
        </label>
        <label>
          <Input
            type="checkbox"
            checked={draft.dmPermission === true}
            onChange={(event) => update("dmPermission", event.target.checked)}
          />{" "}
          {text.dmPermission}
        </label>
      </div>
      <CommandMultiSelect
        title={text.contexts}
        values={draft.contexts ?? []}
        options={["guild", "bot_dm", "private_channel"]}
        onChange={(values) =>
          update("contexts", values as ApplicationCommandDraft["contexts"])
        }
      />
      <CommandMultiSelect
        title={text.integrationTypes}
        values={draft.integrationTypes ?? []}
        options={["guild_install", "user_install"]}
        onChange={(values) =>
          update(
            "integrationTypes",
            values as ApplicationCommandDraft["integrationTypes"],
          )
        }
      />
      {draft.type === "chat_input" ? (
        <SlashCommandOptionsEditor
          options={draft.options}
          text={text}
          depth={0}
          onChange={(options) => update("options", options)}
        />
      ) : null}
      {validationErrors.length ? (
        <div className="slashCommandValidationList">
          <strong>{text.commandValidationTitle}</strong>
          {validationErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
      <p className="permissionPanelHint">{text.finePermissionsNote}</p>
      <div className="slashCommandActions">
        <Button variant="unstyled"
          type="button"
          onClick={onSave}
          disabled={validationErrors.length > 0}
        >
          {editing ? text.saveCommand : text.createCommand}
        </Button>
        <Button variant="unstyled" type="button" onClick={onReset}>
          {text.resetBuilder}
        </Button>
      </div>
    </section>
  );
}

// Sélection multiple commande.


export function CommandMultiSelect({
  title,
  values,
  options,
  onChange,
}: {
  title: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="slashCommandMultiSelect">
      <strong>{title}</strong>
      {options.map((option) => (
        <label key={option}>
          <Input
            type="checkbox"
            checked={values.includes(option)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...values, option]
                  : values.filter((item) => item !== option),
              )
            }
          />{" "}
          {option}
        </label>
      ))}
    </div>
  );
}

// Éditeur options slash.


export function SlashCommandOptionsEditor({
  options,
  text,
  depth,
  onChange,
}: {
  options: ApplicationCommandDraftOption[];
  text: UiText;
  depth: number;
  onChange: (options: ApplicationCommandDraftOption[]) => void;
}) {
  const updateOption = (
    id: string,
    patch: Partial<ApplicationCommandDraftOption>,
  ) =>
    onChange(
      options.map((option) =>
        option.id === id ? { ...option, ...patch } : option,
      ),
    );
  const removeOption = (id: string) =>
    onChange(options.filter((option) => option.id !== id));
  const moveOption = (id: string, direction: -1 | 1) => {
    const index = options.findIndex((option) => option.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= options.length) return;
    const next = options.slice();
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };
  return (
    <div className="slashCommandOptionBuilder" data-depth={depth}>
      <div className="slashCommandOptionHeader">
        <h3>{text.commandOptionsBuilder}</h3>
        <Button variant="unstyled"
          type="button"
          onClick={() => onChange([...options, createDraftOption()])}
          disabled={options.length >= 25}
        >
          {text.addOption}
        </Button>
      </div>
      {options.map((option) => (
        <article key={option.id} className="slashCommandOptionCard">
          <div className="slashCommandFormGrid">
            <label>
              <span>{i18nText("Type")}</span>
              <Select
                value={option.type}
                onChange={(event) =>
                  updateOption(option.id, {
                    type: event.target
                      .value as ApplicationCommandDraftOption["type"],
                    options: [],
                    choices: [],
                  })
                }
              >
                {commandOptionTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>{text.commandName}</span>
              <Input
                value={option.name}
                onChange={(event) =>
                  updateOption(option.id, { name: event.target.value })
                }
              />
            </label>
            <label>
              <span>{text.commandDescription}</span>
              <Input
                value={option.description}
                onChange={(event) =>
                  updateOption(option.id, { description: event.target.value })
                }
              />
            </label>
            {option.type !== "sub_command" &&
            option.type !== "sub_command_group" ? (
              <label>
                <span>{i18nText("Required")}</span>
                <Input
                  type="checkbox"
                  checked={option.required}
                  onChange={(event) =>
                    updateOption(option.id, { required: event.target.checked })
                  }
                />
              </label>
            ) : null}
            {["integer", "number"].includes(option.type) ? (
              <label>
                <span>{i18nText("Min value")}</span>
                <Input
                  type="number"
                  value={option.minValue ?? ""}
                  onChange={(event) =>
                    updateOption(option.id, {
                      minValue: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
            ) : null}
            {["integer", "number"].includes(option.type) ? (
              <label>
                <span>{i18nText("Max value")}</span>
                <Input
                  type="number"
                  value={option.maxValue ?? ""}
                  onChange={(event) =>
                    updateOption(option.id, {
                      maxValue: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
            ) : null}
            {option.type === "string" ? (
              <label>
                <span>{i18nText("Min length")}</span>
                <Input
                  type="number"
                  value={option.minLength ?? ""}
                  onChange={(event) =>
                    updateOption(option.id, {
                      minLength: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
            ) : null}
            {option.type === "string" ? (
              <label>
                <span>{i18nText("Max length")}</span>
                <Input
                  type="number"
                  value={option.maxLength ?? ""}
                  onChange={(event) =>
                    updateOption(option.id, {
                      maxLength: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </label>
            ) : null}
          </div>
          {["string", "integer", "number"].includes(option.type) ? (
            <ChoiceEditor
              option={option}
              text={text}
              onChange={(patch) => updateOption(option.id, patch)}
            />
          ) : null}
          {option.type === "channel" ? (
            <label className="slashCommandWideLabel">
              <span>{i18nText("Channel types CSV")}</span>
              <Input
                value={option.channelTypes.join(",")}
                onChange={(event) =>
                  updateOption(option.id, {
                    channelTypes: event.target.value
                      .split(",")
                      .map((item) => Number.parseInt(item.trim(), 10))
                      .filter(Number.isFinite),
                  })
                }
                placeholder="0,2,5,10,11,12,13,15"
              />
            </label>
          ) : null}
          {option.type === "sub_command" ||
          option.type === "sub_command_group" ? (
            <SlashCommandOptionsEditor
              options={option.options}
              text={text}
              depth={depth + 1}
              onChange={(children) =>
                updateOption(option.id, { options: children })
              }
            />
          ) : null}
          <div className="slashCommandActions">
            <Button variant="unstyled" type="button" onClick={() => moveOption(option.id, -1)}>
              ↑
            </Button>
            <Button variant="unstyled" type="button" onClick={() => moveOption(option.id, 1)}>
              ↓
            </Button>
            <Button variant="unstyled"
              type="button"
              className="dangerButton"
              onClick={() => removeOption(option.id)}
            >
              {text.remove}
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

// Éditeur de choix.


export function ChoiceEditor({
  option,
  text,
  onChange,
}: {
  option: ApplicationCommandDraftOption;
  text: UiText;
  onChange: (patch: Partial<ApplicationCommandDraftOption>) => void;
}) {
  const updateChoice = (
    index: number,
    key: "name" | "value",
    value: string,
  ) => {
    const choices = option.choices.map((choice, choiceIndex) =>
      choiceIndex === index
        ? {
            ...choice,
            [key]:
              key === "value" && option.type !== "string"
                ? Number(value)
                : value,
          }
        : choice,
    );
    onChange({ choices });
  };
  return (
    <div className="slashCommandChoiceRows">
      <label>
        <Input
          type="checkbox"
          checked={option.autocomplete}
          onChange={(event) =>
            onChange({
              autocomplete: event.target.checked,
              choices: event.target.checked ? [] : option.choices,
            })
          }
        />{" "}
        {i18nText("Autocomplete")}
      </label>
      {!option.autocomplete ? (
        <Button variant="unstyled"
          type="button"
          onClick={() =>
            onChange({
              choices: [
                ...option.choices,
                {
                  name: "choice",
                  value: option.type === "string" ? "value" : 1,
                },
              ],
            })
          }
          disabled={option.choices.length >= 25}
        >
          {text.addChoice}
        </Button>
      ) : null}
      {option.choices.map((choice, index) => (
        <div key={index} className="slashCommandChoiceRow">
          <Input
            value={choice.name}
            onChange={(event) =>
              updateChoice(index, "name", event.target.value)
            }
          />
          <Input
            value={String(choice.value)}
            onChange={(event) =>
              updateChoice(index, "value", event.target.value)
            }
          />
          <Button variant="unstyled"
            type="button"
            onClick={() =>
              onChange({
                choices: option.choices.filter(
                  (_, choiceIndex) => choiceIndex !== index,
                ),
              })
            }
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}

// Onglet commande workflow.
