"use client";

// Composants Slash Studio extraits de slash-studio-widgets.tsx.


import { Input, Select, Textarea } from "../../../components/ui/field";
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
import { Panel } from "../../../components/ui/panel";
import { Badge } from "../../../components/ui/badge";

export function CommandWorkflowTab({
  draft,
  text,
  compact = false,
}: {
  draft: ApplicationCommandDraft;
  text: UiText;
  compact?: boolean;
}) {
  const slashText = slashLabels(text);
  const visibleBlocks = compact ? workflowBlocks.slice(0, 5) : workflowBlocks;
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Workflow")}</p>
          <h3>
            {i18nText("Trigger")} {"->"} {i18nText("Conditions")} {"->"} {i18nText("Actions")} {"->"} {i18nText("Responses")} {"->"}{" "}
            {i18nText("Handlers")}
          </h3>
          <p>
            {i18nText("Chaque bloc represente une etape configurable du comportement de la commande.")}
          </p>
        </div>
      </div>
      <div className="commandWorkflowCanvas">
        <div className="commandWorkflowNode isTrigger">
          <span>{i18nText("Trigger")}</span>
          <strong>{draftCommandDisplayName(draft)}</strong>
          <small>
            {commandExecutionModeFromDraft(draft) === "prefix"
              ? slashText.textPrefixCommand
              : commandTypeLabel(draft.type, text)}
          </small>
        </div>
        {visibleBlocks.map((block, index) => (
          <article key={block.title} className="commandWorkflowNode">
            <span>{i18nText("Etape")} {index + 1}</span>
            <strong>{block.title}</strong>
            <p>{block.description}</p>
            <small>{i18nText("Permission:")} {block.permission}</small>
          </article>
        ))}
      </div>
      <div className="commandStudioBlockPicker">
        {workflowBlocks.map((block) => (
          <Button variant="unstyled" key={block.title} type="button">
            <strong>{i18nText("Ajouter")}</strong>
            <span>{block.title}</span>
          </Button>
        ))}
      </div>
    </Panel>
  );
}

// Onglet commande réponse.


export function CommandResponseTab({
  draft,
  onDraftChange,
}: {
  draft: ApplicationCommandDraft;
  onDraftChange: (draft: ApplicationCommandDraft) => void;
}) {
  const completeDraft = ensureCommandRuntime(draft);
  const runtime = completeDraft.runtime!;
  const updateRuntime = (patch: Partial<ApplicationCommandRuntimeDefinition>) =>
    onDraftChange({ ...completeDraft, runtime: { ...runtime, ...patch } });
  const updateResponse = (
    patch: Partial<ApplicationCommandRuntimeDefinition["response"]>,
  ) => updateRuntime({ response: { ...runtime.response, ...patch } });

  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Response")}</p>
          <h3>{i18nText("Ce que le bot répond vraiment")}</h3>
          <p>
            {i18nText("Cette réponse est sauvegardée avec la commande et relue quand tu modifies la commande.")}
          </p>
        </div>
      </div>
      <div className="commandStudioConfigGrid">
        <label>
          <span>{i18nText("Visibilité")}</span>
          <Select
            value={runtime.response.visibility}
            onChange={(event) =>
              updateResponse({
                visibility: event.target
                  .value as ApplicationCommandRuntimeDefinition["response"]["visibility"],
              })
            }
          >
            <option value="ephemeral">{i18nText("Éphémère")}</option>
            <option value="public">{i18nText("Publique")}</option>
          </Select>
        </label>
        <label>
          <span>{i18nText("Message principal")}</span>
          <Textarea
            value={runtime.response.content}
            onChange={(event) =>
              updateResponse({ content: event.target.value })
            }
          />
        </label>
        <label>
          <span>{i18nText("Résumé d'intention mémorisé")}</span>
          <Textarea
            value={runtime.intent ?? ""}
            onChange={(event) => updateRuntime({ intent: event.target.value })}
          />
        </label>
      </div>
      <div className="commandWorkflowCanvas">
        {runtime.workflow.map((action, index) => (
          <article key={action.id} className="commandWorkflowNode">
            <span>{i18nText("Étape")} {index + 1}</span>
            <strong>{action.label}</strong>
            <p>{action.content ?? action.type}</p>
          </article>
        ))}
      </div>
    </Panel>
  );
}
// Onglet builder embed.


