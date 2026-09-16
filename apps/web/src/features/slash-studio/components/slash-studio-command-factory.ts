// Construction, validation et sérialisation des commandes Slash Studio.

import {
  type ApplicationCommandDraft,
  type ApplicationCommandDraftOption,
  type ApplicationCommandRuntimeDefinition,
  type ApplicationCommandScope,
  type ApplicationCommandSummary,
} from "@botdeck/shared";

import { type UiText } from "@/features/workspace/core";

import {
  DEFAULT_LOG_EVENT_MESSAGES,
  DISCORD_EMBED_LIMITS,
  LOG_EVENT_KEYS,
  LOG_EVENT_LABELS,
  MAX_MODAL_RESPONSE_CARDS,
  commandAvailabilityFromDraft,
  commandExecutionModeFromDraft,
  commandResponseModeFromDraft,
  commandRuntimeActionType,
  commandRuntimeMetadata,
  createEmbedPageDraft,
  embedPageTextLength,
  embedPagesFromMetadata,
  goodbyeEmbedPagesFromMetadata,
  logEventConfigsFromMetadata,
  moderationEmbedPagesFromMetadata,
  welcomeEmbedPagesFromMetadata,
  type CommandEmbedPageDraft,
  type CommandModalResponseDraft,
  type CommandModalResponseKind,
} from "./slash-studio-command-runtime";
import {
  createDraftOption,
  createEmptyCommandDraft,
  isRecord,
} from "./slash-studio-command-drafts";
import { type CommandTemplateKey, workflowBlocks } from "./slash-studio-catalog";
import { slashLabels, slashStudioText } from "./slash-studio-text";

export function isDiscordSnowflakeId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

