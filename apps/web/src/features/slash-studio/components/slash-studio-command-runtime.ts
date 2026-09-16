// Helpers purs pour le runtime du Slash Studio.

import {
  type ApplicationCommandDraft,
  type ApplicationCommandRuntimeDefinition,
} from "@botdeck/shared";

import { type LogEventKey } from "./slash-studio-template-variables";
import { permissionPresets } from "./slash-studio-command-drafts";

export type CommandDraftSummary = {
  intent: string;
  response: string;
  workflow: string[];
  permissions: string[];
};

// Résume le brouillon commande.
export function getCommandDraftSummary(
  draft: ApplicationCommandDraft,
): CommandDraftSummary {
  const name = draft.name || "command";
  const lower = `${draft.name} ${draft.description}`.toLowerCase();
  if (
    lower.includes("unban") ||
    lower.includes("deban") ||
    lower.includes("débann")
  )
    return {
      intent: "Débannissement",
      response:
        "Débannit un utilisateur puis envoie une réponse personnalisée et un log de modération.",
      workflow: [
        "Vérifier Ban Members",
        "Lire l'identifiant utilisateur et la raison",
        "Retirer le bannissement",
        "Envoyer la réponse",
        "Envoyer le log",
      ],
      permissions: ["Ban Members", "Send Messages"],
    };
  if (lower.includes("kick") || lower.includes("expuls"))
    return {
      intent: "Expulsion",
      response:
        "Expulse un membre puis envoie une réponse personnalisée et un log de modération.",
      workflow: [
        "Vérifier Kick Members",
        "Vérifier la hiérarchie des rôles",
        "Lire la cible et la raison",
        "Expulser le membre",
        "Envoyer la réponse",
        "Envoyer le log",
      ],
      permissions: ["Kick Members", "Send Messages"],
    };
  if (lower.includes("ban") || lower.includes("bann"))
    return {
      intent: "Bannissement",
      response:
        "Bannit un membre puis envoie une réponse personnalisée et un log de modération.",
      workflow: [
        "Vérifier Ban Members",
        "Vérifier la hiérarchie des rôles",
        "Lire la cible et la raison",
        "Bannir le membre",
        "Envoyer la réponse",
        "Envoyer le log",
      ],
      permissions: ["Ban Members", "Send Messages"],
    };
  if (
    lower.includes("autorole") ||
    lower.includes("auto role") ||
    lower.includes("role automation") ||
    lower.includes("rôle automatique") ||
    lower.includes("role automatique")
  )
    return {
      intent: "Role automation",
      response:
        "Commande éphémère pour lister, ajouter, supprimer ou synchroniser des rôles automatiques.",
      workflow: [
        "Recevoir /autorole",
        "Lire action:list/add/remove/sync",
        "Sauvegarder la règle",
        "Évaluer les membres selon messages, vocal ou ancienneté",
      ],
      permissions: [
        "Manage Roles",
        "Guild Members intent",
        "Guild Voice States intent",
        "Message Content intent",
      ],
    };
  if (
    lower.includes("setlogs") ||
    lower.includes("logs") ||
    lower.includes("journal")
  )
    return {
      intent: "Configuration logs",
      response: "Confirmation éphémère puis logs serveur automatiques.",
      workflow: [
        "Recevoir /setlogs",
        "Sauvegarder le salon du serveur",
        "Confirmer en éphémère",
        "Envoyer les événements configurés",
      ],
      permissions: ["Send Messages", "View Audit Log"],
    };
  if (
    lower.includes("goodbye") ||
    lower.includes("au revoir") ||
    lower.includes("départ") ||
    lower.includes("depart")
  )
    return {
      intent: "Configuration goodbye",
      response: "Confirmation éphémère puis message de départ automatique.",
      workflow: [
        "Recevoir /setgoodbye",
        "Sauvegarder le salon du serveur",
        "Confirmer en éphémère",
        "Envoyer le goodbye au prochain guildMemberRemove",
      ],
      permissions: ["Send Messages", "Guild Members intent"],
    };
  if (lower.includes("welcome") || lower.includes("bienvenue"))
    return {
      intent: "Configuration welcome",
      response: "Confirmation éphémère puis message de bienvenue automatique.",
      workflow: [
        "Recevoir /setwelcome",
        "Sauvegarder le salon du serveur",
        "Confirmer en éphémère",
        "Envoyer le welcome au prochain guildMemberAdd",
      ],
      permissions: ["Send Messages", "Guild Members intent"],
    };
  if (lower.includes("ticket"))
    return {
      intent: "Ticket support",
      response: "Message de confirmation avec bouton ou formulaire de support.",
      workflow: [
        "Répondre à l'interaction",
        "Collecter le sujet",
        "Créer un salon privé",
        "Notifier l'équipe",
      ],
      permissions: ["Manage Channels", "Send Messages"],
    };
  if (lower.includes("role"))
    return {
      intent: "Menu de rôles",
      response: "Menu compact permettant de choisir ou retirer des rôles.",
      workflow: [
        "Afficher le menu",
        "Lire la sélection",
        "Ajouter ou retirer le rôle",
        "Confirmer en éphémère",
      ],
      permissions: ["Manage Roles"],
    };
  if (lower.includes("embed"))
    return {
      intent: "Réponse embed",
      response: "Embed Discord avec titre, description et statut.",
      workflow: ["Construire l'embed", "Répondre à l'interaction"],
      permissions: ["Embed Links", "Send Messages"],
    };
  if (draft.defaultMemberPermissions)
    return {
      intent: "Action de modération",
      response: "Confirmation claire et log de modération.",
      workflow: [
        "Vérifier les permissions",
        "Lire la cible et la raison",
        "Exécuter l'action",
        "Envoyer un log",
      ],
      permissions: ["Moderation permission", "Send Messages"],
    };
  return {
    intent: "Réponse simple",
    response: `/${name} répond immédiatement avec un message clair.`,
    workflow: ["Recevoir l'interaction", "Valider les options", "Répondre"],
    permissions: ["Use Application Commands"],
  };
}