export function CommandEmbedBuilderTab({
  draft,
}: {
  draft: ApplicationCommandDraft;
}) {
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Embed Builder")}</p>
          <h3>{i18nText("Preview Discord-like")}</h3>
          <p>{i18nText("Les variables peuvent etre inserees dans chaque champ.")}</p>
        </div>
      </div>
      <div className="commandStudioSplit">
        <div className="commandStudioConfigGrid">
          <label>
            <span>{i18nText("Title")}</span>
            <Input defaultValue={`${draft.name || "Command"} result`} />
          </label>
          <label>
            <span>{i18nText("Color")}</span>
            <Input type="color" defaultValue="#35f2c4" />
          </label>
          <label>
            <span>{i18nText("Description")}</span>
            <Textarea defaultValue="Resultat pour {user.mention}" />
          </label>
          <label>
            <span>{i18nText("Author")}</span>
            <Input defaultValue="{guild.name}" />
          </label>
          <label>
            <span>{i18nText("Field")}</span>
            <Input defaultValue="Status: success" />
          </label>
          <label>
            <span>{i18nText("Footer")}</span>
            <Input defaultValue="Updated at {timestamp}" />
          </label>
          <label>
            <span>{i18nText("Image URL")}</span>
            <Input placeholder={i18nText("https://...")} />
          </label>
          <label>
            <span>{i18nText("Thumbnail URL")}</span>
            <Input placeholder={i18nText("https://...")} />
          </label>
        </div>
        <div className="commandDiscordPreview">
          <div className="commandDiscordEmbed">
            <strong>{draft.name || "Command"} {i18nText("result")}</strong>
            <p>{i18nText("Resultat pour @user")}</p>
            <dl>
              <dt>{i18nText("Status")}</dt>
              <dd>{i18nText("success")}</dd>
            </dl>
            <footer>
              {draft.scope} · {new Date().toLocaleDateString()}
            </footer>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// Onglet commande composants.


export function CommandComponentsTab() {
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Components")}</p>
          <h3>{i18nText("Boutons, select menus et handlers")}</h3>
          <p>
            {i18nText("Les custom_id sont generes automatiquement et relies a une action.")}
          </p>
        </div>
      </div>
      <div className="commandStudioComponentRows">
        {[
          i18nText("Bouton Creer un ticket -> create channel"),
          i18nText("Select menu Role -> add/remove role"),
          i18nText("Bouton Fermer -> stop workflow"),
        ].map((item) => (
          <article key={item}>
            <strong>{item}</strong>
            <span>{i18nText("Style configurable · disabled toggle · action row")}</span>
            <Button variant="unstyled" type="button">{i18nText("Configurer handler")}</Button>
          </article>
        ))}
      </div>
    </Panel>
  );
}

// Onglet réponses modales.


export function CommandModalsTab() {
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Modals")}</p>
          <h3>{i18nText("Formulaires Discord")}</h3>
          <p>{i18nText("Chaque champ genere une variable utilisable dans le workflow.")}</p>
        </div>
      </div>
      <div className="commandStudioConfigGrid">
        <label>
          <span>{i18nText("Modal title")}</span>
          <Input defaultValue="Demande de support" />
        </label>
        <label>
          <span>{i18nText("Handler")}</span>
          <Select>
            <option>{i18nText("Continuer le workflow")}</option>
            <option>{i18nText("Envoyer un embed")}</option>
            <option>{i18nText("Creer un ticket")}</option>
          </Select>
        </label>
        <label>
          <span>{i18nText("Input label")}</span>
          <Input defaultValue="Sujet" />
        </label>
        <label>
          <span>{i18nText("Placeholder")}</span>
          <Input defaultValue="Explique ton besoin" />
        </label>
        <label>
          <span>{i18nText("Style")}</span>
          <Select>
            <option>{i18nText("Short")}</option>
            <option>{i18nText("Paragraph")}</option>
          </Select>
        </label>
        <label>
          <span>{i18nText("Required")}</span>
          <Select>
            <option>{i18nText("Oui")}</option>
            <option>{i18nText("Non")}</option>
          </Select>
        </label>
      </div>
    </Panel>
  );
}

// Onglet commande conditions.


export function CommandConditionsTab() {
  const conditions = [
    "L'utilisateur possede un role",
    "L'utilisateur n'a pas un role",
    "L'utilisateur a une permission",
    "Le bot a une permission",
    "Commande utilisee dans tel salon",
    "Commande utilisee dans telle guild",
    "Option egale a une valeur",
    "Option contient une valeur",
    "Cooldown actif ou non",
    "User id autorise/interdit",
  ];
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Conditions")}</p>
          <h3>{i18nText("Branches sans code")}</h3>
          <p>{i18nText("Compose des regles lisibles avant d'executer les actions.")}</p>
        </div>
      </div>
      <div className="commandStudioRuleGrid">
        {conditions.map((condition) => (
          <Button variant="unstyled" key={condition} type="button">
            {condition}
          </Button>
        ))}
      </div>
    </Panel>
  );
}

// Onglet commande actions.


