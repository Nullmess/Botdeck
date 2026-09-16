import type { Guild } from "discord.js";
import type { RuntimeEmbedPage } from "@/server/control-plane-helpers";

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

export type StoredLogConfig = {
  guildId: string;
  channelId: string;
  eventConfigsJson: string | null;
  enabled: boolean;
};

export type LogEventConfig = {
  enabled: boolean;
  mode: "message" | "embed";
  messageTemplate: string;
  embedPages?: RuntimeEmbedPage[];
};

export type LogEventPayload = {
  key: LogEventKey;
  guild: Guild;
  values: Record<string, string>;
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
  message_edit: "Modification du message",
  message_delete: "Suppression du message",
  channel_create: "Création du salon",
  channel_update: "Modification du salon",
  channel_delete: "Suppression du salon",
  channel_recreate_purge: "Réinitialisation du salon",
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