// Validation UI avant API Discord.
export function validateCommandDraft(draft: ApplicationCommandDraft): string[] {
  const errors: string[] = [];
  const namePattern = /^[\p{Ll}\p{N}_-]{1,32}$/u;
  const executionMode = commandExecutionModeFromDraft(draft);
  const responseMode = commandResponseModeFromDraft(draft);
  const metadata = commandRuntimeMetadata(draft);
  const availability = commandAvailabilityFromDraft(draft);
  const responseVisibility = draft.runtime?.response.visibility ?? "public";
  const validateEmbedPages = (
    pages: CommandEmbedPageDraft[],
    label: string,
  ) => {
    pages.forEach((page, index) => {
      const prefix = `${label} page ${index + 1}`;
      const total = embedPageTextLength(page);
      if (page.title.length > DISCORD_EMBED_LIMITS.title)
        errors.push(
          `${prefix}: titre trop long (${page.title.length}/${DISCORD_EMBED_LIMITS.title}).`,
        );
      if (page.description.length > DISCORD_EMBED_LIMITS.description)
        errors.push(
          `${prefix}: description trop longue (${page.description.length}/${DISCORD_EMBED_LIMITS.description}).`,
        );
      if (page.author.length > DISCORD_EMBED_LIMITS.author)
        errors.push(
          `${prefix}: auteur trop long (${page.author.length}/${DISCORD_EMBED_LIMITS.author}).`,
        );
      if (page.footer.length > DISCORD_EMBED_LIMITS.footer)
        errors.push(
          `${prefix}: footer trop long (${page.footer.length}/${DISCORD_EMBED_LIMITS.footer}).`,
        );
      if (page.fields.length > DISCORD_EMBED_LIMITS.fields)
        errors.push(
          `${prefix}: Discord limite un embed à ${DISCORD_EMBED_LIMITS.fields} fields.`,
        );
      if (total > DISCORD_EMBED_LIMITS.pageText)
        errors.push(
          `${prefix}: total embed trop long (${total}/${DISCORD_EMBED_LIMITS.pageText}).`,
        );
      page.fields.forEach((field, fieldIndex) => {
        if (field.name.length > DISCORD_EMBED_LIMITS.fieldName)
          errors.push(
            `${prefix} field ${fieldIndex + 1}: nom trop long (${field.name.length}/${DISCORD_EMBED_LIMITS.fieldName}).`,
          );
        if (field.value.length > DISCORD_EMBED_LIMITS.fieldValue)
          errors.push(
            `${prefix} field ${fieldIndex + 1}: valeur trop longue (${field.value.length}/${DISCORD_EMBED_LIMITS.fieldValue}).`,
          );
      });
    });
  };
  if (!draft.name.trim()) errors.push("Le nom est requis.");
  if (draft.name.trim() && !namePattern.test(draft.name.trim()))
    errors.push(
      "Le nom doit être en minuscules, 1-32 caractères, avec lettres, chiffres, _ ou -.",
    );
  if (draft.type === "chat_input" && !draft.description.trim())
    errors.push("La description est requise pour une commande slash.");
  if (draft.type === "chat_input" && draft.description.trim().length > 100)
    errors.push("La description doit faire 100 caractères maximum.");
  if (draft.options.length > 25)
    errors.push("Discord limite les options à 25 par niveau.");
  if (draft.scope === "guild" && !isDiscordSnowflakeId(draft.guildId))
    errors.push(
      "Choisis un serveur valide pour créer une commande limitée à un serveur.",
    );
  if (
    (availability === "dm" || availability === "both") &&
    draft.scope !== "global"
  )
    errors.push(
      "Les commandes disponibles en DM doivent être créées en portée globale.",
    );
  if (availability === "dm" && draft.defaultMemberPermissions)
    errors.push(
      "Les permissions serveur ne s’appliquent pas à une commande uniquement DM.",
    );
  if (executionMode === "prefix" && responseMode === "modal")
    errors.push(
      "Une commande à préfixe ne peut pas ouvrir un modal Discord. Utilise une commande slash.",
    );
  if (
    (responseMode === "welcome" ||
      responseMode === "goodbye" ||
      responseMode === "logs") &&
    draft.type !== "chat_input"
  )
    errors.push(
      "La configuration welcome/goodbye/logs doit être une commande slash avec une option salon.",
    );
  if (
    (responseMode === "welcome" ||
      responseMode === "goodbye" ||
      responseMode === "logs") &&
    availability !== "guild"
  )
    errors.push(
      "La configuration welcome/goodbye/logs doit être limitée aux serveurs, pas aux DM.",
    );
  if (responseMode === "autorole" && draft.type !== "chat_input")
    errors.push("Role automation doit être une commande slash serveur.");
  if (responseMode === "autorole" && availability !== "guild")
    errors.push("Role automation doit être limité aux serveurs, pas aux DM.");
  if (
    (responseMode === "ban" ||
      responseMode === "unban" ||
      responseMode === "kick") &&
    draft.type !== "chat_input"
  )
    errors.push(
      "Les commandes ban/unban/kick doivent être des commandes slash serveur.",
    );
  if (
    (responseMode === "ban" ||
      responseMode === "unban" ||
      responseMode === "kick") &&
    availability !== "guild"
  )
    errors.push(
      "Les commandes de modération doivent être limitées aux serveurs, pas aux DM.",
    );
  if (executionMode === "prefix" && responseVisibility === "ephemeral")
    errors.push("Une commande à préfixe ne peut pas répondre en éphémère.");
  const validateOptions = (
    options: ApplicationCommandDraftOption[],
    path: string,
  ) => {
    const hasSubcommands = options.some(
      (option) =>
        option.type === "sub_command" || option.type === "sub_command_group",
    );
    const hasPrimitive = options.some(
      (option) =>
        option.type !== "sub_command" && option.type !== "sub_command_group",
    );
    if (hasSubcommands && hasPrimitive)
      errors.push(
        `${path}: ne mélange pas subcommands et options primitives au même niveau.`,
      );
    let seenOptional = false;
    options.forEach((option, index) => {
      const label = `${path}/${option.name || `option-${index + 1}`}`;
      if (!option.name.trim() || !namePattern.test(option.name.trim()))
        errors.push(`${label}: nom invalide.`);
      if (!option.description.trim())
        errors.push(`${label}: description requise.`);
      if (option.description.trim().length > 100)
        errors.push(`${label}: description trop longue.`);
      if (option.required && seenOptional)
        errors.push(
          `${label}: les options required doivent être avant les options optionnelles.`,
        );
      if (!option.required) seenOptional = true;
      if (option.choices.length > 25)
        errors.push(`${label}: maximum 25 choices.`);
      if (option.choices.length > 0 && option.autocomplete)
        errors.push(`${label}: choices et autocomplete sont incompatibles.`);
      if (
        (option.type === "sub_command" ||
          option.type === "sub_command_group") &&
        option.options.length > 25
      )
        errors.push(`${label}: maximum 25 options enfant.`);
      if (
        option.type === "sub_command_group" &&
        option.options.some((child) => child.type !== "sub_command")
      )
        errors.push(`${label}: un group ne peut contenir que des subcommands.`);
      if (
        option.type !== "sub_command" &&
        option.type !== "sub_command_group" &&
        option.options.length > 0
      )
        errors.push(
          `${label}: seules les subcommands peuvent contenir des options enfant.`,
        );
      validateOptions(option.options, label);
    });
  };
  if (draft.type !== "chat_input" && draft.options.length > 0)
    errors.push("Les commandes User/Message ne supportent pas d’options.");
  validateOptions(draft.options, `/${draft.name || "command"}`);
  if (responseMode === "embed")
    validateEmbedPages(
      embedPagesFromMetadata(
        draft,
        metadata,
        draft.runtime?.response.content ?? "",
      ),
      "Embed",
    );
  if (
    (responseMode === "ban" ||
      responseMode === "unban" ||
      responseMode === "kick") &&
    metadata.moderationResponseType === "embed"
  )
    validateEmbedPages(
      moderationEmbedPagesFromMetadata(
        draft,
        metadata,
        draft.runtime?.response.content ?? "",
      ),
      "Moderation embed",
    );
  if (responseMode === "welcome")
    validateEmbedPages(
      welcomeEmbedPagesFromMetadata(
        draft,
        metadata,
        typeof metadata.welcomeMessage === "string"
          ? metadata.welcomeMessage
          : "",
      ),
      "Welcome embed",
    );
  if (responseMode === "goodbye")
    validateEmbedPages(
      goodbyeEmbedPagesFromMetadata(
        draft,
        metadata,
        typeof metadata.goodbyeMessage === "string"
          ? metadata.goodbyeMessage
          : "",
      ),
      "Goodbye embed",
    );
  if (responseMode === "logs") {
    const configs = logEventConfigsFromMetadata(draft, metadata);
    LOG_EVENT_KEYS.forEach((key) => {
      if (configs[key].mode === "embed")
        validateEmbedPages(
          configs[key].embedPages,
          `Logs ${LOG_EVENT_LABELS[key]}`,
        );
    });
  }
  if (responseMode === "modal") {
    modalResponsesFromMetadata(draft, metadata).forEach((response, index) => {
      if (response.kind === "embed")
        validateEmbedPages(response.embedPages, `Modal carte ${index + 1}`);
    });
  }
  return errors;
}

