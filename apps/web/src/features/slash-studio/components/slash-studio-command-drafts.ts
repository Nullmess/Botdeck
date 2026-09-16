// Modèle de brouillon des commandes Slash Studio

import {
	type ApplicationCommandDraft,
	type ApplicationCommandDraftOption,
	type ApplicationCommandRuntimeDefinition,
	type ApplicationCommandScope,
	type ApplicationCommandSummary
} from "@botdeck/shared";

export const commandDraftTypes: Array<{
  value: ApplicationCommandDraft["type"];
  label: string;
}> = [
  { value: "chat_input", label: "Slash / Chat Input" },
  { value: "user", label: "User command" },
  { value: "message", label: "Message command" },
];

export const commandOptionTypes: Array<{
  value: ApplicationCommandDraftOption["type"];
  label: string;
}> = [
  { value: "sub_command", label: "Sub-command" },
  { value: "sub_command_group", label: "Sub-command group" },
  { value: "string", label: "String" },
  { value: "integer", label: "Integer" },
  { value: "boolean", label: "Boolean" },
  { value: "user", label: "User" },
  { value: "channel", label: "Channel" },
  { value: "role", label: "Role" },
  { value: "mentionable", label: "Mentionable" },
  { value: "number", label: "Number" },
  { value: "attachment", label: "Attachment" },
];

export const permissionPresets = [
  { label: "Everyone", value: null },
  { label: "Admin only", value: "8" },
  { label: "Manage Guild", value: "32" },
  { label: "Manage Messages", value: "8192" },
  { label: "Manage Roles", value: "268435456" },
  { label: "Kick Members", value: "2" },
  { label: "Ban Members", value: "4" },
  { label: "Moderate Members", value: "1099511627776" },
] as const;

// Crée une option brouillon.
export function createDraftOption(
  type: ApplicationCommandDraftOption["type"] = "string",
): ApplicationCommandDraftOption {
  return {
    id: crypto.randomUUID(),
    type,
    name: "option",
    description: "Option description",
    required: false,
    choices: [],
    autocomplete: false,
    minValue: null,
    maxValue: null,
    minLength: null,
    maxLength: null,
    channelTypes: [],
    nameLocalizations: null,
    descriptionLocalizations: null,
    options: [],
  };
}

// Brouillon complet par défaut.
export function createEmptyCommandDraft(
  scope: ApplicationCommandScope,
  guildId: string | null,
): ApplicationCommandDraft {
  return {
    scope,
    guildId: scope === "guild" ? guildId : null,
    type: "chat_input",
    name: "new-command",
    description: "Describe what this command does",
    options: [],
    defaultMemberPermissions: null,
    dmPermission: null,
    nsfw: false,
    contexts: ["guild"],
    integrationTypes: ["guild_install"],
    nameLocalizations: null,
    descriptionLocalizations: null,
    raw: null,
  };
}

// Convertit le type option brut.
export function optionTypeFromRaw(
  value: unknown,
): ApplicationCommandDraftOption["type"] {
  if (typeof value === "string") {
    const normalized = value
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/-/g, "_");
    if (commandOptionTypes.some((item) => item.value === normalized))
      return normalized as ApplicationCommandDraftOption["type"];
  }
  const map: Record<number, ApplicationCommandDraftOption["type"]> = {
    1: "sub_command",
    2: "sub_command_group",
    3: "string",
    4: "integer",
    5: "boolean",
    6: "user",
    7: "channel",
    8: "role",
    9: "mentionable",
    10: "number",
    11: "attachment",
  };
  return typeof value === "number" ? (map[value] ?? "string") : "string";
}

// Déduit le type depuis le résumé.
export function commandDraftTypeFromSummary(
  command: ApplicationCommandSummary,
): ApplicationCommandDraft["type"] {
  if (command.type === "User") return "user";
  if (command.type === "Message") return "message";
  return "chat_input";
}