export type CommandExecutionMode = ApplicationCommandDraft["type"] | "prefix";
export type CommandResponseMode =
  | "message"
  | "embed"
  | "modal"
  | "welcome"
  | "goodbye"
  | "logs"
  | "autorole"
  | "ban"
  | "unban"
  | "kick";
export type CommandAvailability = "guild" | "dm" | "both";
export type CommandEmbedFieldDraft = {
  id: string;
  name: string;
  value: string;
  inline: boolean;
};
export const DISCORD_EMBED_LIMITS = {
  title: 256,
  description: 4096,
  author: 256,
  footer: 2048,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  pageText: 6000,
  url: 2048,
  pages: 10,
} as const;

export type CommandEmbedPageDraft = {
  id: string;
  title: string;
  description: string;
  color: string;
  author: string;
  authorIconUrl: string;
  footer: string;
  footerIconUrl: string;
  imageUrl: string;
  thumbnailUrl: string;
  fields: CommandEmbedFieldDraft[];
};

export type CommandModalResponseKind = "message" | "embed";
export type CommandModalResponseDraft = {
  id: string;
  kind: CommandModalResponseKind;
  label: string;
  searchTerms: string;
  content: string;
  embedPages: CommandEmbedPageDraft[];
};

export const MAX_MODAL_RESPONSE_CARDS = 5;

export const commandCreationSteps = [
  "Execution",
  "Identité",
  "Comportement",
  "Contenu",
  "Accès",
];

export function embedPageTextLength(page: CommandEmbedPageDraft): number {
  return (
    page.title.length +
    page.description.length +
    page.author.length +
    page.footer.length +
    page.fields.reduce(
      (total, field) => total + field.name.length + field.value.length,
      0,
    )
  );
}

export function embedLimitTone(value: number, max: number): string {
  if (value > max) return " isOver";
  if (value >= Math.floor(max * 0.9)) return " isNear";
  return "";
}