// Libellé du type commande.
export function commandTypeLabel(
  type: ApplicationCommandDraft["type"] | ApplicationCommandSummary["type"],
  text?: UiText,
): string {
  const labels = text
    ? slashLabels(text).commandTypes
    : slashStudioText.en.commandTypes;
  if (type === "chat_input" || type === "Chat Input") return labels.chat_input;
  if (type === "user" || type === "User") return labels.user;
  if (type === "message" || type === "Message") return labels.message;
  return labels.unknown;
}

// Extrait les métadonnées runtime.
export function commandRuntimeMetadataFromRuntime(
  runtime: ApplicationCommandRuntimeDefinition | null | undefined,
): Record<string, unknown> {
  const metadata = runtime?.workflow?.[0]?.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
}

// Détecte une commande préfixe.
export function isPrefixCommandSummary(
  command: ApplicationCommandSummary,
): boolean {
  const metadata = commandRuntimeMetadataFromRuntime(
    command.runtime ??
      (isRecord(command.raw.botdeckRuntime)
        ? (command.raw
            .botdeckRuntime as unknown as ApplicationCommandRuntimeDefinition)
        : null),
  );
  return (
    metadata.executionMode === "prefix" ||
    command.id.startsWith("local-prefix:") ||
    command.raw.localOnly === true
  );
}

// Lit le préfixe affiché.
export function commandPrefixFromSummary(
  command: ApplicationCommandSummary,
): string {
  const metadata = commandRuntimeMetadataFromRuntime(
    command.runtime ??
      (isRecord(command.raw.botdeckRuntime)
        ? (command.raw
            .botdeckRuntime as unknown as ApplicationCommandRuntimeDefinition)
        : null),
  );
  return typeof metadata.prefix === "string" && metadata.prefix.length > 0
    ? metadata.prefix
    : "&";
}

// Nom affiché de commande.
export function commandDisplayName(command: ApplicationCommandSummary): string {
  if (isPrefixCommandSummary(command))
    return `${commandPrefixFromSummary(command)}${command.name}`;
  return `${command.type === "Chat Input" ? "/" : ""}${command.name}`;
}

// Type lisible du résumé.
export function commandSummaryTypeLabel(
  command: ApplicationCommandSummary,
): string {
  return isPrefixCommandSummary(command)
    ? slashStudioText.en.textPrefixCommand
    : commandTypeLabel(command.type);
}

