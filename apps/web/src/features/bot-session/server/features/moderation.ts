import type { ApplicationCommandRuntimeDefinition } from "@botdeck/shared";
import type { Guild, User } from "discord.js";
import {
  runtimeEmbedPages,
  runtimeMetadata,
  runtimeResponseMode,
  type RuntimeEmbedPage,
} from "@/server/control-plane-helpers";
import type { LogEventKey } from "./automation-logs";

export type ModerationAction = "ban" | "unban" | "kick";
export type ModerationTarget =
  | User
  | { id: string; username?: string | null; displayName?: string | null };

export function isModerationResponseMode(
  mode: string,
): mode is ModerationAction {
  return mode === "ban" || mode === "unban" || mode === "kick";
}

export function moderationActionFromRuntime(
  runtime: ApplicationCommandRuntimeDefinition,
): ModerationAction {
  const mode = runtimeResponseMode(runtime);
  const metadata = runtimeMetadata(runtime);
  const action =
    typeof metadata.moderationAction === "string"
      ? metadata.moderationAction
      : mode;
  return action === "unban" ? "unban" : action === "kick" ? "kick" : "ban";
}

export function moderationResponseType(
  runtime: ApplicationCommandRuntimeDefinition,
): "message" | "embed" {
  const metadata = runtimeMetadata(runtime);
  return metadata.moderationResponseType === "embed" ? "embed" : "message";
}

export function moderationEmbedPages(
  runtime: ApplicationCommandRuntimeDefinition,
  fallbackContent: string,
): RuntimeEmbedPage[] {
  const metadata = runtimeMetadata(runtime);
  const embedRuntime: ApplicationCommandRuntimeDefinition = {
    ...runtime,
    workflow: [
      {
        ...(runtime.workflow[0] ?? {
          id: "moderation",
          type: "moderation" as const,
          label: "Modération",
        }),
        metadata: {
          embedPages: Array.isArray(metadata.moderationEmbedPages)
            ? metadata.moderationEmbedPages
            : [],
        },
      },
      ...runtime.workflow.slice(1),
    ],
  };
  return runtimeEmbedPages(embedRuntime, fallbackContent);
}

export function moderationLogKey(action: ModerationAction): LogEventKey {
  return action === "ban"
    ? "member_ban"
    : action === "unban"
      ? "member_unban"
      : "member_kick";
}

export function moderationActionName(action: ModerationAction): string {
  return action === "ban" ? "Ban" : action === "unban" ? "Unban" : "Kick";
}

export function moderationActionEmoji(action: ModerationAction): string {
  return action === "ban" ? "🔨" : action === "unban" ? "✅" : "👢";
}

export function moderationEventName(action: ModerationAction): string {
  return action === "ban"
    ? "Membre banni"
    : action === "unban"
      ? "Membre débanni"
      : "Membre expulsé";
}

export function buildUserTemplateValues(
  prefix: string,
  user: User | null | undefined,
): Record<string, string> {
  const name = user?.username ?? "Inconnu";
  return {
    [`${prefix}.id`]: user?.id ?? "",
    [`${prefix}.name`]: name,
    [`${prefix}.username`]: name,
    [`${prefix}.displayName`]: user?.displayName ?? name,
    [`${prefix}.mention`]: user ? `<@${user.id}>` : "Inconnu",
    [`${prefix}.avatar`]: user?.displayAvatarURL({ size: 512 }) ?? "",
    [`${prefix}.avatarUrl`]: user?.displayAvatarURL({ size: 512 }) ?? "",
  };
}

export function buildModerationTemplateValues(args: {
  guild: Guild;
  botUser: User | null | undefined;
  actor: User | null | undefined;
  target: ModerationTarget | null | undefined;
  action: ModerationAction;
  reason?: string | null;
}): Record<string, string> {
  const { guild, botUser, actor, target, action, reason } = args;
  const targetId = target?.id ?? "";
  const targetName =
    target && "username" in target && typeof target.username === "string"
      ? target.username
      : "Utilisateur";
  const targetDisplay =
    target && "displayName" in target && typeof target.displayName === "string"
      ? target.displayName
      : targetName;
  return {
    action: action,
    "action.key": action,
    "action.name": moderationActionName(action),
    "action.emoji": moderationActionEmoji(action),
    reason: reason?.trim() || "Aucune raison fournie",
    "guild.id": guild.id,
    "guild.name": guild.name,
    "guild.icon": guild.iconURL({ size: 512 }) ?? "",
    "guild.iconUrl": guild.iconURL({ size: 512 }) ?? "",
    "bot.id": botUser?.id ?? "",
    "bot.name": botUser?.username ?? "Bot",
    "bot.username": botUser?.username ?? "Bot",
    "bot.mention": botUser ? `<@${botUser.id}>` : "Bot",
    "bot.avatar": botUser?.displayAvatarURL({ size: 512 }) ?? "",
    "bot.avatarUrl": botUser?.displayAvatarURL({ size: 512 }) ?? "",
    ...buildUserTemplateValues("actor", actor ?? null),
    "target.id": targetId,
    "target.name": targetName,
    "target.username": targetName,
    "target.displayName": targetDisplay,
    "target.mention": targetId ? `<@${targetId}>` : targetName,
    "target.avatar":
      target &&
      "displayAvatarURL" in target &&
      typeof target.displayAvatarURL === "function"
        ? target.displayAvatarURL({ size: 512 })
        : "",
    "target.avatarUrl":
      target &&
      "displayAvatarURL" in target &&
      typeof target.displayAvatarURL === "function"
        ? target.displayAvatarURL({ size: 512 })
        : "",
    "event.date": new Date().toISOString(),
    "event.name": moderationEventName(action),
  };
}