// Libellé du préréglage permissions.
export function commandPermissionPresetLabel(
  value: string | null | undefined,
): string {
  return (
    permissionPresets.find((preset) => preset.value === (value ?? null))
      ?.label ?? (value ? `Permission ${value}` : "Everyone")
  );
}

// Liste les permissions requises.
export function commandRequiredPermissions(draft: ApplicationCommandDraft): {
  bot: string[];
  users: string[];
} {
  const summary = getCommandDraftSummary(draft);
  const executionMode = commandExecutionModeFromDraft(draft);
  const summaryPermissions = Array.isArray(summary.permissions)
    ? summary.permissions.filter(
        (permission): permission is string =>
          typeof permission === "string" && permission.trim().length > 0,
      )
    : [];
  const bot = Array.from(
    new Set([
      executionMode === "prefix" ? "Send Messages" : "Use Application Commands",
      ...summaryPermissions,
    ]),
  );
  const users = [commandPermissionPresetLabel(draft.defaultMemberPermissions)];
  return { bot, users };
}

// Métadonnées runtime commande.
export function commandRuntimeMetadata(
  draft: ApplicationCommandDraft,
): Record<string, unknown> {
  const metadata = draft.runtime?.workflow?.[0]?.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
}

// Mode d’exécution du brouillon.
export function commandExecutionModeFromDraft(
  draft: ApplicationCommandDraft,
): CommandExecutionMode {
  const metadata = commandRuntimeMetadata(draft);
  return metadata.executionMode === "prefix" ? "prefix" : draft.type;
}

// Nom affiché du brouillon.
export function draftCommandDisplayName(
  draft: ApplicationCommandDraft,
): string {
  const metadata = commandRuntimeMetadata(draft);
  if (metadata.executionMode === "prefix") {
    const prefix =
      typeof metadata.prefix === "string" && metadata.prefix.length > 0
        ? metadata.prefix
        : "&";
    return `${prefix}${draft.name || "command"}`;
  }
  return `${draft.type === "chat_input" ? "/" : ""}${draft.name || "command"}`;
}

// Type de réponse du brouillon.
export function commandResponseModeFromDraft(
  draft: ApplicationCommandDraft,
): CommandResponseMode {
  const metadata = commandRuntimeMetadata(draft);
  return metadata.responseMode === "embed" ||
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
}

// Disponibilité du brouillon.
export function commandAvailabilityFromDraft(
  draft: ApplicationCommandDraft,
): CommandAvailability {
  const contexts = draft.contexts ?? [];
  const hasGuild = contexts.length === 0 || contexts.includes("guild");
  const hasDm =
    contexts.includes("bot_dm") ||
    contexts.includes("private_channel") ||
    draft.dmPermission === true;
  if (hasGuild && hasDm) return "both";
  if (hasDm) return "dm";
  return "guild";
}

// Patch de disponibilité.
export function commandAvailabilityPatch(
  availability: CommandAvailability,
): Pick<ApplicationCommandDraft, "contexts" | "dmPermission"> &
  Partial<Pick<ApplicationCommandDraft, "scope" | "guildId">> {
  if (availability === "dm")
    return {
      contexts: ["bot_dm", "private_channel"],
      dmPermission: true,
      scope: "global",
      guildId: null,
    };
  if (availability === "both")
    return {
      contexts: ["guild", "bot_dm", "private_channel"],
      dmPermission: true,
      scope: "global",
      guildId: null,
    };
  return { contexts: ["guild"], dmPermission: null };
}

// Type d’action runtime.
export function commandRuntimeActionType(
  mode: CommandResponseMode,
): ApplicationCommandRuntimeDefinition["workflow"][number]["type"] {
  if (mode === "embed") return "send_embed";
  if (mode === "modal") return "show_modal";
  if (mode === "welcome") return "set_welcome_channel";
  if (mode === "goodbye") return "set_goodbye_channel";
  if (mode === "logs") return "set_logs_channel";
  if (mode === "autorole") return "role_automation";
  if (mode === "ban" || mode === "unban" || mode === "kick")
    return "moderation";
  return "reply";
}