// Crée le runtime commande.
export function createRuntimeDefinition(
  intent: string,
  kind:
    | "simple"
    | "embed"
    | "welcome"
    | "goodbye"
    | "logs"
    | "autorole"
    | "ban"
    | "unban"
    | "kick"
    | "ticket"
    | "roles"
    | "moderation",
  content: string,
): ApplicationCommandRuntimeDefinition {
  const visibility =
    kind === "moderation" ||
    kind === "ban" ||
    kind === "unban" ||
    kind === "kick" ||
    kind === "welcome" ||
    kind === "goodbye" ||
    kind === "logs" ||
    kind === "autorole"
      ? "ephemeral"
      : "public";
  const workflowMap: Record<
    typeof kind,
    ApplicationCommandRuntimeDefinition["workflow"]
  > = {
    simple: [
      { id: "reply", type: "reply", label: "Répondre immédiatement", content },
    ],
    embed: [
      { id: "embed", type: "send_embed", label: "Envoyer un embed", content },
    ],
    welcome: [
      {
        id: "welcome",
        type: "set_welcome_channel",
        label: "Définir le salon welcome",
        content,
        metadata: {
          responseMode: "welcome",
          welcomeChannelOption: "salon",
          welcomeMessageType: "message",
          welcomeMessage: "Bienvenue {user.mention} sur {guild.name} !",
          welcomeRemoveConfirmation:
            "Le salon welcome a été retiré pour {channel.mention}.",
        },
      },
    ],
    goodbye: [
      {
        id: "goodbye",
        type: "set_goodbye_channel",
        label: "Définir le salon goodbye",
        content,
        metadata: {
          responseMode: "goodbye",
          goodbyeChannelOption: "salon",
          goodbyeMessageType: "message",
          goodbyeMessage:
            "👋 {user.displayName} a quitté {guild.name}. Nous sommes maintenant {member.count} membres.",
          goodbyeRemoveConfirmation:
            "Le salon goodbye a été retiré pour {channel.mention}.",
        },
      },
    ],
    logs: [
      {
        id: "logs",
        type: "set_logs_channel",
        label: "Définir le salon logs",
        content,
        metadata: {
          responseMode: "logs",
          logsChannelOption: "salon",
          logsRemoveConfirmation:
            "Le salon logs a été retiré pour {channel.mention}.",
          logsSetConfirmation:
            "Le salon logs a été mis à jour: {channel.mention}.",
          logsDefaultMode: "message",
        },
      },
    ],
    autorole: [
      {
        id: "autorole",
        type: "role_automation",
        label: "Gérer les rôles automatiques",
        content,
        metadata: { responseMode: "autorole" },
      },
    ],
    ban: [
      {
        id: "ban",
        type: "moderation",
        label: "Bannir un membre",
        content,
        metadata: {
          responseMode: "ban",
          moderationAction: "ban",
          moderationResponseType: "message",
        },
      },
    ],
    unban: [
      {
        id: "unban",
        type: "moderation",
        label: "Débannir un utilisateur",
        content,
        metadata: {
          responseMode: "unban",
          moderationAction: "unban",
          moderationResponseType: "message",
        },
      },
    ],
    kick: [
      {
        id: "kick",
        type: "moderation",
        label: "Expulser un membre",
        content,
        metadata: {
          responseMode: "kick",
          moderationAction: "kick",
          moderationResponseType: "message",
        },
      },
    ],
    ticket: [
      { id: "reply", type: "reply", label: "Confirmer la demande", content },
      {
        id: "ticket",
        type: "create_ticket_channel",
        label: "Préparer le ticket privé",
        metadata: { planned: true },
      },
    ],
    roles: [
      {
        id: "reply",
        type: "reply",
        label: "Afficher le menu de rôles",
        content,
      },
      {
        id: "roles",
        type: "role_menu",
        label: "Gérer la sélection de rôle",
        metadata: { planned: true },
      },
    ],
    moderation: [
      {
        id: "guard",
        type: "moderation",
        label: "Vérifier les permissions",
        metadata: { planned: true },
      },
      { id: "reply", type: "reply", label: "Confirmer l'action", content },
    ],
  };

  return {
    version: 1,
    intent,
    response: { content, visibility },
    workflow: workflowMap[kind],
    variables: ["user.mention", "guild.name", "command.name"],
  };
}

