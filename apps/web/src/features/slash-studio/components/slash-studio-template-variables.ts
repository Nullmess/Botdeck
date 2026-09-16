// Variables et prévisualisations des templates Slash Studio.

export type LogEventKey =
  | "message_edit"
  | "message_delete"
  | "channel_create"
  | "channel_update"
  | "channel_delete"
  | "channel_recreate_purge"
  | "member_ban"
  | "member_unban"
  | "member_kick";
export const COMMON_LOG_VARIABLES = [
  "event.key",
  "event.name",
  "event.date",
  "guild.id",
  "guild.name",
  "guild.icon",
  "guild.iconUrl",
  "bot.id",
  "bot.name",
  "bot.username",
  "bot.mention",
  "bot.avatar",
  "bot.avatarUrl",
  "actor.id",
  "actor.name",
  "actor.username",
  "actor.displayName",
  "actor.mention",
  "actor.avatar",
  "actor.avatarUrl",
  "channel.id",
  "channel.name",
  "channel.mention",
  "channel.type",
];
export const LOG_EVENT_VARIABLES: Record<LogEventKey, string[]> = {
  message_edit: [
    ...COMMON_LOG_VARIABLES,
    "target.id",
    "target.name",
    "target.username",
    "target.displayName",
    "target.mention",
    "target.avatar",
    "target.avatarUrl",
    "message.id",
    "message.before",
    "message.after",
    "message.url",
  ],
  message_delete: [
    ...COMMON_LOG_VARIABLES,
    "target.id",
    "target.name",
    "target.username",
    "target.displayName",
    "target.mention",
    "target.avatar",
    "target.avatarUrl",
    "message.id",
    "message.before",
    "message.after",
    "message.url",
  ],
  channel_create: COMMON_LOG_VARIABLES,
  channel_update: [...COMMON_LOG_VARIABLES, "channel.before", "channel.after"],
  channel_delete: COMMON_LOG_VARIABLES,
  channel_recreate_purge: [...COMMON_LOG_VARIABLES, "oldChannel.id", "oldChannel.name", "oldChannel.type", "oldChannel.parentId", "oldChannel.position", "newChannel.id", "newChannel.name", "newChannel.mention", "newChannel.type", "newChannel.parentId", "newChannel.position", "purge.reason", "purge.status", "purge.startedAt", "purge.finishedAt", "purge.duration"],
  member_ban: [
    ...COMMON_LOG_VARIABLES,
    "target.id",
    "target.name",
    "target.username",
    "target.displayName",
    "target.mention",
    "target.avatar",
    "target.avatarUrl",
    "reason",
    "action",
    "action.name",
  ],
  member_unban: [
    ...COMMON_LOG_VARIABLES,
    "target.id",
    "target.name",
    "target.username",
    "target.displayName",
    "target.mention",
    "target.avatar",
    "target.avatarUrl",
    "reason",
    "action",
    "action.name",
  ],
  member_kick: [
    ...COMMON_LOG_VARIABLES,
    "target.id",
    "target.name",
    "target.username",
    "target.displayName",
    "target.mention",
    "target.avatar",
    "target.avatarUrl",
    "reason",
    "action",
    "action.name",
  ],
};

const welcomePreviewAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="34" fill="#35f2c4"/><circle cx="64" cy="48" r="24" fill="#f2f3f5"/><path d="M24 116c5-27 25-43 40-43s35 16 40 43" fill="#f2f3f5" opacity=".95"/></svg>`;
const welcomePreviewGuildIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" fill="#2b2d43"/><circle cx="64" cy="64" r="42" fill="#7c5cff"/><path d="M39 76c8 10 17 15 25 15s17-5 25-15" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="48" cy="54" r="7" fill="#fff"/><circle cx="80" cy="54" r="7" fill="#fff"/></svg>`;
const welcomePreviewBotAvatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="34" fill="#111827"/><rect x="28" y="38" width="72" height="56" rx="18" fill="#22c55e"/><circle cx="50" cy="66" r="7" fill="#052e16"/><circle cx="78" cy="66" r="7" fill="#052e16"/><path d="M56 82h16" stroke="#052e16" stroke-width="6" stroke-linecap="round"/><path d="M64 26v12" stroke="#22c55e" stroke-width="8" stroke-linecap="round"/><circle cx="64" cy="22" r="7" fill="#22c55e"/></svg>`;
const welcomePreviewAvatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(welcomePreviewAvatarSvg)}`;
const welcomePreviewGuildIconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(welcomePreviewGuildIconSvg)}`;
const welcomePreviewBotAvatarUrl = `data:image/svg+xml;utf8,${encodeURIComponent(welcomePreviewBotAvatarSvg)}`;
const welcomePreviewAliases: Record<string, string> = {
  "user.id": "555555555555555555",
  "user.mention": "@Macxzew",
  "user.name": "macxzew",
  "user.username": "macxzew",
  "user.displayName": "Macxzew",
  "user.avatar": welcomePreviewAvatarUrl,
  "user.avatarUrl": welcomePreviewAvatarUrl,
  "guild.id": "123456789012345678",
  "guild.name": "Botdeck Community",
  "guild.icon": welcomePreviewGuildIconUrl,
  "guild.iconUrl": welcomePreviewGuildIconUrl,
  "bot.id": "987654321098765432",
  "bot.name": "Botdeck Bot",
  "bot.username": "Botdeck Bot",
  "bot.mention": "@Botdeck Bot",
  "bot.avatar": welcomePreviewBotAvatarUrl,
  "bot.avatarUrl": welcomePreviewBotAvatarUrl,
  "member.count": "128",
  "member.joinedAt": "28 mai 2026 à 11:30",
  "member.joinedDate": "28 mai 2026",
  "member.joinedTime": "11:30",
  "member.joinedRelative": "à l’instant",
  "member.leftAt": "4 juin 2026 à 13:00",
  "member.leftDate": "4 juin 2026",
  "member.leftTime": "13:00",
  "member.leftRelative": "à l’instant",
  "channel.id": "333333333333333333",
  "channel.name": "welcome",
  "channel.mention": "#welcome",
  "channel.type": "text",
};

export const WELCOME_VARIABLES = [
  "user.id",
  "user.mention",
  "user.name",
  "user.username",
  "user.displayName",
  "user.avatar",
  "user.avatarUrl",
  "guild.id",
  "guild.name",
  "guild.icon",
  "guild.iconUrl",
  "bot.id",
  "bot.name",
  "bot.username",
  "bot.mention",
  "bot.avatar",
  "bot.avatarUrl",
  "member.count",
  "member.joinedAt",
  "member.joinedDate",
  "member.joinedTime",
  "member.joinedRelative",
  "channel.id",
  "channel.name",
  "channel.mention",
  "channel.type",
];

export const GOODBYE_VARIABLES = [
  "user.id",
  "user.mention",
  "user.name",
  "user.username",
  "user.displayName",
  "user.avatar",
  "user.avatarUrl",
  "guild.id",
  "guild.name",
  "guild.icon",
  "guild.iconUrl",
  "bot.id",
  "bot.name",
  "bot.username",
  "bot.mention",
  "bot.avatar",
  "bot.avatarUrl",
  "member.count",
  "member.leftAt",
  "member.leftDate",
  "member.leftTime",
  "member.leftRelative",
  "channel.id",
  "channel.name",
  "channel.mention",
  "channel.type",
];

export const MODERATION_VARIABLES = [
  "action",
  "action.key",
  "action.name",
  "action.emoji",
  "reason",
  "event.name",
  "event.date",
  "guild.id",
  "guild.name",
  "guild.icon",
  "guild.iconUrl",
  "bot.id",
  "bot.name",
  "bot.username",
  "bot.mention",
  "bot.avatar",
  "bot.avatarUrl",
  "actor.id",
  "actor.mention",
  "actor.name",
  "actor.username",
  "actor.displayName",
  "actor.avatar",
  "actor.avatarUrl",
  "target.id",
  "target.mention",
  "target.name",
  "target.username",
  "target.displayName",
  "target.avatar",
  "target.avatarUrl",
];
const logPreviewAliases: Record<string, string> = {
  ...welcomePreviewAliases,
  "event.key": "message_edit",
  "event.name": "Modification du message",
  "event.date": "9 juin 2026 à 14:30",
  "actor.id": "1115219081625354341",
  "actor.name": "Shyno",
  "actor.username": "Shyno",
  "actor.displayName": "Shyno",
  "actor.mention": "@Shyno",
  "actor.avatar": welcomePreviewBotAvatarUrl,
  "actor.avatarUrl": welcomePreviewBotAvatarUrl,
  "target.id": "222222222222222222",
  "target.name": "Macxzew",
  "target.username": "macxzew",
  "target.displayName": "Macxzew",
  "target.mention": "@Macxzew",
  "target.avatar": welcomePreviewAvatarUrl,
  "target.avatarUrl": welcomePreviewAvatarUrl,
  "channel.id": "333333333333333333",
  "channel.name": "general",
  "channel.mention": "#general",
  "channel.type": "text",
  "channel.before": "nom: anciens-logs",
  "channel.after": "nom: logs",
  "message.id": "444444444444444444",
  "message.url":
    "https://discord.com/channels/123456789012345678/333333333333333333/444444444444444444",
  "message.before": "Ancien contenu du message",
  "message.after": "Nouveau contenu du message",
  reason: "Spam",
  action: "ban",
  "action.key": "ban",
  "action.name": "Bannissement",
  "action.emoji": "🔨",
};

const LOG_EVENT_PREVIEW_OVERRIDES: Record<
  LogEventKey,
  Record<string, string>
> = {
  message_edit: {
    "event.key": "message_edit",
    "event.name": "Modification du message",
  },
  message_delete: {
    "event.key": "message_delete",
    "event.name": "Suppression du message",
    "message.after": "",
  },
  channel_create: {
    "event.key": "channel_create",
    "event.name": "Création du salon",
    "channel.name": "nouveau-salon",
    "channel.mention": "#nouveau-salon",
  },
  channel_update: {
    "event.key": "channel_update",
    "event.name": "Modification du salon",
  },
  channel_delete: {
    "event.key": "channel_delete",
    "event.name": "Suppression du salon",
    "channel.name": "ancien-salon",
    "channel.mention": "#ancien-salon",
  },
  channel_recreate_purge: {
    "event.key": "channel_recreate_purge",
    "event.name": "Réinitialisation du salon",
    "channel.name": "general",
    "channel.mention": "<#1032373924488552999>",
    "oldChannel.id": "1032373924488552555",
    "oldChannel.name": "general",
    "oldChannel.type": "text",
    "oldChannel.parentId": "1032373924488552500",
    "oldChannel.position": "3",
    "newChannel.id": "1032373924488552999",
    "newChannel.name": "general",
    "newChannel.mention": "<#1032373924488552999>",
    "newChannel.type": "text",
    "newChannel.parentId": "1032373924488552500",
    "newChannel.position": "3",
    "purge.reason": "Nettoyage complet",
    "purge.status": "success",
    "purge.startedAt": "2026-06-19T12:00:00.000Z",
    "purge.finishedAt": "2026-06-19T12:00:04.000Z",
    "purge.duration": "4000ms",
  },
  member_ban: {
    "event.key": "member_ban",
    "event.name": "Membre banni",
    action: "ban",
    "action.key": "ban",
    "action.name": "Bannissement",
    "action.emoji": "🔨",
  },
  member_unban: {
    "event.key": "member_unban",
    "event.name": "Membre débanni",
    action: "unban",
    "action.key": "unban",
    "action.name": "Débannissement",
    "action.emoji": "✅",
  },
  member_kick: {
    "event.key": "member_kick",
    "event.name": "Membre expulsé",
    action: "kick",
    "action.key": "kick",
    "action.name": "Expulsion",
    "action.emoji": "👢",
  },
};

const MODERATION_PREVIEW_OVERRIDES: Record<
  "ban" | "unban" | "kick",
  Record<string, string>
> = {
  ban: {
    action: "ban",
    "action.key": "ban",
    "action.name": "Bannissement",
    "action.emoji": "🔨",
    "event.name": "Membre banni",
  },
  unban: {
    action: "unban",
    "action.key": "unban",
    "action.name": "Débannissement",
    "action.emoji": "✅",
    "event.name": "Membre débanni",
  },
  kick: {
    action: "kick",
    "action.key": "kick",
    "action.name": "Expulsion",
    "action.emoji": "👢",
    "event.name": "Membre expulsé",
  },
};

function replacePreviewAliases(value: string, aliases: Record<string, string>) {
  if (!value) return value;
  return value.replace(
    /\{([a-zA-Z0-9_.]+)\}/g,
    (match, key: string) => aliases[key] ?? match,
  );
}

export function replaceWelcomePreviewAliases(value: string, enabled: boolean) {
  if (!enabled) return value;
  return replacePreviewAliases(value, welcomePreviewAliases);
}

export function replaceLogPreviewAliases(
  value: string,
  eventKey: LogEventKey = "message_edit",
) {
  return replacePreviewAliases(value, {
    ...logPreviewAliases,
    ...(LOG_EVENT_PREVIEW_OVERRIDES[eventKey] ?? {}),
  });
}

export function replaceModerationPreviewAliases(
  value: string,
  action: "ban" | "unban" | "kick",
) {
  return replacePreviewAliases(value, {
    ...logPreviewAliases,
    ...(MODERATION_PREVIEW_OVERRIDES[action] ?? {}),
  });
}

export function previewExampleLabel(value: string) {
  if (!value) return "—";
  if (/^data:image\//i.test(value)) return "URL image d’exemple";
  return value.length > 72 ? `${value.slice(0, 69)}…` : value;
}