export function createEmbedFieldDraft(): CommandEmbedFieldDraft {
  return {
    id: crypto.randomUUID(),
    name: "Champ",
    value: "Valeur",
    inline: false,
  };
}

// Crée une page embed.
export function createEmbedPageDraft(
  draft: ApplicationCommandDraft,
  description = "",
): CommandEmbedPageDraft {
  return {
    id: crypto.randomUUID(),
    title: `${draft.name || "Commande"} result`,
    description,
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

// Normalise la couleur embed.
export function normalizeEmbedColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#35f2c4";
}

// Relit les pages embed.
export function embedPagesFromMetadata(
  draft: ApplicationCommandDraft,
  metadata: Record<string, unknown>,
  fallbackDescription: string,
): CommandEmbedPageDraft[] {
  const rawPages = Array.isArray(metadata.embedPages)
    ? metadata.embedPages
    : [];
  if (rawPages.length) {
    return rawPages.slice(0, 10).map((item, index) => {
      const page =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};
      const fields = Array.isArray(page.fields)
        ? page.fields.slice(0, 25).map((field, fieldIndex) => {
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
        title:
          typeof page.title === "string"
            ? page.title
            : `${draft.name || "Commande"} result`,
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
    });
  }
  return [createEmbedPageDraft(draft, fallbackDescription)];
}

export type WelcomeMessageType = "message" | "embed";

export function welcomeMessageTypeFromMetadata(
  metadata: Record<string, unknown>,
): WelcomeMessageType {
  return metadata.welcomeMessageType === "embed" ? "embed" : "message";
}

export function welcomeEmbedPagesFromMetadata(
  draft: ApplicationCommandDraft,
  metadata: Record<string, unknown>,
  fallbackDescription: string,
): CommandEmbedPageDraft[] {
  const previousEmbedPages = metadata.embedPages;
  return embedPagesFromMetadata(
    draft,
    {
      ...metadata,
      embedPages: Array.isArray(metadata.welcomeEmbedPages)
        ? metadata.welcomeEmbedPages
        : previousEmbedPages,
    },
    fallbackDescription,
  );
}

export function goodbyeMessageTypeFromMetadata(
  metadata: Record<string, unknown>,
): WelcomeMessageType {
  return metadata.goodbyeMessageType === "embed" ? "embed" : "message";
}

export function goodbyeEmbedPagesFromMetadata(
  draft: ApplicationCommandDraft,
  metadata: Record<string, unknown>,
  fallbackDescription: string,
): CommandEmbedPageDraft[] {
  const previousEmbedPages = metadata.embedPages;
  return embedPagesFromMetadata(
    draft,
    {
      ...metadata,
      embedPages: Array.isArray(metadata.goodbyeEmbedPages)
        ? metadata.goodbyeEmbedPages
        : previousEmbedPages,
    },
    fallbackDescription,
  );
}

export function moderationResponseTypeFromMetadata(
  metadata: Record<string, unknown>,
): WelcomeMessageType {
  return metadata.moderationResponseType === "embed" ? "embed" : "message";
}

export function moderationEmbedPagesFromMetadata(
  draft: ApplicationCommandDraft,
  metadata: Record<string, unknown>,
  fallbackDescription: string,
): CommandEmbedPageDraft[] {
  const previousEmbedPages = metadata.embedPages;
  return embedPagesFromMetadata(
    draft,
    {
      ...metadata,
      embedPages: Array.isArray(metadata.moderationEmbedPages)
        ? metadata.moderationEmbedPages
        : previousEmbedPages,
    },
    fallbackDescription,
  );
}

export type LogMessageType = "message" | "embed";
export type LogEventConfigDraft = {
  enabled: boolean;
  mode: LogMessageType;
  messageTemplate: string;
  embedPages: CommandEmbedPageDraft[];
};

export const LOG_EVENT_KEYS: LogEventKey[] = [
  "message_edit",
  "message_delete",
  "channel_create",
  "channel_update",
  "channel_delete",
  "channel_recreate_purge",
  "member_ban",
  "member_unban",
  "member_kick",
];
export const LOG_EVENT_LABELS: Record<LogEventKey, string> = {
  message_edit: "Modification message",
  message_delete: "Suppression message",
  channel_create: "Création salon",
  channel_update: "Modification salon",
  channel_delete: "Suppression salon",
  channel_recreate_purge: "Réinitialisation salon",
  member_ban: "Membre banni",
  member_unban: "Membre débanni",
  member_kick: "Membre expulsé",
};
export const DEFAULT_LOG_EVENT_MESSAGES: Record<LogEventKey, string> = {
  message_edit:
    "✉️ {event.name} par {actor.mention} dans {channel.mention}\nAvant: {message.before}\nAprès: {message.after}\nLien: {message.url}",
  message_delete:
    "🗑️ {event.name} par {actor.mention} dans {channel.mention}\nAuteur: {target.mention}\nMessage: {message.before}",
  channel_create:
    "🔨 {event.name} par {actor.mention}: {channel.mention} `{channel.name}`",
  channel_update:
    "🛠️ {event.name} par {actor.mention}: {channel.mention} `{channel.name}`\nAvant: {channel.before}\nAprès: {channel.after}",
  channel_delete:
    "🗑️ {event.name} par {actor.mention}: `{channel.name}` `{channel.id}`",
  channel_recreate_purge:
    "🧹 {event.name} par {actor.mention}\nAncien: `{oldChannel.name}`\nNouveau: {newChannel.mention}\nRaison: {purge.reason}",
  member_ban:
    "🔨 {target.mention} a été banni par {actor.mention}.\nRaison: {reason}",
  member_unban:
    "✅ {target.mention} a été débanni par {actor.mention}.\nRaison: {reason}",
  member_kick:
    "👢 {target.mention} a été expulsé par {actor.mention}.\nRaison: {reason}",
};
export function logEventConfigsFromMetadata(
  draft: ApplicationCommandDraft,
  metadata: Record<string, unknown>,
): Record<LogEventKey, LogEventConfigDraft> {
  const rawConfigs =
    metadata.logsEventConfigs &&
    typeof metadata.logsEventConfigs === "object" &&
    !Array.isArray(metadata.logsEventConfigs)
      ? (metadata.logsEventConfigs as Record<string, unknown>)
      : {};
  const defaultMode: LogMessageType =
    metadata.logsDefaultMode === "embed" ? "embed" : "message";
  return Object.fromEntries(
    LOG_EVENT_KEYS.map((key) => {
      const raw =
        rawConfigs[key] &&
        typeof rawConfigs[key] === "object" &&
        !Array.isArray(rawConfigs[key])
          ? (rawConfigs[key] as Record<string, unknown>)
          : {};
      const messageTemplate =
        typeof raw.messageTemplate === "string"
          ? raw.messageTemplate
          : DEFAULT_LOG_EVENT_MESSAGES[key];
      const mode: LogMessageType =
        raw.mode === "embed"
          ? "embed"
          : raw.mode === "message"
            ? "message"
            : defaultMode;
      const embedPages = embedPagesFromMetadata(
        draft,
        { embedPages: Array.isArray(raw.embedPages) ? raw.embedPages : [] },
        messageTemplate,
      );
      return [
        key,
        {
          enabled: raw.enabled !== false,
          mode,
          messageTemplate,
          embedPages,
        },
      ];
    }),
  ) as Record<LogEventKey, LogEventConfigDraft>;
}

export function serializeLogEventConfigs(
  configs: Record<LogEventKey, LogEventConfigDraft>,
) {
  return Object.fromEntries(
    LOG_EVENT_KEYS.map((key) => {
      const config = configs[key];
      return [
        key,
        {
          enabled: config.enabled,
          mode: config.mode,
          messageTemplate: config.messageTemplate,
          embedPages:
            config.mode === "embed" ? config.embedPages.slice(0, 10) : [],
        },
      ];
    }),
  );
}