// Déduit le genre runtime.
export function runtimeKindFromDraft(
  draft: ApplicationCommandDraft,
):
  | "simple"
  | "embed"
  | "welcome"
  | "goodbye"
  | "logs"
  | "autorole"
  | "ban"
  | "unban"
  | "kick"
  | "ticket"
  | "roles"
  | "moderation" {
  const lower = `${draft.name} ${draft.description}`.toLowerCase();
  if (
    lower.includes("unban") ||
    lower.includes("deban") ||
    lower.includes("débann")
  )
    return "unban";
  if (lower.includes("kick") || lower.includes("expuls")) return "kick";
  if (lower.includes("ban") || lower.includes("bann")) return "ban";
  if (
    lower.includes("autorole") ||
    lower.includes("auto role") ||
    lower.includes("role automation") ||
    lower.includes("rôle automatique") ||
    lower.includes("role automatique")
  )
    return "autorole";
  if (
    lower.includes("goodbye") ||
    lower.includes("au revoir") ||
    lower.includes("départ") ||
    lower.includes("depart")
  )
    return "goodbye";
  if (
    lower.includes("setlogs") ||
    lower.includes("logs") ||
    lower.includes("journal")
  )
    return "logs";
  if (lower.includes("welcome") || lower.includes("bienvenue"))
    return "welcome";
  if (lower.includes("ticket")) return "ticket";
  if (lower.includes("role") || lower.includes("rôle")) return "roles";
  if (lower.includes("embed") || lower.includes("info")) return "embed";
  if (
    draft.defaultMemberPermissions ||
    lower.includes("ban") ||
    lower.includes("kick") ||
    lower.includes("mute")
  )
    return "moderation";
  return "simple";
}

// Garantit un runtime valide.
export function ensureCommandRuntime(
  draft: ApplicationCommandDraft,
  fallbackIntent = "",
): ApplicationCommandDraft {
  if (draft.runtime) {
    return {
      ...draft,
      runtime: {
        ...draft.runtime,
        response: {
          content:
            typeof draft.runtime.response?.content === "string"
              ? draft.runtime.response.content
              : "",
          visibility: draft.runtime.response?.visibility ?? "public",
        },
        workflow: Array.isArray(draft.runtime.workflow)
          ? draft.runtime.workflow
          : [],
      },
    };
  }
  const kind = runtimeKindFromDraft(draft);
  const name = draft.name || "commande";
  const content =
    kind === "simple" && name === "ping"
      ? "Pong"
      : kind === "welcome"
        ? "Le salon welcome a été mis à jour: {channel.mention}."
        : kind === "logs"
          ? "Le salon logs a été mis à jour: {channel.mention}."
          : kind === "autorole"
            ? "Rôles automatiques mis à jour."
            : kind === "ban"
              ? "🔨 {target.mention} a été banni. Raison: {reason}"
              : kind === "unban"
                ? "✅ {target.mention} a été débanni. Raison: {reason}"
                : kind === "kick"
                  ? "👢 {target.mention} a été expulsé. Raison: {reason}"
                  : kind === "ticket"
                    ? "Ticket reçu. L'équipe va prendre le relais."
                    : kind === "roles"
                      ? "Choisis tes rôles avec le menu ci-dessous."
                      : kind === "embed"
                        ? `Voici les informations pour /${name}.`
                        : kind === "moderation"
                          ? "Action de modération reçue pour {membre}. Raison: {raison}."
                          : `Commande /${name} exécutée.`;
  return {
    ...draft,
    runtime: createRuntimeDefinition(
      fallbackIntent || `/${name}`,
      kind,
      content,
    ),
  };
}