// Filtre un objet inconnu.
export function recordFromUnknown(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// Filtre les objets simples.
export function isRecord(value: unknown): value is Record<string, unknown> {
  return recordFromUnknown(value) !== null;
}

// Relit une traduction inconnue.
export function localizationFromUnknown(
  value: unknown,
): Record<string, string> | null {
  const record = recordFromUnknown(value);
  if (!record) return null;
  const entries = Object.entries(record).filter(
    ([, item]) => typeof item === "string" && item.trim().length > 0,
  ) as Array<[string, string]>;
  return entries.length ? Object.fromEntries(entries) : null;
}

// Convertit les contextes Discord.
export function rawContextToDraft(
  value: unknown,
): ApplicationCommandDraft["contexts"] {
  if (!Array.isArray(value)) return null;
  const mapped = value
    .map((item) => {
      if (item === 0 || item === "GUILD" || item === "guild") return "guild";
      if (item === 1 || item === "BOT_DM" || item === "bot_dm") return "bot_dm";
      if (
        item === 2 ||
        item === "PRIVATE_CHANNEL" ||
        item === "private_channel"
      )
        return "private_channel";
      return null;
    })
    .filter(
      (
        item,
      ): item is NonNullable<ApplicationCommandDraft["contexts"]>[number] =>
        Boolean(item),
    );
  return mapped.length ? mapped : null;
}

// Convertit les intégrations Discord.
export function rawIntegrationTypesToDraft(
  value: unknown,
): ApplicationCommandDraft["integrationTypes"] {
  if (!Array.isArray(value)) return null;
  const mapped = value
    .map((item) => {
      if (item === 0 || item === "GUILD_INSTALL" || item === "guild_install")
        return "guild_install";
      if (item === 1 || item === "USER_INSTALL" || item === "user_install")
        return "user_install";
      return null;
    })
    .filter(
      (
        item,
      ): item is NonNullable<
        ApplicationCommandDraft["integrationTypes"]
      >[number] => Boolean(item),
    );
  return mapped.length ? mapped : null;
}

// Convertit une option Discord.
export function rawOptionToDraft(
  option: Record<string, unknown>,
): ApplicationCommandDraftOption {
  const type = optionTypeFromRaw(option.type);
  const choices = Array.isArray(option.choices)
    ? option.choices
        .map(recordFromUnknown)
        .filter((choice): choice is Record<string, unknown> => Boolean(choice))
        .map((choice) => ({
          name: typeof choice.name === "string" ? choice.name : "choice",
          value:
            typeof choice.value === "number" || typeof choice.value === "string"
              ? choice.value
              : String(choice.value ?? ""),
          nameLocalizations: localizationFromUnknown(choice.name_localizations),
        }))
    : [];
  return {
    id: crypto.randomUUID(),
    type,
    name: typeof option.name === "string" ? option.name : "option",
    description:
      typeof option.description === "string"
        ? option.description
        : "Option description",
    required: typeof option.required === "boolean" ? option.required : false,
    choices,
    autocomplete:
      typeof option.autocomplete === "boolean" ? option.autocomplete : false,
    minValue: typeof option.min_value === "number" ? option.min_value : null,
    maxValue: typeof option.max_value === "number" ? option.max_value : null,
    minLength: typeof option.min_length === "number" ? option.min_length : null,
    maxLength: typeof option.max_length === "number" ? option.max_length : null,
    channelTypes: Array.isArray(option.channel_types)
      ? option.channel_types.filter(
          (item): item is number => typeof item === "number",
        )
      : [],
    nameLocalizations: localizationFromUnknown(option.name_localizations),
    descriptionLocalizations: localizationFromUnknown(
      option.description_localizations,
    ),
    options: Array.isArray(option.options)
      ? option.options
          .map(recordFromUnknown)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map(rawOptionToDraft)
      : [],
  };
}

// Convertit un résumé en brouillon.
export function commandSummaryToDraft(
  command: ApplicationCommandSummary,
  fallbackGuildId: string | null,
): ApplicationCommandDraft {
  const raw = command.raw;
  return {
    id: command.id,
    scope: command.scope,
    guildId:
      command.scope === "guild" ? (command.guildId ?? fallbackGuildId) : null,
    type: commandDraftTypeFromSummary(command),
    name: command.name,
    description: command.description ?? "",
    nameLocalizations:
      command.nameLocalizations ??
      localizationFromUnknown(raw.name_localizations),
    descriptionLocalizations:
      command.descriptionLocalizations ??
      localizationFromUnknown(raw.description_localizations),
    options: Array.isArray(raw.options)
      ? raw.options
          .map(recordFromUnknown)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map(rawOptionToDraft)
      : [],
    defaultMemberPermissions: command.defaultMemberPermissions ?? null,
    dmPermission: command.dmPermission ?? null,
    nsfw: command.nsfw ?? false,
    contexts: command.contexts ?? rawContextToDraft(raw.contexts),
    integrationTypes:
      command.integrationTypes ??
      rawIntegrationTypesToDraft(raw.integration_types),
    runtime:
      command.runtime ??
      (isRecord(raw.botdeckRuntime)
        ? (raw.botdeckRuntime as unknown as ApplicationCommandRuntimeDefinition)
        : null),
    raw,
  };
}

// Importe un JSON commande.
export function importedJsonToDraft(
  value: unknown,
  scope: ApplicationCommandScope,
  guildId: string | null,
): ApplicationCommandDraft {
  const raw = recordFromUnknown(value) ?? {};
  const type = (() => {
    if (raw.type === 2 || raw.type === "USER") return "user";
    if (raw.type === 3 || raw.type === "MESSAGE") return "message";
    return "chat_input";
  })();
  return {
    scope,
    guildId: scope === "guild" ? guildId : null,
    type,
    name: typeof raw.name === "string" ? raw.name : "imported-command",
    description:
      typeof raw.description === "string"
        ? raw.description
        : "Imported command",
    nameLocalizations: localizationFromUnknown(raw.name_localizations),
    descriptionLocalizations: localizationFromUnknown(
      raw.description_localizations,
    ),
    options: Array.isArray(raw.options)
      ? raw.options
          .map(recordFromUnknown)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map(rawOptionToDraft)
      : [],
    defaultMemberPermissions:
      typeof raw.default_member_permissions === "string"
        ? raw.default_member_permissions
        : null,
    dmPermission:
      typeof raw.dm_permission === "boolean" ? raw.dm_permission : null,
    nsfw: typeof raw.nsfw === "boolean" ? raw.nsfw : false,
    contexts: rawContextToDraft(raw.contexts),
    integrationTypes: rawIntegrationTypesToDraft(raw.integration_types),
    runtime: isRecord(raw.botdeckRuntime)
      ? (raw.botdeckRuntime as unknown as ApplicationCommandRuntimeDefinition)
      : null,
    raw,
  };
}

// Valide un id Discord.
