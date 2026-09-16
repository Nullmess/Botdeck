"use client";

// Éditeur embed et helpers automation du Slash Studio.


import { Input } from "../../../components/ui/field";
import type { GuildAutomationConfig } from "@botdeck/shared";
import { useEffect, useState, type CSSProperties } from "react";
import { i18nText } from "@/features/workspace/core";

import {
  previewExampleLabel,
  replaceLogPreviewAliases,
  replaceWelcomePreviewAliases,
} from "./slash-studio-template-variables";
import {
  DISCORD_EMBED_LIMITS,
  createEmbedFieldDraft,
  embedLimitTone,
  embedPageTextLength,
  normalizeEmbedColor,
  type CommandEmbedFieldDraft,
  type CommandEmbedPageDraft,
} from "./slash-studio-command-runtime";
import { MarkdownVisualField } from "./slash-studio-markdown-fields";
import {
  CommandEmbedPreviewPanel,
  safePreviewImageUrl,
} from "./slash-studio-embed-preview";
import { Button } from "../../../components/ui/button";
import { Tabs, TabButton } from "../../../components/ui/tabs";

export function CommandVariablePreviewList({
  title,
  variables,
  previewValue,
  note,
}: {
  title: string;
  variables: string[];
  previewValue: (value: string) => string;
  note?: string;
}) {
  return (
    <div className="commandVariablePreviewList">
      <div className="commandVariablePreviewHeader">
        <strong>{title}</strong>
        <span>
          {i18nText("Chaque variable est prévisualisée avec une valeur d’exemple.")}
        </span>
      </div>
      <div className="commandVariablePreviewGrid">
        {variables.map((variable) => {
          const token = `{${variable}}`;
          const example = previewExampleLabel(previewValue(token));
          return (
            <div
              key={variable}
              className="commandVariablePreviewItem"
              tabIndex={0}
              aria-label={`${token} donne par exemple ${example}`}
            >
              <code>{token}</code>
              <span className="commandVariablePreviewTooltip" role="tooltip">
                <span className="commandVariablePreviewTooltipLabel">
                  {i18nText("Exemple")}
                </span>
                <span className="commandVariablePreviewTooltipValue">
                  {example}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

function automationEmbedPageFromUnknown(
  item: unknown,
  index: number,
  fallbackTitle: string,
  fallbackDescription: string,
): CommandEmbedPageDraft {
  const page =
    item && typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
  const fields = Array.isArray(page.fields)
    ? page.fields
        .slice(0, DISCORD_EMBED_LIMITS.fields)
        .map((field, fieldIndex) => {
          const record =
            field && typeof field === "object" && !Array.isArray(field)
              ? (field as Record<string, unknown>)
              : {};
          return {
            id:
              typeof record.id === "string"
                ? record.id
                : `field-${index}-${fieldIndex}`,
            name: typeof record.name === "string" ? record.name : "Champ",
            value: typeof record.value === "string" ? record.value : "Valeur",
            inline: record.inline === true,
          };
        })
    : [];
  return {
    id: typeof page.id === "string" ? page.id : `page-${index}`,
    title: typeof page.title === "string" ? page.title : fallbackTitle,
    description:
      typeof page.description === "string"
        ? page.description
        : fallbackDescription,
    color:
      typeof page.color === "string"
        ? normalizeEmbedColor(page.color)
        : "#35f2c4",
    author: typeof page.author === "string" ? page.author : "",
    authorIconUrl:
      typeof page.authorIconUrl === "string" ? page.authorIconUrl : "",
    footer: typeof page.footer === "string" ? page.footer : "",
    footerIconUrl:
      typeof page.footerIconUrl === "string" ? page.footerIconUrl : "",
    imageUrl: typeof page.imageUrl === "string" ? page.imageUrl : "",
    thumbnailUrl:
      typeof page.thumbnailUrl === "string" ? page.thumbnailUrl : "",
    fields,
  };
}

function fallbackAutomationEmbedPage(
  fallbackTitle: string,
  fallbackDescription: string,
): CommandEmbedPageDraft {
  return {
    id: crypto.randomUUID(),
    title: fallbackTitle,
    description: fallbackDescription,
    color: "#35f2c4",
    author: "",
    authorIconUrl: "",
    footer: "",
    footerIconUrl: "",
    imageUrl: "",
    thumbnailUrl: "",
    fields: [],
  };
}

function automationEmbedPagesFromJson(
  value: string,
  fallbackTitle: string,
  fallbackDescription: string,
): { pages: CommandEmbedPageDraft[]; normalized: boolean } {
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed) && parsed.length) {
      return {
        pages: parsed
          .slice(0, DISCORD_EMBED_LIMITS.pages)
          .map((item, index) =>
            automationEmbedPageFromUnknown(
              item,
              index,
              fallbackTitle,
              fallbackDescription,
            ),
          ),
        normalized: true,
      };
    }
  } catch {
    // Replace invalid local drafts by a usable first page.
  }
  return {
    pages: [fallbackAutomationEmbedPage(fallbackTitle, fallbackDescription)],
    normalized: false,
  };
}

export function SlashStudioEmbedEditor({
  value,
  fallbackTitle,
  fallbackDescription,
  previewMode,
  onChange,
}: {
  value: string;
  fallbackTitle: string;
  fallbackDescription: string;
  previewMode: "welcome" | "goodbye" | "logs" | "generic";
  onChange: (value: string) => void;
}) {
  const [activePage, setActivePage] = useState(0);
  const [activeFieldByPage, setActiveFieldByPage] = useState<
    Record<string, string | null>
  >({});
  const [embedPane, setEmbedPane] = useState<"customize" | "preview">(
    "customize",
  );
  const { pages, normalized } = automationEmbedPagesFromJson(
    value,
    fallbackTitle,
    fallbackDescription,
  );
  const currentPage = pages[Math.min(activePage, pages.length - 1)] ?? pages[0];
  const previewAliasesEnabled = true;
  const previewValue = (raw: string) =>
    previewMode === "logs"
      ? replaceLogPreviewAliases(raw)
      : replaceWelcomePreviewAliases(raw, previewAliasesEnabled);
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
  const currentPageTextLength = embedPageTextLength(currentPage);
  const savePages = (nextPages: CommandEmbedPageDraft[]) =>
    onChange(
      JSON.stringify(nextPages.slice(0, DISCORD_EMBED_LIMITS.pages), null, 2),
    );
  const updatePage = (patch: Partial<CommandEmbedPageDraft>) => {
    const nextPage = { ...currentPage, ...patch };
    const nextLength = embedPageTextLength(nextPage);
    if (
      nextLength > DISCORD_EMBED_LIMITS.pageText &&
      nextLength > currentPageTextLength
    )
      return;
    savePages(
      pages.map((page) => (page.id === currentPage.id ? nextPage : page)),
    );
  };
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
    if (
      embedPageTextLength({
        ...currentPage,
        fields: [...currentPage.fields, field],
      }) > DISCORD_EMBED_LIMITS.pageText
    )
      return;
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
    if (pages.length >= DISCORD_EMBED_LIMITS.pages) return;
    const next = [...pages, fallbackAutomationEmbedPage("", "")];
    savePages(next);
    setActivePage(next.length - 1);
  };
  const removePage = (pageId = currentPage.id) => {
    if (pages.length <= 1) return;
    const removedIndex = pages.findIndex((page) => page.id === pageId);
    const next = pages.filter((page) => page.id !== pageId);
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

  useEffect(() => {
    if (!normalized) onChange(JSON.stringify(pages, null, 2));
  }, [normalized, onChange, pages]);

  return (
    <div
      className={`commandLogsVisualEmbed ${embedPane === "preview" ? "isPreview" : "isCustomize"}`}
      style={{ "--command-embed-accent": currentPage.color } as CSSProperties}
    >
      <div className="commandEmbedPageTabs">
        {pages.map((page, index) => (
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
          disabled={pages.length >= DISCORD_EMBED_LIMITS.pages}
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
        <small
          className={`commandEmbedPageTextCounter${embedLimitTone(currentPageTextLength, DISCORD_EMBED_LIMITS.pageText)}`}
        >
          {currentPageTextLength}/{DISCORD_EMBED_LIMITS.pageText}
        </small>
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
      {previewMode === "welcome" || previewMode === "goodbye" ? (
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
            onChange={(author) => updatePage({ author })}
            placeholder={i18nText("Auteur")}
            singleLine
            previewKey={`automation-embed-author-${currentPage.id}`}
          />
        </div>
        <MarkdownVisualField
          className="commandLogsEmbedTitleInput"
          value={currentPage.title}
          maxLength={DISCORD_EMBED_LIMITS.title}
          onChange={(title) => updatePage({ title })}
          placeholder={i18nText("Titre de l'embed")}
          singleLine
          previewKey={`automation-embed-title-${currentPage.id}`}
        />
        <MarkdownVisualField
          className="commandLogsEmbedDescriptionInput"
          value={currentPage.description}
          maxLength={DISCORD_EMBED_LIMITS.description}
          onChange={(description) => updatePage({ description })}
          placeholder={i18nText("Description de l'embed")}
          previewKey={`automation-embed-description-${currentPage.id}`}
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
                  onChange={(name) => updateField(field.id, { name })}
                  placeholder={`Field ${index + 1}`}
                  singleLine
                  previewKey={`automation-embed-field-name-${field.id}`}
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
                  onChange={(fieldValue) =>
                    updateField(field.id, { value: fieldValue })
                  }
                  placeholder={i18nText("Valeur")}
                  previewKey={`automation-embed-field-value-${field.id}`}
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
            onChange={(footer) => updatePage({ footer })}
            placeholder={i18nText("Footer")}
            singleLine
            previewKey={`automation-embed-footer-${currentPage.id}`}
          />
        </div>
      </div>
      <div className="commandLogsEmbedControls">
        <Button variant="unstyled"
          type="button"
          className="commandLogsEmbedAddField"
          onClick={addField}
          disabled={currentPage.fields.length >= DISCORD_EMBED_LIMITS.fields}
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
                  updateField(activeField.id, { inline: event.target.checked })
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
              previewMode === "logs"
                ? i18nText("{actor.avatar} ou https://...")
                : i18nText("{user.avatar}, {guild.icon} ou https://...")
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
            placeholder={i18nText("{bot.avatar}, {guild.icon} ou https://...")}
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
            placeholder={
              previewMode === "logs"
                ? i18nText("https://... ou {actor.avatar}")
                : i18nText("https://... ou {user.avatar}, {guild.icon}, {bot.avatar}")
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
              previewMode === "logs"
                ? i18nText("{target.avatar} ou {guild.icon}")
                : i18nText("{user.avatar}, {guild.icon} ou {bot.avatar}")
            }
          />
        </label>
      </div>
      <CommandEmbedPreviewPanel
        page={currentPage}
        previewValue={previewValue}
        pageIndex={activePage}
        pageCount={pages.length}
        onPrevious={() => setActivePage(Math.max(0, activePage - 1))}
        onNext={() => setActivePage(Math.min(pages.length - 1, activePage + 1))}
      />
    </div>
  );
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function automationMetadataPatch(
  mode: "welcome" | "goodbye" | "logs",
  config?: GuildAutomationConfig | null,
): Record<string, unknown> {
  if (mode === "welcome" && config?.welcome) {
    const embedPages = config.welcome.embedPagesJson
      ? safeJsonParse(config.welcome.embedPagesJson, [])
      : [];
    return {
      responseMode: "welcome",
      welcomeChannelOption: "salon",
      welcomeMessageType: config.welcome.messageType,
      welcomeMessage: config.welcome.messageTemplate,
      welcomeEmbedPages: Array.isArray(embedPages) ? embedPages : [],
      welcomeRemoveConfirmation:
        i18nText("Le salon welcome a été retiré pour {channel.mention}."),
    };
  }
  if (mode === "goodbye" && config?.goodbye) {
    const embedPages = config.goodbye.embedPagesJson
      ? safeJsonParse(config.goodbye.embedPagesJson, [])
      : [];
    return {
      responseMode: "goodbye",
      goodbyeChannelOption: "salon",
      goodbyeMessageType: config.goodbye.messageType,
      goodbyeMessage: config.goodbye.messageTemplate,
      goodbyeEmbedPages: Array.isArray(embedPages) ? embedPages : [],
      goodbyeRemoveConfirmation:
        i18nText("Le salon goodbye a été retiré pour {channel.mention}."),
    };
  }
  if (mode === "logs" && config?.logs) {
    return {
      responseMode: "logs",
      logsChannelOption: "salon",
      logsSetConfirmation: "Le salon logs a été mis à jour: {channel.mention}.",
      logsRemoveConfirmation:
        "Le salon logs a été retiré pour {channel.mention}.",
      logsDefaultMode: "message",
      logsEventConfigs: config.logs.eventConfigsJson
        ? safeJsonParse(config.logs.eventConfigsJson, {})
        : {},
    };
  }
  return { responseMode: mode };
}