// Applique un modèle commande.
export function applyCommandTemplate(
  template: CommandTemplateKey,
  scope: ApplicationCommandScope,
  guildId: string | null,
): ApplicationCommandDraft {
  const draft = createEmptyCommandDraft(scope, guildId);
  if (template === "simple")
    return ensureCommandRuntime(
      { ...draft, name: "hello", description: "Reply with a friendly message" },
      "/hello répond Bonjour",
    );
  if (template === "embed")
    return ensureCommandRuntime(
      { ...draft, name: "info", description: "Send a rich information embed" },
      "/info envoie un embed",
    );
  if (template === "welcome")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "setwelcome",
        description: "Set the server welcome channel",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        options: [
          createComposerOption(
            "channel",
            "salon",
            "Salon où envoyer les messages de bienvenue",
            true,
          ),
        ],
      },
      "/setwelcome définit le salon welcome",
    );
  if (template === "goodbye")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "setgoodbye",
        description: "Set the server goodbye channel",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        options: [
          createComposerOption(
            "channel",
            "salon",
            "Salon où envoyer les messages de départ",
            true,
          ),
        ],
      },
      "/setgoodbye définit le salon goodbye",
    );
  if (template === "logs")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "setlogs",
        description: "Set the server logs channel",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "32",
        options: [
          createComposerOption(
            "channel",
            "salon",
            "Salon où envoyer les logs",
            true,
          ),
        ],
      },
      "/setlogs définit le salon logs",
    );
  if (template === "recreate_purge") {
    const channelOption = createComposerOption(
      "channel",
      "salon",
      "Salon à recréer. Vide = salon courant.",
      false,
    );
    channelOption.channelTypes = [0, 2, 5, 13, 15, 16];
    const confirmationOption = createComposerOption(
      "string",
      "confirmation",
      "Tape RECREER pour confirmer l'action destructive.",
      true,
    );
    const reasonOption = createComposerOption(
      "string",
      "raison",
      "Raison affichée dans le message et l'audit log.",
      false,
    );
    return ensureCommandRuntime(
      {
        ...draft,
        name: "reinitialiser-salon",
        description: "Recrée un salon à l'identique puis supprime l'ancien",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "16",
        options: [confirmationOption, channelOption, reasonOption],
      },
      "/reinitialiser-salon recrée un salon après confirmation",
    );
  }
  if (template === "autorole")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "autorole",
        description: "Manage automatic server roles",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "268435456",
        options: createAutoRoleCommandOptions(),
      },
      "/autorole gère les rôles automatiques",
    );
  if (template === "ban")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "ban",
        description: "Ban a member",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "4",
        options: createModerationCommandOptions("ban"),
      },
      "/ban bannit un membre",
    );
  if (template === "unban")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "unban",
        description: "Unban a user",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "4",
        options: createModerationCommandOptions("unban"),
      },
      "/unban débannit un utilisateur",
    );
  if (template === "kick")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "kick",
        description: "Kick a member",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "2",
        options: createModerationCommandOptions("kick"),
      },
      "/kick expulse un membre",
    );
  if (template === "ticket")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "ticket",
        description: "Create a support ticket",
        options: [
          createComposerOption("string", "sujet", "Sujet du ticket", false),
        ],
      },
      "/ticket ouvre un ticket",
    );
  if (template === "roles")
    return ensureCommandRuntime(
      { ...draft, name: "roles", description: "Open a role selection menu" },
      "/roles affiche un menu",
    );
  if (template === "modal")
    return ensureCommandRuntime(
      { ...draft, name: "form", description: "Open a Discord modal form" },
      "/form ouvre un formulaire",
    );
  if (template === "announcement")
    return ensureCommandRuntime(
      {
        ...draft,
        name: "announce",
        description: "Prepare and send an announcement",
        defaultMemberPermissions: "8192",
      },
      "/announce prépare une annonce",
    );
  return ensureCommandRuntime(
    {
      ...draft,
      name: "moderate",
      description: "Run a moderation workflow",
      defaultMemberPermissions: "1099511627776",
    },
    "/moderate modère un membre",
  );
}

// Construit le runtime commande.
export function buildRuntimeDefinition(draft: ApplicationCommandDraft) {
  const completeDraft = ensureCommandRuntime(draft);
  return {
    command: {
      type: completeDraft.type,
      name: completeDraft.name,
      description: completeDraft.description,
      scope: completeDraft.scope,
      guildId: completeDraft.guildId ?? null,
      options: completeDraft.options,
    },
    runtime: completeDraft.runtime,
  };
}


export function createComposerOption(
  type: ApplicationCommandDraftOption["type"],
  name: string,
  description: string,
  required = false,
): ApplicationCommandDraftOption {
  return {
    ...createDraftOption(type),
    name,
    description,
    required,
    channelTypes: type === "channel" ? [0, 5] : [],
  };
}

export function createAutoRoleCommandOptions(): ApplicationCommandDraftOption[] {
  const action = createComposerOption(
    "string",
    "action",
    "list, add, remove ou sync",
    true,
  );
  action.choices = [
    { name: "list", value: "list" },
    { name: "add", value: "add" },
    { name: "remove", value: "remove" },
    { name: "sync", value: "sync" },
  ];
  const mode = createComposerOption(
    "string",
    "mode",
    "all = toutes les conditions, any = une seule condition",
    false,
  );
  mode.choices = [
    { name: "all", value: "all" },
    { name: "any", value: "any" },
  ];
  return [
    action,
    createComposerOption(
      "role",
      "role",
      "Rôle à attribuer pour action:add",
      false,
    ),
    createComposerOption(
      "string",
      "id",
      "ID court ou complet pour action:remove",
      false,
    ),
    createComposerOption(
      "integer",
      "messages",
      "Nombre de messages requis",
      false,
    ),
    createComposerOption(
      "integer",
      "vocal_min",
      "Temps vocal requis en minutes",
      false,
    ),
    createComposerOption(
      "integer",
      "anciennete_jours",
      "Ancienneté serveur requise en jours",
      false,
    ),
    mode,
  ];
}

export function createModerationCommandOptions(
  action: "ban" | "unban" | "kick",
): ApplicationCommandDraftOption[] {
  const reason = createComposerOption(
    "string",
    "raison",
    "Raison affichée dans la réponse et les logs",
    false,
  );
  reason.maxLength = 512;
  if (action === "unban") {
    const userId = createComposerOption(
      "string",
      "user_id",
      "ID Discord de l'utilisateur à débannir",
      true,
    );
    userId.minLength = 17;
    userId.maxLength = 20;
    return [userId, reason];
  }
  return [
    createComposerOption(
      "user",
      "membre",
      action === "ban" ? "Membre à bannir" : "Membre à expulser",
      true,
    ),
    reason,
  ];
}

