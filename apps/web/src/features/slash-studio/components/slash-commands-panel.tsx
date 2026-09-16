"use client";

// Composants Slash Studio extraits de slash-studio-widgets.tsx.


import { Input } from "../../../components/ui/field";
import { Badge } from "../../../components/ui/badge";
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
import { CommandComposerPanel } from "./command-composer-panel";
import { SlashCommandJsonPanel } from "./slash-command-json-panel";

import {
  buildBotdeckPackage,
  commandConflictKey,
  commandDraftToPackageItem,
  downloadJsonPackage,
  duplicateCommandName,
  parseBotdeckPackage,
  parseJsonFileContent,
  readTextFile,
  safePackageName,
} from "@/lib/import-export/botdeck-package";
import { Button } from "../../../components/ui/button";
import { Card, Section } from "../../../components/ui/panel";

export function SlashCommandsPanel({
  commands,
  loading,
  guildName,
  context,
  text,
  guildId,
  serverAutomationConfig,
  onClose,
  onRefresh,
  onSave,
  onDelete,
  syncState,
  draftStorageKey,
}: {
  commands: {
    globalCommands: ApplicationCommandSummary[];
    guildCommands: ApplicationCommandSummary[];
    partialError?: string | null;
  };
  loading: boolean;
  guildName: string | null;
  context: SlashStudioContext;
  text: UiText;
  guildId: string | null;
  serverAutomationConfig?: GuildAutomationConfig | null;
  onClose: () => void;
  onRefresh: () => void;
  onSave: (
    draft: ApplicationCommandDraft,
    commandId?: string | null,
  ) => boolean;
  onDelete: (command: ApplicationCommandSummary) => void;
  syncState: SlashSyncState;
  draftStorageKey: string | null;
}) {
  const [mode, setMode] = useState<"list" | "composer">("list");
  const [draft, setDraft] = useState<ApplicationCommandDraft>(() => {
    const fallback = ensureCommandRuntime(
      createEmptyCommandDraft(guildId ? "guild" : "global", guildId),
    );
    return readStoredSlashCommandDraft(draftStorageKey, fallback);
  });
  const [editingCommand, setEditingCommand] =
    useState<ApplicationCommandSummary | null>(null);
  const [jsonCommand, setJsonCommand] =
    useState<ApplicationCommandSummary | null>(null);
  const commandImportInputRef = useRef<HTMLInputElement | null>(null);
  const [importedCommandDrafts, setImportedCommandDrafts] = useState<ApplicationCommandDraft[]>([]);
  const allCommands = [...commands.guildCommands, ...commands.globalCommands];
  const activeDraft = ensureCommandRuntime(draft);
  const validationErrors = validateCommandDraft(activeDraft);
  const currentGuildId = guildId ?? context.guildId ?? null;
  const defaultScope: ApplicationCommandScope = currentGuildId
    ? "guild"
    : "global";
  const slashText = slashLabels(text);
  const subtitle =
    context.label ||
    guildName ||
    (currentGuildId ? text.commandScopeGuild : text.commandScopeGlobal);
  useEffect(() => {
    if (mode === "composer" && !editingCommand)
      writeStoredSlashCommandDraft(draftStorageKey, activeDraft);
  }, [activeDraft, draftStorageKey, editingCommand, mode]);
  const openComposer = (command?: ApplicationCommandSummary | null) => {
    if (command) {
      setEditingCommand(command);
      setDraft(
        ensureCommandRuntime(commandSummaryToDraft(command, currentGuildId)),
      );
    } else {
      setEditingCommand(null);
      const fallback = ensureCommandRuntime(
        createEmptyCommandDraft(
          defaultScope,
          defaultScope === "guild" ? currentGuildId : null,
        ),
      );
      setDraft(readStoredSlashCommandDraft(draftStorageKey, fallback));
    }
    setMode("composer");
  };
  const duplicateCommand = (command: ApplicationCommandSummary) => {
    const next = commandSummaryToDraft(command, currentGuildId);
    setEditingCommand(null);
    setDraft(
      ensureCommandRuntime({
        ...next,
        id: undefined,
        name:
          `${next.name.slice(0, 26)}-copy`
            .replace(/--+/g, "-")
            .replace(/^-|-$/g, "") || "command-copy",
        raw: null,
      }),
    );
    setMode("composer");
  };
  const exportCommandDraft = (draftToExport: ApplicationCommandDraft) => {
    const safeDraft = ensureCommandRuntime(draftToExport);
    const pkg = buildBotdeckPackage({
      kind: "command",
      name: `${safeDraft.name} command`,
      items: [commandDraftToPackageItem(safeDraft)],
    });
    downloadJsonPackage(pkg, `botdeck-command-${safePackageName(safeDraft.name, "command")}.botdeck.json`);
  };
  const exportCommand = (command: ApplicationCommandSummary) => {
    exportCommandDraft(commandSummaryToDraft(command, currentGuildId));
  };
  const exportAllCommands = () => {
    const items = [
      ...importedCommandDrafts.map((draftItem) => commandDraftToPackageItem(ensureCommandRuntime(draftItem))),
      ...allCommands.map((command) =>
        commandDraftToPackageItem(ensureCommandRuntime(commandSummaryToDraft(command, currentGuildId))),
      ),
    ];
    if (!items.length) {
      window.alert("No command to export.");
      return;
    }
    const pkg = buildBotdeckPackage({
      kind: "commands",
      name: "Botdeck command pack",
      items,
    });
    downloadJsonPackage(pkg, "botdeck-commands-pack.botdeck.json");
  };
  const normalizeImportedCommands = (incomingDrafts: ApplicationCommandDraft[]) => {
    const existingNames = new Set([
      ...allCommands.map((command) => command.name.toLowerCase()),
      ...importedCommandDrafts.map((draftItem) => draftItem.name.toLowerCase()),
    ]);
    const existingKeys = new Set([
      ...allCommands.map((command) => commandConflictKey(commandSummaryToDraft(command, currentGuildId))),
      ...importedCommandDrafts.map(commandConflictKey),
    ]);
    return incomingDrafts.map((importedDraft) => {
      const normalizedDraft = ensureCommandRuntime({
        ...importedDraft,
        id: undefined,
        scope: importedDraft.scope ?? defaultScope,
        guildId: importedDraft.scope === "guild" ? (importedDraft.guildId ?? currentGuildId) : null,
      });
      const hasConflict = existingKeys.has(commandConflictKey(normalizedDraft));
      const nextDraft = hasConflict
        ? {
            ...normalizedDraft,
            name: duplicateCommandName(normalizedDraft.name, existingNames),
          }
        : normalizedDraft;
      existingNames.add(nextDraft.name.toLowerCase());
      existingKeys.add(commandConflictKey(nextDraft));
      return nextDraft;
    });
  };
  const openImportedCommand = (importedDraft: ApplicationCommandDraft) => {
    const [nextDraft] = normalizeImportedCommands([importedDraft]);
    setImportedCommandDrafts((current) => [nextDraft, ...current]);
    setEditingCommand(null);
    setDraft(nextDraft);
    setMode("composer");
  };
  const openLocalImportedDraft = (importedDraft: ApplicationCommandDraft) => {
    setEditingCommand(null);
    setDraft(importedDraft);
    setMode("composer");
  };
  const handleCommandPackageImport = async (file: File) => {
    try {
      const parsed = parseJsonFileContent(await readTextFile(file));
      const { package: pkg, validation } = parseBotdeckPackage(parsed);
      if (!pkg) {
        openImportedCommand(importedJsonToDraft(parsed, defaultScope, currentGuildId));
        return;
      }
      if (!validation.valid) {
        window.alert(validation.reason ?? "Invalid Botdeck package.");
        return;
      }
      const commandItems = pkg.items.filter((item) => item.kind === "command");
      if (!commandItems.length) {
        window.alert("This package does not contain commands.");
        return;
      }
      if (commandItems.length > 1) {
        const confirmed = window.confirm(`Import ${commandItems.length} commands as local drafts? Nothing will sync to Discord.`);
        if (!confirmed) return;
      }
      const importedDrafts = normalizeImportedCommands(commandItems.map((item) => item.draft));
      setImportedCommandDrafts((current) => [...importedDrafts, ...current]);
      setEditingCommand(null);
      setDraft(importedDrafts[0]);
      setMode("composer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not import command.");
    } finally {
      if (commandImportInputRef.current) commandImportInputRef.current.value = "";
    }
  };
  const saveCurrentDraft = () => {
    if (!onSave(activeDraft, editingCommand?.id ?? null)) return;
    clearStoredSlashCommandDraft(draftStorageKey);
    setMode("list");
  };
  const renderImportedDraftCard = (draftItem: ApplicationCommandDraft) => (
    <Card
      key={`imported-${draftItem.type}-${draftItem.name}`}
      className="slashCommandCard"
    >
      <div className="slashCommandCardMain">
        <div>
          <strong>
            {draftItem.type === "chat_input" ? "/" : ""}
            {draftItem.name}
          </strong>
          <p>{draftItem.description || i18nText("Imported local draft")}</p>
        </div>
        <span className="slashCommandScope">{i18nText("Imported draft")}</span>
      </div>
      <div className="slashCommandMeta">
        <span>{commandTypeLabel(draftItem.type === "user" ? "User" : draftItem.type === "message" ? "Message" : "Chat Input", text)}</span>
        <span>{i18nText("Not synced")}</span>
      </div>
      <div className="slashCommandActions">
        <Button variant="unstyled" type="button" onClick={() => openLocalImportedDraft(draftItem)}>
          {i18nText("Edit draft")}
        </Button>
        <Button variant="unstyled" type="button" onClick={() => exportCommandDraft(draftItem)}>
          {i18nText("Export")}
        </Button>
        <Button variant="unstyled"
          type="button"
          className="dangerButton"
          onClick={() =>
            setImportedCommandDrafts((current) => current.filter((item) => item !== draftItem))
          }
        >
          {i18nText("Remove")}
        </Button>
      </div>
    </Card>
  );

  const renderCommandCard = (command: ApplicationCommandSummary) => (
    <Card
      key={`${command.scope}-${command.id}`}
      className="slashCommandCard"
    >
      <div className="slashCommandCardMain">
        <div>
          <strong>
            {command.type === "Chat Input" ? "/" : ""}
            {command.name}
          </strong>
          <p>{command.description || commandTypeLabel(command.type, text)}</p>
        </div>
        <span className="slashCommandScope">
          {command.scope === "global"
            ? text.commandScopeGlobal
            : text.commandScopeGuild}
        </span>
        {syncState.commandId === command.id ? (
          <Badge className={`slashCommandSyncBadge is-${syncState.status}`} tone="unstyled">
            {syncState.status === "syncing"
              ? slashText.syncing
              : syncState.status === "synced"
                ? slashText.synced
                : syncState.status === "error"
                  ? slashText.error
                  : slashText.local}
          </Badge>
        ) : null}
      </div>
      <div className="slashCommandMeta">
        <span>{commandTypeLabel(command.type, text)}</span>
        {command.defaultMemberPermissions ? (
          <span>
            {commandPermissionPresetLabel(command.defaultMemberPermissions)}
          </span>
        ) : (
          <span>{slashText.everyone}</span>
        )}
        {command.updatedAt ? (
          <span>{formatTime(command.updatedAt)}</span>
        ) : null}
      </div>
      {Array.isArray(command.raw.options) && command.raw.options.length ? (
        <div className="slashCommandOptions">
          {command.raw.options.slice(0, 6).map((option, index) => (
            <span key={String((option as { name?: unknown }).name ?? index)}>
              {String(
                (option as { name?: unknown }).name ?? `option-${index + 1}`,
              )}
            </span>
          ))}
        </div>
      ) : null}
      <div className="slashCommandActions">
        <Button variant="unstyled" type="button" onClick={() => openComposer(command)}>
          {text.editCommand}
        </Button>
        <Button variant="unstyled" type="button" onClick={() => duplicateCommand(command)}>
          {text.duplicateCommand}
        </Button>
        <Button variant="unstyled" type="button" onClick={() => exportCommand(command)}>
          {i18nText("Export")}
        </Button>
        <Button variant="unstyled" type="button" onClick={() => setJsonCommand(command)}>
          {text.viewJson}
        </Button>
        <Button variant="unstyled"
          type="button"
          className="dangerButton"
          onClick={() => onDelete(command)}
        >
          {text.deleteCommand}
        </Button>
      </div>
    </Card>
  );

  const studioHealth =
    commands.partialError || syncState.status === "error"
      ? "isError"
      : syncState.status === "syncing"
        ? "isWarn"
        : "isOk";
  const studioHealthLabel =
    syncState.status === "syncing"
      ? "Sync en cours"
      : commands.partialError || syncState.status === "error"
        ? "À vérifier"
        : "Prêt";
  return (
    <>
      <section className="slashStudioPage" aria-label={i18nText("Slash Studio")}>
        <header className="slashStudioPageHeader">
          <div className="slashStudioPageTitle">
            <div>
              <p>{i18nText("Slash Studio")}</p>
              <h2>
                {mode === "composer"
                  ? slashText.commandComposer
                  : text.slashCommands}
              </h2>
              <span>
                {subtitle}
                {guildName ? ` · ${guildName}` : ""}
              </span>
            </div>
          </div>
          <div className="slashStudioPageActions">
            <strong className={studioHealth}>{studioHealthLabel}</strong>
            <Button variant="unstyled" type="button" onClick={onClose}>
              {text.close}
            </Button>
          </div>
        </header>

        <div className="slashStudioPageScroll">
          <section className="slashStudioWorkspace">
            <aside
              className="slashStudioRail"
              aria-label={i18nText("Actions Slash Studio")}
            >
              <div className="slashStudioRailHead">
                <span>{i18nText("Workspace")}</span>
                <strong>{allCommands.length} {i18nText("commande(s)")}</strong>
              </div>
              <Button variant="unstyled"
                type="button"
                className={mode === "list" ? "isActive" : ""}
                onClick={() => {
                  setMode("list");
                  onRefresh();
                }}
              >
                <strong>{text.commandList}</strong>
              </Button>
              <Button variant="unstyled"
                type="button"
                className={
                  mode === "composer" && !editingCommand ? "isActive" : ""
                }
                onClick={() => openComposer(null)}
              >
                <strong>{text.createCommand}</strong>
              </Button>
              <Button variant="unstyled" type="button" onClick={onRefresh} disabled={loading}>
                <strong>
                  {loading ? text.refreshCommandsLoading : text.refreshCommands}
                </strong>
              </Button>
              <Button variant="unstyled" type="button" onClick={() => commandImportInputRef.current?.click()}>
                <strong>{i18nText("Import")}</strong>
              </Button>
              <Button variant="unstyled" type="button" onClick={exportAllCommands} disabled={!allCommands.length}>
                <strong>{i18nText("Export all")}</strong>
              </Button>
              <Input
                ref={commandImportInputRef}
                type="file"
                accept=".json,.botdeck.json,application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleCommandPackageImport(file);
                }}
              />
            </aside>

            <main className="slashStudioMain">
              {mode === "list" ? (
                <div className="slashStudioCommandBoard">
                  {importedCommandDrafts.length ? (
                    <Section className="slashCommandsPanelSection">
                      <div className="slashCommandsSectionHeader">
                        <h3>{i18nText("Imported drafts")}</h3>
                        <span>{importedCommandDrafts.length}</span>
                      </div>
                      <div className="slashCommandCards">
                        {importedCommandDrafts.map(renderImportedDraftCard)}
                      </div>
                    </Section>
                  ) : null}
                  <Section className="slashCommandsPanelSection">
                    <div className="slashCommandsSectionHeader">
                      <h3>{text.guildCommands}</h3>
                      <span>{commands.guildCommands.length}</span>
                    </div>
                    {commands.guildCommands.length ? (
                      <div className="slashCommandCards">
                        {commands.guildCommands.map(renderCommandCard)}
                      </div>
                    ) : (
                      <div className="slashCommandsEmpty">
                        {text.noSlashCommands}
                      </div>
                    )}
                  </Section>
                  <Section className="slashCommandsPanelSection">
                    <div className="slashCommandsSectionHeader">
                      <h3>{text.globalCommands}</h3>
                      <span>{commands.globalCommands.length}</span>
                    </div>
                    {commands.globalCommands.length ? (
                      <div className="slashCommandCards">
                        {commands.globalCommands.map(renderCommandCard)}
                      </div>
                    ) : (
                      <div className="slashCommandsEmpty">
                        {text.noSlashCommands}
                      </div>
                    )}
                  </Section>
                </div>
              ) : (
                <div className="slashStudioComposerSurface">
                  <CommandComposerPanel
                    draft={activeDraft}
                    guildId={currentGuildId}
                    guildName={guildName}
                    editing={Boolean(editingCommand)}
                    text={text}
                    validationErrors={validationErrors}
                    serverAutomationConfig={serverAutomationConfig}
                    onBack={() => {
                      setMode("list");
                      onRefresh();
                    }}
                    onDraftChange={setDraft}
                    onSave={saveCurrentDraft}
                  />
                </div>
              )}
            </main>
          </section>
        </div>
      </section>
      {jsonCommand ? (
        <SlashCommandJsonPanel
          command={jsonCommand}
          text={text}
          onClose={() => setJsonCommand(null)}
        />
      ) : null}
    </>
  );
}

// Tableau santé bot.


// Crée une option compositeur.
// Crée un champ embed.












// Relit les réponses modale.




// Compositeur: identité, réponse, options.
