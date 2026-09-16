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
import { Button } from "../../../components/ui/button";
import { Tabs, TabButton } from "../../../components/ui/tabs";


export function CommandModalResponseInlineEditor({
  draft,
  response,
  index,
  variableName,
  onChange,
  onRemove,
}: {
  draft: ApplicationCommandDraft;
  response: CommandModalResponseDraft;
  index: number;
  variableName: string;
  onChange: (response: CommandModalResponseDraft) => void;
  onRemove: () => void;
}) {
  const [activePage, setActivePage] = useState(0);
  const [activeFieldByPage, setActiveFieldByPage] = useState<
    Record<string, string | null>
  >({});
  const [modalEmbedPane, setModalEmbedPane] = useState<"customize" | "preview">(
    "customize",
  );
  const pages = response.embedPages.length
    ? response.embedPages
    : [createEmbedPageDraft(draft, `Résultat pour {${variableName}}`)];
  const currentPage = pages[Math.min(activePage, pages.length - 1)] ?? pages[0];
  const activeFieldId = currentPage
    ? (activeFieldByPage[currentPage.id] ?? currentPage.fields[0]?.id ?? null)
    : null;
  const activeField =
    currentPage?.fields.find((field) => field.id === activeFieldId) ??
    currentPage?.fields[0] ??
    null;
  const safeModalImageUrl = (value: string) => safePreviewImageUrl(value);
  const previewAuthorIconUrl = currentPage
    ? safeModalImageUrl(currentPage.authorIconUrl)
    : "";
  const previewFooterIconUrl = currentPage
    ? safeModalImageUrl(currentPage.footerIconUrl)
    : "";
  const previewImageUrl = currentPage
    ? safeModalImageUrl(currentPage.imageUrl)
    : "";
  const previewThumbnailUrl = currentPage
    ? safeModalImageUrl(currentPage.thumbnailUrl)
    : "";
  const setPatch = (patch: Partial<CommandModalResponseDraft>) =>
    onChange({ ...response, ...patch });
  const savePages = (nextPages: CommandEmbedPageDraft[]) =>
    setPatch({ embedPages: nextPages.slice(0, DISCORD_EMBED_LIMITS.pages) });
  const updatePage = (patch: Partial<CommandEmbedPageDraft>) =>
    currentPage
      ? savePages(
          pages.map((page) =>
            page.id === currentPage.id ? { ...page, ...patch } : page,
          ),
        )
      : undefined;
  const switchKind = (kind: CommandModalResponseKind) => {
    if (kind === response.kind) return;
    setPatch({
      kind,
      label: kind === "embed" ? "Embed résultat" : "Message résultat",
      content:
        kind === "message"
          ? response.content || `Réponse liée à {${variableName}}`
          : response.content,
      embedPages: kind === "embed" ? pages : [],
    });
  };
  const addPage = () => {
    if (pages.length >= DISCORD_EMBED_LIMITS.pages) return;
    const next = [
      ...pages,
      createEmbedPageDraft(draft, `Résultat lié à {${variableName}}`),
    ];
    savePages(next);
    setActivePage(next.length - 1);
  };
  const removePage = (pageId = currentPage?.id) => {
    if (!pageId || pages.length <= 1) return;
    const removedIndex = pages.findIndex((page) => page.id === pageId);
    const next = pages.filter((page) => page.id !== pageId);
    savePages(next);
    setActivePage(Math.max(0, Math.min(removedIndex - 1, next.length - 1)));
  };
  const addField = () => {
    if (
      !currentPage ||
      currentPage.fields.length >= DISCORD_EMBED_LIMITS.fields
    )
      return;
    const field = createEmbedFieldDraft();
    updatePage({ fields: [...currentPage.fields, field] });
    setActiveFieldByPage((current) => ({
      ...current,
      [currentPage.id]: field.id,
    }));
  };
  const updateField = (
    fieldId: string,
    patch: Partial<CommandEmbedFieldDraft>,
  ) =>
    currentPage
      ? updatePage({
          fields: currentPage.fields.map((field) =>
            field.id === fieldId ? { ...field, ...patch } : field,
          ),
        })
      : undefined;
  const removeField = (fieldId: string) => {
    if (!currentPage) return;
    const fieldIndex = currentPage.fields.findIndex(
      (field) => field.id === fieldId,
    );
    const nextFields = currentPage.fields.filter(
      (field) => field.id !== fieldId,
    );
    updatePage({ fields: nextFields });
    setActiveFieldByPage((current) => ({
      ...current,
      [currentPage.id]:
        nextFields[Math.max(0, fieldIndex - 1)]?.id ??
        nextFields[0]?.id ??
        null,
    }));
  };
  return (
    <section className="commandModalInlineCard">
      <header>
        <div>
          <span>{i18nText("Carte")} {index + 1}</span>
          <strong>
            {response.kind === "embed" ? i18nText("Message embed") : "Message"}
          </strong>
        </div>
        <Button variant="unstyled" type="button" className="dangerButton" onClick={onRemove}>
          {i18nText("Supprimer")}
        </Button>
      </header>
      <div className="commandModalResponseTypeSwitch">
        <Button variant="unstyled"
          type="button"
          className={response.kind === "message" ? "isSelected" : ""}
          onClick={() => switchKind("message")}
        >
          {i18nText("Message")}
        </Button>
        <Button variant="unstyled"
          type="button"
          className={response.kind === "embed" ? "isSelected" : ""}
          onClick={() => switchKind("embed")}
        >
          {i18nText("Embed")}
        </Button>
      </div>
      <MarkdownField
        label="Nom de la carte"
        value={response.label}
        maxLength={80}
        onChange={(value) => setPatch({ label: value })}
        singleLine
      />
      <MarkdownField
        label="Mots-clés de recherche"
        value={response.searchTerms}
        maxLength={240}
        onChange={(value) => setPatch({ searchTerms: value })}
        placeholder={`ex: aide, crotte, ticket, {${variableName}} reste disponible dans la réponse`}
        singleLine
      />
      {response.kind === "message" ? (
        <MarkdownField
          label={i18nText("Message envoyé")}
          value={response.content}
          onChange={(value) => setPatch({ content: value })}
          placeholder={`Résultat pour {${variableName}}`}
          maxLength={2000}
        />
      ) : null}
      {response.kind === "embed" && currentPage ? (
        <div
          className={`commandLogsVisualEmbed ${modalEmbedPane === "preview" ? "isPreview" : "isCustomize"}`}
          style={
            { "--command-embed-accent": currentPage.color } as CSSProperties
          }
        >
          <div className="commandEmbedPageTabs">
            {pages.map((page, pageIndex) => (
              <div
                key={page.id}
                className={`commandEmbedPageTab${pageIndex === activePage ? " isActive" : ""}`}
              >
                <Button variant="unstyled" type="button" onClick={() => setActivePage(pageIndex)}>
                  <span>{i18nText("Page")} {pageIndex + 1}</span>
                  <small>{page.title || i18nText("Sans titre")}</small>
                </Button>
                {pageIndex > 0 ? (
                  <Button variant="unstyled"
                    type="button"
                    className="commandEmbedPageRemove"
                    onClick={() => removePage(page.id)}
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
              disabled={pages.length >= DISCORD_EMBED_LIMITS.pages}
            >
              +
            </Button>
          </div>
          <Tabs className="commandEmbedViewTabs" aria-label={i18nText("Vue embed")}>
            <TabButton
              type="button"
              active={modalEmbedPane === "customize"}
              onClick={() => setModalEmbedPane("customize")}
            >
              {i18nText("Personnalisation")}
            </TabButton>
            <TabButton
              type="button"
              active={modalEmbedPane === "preview"}
              onClick={() => setModalEmbedPane("preview")}
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
                {i18nText("Page")} {Math.min(activePage + 1, pages.length)} / {pages.length}
              </span>
              <Button variant="unstyled"
                type="button"
                onClick={() =>
                  setActivePage(Math.min(pages.length - 1, activePage + 1))
                }
                disabled={activePage >= pages.length - 1}
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
                previewKey={`modal-author-${currentPage.id}`}
              />
            </div>
            <MarkdownVisualField
              className="commandLogsEmbedTitleInput"
              value={currentPage.title}
              maxLength={DISCORD_EMBED_LIMITS.title}
              onChange={(value) => updatePage({ title: value })}
              placeholder={i18nText("Titre de l'embed")}
              singleLine
              previewKey={`modal-title-${currentPage.id}`}
            />
            <MarkdownVisualField
              className="commandLogsEmbedDescriptionInput"
              value={currentPage.description}
              maxLength={DISCORD_EMBED_LIMITS.description}
              onChange={(value) => updatePage({ description: value })}
              placeholder={`Résultat pour {${variableName}}`}
              previewKey={`modal-description-${currentPage.id}`}
            />
            <div className="commandLogsEmbedFieldList">
              {currentPage.fields.map((field, fieldIndex) => (
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
                      placeholder={`Field ${fieldIndex + 1}`}
                      singleLine
                      previewKey={`modal-field-name-${field.id}`}
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
                      previewKey={`modal-field-value-${field.id}`}
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
                previewKey={`modal-footer-${currentPage.id}`}
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
                placeholder={`https://... ou {${variableName}}`}
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
                placeholder={`https://... ou {${variableName}}`}
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
                placeholder={i18nText("https://...")}
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
                placeholder={i18nText("https://...")}
              />
            </label>
          </div>
          <CommandEmbedPreviewPanel
            page={currentPage}
            previewValue={(value) => value}
            pageIndex={activePage}
            pageCount={pages.length}
            onPrevious={() => setActivePage(Math.max(0, activePage - 1))}
            onNext={() =>
              setActivePage(Math.min(pages.length - 1, activePage + 1))
            }
          />
        </div>
      ) : null}
      {false && response.kind === "embed" && currentPage ? (
        <div className="commandModalEmbedEditor">
          <div className="commandEmbedPageTabs">
            {pages.map((page, pageIndex) => (
              <div
                key={page.id}
                className={`commandEmbedPageTab${pageIndex === activePage ? " isActive" : ""}`}
              >
                <Button variant="unstyled" type="button" onClick={() => setActivePage(pageIndex)}>
                  <span>{i18nText("Page")} {pageIndex + 1}</span>
                  <small>{page.title || i18nText("Sans titre")}</small>
                </Button>
                {pageIndex > 0 ? (
                  <Button variant="unstyled"
                    type="button"
                    className="commandEmbedPageRemove"
                    onClick={() => removePage(page.id)}
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
              disabled={pages.length >= DISCORD_EMBED_LIMITS.pages}
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
              {i18nText("Page")} {Math.min(activePage + 1, pages.length)} / {pages.length}
            </span>
            <Button variant="unstyled"
              type="button"
              onClick={() =>
                setActivePage(Math.min(pages.length - 1, activePage + 1))
              }
              disabled={activePage >= pages.length - 1}
            >
              →
            </Button>
          </div>
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
              placeholder={`https://... ou {${variableName}}`}
            />
          </label>
          <MarkdownField
            label="Description"
            value={currentPage.description}
            onChange={(value) => updatePage({ description: value })}
            placeholder={`Résultat pour {${variableName}}`}
            maxLength={DISCORD_EMBED_LIMITS.description}
          />
          <div className="commandEmbedFieldTabs">
            {currentPage.fields.map((field, fieldIndex) => (
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
                  <span>{i18nText("Field")} {fieldIndex + 1}</span>
                  <small>{field.name || i18nText("Sans nom")}</small>
                </Button>
                <Button variant="unstyled"
                  type="button"
                  className="commandEmbedPageRemove"
                  onClick={() => removeField(field.id)}
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
            <p className="commandFlowNote">{i18nText("Aucun field pour cette page.")}</p>
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
              placeholder={`https://... ou {${variableName}}`}
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
              onChange={(event) => updatePage({ imageUrl: event.target.value })}
              placeholder={i18nText("https://...")}
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
              placeholder={i18nText("https://...")}
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}

// Zone Markdown contrôlée.
// Étape accès commande.