// Propose un nom depuis l’intention.
export function commandNameFromIntent(
  intent: string,
  fallback: string,
): string {
  const slashMatch = intent.match(/\/([\p{Ll}\p{L}\p{N}_-]{1,32})/u);
  const raw = slashMatch?.[1] ?? fallback;
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized.slice(0, 32) || fallback;
}

// Transforme l’intention en brouillon.
export function commandIntentToDraft(
  intent: string,
  scope: ApplicationCommandScope,
  guildId: string | null,
): ApplicationCommandDraft {
  const normalized = intent.toLowerCase();
  const base = createEmptyCommandDraft(scope, guildId);
  if (
    normalized.includes("autorole") ||
    normalized.includes("auto role") ||
    normalized.includes("role automation") ||
    normalized.includes("rôle automatique") ||
    normalized.includes("role automatique")
  ) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "autorole"),
        description: "Manage automatic server roles",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "268435456",
        options: createAutoRoleCommandOptions(),
        runtime: createRuntimeDefinition(
          intent,
          "autorole",
          "Rôles automatiques mis à jour.",
        ),
      },
      intent,
    );
  }
  if (
    normalized.includes("setlogs") ||
    normalized.includes("logs") ||
    normalized.includes("journal")
  ) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "setlogs"),
        description: "Set the server logs channel",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "32",
        options: [
          createComposerOption(
            "channel",
            "salon",
            "Salon où envoyer les logs",
            true,
          ),
        ],
        runtime: createRuntimeDefinition(
          intent,
          "logs",
          "Le salon logs a été mis à jour: {channel.mention}.",
        ),
      },
      intent,
    );
  }
  if (
    normalized.includes("goodbye") ||
    normalized.includes("au revoir") ||
    normalized.includes("départ") ||
    normalized.includes("depart")
  ) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "setgoodbye"),
        description: "Set the server goodbye channel",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        options: [
          createComposerOption(
            "channel",
            "salon",
            "Salon où envoyer les messages de départ",
            true,
          ),
        ],
        runtime: createRuntimeDefinition(
          intent,
          "goodbye",
          "Le salon goodbye a été mis à jour: {channel.mention}.",
        ),
      },
      intent,
    );
  }
  if (normalized.includes("welcome") || normalized.includes("bienvenue")) {
    return ensureCommandRuntime(
      {
        ...base,
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        name: commandNameFromIntent(intent, "setwelcome"),
        description: "Set the server welcome channel",
        options: [
          createComposerOption(
            "channel",
            "salon",
            "Salon où envoyer les messages de bienvenue",
            true,
          ),
        ],
      },
      intent,
    );
  }
  if (normalized.includes("ticket")) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "ticket"),
        description: "Open a private support ticket",
        options: [
          createComposerOption("string", "sujet", "Sujet du ticket", false),
        ],
      },
      intent,
    );
  }
  if (
    normalized.includes("role") ||
    normalized.includes("rôle") ||
    normalized.includes("roles") ||
    normalized.includes("rôles")
  ) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "role"),
        description: "Open a role selection menu",
        defaultMemberPermissions: null,
      },
      intent,
    );
  }
  if (normalized.includes("embed")) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "embed"),
        description: "Send a rich Discord embed",
      },
      intent,
    );
  }
  if (
    normalized.includes("unban") ||
    normalized.includes("deban") ||
    normalized.includes("débann")
  ) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "unban"),
        description: "Unban a user with reason and log",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "4",
        options: createModerationCommandOptions("unban"),
        runtime: createRuntimeDefinition(
          intent,
          "unban",
          "✅ {target.mention} a été débanni. Raison: {reason}",
        ),
      },
      intent,
    );
  }
  if (normalized.includes("ban") || normalized.includes("bann")) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "ban"),
        description: "Ban a member with reason and log",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "4",
        options: createModerationCommandOptions("ban"),
        runtime: createRuntimeDefinition(
          intent,
          "ban",
          "🔨 {target.mention} a été banni. Raison: {reason}",
        ),
      },
      intent,
    );
  }
  if (normalized.includes("kick") || normalized.includes("expuls")) {
    return ensureCommandRuntime(
      {
        ...base,
        name: commandNameFromIntent(intent, "kick"),
        description: "Kick a member with reason and log",
        scope: "guild",
        guildId,
        contexts: ["guild"],
        dmPermission: null,
        defaultMemberPermissions: "2",
        options: createModerationCommandOptions("kick"),
        runtime: createRuntimeDefinition(
          intent,
          "kick",
          "👢 {target.mention} a été expulsé. Raison: {reason}",
        ),
      },
      intent,
    );
  }
  const replyText = intent.match(/r[eé]pond\s+(.+)/i)?.[1]?.trim();
  return ensureCommandRuntime(
    {
      ...base,
      name: commandNameFromIntent(intent, "ping"),
      description: replyText
        ? `Reply ${replyText.slice(0, 80)}`
        : "Reply with a simple message",
      runtime: createRuntimeDefinition(intent, "simple", replyText || "Pong"),
    },
    intent,
  );
}

