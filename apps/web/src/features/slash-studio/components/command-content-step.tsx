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
import { CommandModalResponseDesigner } from "./command-modal-response-designer";
import { Button } from "../../../components/ui/button";
import { Tabs, TabButton } from "../../../components/ui/tabs";


export function CommandContentStep({
  draft,
  responseMode,
  response,
  metadata,
  text,
  onResponseChange,
  onMetadataChange,
}: {
  draft: ApplicationCommandDraft;
  responseMode: CommandResponseMode;
  response: string;
  metadata: Record<string, unknown>;
  text: UiText;
  onResponseChange: (content: string) => void;
  onMetadataChange: (patch: Record<string, unknown>) => void;
}) {
  const wizardText = wizardLabels(text);
  const [activePage, setActivePage] = useState(0);
  const [activeFieldByPage, setActiveFieldByPage] = useState<
    Record<string, string | null>
  >({});
  const [activeLogEventKey, setActiveLogEventKey] =
    useState<LogEventKey>("message_edit");
  const [embedPane, setEmbedPane] = useState<"customize" | "preview">(
    "customize",
  );
  const embedPages = embedPagesFromMetadata(draft, metadata, response);
  const modalTitle =
    typeof metadata.modalTitle === "string" ? metadata.modalTitle : "Recherche";
  const modalField =
    typeof metadata.modalField === "string" ? metadata.modalField : "query";
  const welcomeMessage =
    typeof metadata.welcomeMessage === "string"
      ? metadata.welcomeMessage
      : i18nText("Bienvenue {user.mention} sur {guild.name} !");
  const welcomeRemoveConfirmation =
    typeof metadata.welcomeRemoveConfirmation === "string"
      ? metadata.welcomeRemoveConfirmation
      : i18nText("Le salon welcome a été retiré pour {channel.mention}.");
  const welcomeMessageType = welcomeMessageTypeFromMetadata(metadata);
  const welcomeEmbedPages = welcomeEmbedPagesFromMetadata(
    draft,
    metadata,
    welcomeMessage,
  );
  const goodbyeMessage =
    typeof metadata.goodbyeMessage === "string"
      ? metadata.goodbyeMessage
      : "👋 {user.displayName} a quitté {guild.name}. Nous sommes maintenant {member.count} membres.";
  const goodbyeRemoveConfirmation =
    typeof metadata.goodbyeRemoveConfirmation === "string"
      ? metadata.goodbyeRemoveConfirmation
      : i18nText("Le salon goodbye a été retiré pour {channel.mention}.");
  const logsRemoveConfirmation =
    typeof metadata.logsRemoveConfirmation === "string"
      ? metadata.logsRemoveConfirmation
      : "Le salon logs a été retiré pour {channel.mention}.";
  const goodbyeMessageType = goodbyeMessageTypeFromMetadata(metadata);
  const goodbyeEmbedPages = goodbyeEmbedPagesFromMetadata(
    draft,
    metadata,
    goodbyeMessage,
  );
  const logEventConfigs = logEventConfigsFromMetadata(draft, metadata);
  const activeLogEvent = logEventConfigs[activeLogEventKey];
  const activeLogVariables = LOG_EVENT_VARIABLES[activeLogEventKey];
  const moderationMode =
    responseMode === "ban" ||
    responseMode === "unban" ||
    responseMode === "kick";
  const moderationAction = moderationMode
    ? (responseMode as "ban" | "unban" | "kick")
    : "ban";
  const moderationResponseType = moderationResponseTypeFromMetadata(metadata);
  const moderationEmbedPages = moderationEmbedPagesFromMetadata(
    draft,
    metadata,
    response,
  );
  const eventMessageType =
    responseMode === "goodbye" ? goodbyeMessageType : welcomeMessageType;
  const eventMessage =
    responseMode === "goodbye" ? goodbyeMessage : welcomeMessage;
  const eventEmbedPages =
    responseMode === "goodbye" ? goodbyeEmbedPages : welcomeEmbedPages;
  const editableEmbedPages =
    responseMode === "logs" && activeLogEvent.mode === "embed"
      ? activeLogEvent.embedPages
      : moderationMode && moderationResponseType === "embed"
        ? moderationEmbedPages
        : (responseMode === "welcome" || responseMode === "goodbye") &&
            eventMessageType === "embed"
          ? eventEmbedPages
          : embedPages;
  const currentPage =
    editableEmbedPages[Math.min(activePage, editableEmbedPages.length - 1)] ??
    editableEmbedPages[0];
  const previewAliasesEnabled =
    responseMode === "welcome" ||
    responseMode === "goodbye" ||
    responseMode === "logs" ||
    moderationMode;
  const previewValue = (value: string) =>
    responseMode === "logs"
      ? replaceLogPreviewAliases(value, activeLogEventKey)
      : moderationMode
        ? replaceModerationPreviewAliases(value, moderationAction)
        : replaceWelcomePreviewAliases(value, previewAliasesEnabled);
  const previewTitle = previewValue(currentPage.title || "Titre de l'embed");
  const previewAuthor = previewValue(currentPage.author);
  const previewDescription = previewValue(
    currentPage.description || "Description de l'embed",
  );
  const previewFooter = previewValue(currentPage.footer);
  const previewAuthorIconUrl = safePreviewImageUrl(
    previewValue(currentPage.authorIconUrl),
  );
  const previewFooterIconUrl = safePreviewImageUrl(
    previewValue(currentPage.footerIconUrl),
  );
  const previewImageUrl = safePreviewImageUrl(
    previewValue(currentPage.imageUrl),
  );
  const previewThumbnailUrl = safePreviewImageUrl(
    previewValue(currentPage.thumbnailUrl),
  );
  const activeFieldId =
    activeFieldByPage[currentPage.id] ?? currentPage.fields[0]?.id ?? null;
  const activeField =
    currentPage.fields.find((field) => field.id === activeFieldId) ??
    currentPage.fields[0] ??
    null;
  const savePages = (pages: CommandEmbedPageDraft[]) => {
    const nextPages = pages.slice(0, DISCORD_EMBED_LIMITS.pages);
    if (responseMode === "welcome") {
      onMetadataChange({
        welcomeEmbedPages: nextPages,
        welcomeMessageType: "embed",
        responseMode: "welcome",
        welcomeChannelOption: "salon",
      });
      return;
    }
    if (responseMode === "goodbye") {
      onMetadataChange({
        goodbyeEmbedPages: nextPages,
        goodbyeMessageType: "embed",
        responseMode: "goodbye",
        goodbyeChannelOption: "salon",
      });
      return;
    }
    if (responseMode === "logs") {
      const nextConfigs = {
        ...logEventConfigs,
        [activeLogEventKey]: {
          ...activeLogEvent,
          mode: "embed" as const,
          embedPages: nextPages,
        },
      };
      onMetadataChange({
        logsEventConfigs: serializeLogEventConfigs(nextConfigs),
        logsDefaultMode: "message",
        responseMode: "logs",
        logsChannelOption: "salon",
      });
      return;
    }
    if (moderationMode) {
      onMetadataChange({
        moderationEmbedPages: nextPages,
        moderationResponseType: "embed",
        moderationAction: responseMode,
        responseMode,
      });
      return;
    }
    onMetadataChange({ embedPages: nextPages, responseMode: "embed" });
  };
  const updateLogEvent = (
    key: LogEventKey,
    patch: Partial<LogEventConfigDraft>,
  ) => {
    const nextConfigs = {
      ...logEventConfigs,
      [key]: { ...logEventConfigs[key], ...patch },
    };
    onMetadataChange({
      logsEventConfigs: serializeLogEventConfigs(nextConfigs),
      logsDefaultMode: "message",
      responseMode: "logs",
      logsChannelOption: "salon",
    });
  };
  const updatePage = (patch: Partial<CommandEmbedPageDraft>) =>
    savePages(
      editableEmbedPages.map((page) =>
        page.id === currentPage.id ? { ...page, ...patch } : page,
      ),
    );
  const updateField = (
    fieldId: string,
    patch: Partial<CommandEmbedFieldDraft>,
  ) =>
    updatePage({
      fields: currentPage.fields.map((field) =>
        field.id === fieldId ? { ...field, ...patch } : field,
      ),
    });
  const addField = () => {
    if (currentPage.fields.length >= DISCORD_EMBED_LIMITS.fields) return;
    const field = createEmbedFieldDraft();
    updatePage({ fields: [...currentPage.fields, field] });
    setActiveFieldByPage((current) => ({
      ...current,
      [currentPage.id]: field.id,
    }));
  };
  const removeField = (fieldId: string) => {
    const index = currentPage.fields.findIndex((field) => field.id === fieldId);
    const nextFields = currentPage.fields.filter(
      (field) => field.id !== fieldId,
    );
    updatePage({ fields: nextFields });
    setActiveFieldByPage((current) => ({
      ...current,
      [currentPage.id]:
        nextFields[Math.max(0, index - 1)]?.id ?? nextFields[0]?.id ?? null,
    }));
  };
  const addPage = () => {
    if (editableEmbedPages.length >= DISCORD_EMBED_LIMITS.pages) return;
    const next = [...editableEmbedPages, createEmbedPageDraft(draft, "")];
    savePages(next);
    setActivePage(next.length - 1);
  };
  const removePage = (pageId = currentPage.id) => {
    if (editableEmbedPages.length <= 1) return;
    const removedIndex = editableEmbedPages.findIndex(
      (page) => page.id === pageId,
    );
    const next = editableEmbedPages.filter((page) => page.id !== pageId);
    savePages(next);
    setActivePage(
      Math.max(
        0,
        Math.min(
          removedIndex < 0 ? activePage : removedIndex - 1,
          next.length - 1,
        ),
      ),
    );
  };
  return (
    <div className="commandFlowStep">
      <div className="commandFlowTitle">
        <span>{wizardText.step4}</span>
        <h2>
          {responseMode === "message"
            ? wizardText.contentTitle.message
            : responseMode === "embed"
              ? wizardText.contentTitle.embed
              : responseMode === "welcome"
                ? wizardText.contentTitle.welcome
                : responseMode === "goodbye"
                  ? wizardText.contentTitle.goodbye
                  : responseMode === "logs"
                    ? wizardText.contentTitle.logs
                    : responseMode === "autorole"
                      ? wizardText.contentTitle.autorole
                      : responseMode === "ban"
                        ? wizardText.contentTitle.ban
                        : responseMode === "unban"
                          ? wizardText.contentTitle.unban
                          : responseMode === "kick"
                            ? wizardText.contentTitle.kick
                            : wizardText.contentTitle.modal}
        </h2>
        <p>
          {responseMode === "embed"
            ? wizardText.contentHelp.embed
            : responseMode === "welcome"
              ? wizardText.contentHelp.welcome
              : responseMode === "goodbye"
                ? wizardText.contentHelp.goodbye
                : responseMode === "logs"
                  ? wizardText.contentHelp.logs
                  : responseMode === "autorole"
                    ? wizardText.contentHelp.autorole
                    : moderationMode
                      ? wizardText.contentHelp.moderation
                      : wizardText.contentHelp.default}
        </p>
      </div>
      {responseMode === "welcome" || responseMode === "goodbye" ? (
        <div className="commandWelcomeSetup">
          <div className="commandWelcomeHeader">
            <div>
              <span>
                {responseMode === "welcome"
                  ? i18nText("Message de bienvenue")
                  : i18nText("Message de départ")}
              </span>
              <p>
                {responseMode === "welcome"
                  ? i18nText("Choisis le message public envoyé dans le salon quand un membre rejoint.")
                  : i18nText("Choisis le message public envoyé dans le salon quand un membre quitte.")}{" "}
                {i18nText("Les messages automatiques ne peuvent pas être éphémères, car ils ne répondent pas à une interaction Discord.")}
              </p>
            </div>
            <div
              className="commandWelcomeTypeSwitch"
              role="group"
              aria-label={
                responseMode === "welcome"
                  ? i18nText("Type de message welcome")
                  : i18nText("Type de message goodbye")
              }
            >
              <Button variant="unstyled"
                type="button"
                className={eventMessageType === "message" ? "isSelected" : ""}
                onClick={() =>
                  responseMode === "welcome"
                    ? onMetadataChange({
                        welcomeMessageType: "message",
                        responseMode: "welcome",
                        welcomeChannelOption: "salon",
                      })
                    : onMetadataChange({
                        goodbyeMessageType: "message",
                        responseMode: "goodbye",
                        goodbyeChannelOption: "salon",
                      })
                }
              >
                <strong>T</strong>
                <span>{i18nText("Simple")}</span>
              </Button>
              <Button variant="unstyled"
                type="button"
                className={eventMessageType === "embed" ? "isSelected" : ""}
                onClick={() =>
                  responseMode === "welcome"
                    ? onMetadataChange({
                        welcomeMessageType: "embed",
                        welcomeEmbedPages,
                        responseMode: "welcome",
                        welcomeChannelOption: "salon",
                      })
                    : onMetadataChange({
                        goodbyeMessageType: "embed",
                        goodbyeEmbedPages,
                        responseMode: "goodbye",
                        goodbyeChannelOption: "salon",
                      })
                }
              >
                <strong>E</strong>
                <span>{i18nText("Embed")}</span>
              </Button>
            </div>
          </div>
          <div className="commandFlowFields isTwoColumns">
            <MarkdownTextarea
              label={i18nText("Réponse éphémère quand le salon est défini")}
              value={response}
              onChange={onResponseChange}
              placeholder={
                responseMode === "welcome"
                  ? i18nText("Le salon welcome a été mis à jour: {channel.mention}.")
                  : i18nText("Le salon goodbye a été mis à jour: {channel.mention}.")
              }
            />
            <MarkdownTextarea
              label={i18nText("Réponse éphémère quand le salon est retiré")}
              value={
                responseMode === "welcome"
                  ? welcomeRemoveConfirmation
                  : goodbyeRemoveConfirmation
              }
              onChange={(value) =>
                responseMode === "welcome"
                  ? onMetadataChange({
                      welcomeRemoveConfirmation: value,
                      responseMode: "welcome",
                      welcomeChannelOption: "salon",
                    })
                  : onMetadataChange({
                      goodbyeRemoveConfirmation: value,
                      responseMode: "goodbye",
                      goodbyeChannelOption: "salon",
                    })
              }
              placeholder={
                responseMode === "welcome"
                  ? i18nText("Le salon welcome a été retiré pour {channel.mention}.")
                  : i18nText("Le salon goodbye a été retiré pour {channel.mention}.")
              }
            />
          </div>
        </div>
      ) : null}
      {responseMode === "logs" ? (
        <div className="commandLogsEditor">
          <div className="commandLogsConfirmRow">
            <MarkdownTextarea
              label={i18nText("Réponse éphémère quand le salon est défini")}
              value={response}
              onChange={onResponseChange}
              placeholder={i18nText("Le salon logs a été mis à jour: {channel.mention}.")}
            />
            <MarkdownTextarea
              label={i18nText("Réponse éphémère quand le salon est retiré")}
              value={logsRemoveConfirmation}
              onChange={(value) =>
                onMetadataChange({
                  logsRemoveConfirmation: value,
                  responseMode: "logs",
                  logsChannelOption: "salon",
                })
              }
              placeholder={i18nText("Le salon logs a été retiré pour {channel.mention}.")}
            />
          </div>
          <div className="commandLogsMain">
            <Tabs className="commandLogsRail" aria-label={i18nText("Événements de logs")}>
              {LOG_EVENT_KEYS.map((key) => (
                <TabButton
                  key={key}
                  type="button"
                  active={key === activeLogEventKey}
                  onClick={() => {
                    setActiveLogEventKey(key);
                    setActivePage(0);
                  }}
                >
                  <span>{LOG_EVENT_LABELS[key]}</span>
                  <small>
                    {logEventConfigs[key].enabled
                      ? logEventConfigs[key].mode === "embed"
                        ? "Embed"
                        : "Simple"
                      : i18nText("Désactivé")}
                  </small>
                </TabButton>
              ))}
            </Tabs>
            <div className="commandLogsWorkArea">
              <div className="commandLogsToolbar">
                <div>
                  <span>{i18nText("Format")}</span>
                  <strong>{LOG_EVENT_LABELS[activeLogEventKey]}</strong>
                </div>
                <label className="commandLogsEnabled">
                  <Input
                    type="checkbox"
                    checked={activeLogEvent.enabled}
                    onChange={(event) =>
                      updateLogEvent(activeLogEventKey, {
                        enabled: event.target.checked,
                      })
                    }
                  />{" "}
                  {i18nText("Envoyer")}
                </label>
                <div
                  className="commandWelcomeTypeSwitch"
                  role="group"
                  aria-label={i18nText("Type du log sélectionné")}
                >
                  <Button variant="unstyled"
                    type="button"
                    className={
                      activeLogEvent.mode === "message" ? "isSelected" : ""
                    }
                    onClick={() =>
                      updateLogEvent(activeLogEventKey, { mode: "message" })
                    }
                  >
                    <strong>T</strong>
                    <span>{i18nText("Simple")}</span>
                  </Button>
                  <Button variant="unstyled"
                    type="button"
                    className={
                      activeLogEvent.mode === "embed" ? "isSelected" : ""
                    }
                    onClick={() => {
                      updateLogEvent(activeLogEventKey, { mode: "embed" });
                      setActivePage(0);
                    }}
                  >
                    <strong>E</strong>
                    <span>{i18nText("Embed")}</span>
                  </Button>
                </div>
              </div>
              {activeLogEvent.mode === "message" ? (
                <MarkdownTextarea
                  label={i18nText("Message simple envoyé")}
                  value={activeLogEvent.messageTemplate}
                  onChange={(value) =>
                    updateLogEvent(activeLogEventKey, {
                      messageTemplate: value,
                    })
                  }
                  placeholder={DEFAULT_LOG_EVENT_MESSAGES[activeLogEventKey]}
                />
              ) : (
                <p className="commandLogsInlineHint">
                  {i18nText("Configure l’embed ci-dessous. Les variables fonctionnent dans la description, les fields, les images et le thumbnail.")}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {responseMode === "autorole" ? (
        <div className="commandWelcomeSetup commandAutoroleSetup">
          <div className="commandWelcomeHeader">
            <div>
              <span>{wizardText.commandAutorole}</span>
              <p>
                {i18nText("La commande générée propose action:list, action:add, action:remove et action:sync. La vraie configuration est stockée dans les paramètres serveur.")}
              </p>
            </div>
            <div
              className="commandWelcomeTypeSwitch"
              role="group"
              aria-label={wizardText.autoroleActions}
            >
              <Button variant="unstyled" type="button" className="isSelected">
                <strong>L</strong>
                <span>{i18nText("List")}</span>
              </Button>
              <Button variant="unstyled" type="button" className="isSelected">
                <strong>A</strong>
                <span>{i18nText("Add")}</span>
              </Button>
              <Button variant="unstyled" type="button" className="isSelected">
                <strong>S</strong>
                <span>{i18nText("Sync")}</span>
              </Button>
            </div>
          </div>
          <p className="commandFlowNote">{wizardText.autoroleModeHelp}</p>
        </div>
      ) : null}
      {moderationMode ? (
        <div className="commandWelcomeSetup commandModerationSetup">
          <div className="commandWelcomeHeader">
            <div>
              <span>{i18nText("Commande de modération")}</span>
              <p>
                {responseMode === "ban"
                  ? i18nText("Bannit un membre.")
                  : responseMode === "unban"
                    ? i18nText("Débannit un utilisateur depuis son ID.")
                    : i18nText("Expulse un membre.")}{" "}
                {i18nText("Le message de retour peut être simple ou embed.")}
              </p>
            </div>
            <div
              className="commandWelcomeTypeSwitch"
              role="group"
              aria-label={i18nText("Type de réponse modération")}
            >
              <Button variant="unstyled"
                type="button"
                className={
                  moderationResponseType === "message" ? "isSelected" : ""
                }
                onClick={() =>
                  onMetadataChange({
                    moderationResponseType: "message",
                    moderationAction: responseMode,
                    responseMode,
                  })
                }
              >
                <strong>T</strong>
                <span>{i18nText("Simple")}</span>
              </Button>
              <Button variant="unstyled"
                type="button"
                className={
                  moderationResponseType === "embed" ? "isSelected" : ""
                }
                onClick={() => {
                  onMetadataChange({
                    moderationResponseType: "embed",
                    moderationAction: responseMode,
                    responseMode,
                  });
                  setActivePage(0);
                }}
              >
                <strong>E</strong>
                <span>{i18nText("Embed")}</span>
              </Button>
            </div>
          </div>
          <p className="commandFlowNote">
            {i18nText("Options créées:")}{" "}
            {responseMode === "unban"
              ? i18nText("user_id et raison")
              : i18nText("membre et raison")}
            {i18nText(". La réponse et les embeds remplacent les variables avec les exemples affichés plus bas.")}
          </p>
        </div>
      ) : null}
      {responseMode === "message" ? (
        <MarkdownTextarea
          label={i18nText("Réponse envoyée")}
          value={response}
          onChange={onResponseChange}
          placeholder={i18nText("Pong")}
        />
      ) : null}
      {moderationMode && moderationResponseType === "message" ? (
        <MarkdownTextarea
          label={i18nText("Message envoyé après exécution")}
          value={response}
          onChange={onResponseChange}
          placeholder={i18nText("✅ {target.mention} modéré. Raison: {reason}")}
        />
      ) : null}
      {(responseMode === "welcome" || responseMode === "goodbye") &&
      eventMessageType === "message" ? (
        <div className="commandFlowFields">
          <MarkdownTextarea
            label={
              responseMode === "welcome"
                ? i18nText("Message envoyé quand un membre rejoint")
                : i18nText("Message envoyé quand un membre quitte")
            }
            value={eventMessage}
            onChange={(value) =>
              responseMode === "welcome"
                ? onMetadataChange({
                    welcomeMessage: value,
                    welcomeMessageType: "message",
                    responseMode: "welcome",
                    welcomeChannelOption: "salon",
                  })
                : onMetadataChange({
                    goodbyeMessage: value,
                    goodbyeMessageType: "message",
                    responseMode: "goodbye",
                    goodbyeChannelOption: "salon",
                  })
            }
            placeholder={
              responseMode === "welcome"
                ? i18nText("Bienvenue {user.mention} sur {guild.name} !")
                : i18nText("👋 {user.displayName} a quitté {guild.name}.")
            }
          />
        </div>
      ) : null}
      {responseMode === "logs" && activeLogEvent.mode === "embed" ? (
        <div
          className={`commandLogsVisualEmbed ${embedPane === "preview" ? "isPreview" : "isCustomize"}`}
          style={
            { "--command-embed-accent": currentPage.color } as CSSProperties
          }
        >
          <div className="commandEmbedPageTabs">
            {editableEmbedPages.map((page, index) => (
              <div
                key={page.id}
                className={`commandEmbedPageTab${index === activePage ? " isActive" : ""}`}
              >
                <Button variant="unstyled" type="button" onClick={() => setActivePage(index)}>
                  <span>{i18nText("Page")} {index + 1}</span>
                  <small>{page.title || i18nText("Sans titre")}</small>
                </Button>
                {index > 0 ? (
                  <Button variant="unstyled"
                    type="button"
                    className="commandEmbedPageRemove"
                    onClick={() => removePage(page.id)}
                    aria-label={`Supprimer page ${index + 1}`}
                  >
                    ×
                  </Button>
                ) : null}
              </div>
            ))}
            <Button variant="unstyled"
              type="button"
              className="commandEmbedAddPage"
              onClick={addPage}
              disabled={editableEmbedPages.length >= DISCORD_EMBED_LIMITS.pages}
            >
              +
            </Button>
          </div>
          <Tabs className="commandEmbedViewTabs" aria-label={i18nText("Vue embed")}>
            <TabButton
              type="button"
              active={embedPane === "customize"}
              onClick={() => setEmbedPane("customize")}
            >
              {i18nText("Personnalisation")}
            </TabButton>
            <TabButton
              type="button"
              active={embedPane === "preview"}
              onClick={() => setEmbedPane("preview")}
            >
              {i18nText("Prévisualisation")}
            </TabButton>
          </Tabs>
          <div className="commandLogsEmbedControls">
            <label>
              <span>{i18nText("Couleur")}</span>
              <Input
                type="color"
                value={currentPage.color}
                onChange={(event) => updatePage({ color: event.target.value })}
              />
            </label>
            <div
              className="commandEmbedPageNavigator"
              aria-label={i18nText("Navigation des pages embed")}
            >
              <Button variant="unstyled"
                type="button"
                onClick={() => setActivePage(Math.max(0, activePage - 1))}
                disabled={activePage === 0}
              >
                ←
              </Button>
              <span>
                {i18nText("Page")} {Math.min(activePage + 1, editableEmbedPages.length)} /{" "}
                {editableEmbedPages.length}
              </span>
              <Button variant="unstyled"
                type="button"
                onClick={() =>
                  setActivePage(
                    Math.min(editableEmbedPages.length - 1, activePage + 1),
                  )
                }
                disabled={activePage >= editableEmbedPages.length - 1}
              >
                →
              </Button>
            </div>
          </div>
          <div
            className="commandLogsEmbedCanvas"
            style={{ borderLeftColor: currentPage.color }}
          >
            {previewThumbnailUrl ? (
              <div className="commandLogsEmbedThumbnail">
                <img src={previewThumbnailUrl} alt="" aria-hidden="true" />
              </div>
            ) : null}
            <div className="commandLogsEmbedAuthorLine">
              {previewAuthorIconUrl ? (
                <img src={previewAuthorIconUrl} alt="" aria-hidden="true" />
              ) : null}
              <MarkdownVisualField
                className="commandLogsEmbedAuthorInput"
                value={currentPage.author}
                maxLength={DISCORD_EMBED_LIMITS.author}
                onChange={(value) => updatePage({ author: value })}
                placeholder={i18nText("Auteur")}
                singleLine
                previewKey={`embed-author-${currentPage.id}`}
              />
            </div>
            <MarkdownVisualField
              className="commandLogsEmbedTitleInput"
              value={currentPage.title}
              maxLength={DISCORD_EMBED_LIMITS.title}
              onChange={(value) => updatePage({ title: value })}
              placeholder={i18nText("Titre de l'embed")}
              singleLine
              previewKey={`embed-title-${currentPage.id}`}
            />
            <MarkdownVisualField
              className="commandLogsEmbedDescriptionInput"
              value={currentPage.description}
              maxLength={DISCORD_EMBED_LIMITS.description}
              onChange={(value) => updatePage({ description: value })}
              placeholder={i18nText("Description de l'embed")}
              previewKey={`embed-description-${currentPage.id}`}
            />
            <div className="commandLogsEmbedFieldList">
              {currentPage.fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`commandLogsEmbedField${field.inline ? " isInline" : ""}`}
                >
                  <div
                    onFocus={() =>
                      setActiveFieldByPage((current) => ({
                        ...current,
                        [currentPage.id]: field.id,
                      }))
                    }
                  >
                    <MarkdownVisualField
                      className="commandLogsEmbedFieldNameInput"
                      value={field.name}
                      maxLength={DISCORD_EMBED_LIMITS.fieldName}
                      onChange={(value) =>
                        updateField(field.id, { name: value })
                      }
                      placeholder={`Field ${index + 1}`}
                      singleLine
                      previewKey={`embed-field-name-${field.id}`}
                    />
                  </div>
                  <div
                    onFocus={() =>
                      setActiveFieldByPage((current) => ({
                        ...current,
                        [currentPage.id]: field.id,
                      }))
                    }
                  >
                    <MarkdownVisualField
                      className="commandLogsEmbedFieldValueInput"
                      value={field.value}
                      maxLength={DISCORD_EMBED_LIMITS.fieldValue}
                      onChange={(value) => updateField(field.id, { value })}
                      placeholder={i18nText("Valeur")}
                      previewKey={`embed-field-value-${field.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {previewImageUrl ? (
              <div className="commandLogsEmbedImage">
                <img src={previewImageUrl} alt="" aria-hidden="true" />
              </div>
            ) : null}
            <div className="commandLogsEmbedFooterLine">
              {previewFooterIconUrl ? (
                <img src={previewFooterIconUrl} alt="" aria-hidden="true" />
              ) : null}
              <MarkdownVisualField
                className="commandLogsEmbedFooterInput"
                value={currentPage.footer}
                maxLength={DISCORD_EMBED_LIMITS.footer}
                onChange={(value) => updatePage({ footer: value })}
                placeholder={i18nText("Footer")}
                singleLine
                previewKey={`embed-footer-${currentPage.id}`}
              />
            </div>
          </div>
          <div className="commandLogsEmbedControls">
            <Button variant="unstyled"
              type="button"
              className="commandLogsEmbedAddField"
              onClick={addField}
              disabled={
                currentPage.fields.length >= DISCORD_EMBED_LIMITS.fields
              }
            >
              {i18nText("+ Ajouter un field")}
            </Button>
            {activeField ? (
              <>
                <label>
                  <Input
                    type="checkbox"
                    checked={activeField.inline}
                    onChange={(event) =>
                      updateField(activeField.id, {
                        inline: event.target.checked,
                      })
                    }
                  />{" "}
                  {i18nText("Field inline")}
                </label>
                <Button variant="unstyled"
                  type="button"
                  className="commandLogsEmbedDanger"
                  onClick={() => removeField(activeField.id)}
                >
                  {i18nText("Supprimer le field sélectionné")}
                </Button>
              </>
            ) : null}
          </div>
          <div className="commandLogsEmbedMediaInputs">
            <label>
              <span>
                {i18nText("Author Icon URL")}{" "}
                <small>
                  {currentPage.authorIconUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.authorIconUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ authorIconUrl: event.target.value })
                }
                placeholder={i18nText("{actor.avatar} ou https://...")}
              />
            </label>
            <label>
              <span>
                {i18nText("Footer Icon URL")}{" "}
                <small>
                  {currentPage.footerIconUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.footerIconUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ footerIconUrl: event.target.value })
                }
                placeholder={i18nText("{bot.avatar} ou https://...")}
              />
            </label>
            <label>
              <span>
                {i18nText("Image URL")}{" "}
                <small>
                  {currentPage.imageUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.imageUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ imageUrl: event.target.value })
                }
                placeholder={i18nText("https://... ou {actor.avatar}")}
              />
            </label>
            <label>
              <span>
                {i18nText("Thumbnail URL")}{" "}
                <small>
                  {currentPage.thumbnailUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.thumbnailUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ thumbnailUrl: event.target.value })
                }
                placeholder={i18nText("{target.avatar} ou {guild.icon}")}
              />
            </label>
          </div>
          <CommandEmbedPreviewPanel
            page={currentPage}
            previewValue={previewValue}
            pageIndex={activePage}
            pageCount={editableEmbedPages.length}
            onPrevious={() => setActivePage(Math.max(0, activePage - 1))}
            onNext={() =>
              setActivePage(
                Math.min(editableEmbedPages.length - 1, activePage + 1),
              )
            }
          />
        </div>
      ) : null}
      {responseMode === "logs" ? (
        <CommandVariablePreviewList
          title={`Variables pour ${LOG_EVENT_LABELS[activeLogEventKey]}`}
          variables={activeLogVariables}
          previewValue={previewValue}
        />
      ) : null}
      {responseMode === "embed" ||
      (moderationMode && moderationResponseType === "embed") ||
      ((responseMode === "welcome" || responseMode === "goodbye") &&
        eventMessageType === "embed") ? (
        <div
          className={`commandLogsVisualEmbed ${embedPane === "preview" ? "isPreview" : "isCustomize"}`}
          style={
            { "--command-embed-accent": currentPage.color } as CSSProperties
          }
        >
          <div className="commandEmbedPageTabs">
            {editableEmbedPages.map((page, index) => (
              <div
                key={page.id}
                className={`commandEmbedPageTab${index === activePage ? " isActive" : ""}`}
              >
                <Button variant="unstyled" type="button" onClick={() => setActivePage(index)}>
                  <span>{i18nText("Page")} {index + 1}</span>
                  <small>{page.title || i18nText("Sans titre")}</small>
                </Button>
                {index > 0 ? (
                  <Button variant="unstyled"
                    type="button"
                    className="commandEmbedPageRemove"
                    onClick={() => removePage(page.id)}
                    aria-label={`Supprimer page ${index + 1}`}
                  >
                    ×
                  </Button>
                ) : null}
              </div>
            ))}
            <Button variant="unstyled"
              type="button"
              className="commandEmbedAddPage"
              onClick={addPage}
              disabled={editableEmbedPages.length >= DISCORD_EMBED_LIMITS.pages}
            >
              +
            </Button>
          </div>
          <Tabs className="commandEmbedViewTabs" aria-label={i18nText("Vue embed")}>
            <TabButton
              type="button"
              active={embedPane === "customize"}
              onClick={() => setEmbedPane("customize")}
            >
              {i18nText("Personnalisation")}
            </TabButton>
            <TabButton
              type="button"
              active={embedPane === "preview"}
              onClick={() => setEmbedPane("preview")}
            >
              {i18nText("Prévisualisation")}
            </TabButton>
          </Tabs>
          <div className="commandLogsEmbedControls">
            <label>
              <span>{i18nText("Couleur")}</span>
              <Input
                type="color"
                value={currentPage.color}
                onChange={(event) => updatePage({ color: event.target.value })}
              />
            </label>
            <div
              className="commandEmbedPageNavigator"
              aria-label={i18nText("Navigation des pages embed")}
            >
              <Button variant="unstyled"
                type="button"
                onClick={() => setActivePage(Math.max(0, activePage - 1))}
                disabled={activePage === 0}
              >
                ←
              </Button>
              <span>
                {i18nText("Page")} {Math.min(activePage + 1, editableEmbedPages.length)} /{" "}
                {editableEmbedPages.length}
              </span>
              <Button variant="unstyled"
                type="button"
                onClick={() =>
                  setActivePage(
                    Math.min(editableEmbedPages.length - 1, activePage + 1),
                  )
                }
                disabled={activePage >= editableEmbedPages.length - 1}
              >
                →
              </Button>
            </div>
          </div>
          {responseMode === "welcome" || responseMode === "goodbye" ? (
            <p className="commandFlowNote">
              {i18nText("Discord ne rend pas les mentions cliquables dans le titre, l’auteur ou le footer d’un embed. Mets plutôt les mentions dans la description ou dans un field.")}
            </p>
          ) : null}
          <div
            className="commandLogsEmbedCanvas"
            style={{ borderLeftColor: currentPage.color }}
          >
            {previewThumbnailUrl ? (
              <div className="commandLogsEmbedThumbnail">
                <img src={previewThumbnailUrl} alt="" aria-hidden="true" />
              </div>
            ) : null}
            <div className="commandLogsEmbedAuthorLine">
              {previewAuthorIconUrl ? (
                <img src={previewAuthorIconUrl} alt="" aria-hidden="true" />
              ) : null}
              <MarkdownVisualField
                className="commandLogsEmbedAuthorInput"
                value={currentPage.author}
                maxLength={DISCORD_EMBED_LIMITS.author}
                onChange={(value) => updatePage({ author: value })}
                placeholder={i18nText("Auteur")}
                singleLine
                previewKey={`embed-author-${currentPage.id}`}
              />
            </div>
            <MarkdownVisualField
              className="commandLogsEmbedTitleInput"
              value={currentPage.title}
              maxLength={DISCORD_EMBED_LIMITS.title}
              onChange={(value) => updatePage({ title: value })}
              placeholder={i18nText("Titre de l'embed")}
              singleLine
              previewKey={`embed-title-${currentPage.id}`}
            />
            <MarkdownVisualField
              className="commandLogsEmbedDescriptionInput"
              value={currentPage.description}
              maxLength={DISCORD_EMBED_LIMITS.description}
              onChange={(value) => updatePage({ description: value })}
              placeholder={i18nText("Description de l'embed")}
              previewKey={`embed-description-${currentPage.id}`}
            />
            <div className="commandLogsEmbedFieldList">
              {currentPage.fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`commandLogsEmbedField${field.inline ? " isInline" : ""}`}
                >
                  <div
                    onFocus={() =>
                      setActiveFieldByPage((current) => ({
                        ...current,
                        [currentPage.id]: field.id,
                      }))
                    }
                  >
                    <MarkdownVisualField
                      className="commandLogsEmbedFieldNameInput"
                      value={field.name}
                      maxLength={DISCORD_EMBED_LIMITS.fieldName}
                      onChange={(value) =>
                        updateField(field.id, { name: value })
                      }
                      placeholder={`Field ${index + 1}`}
                      singleLine
                      previewKey={`embed-field-name-${field.id}`}
                    />
                  </div>
                  <div
                    onFocus={() =>
                      setActiveFieldByPage((current) => ({
                        ...current,
                        [currentPage.id]: field.id,
                      }))
                    }
                  >
                    <MarkdownVisualField
                      className="commandLogsEmbedFieldValueInput"
                      value={field.value}
                      maxLength={DISCORD_EMBED_LIMITS.fieldValue}
                      onChange={(value) => updateField(field.id, { value })}
                      placeholder={i18nText("Valeur")}
                      previewKey={`embed-field-value-${field.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            {previewImageUrl ? (
              <div className="commandLogsEmbedImage">
                <img src={previewImageUrl} alt="" aria-hidden="true" />
              </div>
            ) : null}
            <div className="commandLogsEmbedFooterLine">
              {previewFooterIconUrl ? (
                <img src={previewFooterIconUrl} alt="" aria-hidden="true" />
              ) : null}
              <MarkdownVisualField
                className="commandLogsEmbedFooterInput"
                value={currentPage.footer}
                maxLength={DISCORD_EMBED_LIMITS.footer}
                onChange={(value) => updatePage({ footer: value })}
                placeholder={i18nText("Footer")}
                singleLine
                previewKey={`embed-footer-${currentPage.id}`}
              />
            </div>
          </div>
          <div className="commandLogsEmbedControls">
            <Button variant="unstyled"
              type="button"
              className="commandLogsEmbedAddField"
              onClick={addField}
              disabled={
                currentPage.fields.length >= DISCORD_EMBED_LIMITS.fields
              }
            >
              {i18nText("+ Ajouter un field")}
            </Button>
            {activeField ? (
              <>
                <label>
                  <Input
                    type="checkbox"
                    checked={activeField.inline}
                    onChange={(event) =>
                      updateField(activeField.id, {
                        inline: event.target.checked,
                      })
                    }
                  />{" "}
                  {i18nText("Field inline")}
                </label>
                <Button variant="unstyled"
                  type="button"
                  className="commandLogsEmbedDanger"
                  onClick={() => removeField(activeField.id)}
                >
                  {i18nText("Supprimer le field sélectionné")}
                </Button>
              </>
            ) : null}
          </div>
          <div className="commandLogsEmbedMediaInputs">
            <label>
              <span>
                {i18nText("Author Icon URL")}{" "}
                <small>
                  {currentPage.authorIconUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.authorIconUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ authorIconUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("{user.avatar}, {guild.icon} ou https://...")
                    : "https://..."
                }
              />
            </label>
            <label>
              <span>
                {i18nText("Footer Icon URL")}{" "}
                <small>
                  {currentPage.footerIconUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.footerIconUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ footerIconUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("{bot.avatar}, {guild.icon} ou https://...")
                    : "https://..."
                }
              />
            </label>
            <label>
              <span>
                {i18nText("Image URL")}{" "}
                <small>
                  {currentPage.imageUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.imageUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ imageUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("https://... ou {user.avatar}, {guild.icon}, {bot.avatar}")
                    : "https://..."
                }
              />
            </label>
            <label>
              <span>
                {i18nText("Thumbnail URL")}{" "}
                <small>
                  {currentPage.thumbnailUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.thumbnailUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ thumbnailUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("{user.avatar}, {guild.icon} ou {bot.avatar}")
                    : "https://..."
                }
              />
            </label>
          </div>
          <CommandEmbedPreviewPanel
            page={currentPage}
            previewValue={previewValue}
            pageIndex={activePage}
            pageCount={editableEmbedPages.length}
            onPrevious={() => setActivePage(Math.max(0, activePage - 1))}
            onNext={() =>
              setActivePage(
                Math.min(editableEmbedPages.length - 1, activePage + 1),
              )
            }
          />
        </div>
      ) : null}
      {false &&
      (responseMode === "embed" ||
        ((responseMode === "welcome" || responseMode === "goodbye") &&
          eventMessageType === "embed")) ? (
        <div className="commandContentSplit">
          <div className="commandFlowFields commandEmbedBuilder">
            <div className="commandEmbedPageTabs">
              {editableEmbedPages.map((page, index) => (
                <div
                  key={page.id}
                  className={`commandEmbedPageTab${index === activePage ? " isActive" : ""}`}
                >
                  <Button variant="unstyled" type="button" onClick={() => setActivePage(index)}>
                    <span>{i18nText("Page")} {index + 1}</span>
                    <small>{page.title || i18nText("Sans titre")}</small>
                  </Button>
                  {index > 0 ? (
                    <Button variant="unstyled"
                      type="button"
                      className="commandEmbedPageRemove"
                      onClick={() => removePage(page.id)}
                      aria-label={`Supprimer page ${index + 1}`}
                    >
                      ×
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button variant="unstyled"
                type="button"
                className="commandEmbedAddPage"
                onClick={addPage}
                disabled={
                  editableEmbedPages.length >= DISCORD_EMBED_LIMITS.pages
                }
              >
                +
              </Button>
            </div>
            <div
              className="commandEmbedPageNavigator"
              aria-label={i18nText("Navigation des pages embed")}
            >
              <Button variant="unstyled"
                type="button"
                onClick={() => setActivePage(Math.max(0, activePage - 1))}
                disabled={activePage === 0}
              >
                ←
              </Button>
              <span>
                {i18nText("Page")} {Math.min(activePage + 1, editableEmbedPages.length)} /{" "}
                {editableEmbedPages.length}
              </span>
              <Button variant="unstyled"
                type="button"
                onClick={() =>
                  setActivePage(
                    Math.min(editableEmbedPages.length - 1, activePage + 1),
                  )
                }
                disabled={activePage >= editableEmbedPages.length - 1}
              >
                →
              </Button>
            </div>
            {responseMode === "welcome" || responseMode === "goodbye" ? (
              <p className="commandFlowNote">
                {i18nText("Discord ne rend pas les mentions cliquables dans le titre, l’auteur ou le footer d’un embed. Mets plutôt les mentions dans la description ou dans un field.")}
              </p>
            ) : null}
            <MarkdownField
              label="Titre"
              value={currentPage.title}
              maxLength={DISCORD_EMBED_LIMITS.title}
              onChange={(value) => updatePage({ title: value })}
              singleLine
            />
            <label>
              <span>{i18nText("Couleur")}</span>
              <Input
                type="color"
                value={currentPage.color}
                onChange={(event) => updatePage({ color: event.target.value })}
              />
            </label>
            <MarkdownField
              label="Auteur"
              value={currentPage.author}
              maxLength={DISCORD_EMBED_LIMITS.author}
              onChange={(value) => updatePage({ author: value })}
              singleLine
            />
            <label>
              <span>
                {i18nText("Author Icon URL")}{" "}
                <small>
                  {currentPage.authorIconUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.authorIconUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ authorIconUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("{user.avatar}, {guild.icon} ou https://...")
                    : "https://..."
                }
              />
            </label>
            <MarkdownField
              label="Description"
              value={currentPage.description}
              onChange={(value) => updatePage({ description: value })}
              placeholder={i18nText("Contenu de l'embed")}
              maxLength={DISCORD_EMBED_LIMITS.description}
            />
            <div className="commandEmbedFieldTabs">
              {currentPage.fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`commandEmbedFieldTab${activeField?.id === field.id ? " isActive" : ""}`}
                >
                  <Button variant="unstyled"
                    type="button"
                    onClick={() =>
                      setActiveFieldByPage((current) => ({
                        ...current,
                        [currentPage.id]: field.id,
                      }))
                    }
                  >
                    <span>{i18nText("Field")} {index + 1}</span>
                    <small>{field.name || i18nText("Sans nom")}</small>
                  </Button>
                  <Button variant="unstyled"
                    type="button"
                    className="commandEmbedPageRemove"
                    onClick={() => removeField(field.id)}
                    aria-label={`Supprimer field ${index + 1}`}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button variant="unstyled"
                type="button"
                className="commandEmbedAddPage"
                onClick={addField}
                disabled={
                  currentPage.fields.length >= DISCORD_EMBED_LIMITS.fields
                }
              >
                {i18nText("+ Field")}
              </Button>
            </div>
            {activeField ? (
              <div className="commandEmbedFieldEditor">
                <MarkdownField
                  label={i18nText("Nom du field")}
                  value={activeField.name}
                  maxLength={DISCORD_EMBED_LIMITS.fieldName}
                  onChange={(value) =>
                    updateField(activeField.id, { name: value })
                  }
                  singleLine
                />
                <MarkdownField
                  label={i18nText("Valeur du field")}
                  value={activeField.value}
                  onChange={(value) => updateField(activeField.id, { value })}
                  maxLength={DISCORD_EMBED_LIMITS.fieldValue}
                />
                <label className="commandInlineCheckbox">
                  <Input
                    type="checkbox"
                    checked={activeField.inline}
                    onChange={(event) =>
                      updateField(activeField.id, {
                        inline: event.target.checked,
                      })
                    }
                  />{" "}
                  {i18nText("Afficher inline")}
                </label>
              </div>
            ) : (
              <p className="commandFlowNote">
                {i18nText("Aucun field pour cette page. Ajoute-en un si tu veux structurer l’embed.")}
              </p>
            )}
            <MarkdownField
              label="Footer"
              value={currentPage.footer}
              maxLength={DISCORD_EMBED_LIMITS.footer}
              onChange={(value) => updatePage({ footer: value })}
              singleLine
            />
            <label>
              <span>
                {i18nText("Footer Icon URL")}{" "}
                <small>
                  {currentPage.footerIconUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.footerIconUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ footerIconUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("{bot.avatar}, {guild.icon} ou https://...")
                    : "https://..."
                }
              />
            </label>
            <label>
              <span>
                {i18nText("Image URL")}{" "}
                <small>
                  {currentPage.imageUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.imageUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ imageUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("https://... ou {user.avatar}, {guild.icon}, {bot.avatar}")
                    : "https://..."
                }
              />
            </label>
            <label>
              <span>
                {i18nText("Thumbnail URL")}{" "}
                <small>
                  {currentPage.thumbnailUrl.length}/{DISCORD_EMBED_LIMITS.url}
                </small>
              </span>
              <Input
                value={currentPage.thumbnailUrl}
                maxLength={DISCORD_EMBED_LIMITS.url}
                onChange={(event) =>
                  updatePage({ thumbnailUrl: event.target.value })
                }
                placeholder={
                  responseMode === "welcome" || responseMode === "goodbye"
                    ? i18nText("{user.avatar}, {guild.icon} ou {bot.avatar}")
                    : "https://..."
                }
              />
            </label>
          </div>
          <div
            className="commandEmbedPreview"
            style={{ borderLeftColor: currentPage.color }}
          >
            <div className="commandEmbedPreviewBody">
              {previewAuthor ? (
                <small className="commandEmbedPreviewAuthor">
                  {previewAuthorIconUrl ? (
                    <img src={previewAuthorIconUrl} alt="" aria-hidden="true" />
                  ) : null}
                  {renderMessageContent(previewAuthor, "embed-author-preview")}
                </small>
              ) : null}
              <strong>
                {renderMessageContent(previewTitle, "embed-title-preview")}
              </strong>
              <div className="commandEmbedPreviewDescription">
                {renderMessageContent(
                  previewDescription,
                  "embed-description-preview",
                )}
              </div>
              {currentPage.fields.length ? (
                <dl>
                  {currentPage.fields.map((field) => (
                    <div key={field.id}>
                      <dt>
                        {renderMessageContent(
                          previewValue(field.name || "Champ"),
                          `embed-field-name-${field.id}`,
                        )}
                      </dt>
                      <dd>
                        {renderMessageContent(
                          previewValue(field.value || "Valeur"),
                          `embed-field-value-${field.id}`,
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {previewImageUrl ? (
                <div className="commandEmbedImagePreview">
                  <img src={previewImageUrl} alt="" aria-hidden="true" />
                  <span>{previewImageUrl}</span>
                </div>
              ) : null}
              {previewFooter ? (
                <footer>
                  {previewFooterIconUrl ? (
                    <img src={previewFooterIconUrl} alt="" aria-hidden="true" />
                  ) : null}
                  {renderMessageContent(previewFooter, "embed-footer-preview")}
                </footer>
              ) : null}
              {editableEmbedPages.length > 1 ? (
                <div className="commandMenuPreviewButtons">
                  <Button variant="unstyled"
                    type="button"
                    onClick={() => setActivePage(Math.max(0, activePage - 1))}
                  >
                    ←
                  </Button>
                  <span>
                    {activePage + 1} / {editableEmbedPages.length}
                  </span>
                  <Button variant="unstyled"
                    type="button"
                    onClick={() =>
                      setActivePage(
                        Math.min(editableEmbedPages.length - 1, activePage + 1),
                      )
                    }
                  >
                    →
                  </Button>
                </div>
              ) : null}
            </div>
            {previewThumbnailUrl ? (
              <div className="commandEmbedThumbPreview">
                <img src={previewThumbnailUrl} alt="" aria-hidden="true" />
                <span>{previewThumbnailUrl}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {moderationMode ? (
        <CommandVariablePreviewList
          title={i18nText("Variables de la réponse de modération")}
          variables={MODERATION_VARIABLES}
          previewValue={previewValue}
          note={i18nText("Les mêmes variables peuvent être utilisées dans le message simple, l’embed de réponse et les logs ban/unban/kick.")}
        />
      ) : null}
      {responseMode === "welcome" || responseMode === "goodbye" ? (
        <CommandVariablePreviewList
          title={`Variables ${responseMode === "welcome" ? "welcome" : "goodbye"}`}
          variables={
            responseMode === "welcome" ? WELCOME_VARIABLES : GOODBYE_VARIABLES
          }
          previewValue={previewValue}
          note={i18nText("Les mentions sont utiles dans le message, la description ou les fields. Discord ne les rend pas cliquables dans le titre, l’auteur ou le footer.")}
        />
      ) : null}
      {responseMode === "modal" ? (
        <CommandModalResponseDesigner
          draft={draft}
          modalTitle={modalTitle}
          modalField={modalField}
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      ) : null}
    </div>
  );
}



// Designer de réponse modale.