export function CommandActionsTab({ compact = false }: { compact?: boolean }) {
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Actions")}</p>
          <h3>{i18nText("Bibliotheque d'actions")}</h3>
          <p>
            {i18nText("Chaque action indique permissions, champs attendus, variables et erreurs possibles.")}
          </p>
        </div>
      </div>
      <div className="commandStudioActionGrid">
        {actionLibrary
          .slice(0, compact ? 6 : actionLibrary.length)
          .map(([name, description, permission, error]) => (
            <article key={name}>
              <strong>{name}</strong>
              <p>{description}</p>
              <span>{i18nText("Permission:")} {permission}</span>
              <small>{i18nText("Erreur possible:")} {error}</small>
            </article>
          ))}
      </div>
    </Panel>
  );
}

// Onglet commande variables.


export function CommandVariablesTab() {
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Variables")}</p>
          <h3>{i18nText("Variables dynamiques")}</h3>
          <p>{i18nText("Clique une variable pour la copier dans le presse-papier.")}</p>
        </div>
      </div>
      <div className="commandStudioVariableGrid">
        {commandVariables.map((variable) => (
          <Button variant="unstyled"
            key={variable}
            type="button"
            onClick={() => navigator.clipboard?.writeText(variable)}
          >
            {variable}
          </Button>
        ))}
      </div>
    </Panel>
  );
}

// Onglet test et aperçu.


export function CommandTestPreviewTab({
  draft,
  validationErrors,
}: {
  draft: ApplicationCommandDraft;
  validationErrors: string[];
}) {
  return (
    <Panel className="commandStudioPane">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("Test / Preview")}</p>
          <h3>{i18nText("Simulation locale")}</h3>
          <p>{i18nText("Teste le chemin du workflow avant de l’appliquer à Discord.")}</p>
        </div>
      </div>
      <div className="commandStudioSplit">
        <div className="commandStudioConfigGrid">
          <label>
            <span>{i18nText("Utilisateur simule")}</span>
            <Select>
              <option>{i18nText("@alex")}</option>
              <option>{i18nText("@moderator")}</option>
              <option>{i18nText("@new-member")}</option>
            </Select>
          </label>
          <label>
            <span>{i18nText("Serveur simule")}</span>
            <Select>
              <option>{i18nText("Botdeck Lab")}</option>
              <option>{i18nText("Production Guild")}</option>
            </Select>
          </label>
          <label>
            <span>{i18nText("Salon simule")}</span>
            <Select>
              <option>{i18nText("#general")}</option>
              <option>{i18nText("#support")}</option>
              <option>{i18nText("#logs")}</option>
            </Select>
          </label>
          {draft.options.slice(0, 4).map((option) => (
            <label key={option.id}>
              <span>{option.name}</span>
              <Input placeholder={option.description} />
            </label>
          ))}
        </div>
        <div className="commandTestResult">
          <strong>{draftCommandDisplayName(draft)}</strong>
          <p>{draft.description}</p>
          {validationErrors.length ? (
            <div className="slashCommandValidationList">
              <strong>{i18nText("Validation")}</strong>
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : (
            <Badge className="commandStudioBadge isEnabled" tone="success">
              {i18nText("Workflow executable")}
            </Badge>
          )}
          <ol>
            <li>{i18nText("Trigger recu")}</li>
            <li>{i18nText("Conditions verifiees")}</li>
            <li>{i18nText("Reponse preparee")}</li>
            <li>{i18nText("Handlers attaches")}</li>
          </ol>
        </div>
      </div>
    </Panel>
  );
}

// Onglet JSON avancé.


export function CommandAdvancedJsonTab({
  draft,
  importJson,
  importMessage,
  text,
  onImportChange,
  onValidate,
  onLoad,
  onCreate,
}: {
  draft: ApplicationCommandDraft;
  importJson: string;
  importMessage: string | null;
  text: UiText;
  onImportChange: (value: string) => void;
  onValidate: () => ApplicationCommandDraft | null;
  onLoad: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="slashCommandJsonEditor">
      <div className="commandStudioPaneHeader">
        <div>
          <p className="permissionPanelEyebrow">{i18nText("JSON avance")}</p>
          <h3>{i18nText("Definition complete")}</h3>
          <p>
            {i18nText("Definition Discord, runtime definition, import/export et resynchronisation visuelle.")}
          </p>
        </div>
      </div>
      <div className="commandStudioJsonGrid">
        <div>
          <h3>{i18nText("Visual builder JSON")}</h3>
          <pre>{JSON.stringify(buildRuntimeDefinition(draft), null, 2)}</pre>
        </div>
        <div>
          <h3>{text.importJson}</h3>
          <Textarea
            value={importJson}
            onChange={(event) => onImportChange(event.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
      <div className="slashCommandActions">
        <Button variant="unstyled" type="button" onClick={onValidate}>
          {text.validateJson}
        </Button>
        <Button variant="unstyled" type="button" onClick={onLoad}>
          {i18nText("Reset from visual builder")}
        </Button>
        <Button variant="unstyled" type="button" onClick={onCreate}>
          {text.createFromJson}
        </Button>
      </div>
      {importMessage ? <p>{importMessage}</p> : null}
    </section>
  );
}

// Panneau JSON commande slash.