// Patch du runtime commande.
export function patchCommandRuntime(
  draft: ApplicationCommandDraft,
  patch: Record<string, unknown>,
): ApplicationCommandDraft {
  const completeDraft = ensureCommandRuntime(draft);
  const runtime = completeDraft.runtime!;
  const previousMetadata = commandRuntimeMetadata(completeDraft);
  const metadata = { ...previousMetadata, ...patch };
  const responseMode =
    metadata.responseMode === "embed" ||
    metadata.responseMode === "modal" ||
    metadata.responseMode === "welcome" ||
    metadata.responseMode === "goodbye" ||
    metadata.responseMode === "logs" ||
    metadata.responseMode === "autorole" ||
    metadata.responseMode === "ban" ||
    metadata.responseMode === "unban" ||
    metadata.responseMode === "kick"
      ? metadata.responseMode
      : "message";
  return {
    ...completeDraft,
    runtime: {
      ...runtime,
      workflow: [
        {
          ...(runtime.workflow[0] ?? { id: "reply", label: "Répondre" }),
          type: commandRuntimeActionType(responseMode),
          label:
            responseMode === "embed"
              ? "Envoyer un embed"
              : responseMode === "modal"
                ? "Afficher un modal"
                : responseMode === "welcome"
                  ? "Définir le salon welcome"
                  : responseMode === "goodbye"
                    ? "Définir le salon goodbye"
                    : responseMode === "logs"
                      ? "Définir le salon logs"
                      : responseMode === "autorole"
                        ? "Gérer les rôles automatiques"
                        : responseMode === "ban"
                          ? "Bannir un membre"
                          : responseMode === "unban"
                            ? "Débannir un utilisateur"
                            : responseMode === "kick"
                              ? "Expulser un membre"
                              : "Répondre",
          content: runtime.response.content,
          metadata,
        },
        ...runtime.workflow.slice(1),
      ],
    },
  };
}


export function modalResponsesFromMetadata(
  draft: ApplicationCommandDraft,
  metadata: Record<string, unknown>,
): CommandModalResponseDraft[] {
  const rawResponses = Array.isArray(metadata.modalResponses)
    ? metadata.modalResponses
    : [];
  return rawResponses.slice(0, MAX_MODAL_RESPONSE_CARDS).map((item, index) => {
    const record =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
    const kind: CommandModalResponseKind =
      record.kind === "embed" ? "embed" : "message";
    const content = typeof record.content === "string" ? record.content : "";
    const responseMetadata = {
      embedPages: Array.isArray(record.embedPages) ? record.embedPages : [],
    };
    return {
      id: typeof record.id === "string" ? record.id : `modal-response-${index}`,
      kind,
      label:
        typeof record.label === "string" && record.label.trim()
          ? record.label
          : kind === "embed"
            ? `Embed ${index + 1}`
            : `Message ${index + 1}`,
      searchTerms:
        typeof record.searchTerms === "string" ? record.searchTerms : "",
      content,
      embedPages:
        kind === "embed"
          ? embedPagesFromMetadata(draft, responseMetadata, content)
          : [],
    };
  });
}

// Crée une réponse modale.
export function createModalResponseDraft(
  draft: ApplicationCommandDraft,
  kind: CommandModalResponseKind,
): CommandModalResponseDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    label: kind === "embed" ? "Embed résultat" : "Message résultat",
    searchTerms: "",
    content: kind === "embed" ? "" : "Réponse liée à {query}",
    embedPages:
      kind === "embed"
        ? [createEmbedPageDraft(draft, "Résultat lié à {query}")]
        : [],
  };
}

// Sérialise la réponse modale.
export function serializeModalResponseDraft(
  response: CommandModalResponseDraft,
) {
  return {
    id: response.id,
    kind: response.kind,
    label: response.label,
    searchTerms: response.searchTerms,
    content: response.content,
    embedPages:
      response.kind === "embed" ? response.embedPages.slice(0, 10) : [],
  };
}

