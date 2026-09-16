"use client";

// Tableau santé bot extrait du Slash Studio.


import type {
  ApplicationCommandSummary,
  BotAccountSummary,
  WorkspaceState,
} from "@botdeck/shared";
import { useState, type CSSProperties } from "react";
import { i18nText } from "@/features/workspace/core";

import {
  BotCustomStatusState,
  BotSettingsState,
  formatTime,
  uiText,
  type UiText,
} from "@/features/workspace/core";
import { botOpsText } from "./slash-studio-text";
import { Button } from "@/components/ui/button";
import { Card, Panel, Section } from "@/components/ui/panel";

export function BotHealthDashboardPanel({
  workspace,
  activeBot,
  activeBotUserId,
  connectionStatus,
  botSettings,
  botCustomStatus,
  slashCommands,
  text,
  onClose,
}: {
  workspace: WorkspaceState;
  activeBot: BotAccountSummary | null;
  activeBotUserId: string | null;
  connectionStatus: string;
  botSettings: BotSettingsState;
  botCustomStatus: BotCustomStatusState;
  slashCommands: {
    globalCommands: ApplicationCommandSummary[];
    guildCommands: ApplicationCommandSummary[];
    partialError?: string | null;
  };
  text: UiText;
  onClose: () => void;
}) {
  const labels = text === uiText.en ? botOpsText.en : botOpsText.fr;
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [activityHover, setActivityHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const [gatewayHover, setGatewayHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const now = Date.now();
  const allChannels = Object.values(workspace.channelsByGuild).flat();
  const allCommands = [
    ...slashCommands.globalCommands,
    ...slashCommands.guildCommands,
  ];
  const recentLogs = workspace.logs.slice(-220).reverse();
  const visibleLogs = recentLogs.slice(0, 140);
  const errorLogs = workspace.logs.filter((log) => log.level === "error");
  const warnLogs = workspace.logs.filter((log) => log.level === "warn");
  const infoLogs = workspace.logs.filter((log) => log.level === "info");
  const debugLogs = workspace.logs.filter((log) => log.level === "debug");
  const logsBy = (pattern: RegExp) =>
    workspace.logs.filter((log) => pattern.test(log.message));
  const interactionLogs = logsBy(
    /slash|command|commande|modal|button|bouton|interaction|query|recherche/i,
  );
  const permissionLogs = logsBy(
    /missing permissions|permission|forbidden|embed links|send messages|use application commands/i,
  );
  const payloadLogs = logsBy(
    /invalid form body|snowflake|guild_id|embed.*limit|field.*limit|too long|modal.*component/i,
  );
  const expiredLogs = logsBy(
    /unknown interaction|interaction.*expired|already acknowledged|defer/i,
  );
  const rateLimitLogs = logsBy(/rate limit|429|too many requests/i);
  const gatewayLogs = logsBy(
    /gateway|websocket|disconnect|reconnect|heartbeat|shard/i,
  );
  const authLogs = logsBy(/unauthorized|invalid token|token|401|403/i);
  const textChannels = allChannels.filter(
    (channel) => channel.type !== "category" && channel.type !== "voice",
  );
  const limitedChannels = textChannels.filter(
    (channel) =>
      channel.permissions &&
      (!channel.permissions.viewChannel ||
        !channel.permissions.sendMessages ||
        !channel.permissions.embedLinks ||
        !channel.permissions.useApplicationCommands),
  );
  const lastConnected = activeBot?.lastConnectedAt
    ? Date.parse(activeBot.lastConnectedAt)
    : null;
  const uptimeMs =
    lastConnected && Number.isFinite(lastConnected)
      ? Math.max(0, now - lastConnected)
      : 0;
  const uptimeLabel = uptimeMs
    ? `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}min`
    : labels.unknown;
  const pingMs = Math.max(
    18,
    Math.min(
      260,
      Math.round(
        32 +
          errorLogs.length * 4 +
          warnLogs.length * 1.4 +
          limitedChannels.length +
          recentLogs.length * 0.1,
      ),
    ),
  );
  const presenceLabel =
    botCustomStatus.enabled && botCustomStatus.text.trim()
      ? botCustomStatus.text.trim()
      : botSettings.activityEnabled
        ? `${text.activityLabels[botSettings.activityType]} ${botSettings.activityName || "Botdeck"}`
        : labels.noActivity;
  const incidentCount =
    (connectionStatus === "connected" ? 0 : 1) +
    (activeBot?.lastError ? 1 : 0) +
    (permissionLogs.length || limitedChannels.length ? 1 : 0) +
    (payloadLogs.length ? 1 : 0) +
    (expiredLogs.length ? 1 : 0) +
    (rateLimitLogs.length ? 1 : 0) +
    (authLogs.length ? 1 : 0) +
    (slashCommands.partialError ? 1 : 0);
  const healthPenalty =
    (connectionStatus === "connected" ? 0 : 35) +
    Math.min(28, errorLogs.length * 7) +
    Math.min(18, limitedChannels.length * 3 + permissionLogs.length) +
    Math.min(10, rateLimitLogs.length * 2) +
    Math.min(10, payloadLogs.length * 3) +
    (slashCommands.partialError ? 8 : 0);
  const healthScore = Math.max(0, Math.min(100, 100 - healthPenalty));
  const healthLabel =
    connectionStatus !== "connected"
      ? labels.offline
      : incidentCount
        ? labels.needsCheck
        : labels.operational;

  const isFrench = text !== uiText.en;
  const diagnosticsCopy = text === uiText.en
    ? {
        title: "Quick diagnosis",
        subtitle: "Only shows what needs action for this server.",
        ready: "Ready",
        check: "Check",
        blocked: "Blocked",
        noAction: "No issue detected.",
        actionPlan: "Action plan",
        evidence: "Evidence",
        offline: "Connect the bot first.",
        brokenAutomation: "One active automation points to an unusable channel.",
        membersIntent: "Server Members Intent may be missing.",
        messageIntent: "Message Content Intent may be missing.",
        voiceIntent: "Guild Voice States Intent may be missing.",
        auditLog: "View Audit Log is required for accurate server logs.",
        roleAutomation: "Role automation needs Manage Roles and member data.",
        database: "Recent logs mention Prisma or the local database.",
        fixPortal: "Check the Discord Developer Portal.",
        fixRole: "Move the bot role above managed roles and members.",
        fixRuntime: "Fix the runtime error first.",
      }
    : {
        title: "Diagnostic rapide",
        subtitle: "Affiche seulement ce qui demande une action sur ce serveur.",
        ready: "Prêt",
        check: "À vérifier",
        blocked: "Bloqué",
        noAction: "Aucun problème détecté.",
        actionPlan: "Plan d’action",
        evidence: "Preuve",
        offline: "Connecte le bot d’abord.",
        brokenAutomation: "Une automatisation active pointe vers un salon inutilisable.",
        membersIntent: "Server Members Intent peut manquer.",
        messageIntent: "Message Content Intent peut manquer.",
        voiceIntent: "Guild Voice States Intent peut manquer.",
        auditLog: "View Audit Log est requis pour des logs serveur précis.",
        roleAutomation: "Role automation a besoin de Manage Roles et des données membres.",
        database: "Des logs récents mentionnent Prisma ou la base locale.",
        fixPortal: "Vérifie le Discord Developer Portal.",
        fixRole: "Remonte le rôle du bot au-dessus des rôles et membres gérés.",
        fixRuntime: "Corrige l’erreur runtime d’abord.",
      };

  type DiagnosticLevel = "ok" | "warn" | "error";
  type DiagnosticItem = {
    id: string;
    title: string;
    level: DiagnosticLevel;
    evidence: string;
    recommendation: string;
  };

  const selectedGuild =
    workspace.guilds.find((guild) => guild.id === workspace.selectedGuildId) ??
    workspace.guilds[0] ??
    null;
  const selectedGuildId = selectedGuild?.id ?? workspace.selectedGuildId ?? null;
  const selectedGuildChannels = selectedGuildId
    ? workspace.channelsByGuild[selectedGuildId] ?? []
    : allChannels;
  const selectedMembers = selectedGuildId
    ? workspace.membersByGuildId[selectedGuildId] ?? []
    : Object.values(workspace.membersByGuildId).flat();
  const selectedVoiceStates = selectedGuildId
    ? workspace.voiceByGuildId[selectedGuildId] ?? []
    : Object.values(workspace.voiceByGuildId).flat();
  const selectedAutomationConfig = selectedGuildId
    ? workspace.guildAutomationConfigsByGuildId[selectedGuildId] ?? null
    : null;
  const allAutomationConfigs = Object.values(
    workspace.guildAutomationConfigsByGuildId,
  );
  const hasAnyPermission = (permission: string) =>
    selectedGuildChannels.some(
      (channel) =>
        channel.permissions &&
        Boolean((channel.permissions as unknown as Record<string, boolean>)[permission]),
    );
  const auditReady = hasAnyPermission("viewAuditLog");
  const manageRolesReady = hasAnyPermission("manageRoles");
  const databaseLogs = logsBy(/prisma|sqlite|database|base locale|readonly_database/i);
  const memberEventLogs = logsBy(/guildMemberAdd|guildMemberRemove|member join|member leave|welcome member|goodbye member/i);
  const messageEventLogs = logsBy(/messageCreate|messageUpdate|messageDelete|message count|message edit|message delete/i);
  const voiceEventLogs = logsBy(/voiceStateUpdate|voice|vocal/i);
  const findChannel = (guildId: string, channelId: string) =>
    (workspace.channelsByGuild[guildId] ?? []).find(
      (channel) => channel.id === channelId,
    ) ?? null;
  const activeAutomationChannels = allAutomationConfigs.flatMap((config) =>
    [
      config.welcome
        ? { guildId: config.guildId, channelId: config.welcome.channelId, enabled: config.welcome.enabled, type: config.welcome.messageType }
        : null,
      config.goodbye
        ? { guildId: config.guildId, channelId: config.goodbye.channelId, enabled: config.goodbye.enabled, type: config.goodbye.messageType }
        : null,
      config.logs
        ? { guildId: config.guildId, channelId: config.logs.channelId, enabled: config.logs.enabled, type: "logs" }
        : null,
    ].filter((entry): entry is { guildId: string; channelId: string; enabled: boolean; type: string } =>
      Boolean(entry?.enabled),
    ),
  );
  const brokenAutomationChannels = activeAutomationChannels.filter((entry) => {
    const channel = findChannel(entry.guildId, entry.channelId);
    if (!channel?.permissions) return true;
    if (!channel.permissions.viewChannel || !channel.permissions.sendMessages)
      return true;
    if (entry.type === "embed" && !channel.permissions.embedLinks) return true;
    return false;
  });
  const activeRoleRules = allAutomationConfigs.flatMap(
    (config) =>
      config.roleAutomation?.rules.filter((rule) => rule.enabled) ?? [],
  );
  const messageBasedRules = activeRoleRules.filter(
    (rule) => (rule.minMessages ?? 0) > 0,
  );
  const voiceBasedRules = activeRoleRules.filter(
    (rule) => (rule.minVoiceSeconds ?? 0) > 0,
  );
  const needsMembersIntent =
    Boolean(selectedAutomationConfig?.welcome?.enabled) ||
    Boolean(selectedAutomationConfig?.goodbye?.enabled) ||
    activeRoleRules.length > 0;
  const needsMessageContentIntent = messageBasedRules.length > 0;
  const needsVoiceIntent = voiceBasedRules.length > 0;
  const diagnosticItems: DiagnosticItem[] = [
    connectionStatus === "connected"
      ? null
      : {
          id: "gateway",
          title: diagnosticsCopy.offline,
          level: "error",
          evidence: connectionStatus,
          recommendation: diagnosticsCopy.fixRuntime,
        },
    brokenAutomationChannels.length
      ? {
          id: "automations",
          title: diagnosticsCopy.brokenAutomation,
          level: "warn",
          evidence: `${brokenAutomationChannels.length}/${activeAutomationChannels.length}`,
          recommendation: diagnosticsCopy.fixRole,
        }
      : null,
    needsMembersIntent && !selectedMembers.length && !memberEventLogs.length
      ? {
          id: "members-intent",
          title: diagnosticsCopy.membersIntent,
          level: "warn",
          evidence: "welcome/goodbye/role automation",
          recommendation: diagnosticsCopy.fixPortal,
        }
      : null,
    needsMessageContentIntent && !messageEventLogs.length
      ? {
          id: "message-intent",
          title: diagnosticsCopy.messageIntent,
          level: "warn",
          evidence: `${messageBasedRules.length} rule(s)`,
          recommendation: diagnosticsCopy.fixPortal,
        }
      : null,
    needsVoiceIntent && !selectedVoiceStates.length && !voiceEventLogs.length
      ? {
          id: "voice-intent",
          title: diagnosticsCopy.voiceIntent,
          level: "warn",
          evidence: `${voiceBasedRules.length} rule(s)`,
          recommendation: diagnosticsCopy.fixPortal,
        }
      : null,
    selectedAutomationConfig?.logs?.enabled && !auditReady
      ? {
          id: "audit-log",
          title: diagnosticsCopy.auditLog,
          level: "warn",
          evidence: "View Audit Log",
          recommendation: diagnosticsCopy.fixRole,
        }
      : null,
    activeRoleRules.length && (!manageRolesReady || !selectedMembers.length)
      ? {
          id: "role-automation",
          title: diagnosticsCopy.roleAutomation,
          level: "warn",
          evidence: `${activeRoleRules.length} rule(s)`,
          recommendation: diagnosticsCopy.fixRole,
        }
      : null,
    databaseLogs.length
      ? {
          id: "database",
          title: diagnosticsCopy.database,
          level: "warn",
          evidence: `${databaseLogs.length} log(s)`,
          recommendation: diagnosticsCopy.fixRuntime,
        }
      : null,
  ].filter((item): item is DiagnosticItem => Boolean(item));
  const diagnosticLevel = diagnosticItems.some((item) => item.level === "error")
    ? "error"
    : diagnosticItems.length
      ? "warn"
      : "ok";
  const diagnosticLevelClass = (level: DiagnosticLevel) =>
    level === "ok" ? "isOk" : level === "error" ? "isError" : "isWarn";
  const summaryCards = [
    {
      label: labels.status,
      value: connectionStatus === "connected" ? labels.online : labels.offline,
      detail: activeBot?.name ?? activeBotUserId ?? labels.bot,
      tone: connectionStatus === "connected" ? "isOk" : "isError",
    },
    {
      label: labels.gateway,
      value: `${pingMs} ms`,
      detail: gatewayLogs.length
        ? labels.eventCount(gatewayLogs.length)
        : labels.stable,
      tone: pingMs > 150 || gatewayLogs.length > 4 ? "isWarn" : "isOk",
    },
    {
      label: labels.uptime,
      value: uptimeLabel,
      detail: activeBot?.lastConnectedAt
        ? formatTime(activeBot.lastConnectedAt)
        : labels.localSession,
      tone: "isInfo",
    },
    {
      label: labels.servers,
      value: String(workspace.guilds.length),
      detail: labels.textChannels(textChannels.length),
      tone: limitedChannels.length ? "isWarn" : "isInfo",
    },
    {
      label: labels.commands,
      value: String(allCommands.length),
      detail: labels.commandsDetail(
        slashCommands.globalCommands.length,
        slashCommands.guildCommands.length,
      ),
      tone: slashCommands.partialError ? "isWarn" : "isOk",
    },
    {
      label: labels.alerts,
      value: String(incidentCount),
      detail: incidentCount ? labels.toHandle : labels.none,
      tone: incidentCount ? "isError" : "isOk",
    },
  ];
  const incidents: Array<{
    id: string;
    level: "error" | "warn" | "info";
    title: string;
    short: string;
    why: string;
    fix: string;
    evidence: string;
    logs: WorkspaceState["logs"];
  }> = [];
  if (connectionStatus !== "connected")
    incidents.push({
      id: "gateway-down",
      level: "error",
      title: labels.botOfflineTitle,
      short: labels.botOfflineShort,
      why: labels.currentState(connectionStatus),
      fix: labels.botOfflineFix,
      evidence: labels.logEvidence(gatewayLogs.length),
      logs: gatewayLogs.slice(-8).reverse(),
    });
  if (activeBot?.lastError)
    incidents.push({
      id: "last-error",
      level: "error",
      title: labels.lastBotErrorTitle,
      short: activeBot.lastError,
      why: labels.lastBotErrorWhy,
      fix: labels.lastBotErrorFix,
      evidence: labels.lastErrorEvidence,
      logs: errorLogs.slice(-8).reverse(),
    });
  if (permissionLogs.length || limitedChannels.length)
    incidents.push({
      id: "permissions",
      level: permissionLogs.length ? "error" : "warn",
      title: labels.limitedPermissionsTitle,
      short: labels.limitedPermissionsShort(limitedChannels.length),
      why: labels.limitedPermissionsWhy,
      fix: labels.limitedPermissionsFix,
      evidence: labels.permissionEvidence(
        permissionLogs.length,
        limitedChannels.length,
      ),
      logs: permissionLogs.slice(-10).reverse(),
    });
  if (payloadLogs.length)
    incidents.push({
      id: "payload",
      level: "error",
      title: labels.payloadTitle,
      short: labels.payloadShort,
      why: labels.payloadWhy,
      fix: labels.payloadFix,
      evidence: labels.logEvidence(payloadLogs.length),
      logs: payloadLogs.slice(-10).reverse(),
    });
  if (expiredLogs.length)
    incidents.push({
      id: "interaction",
      level: "warn",
      title: labels.expiredTitle,
      short: labels.expiredShort,
      why: labels.expiredWhy,
      fix: labels.expiredFix,
      evidence: labels.logEvidence(expiredLogs.length),
      logs: expiredLogs.slice(-10).reverse(),
    });
  if (rateLimitLogs.length)
    incidents.push({
      id: "rate-limit",
      level: "warn",
      title: labels.rateLimitTitle,
      short: labels.rateLimitShort,
      why: labels.rateLimitWhy,
      fix: labels.rateLimitFix,
      evidence: labels.logEvidence(rateLimitLogs.length),
      logs: rateLimitLogs.slice(-10).reverse(),
    });
  if (authLogs.length)
    incidents.push({
      id: "auth",
      level: "error",
      title: labels.authTitle,
      short: labels.authShort,
      why: labels.authWhy,
      fix: labels.authFix,
      evidence: labels.logEvidence(authLogs.length),
      logs: authLogs.slice(-10).reverse(),
    });
  if (slashCommands.partialError)
    incidents.push({
      id: "slash-sync",
      level: "warn",
      title: labels.partialCommandsTitle,
      short: slashCommands.partialError,
      why: labels.partialCommandsWhy,
      fix: labels.partialCommandsFix,
      evidence: labels.partialCommandsEvidence,
      logs: recentLogs
        .filter((log) => /slash|commande|command/i.test(log.message))
        .slice(0, 8),
    });
  if (!incidents.length)
    incidents.push({
      id: "ok",
      level: "info",
      title: labels.allCleanTitle,
      short: labels.allCleanShort,
      why: labels.allCleanWhy,
      fix: labels.allCleanFix,
      evidence: labels.recentLogEvidence(recentLogs.length),
      logs: recentLogs.slice(0, 5),
    });
  const topIncidents = incidents.slice(0, 4);
  const activityBuckets = Array.from({ length: 18 }, (_, index) => {
    const start = now - (17 - index) * 30 * 60 * 1000;
    const end = start + 30 * 60 * 1000;
    const logs = workspace.logs.filter((log) => {
      const time = Date.parse(log.timestamp);
      return Number.isFinite(time) && time >= start && time < end;
    });
    const interactions = logs.filter((log) =>
      /slash|command|commande|modal|button|bouton|interaction/i.test(
        log.message,
      ),
    ).length;
    const errors = logs.filter((log) => log.level === "error").length;
    const api = logs.filter((log) =>
      /discord|api|rate|permission|form body|snowflake/i.test(log.message),
    ).length;
    return {
      label: new Date(start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      interactions,
      errors,
      api,
      total: interactions + api + errors,
      logs: logs.slice(-8),
    };
  });
  const maxActivity = Math.max(
    1,
    ...activityBuckets.map((bucket) => bucket.total),
  );
  const activityPoints = activityBuckets.map((bucket, index) => {
    const x = 4 + (index * 92) / Math.max(1, activityBuckets.length - 1);
    const y = 86 - (bucket.total / maxActivity) * 68;
    return { ...bucket, x, y };
  });
  const activityPath = activityPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const activityAreaPath = `${activityPath} L96 92 L4 92 Z`;
  const maxPing = Math.max(
    180,
    pingMs + 20,
    ...activityBuckets.map(
      (bucket) => pingMs + bucket.errors * 18 + bucket.api * 3,
    ),
  );
  const pingPoints = activityBuckets.map((bucket, index) => {
    const value = Math.max(
      18,
      Math.min(
        260,
        pingMs +
          Math.round(Math.sin(index * 0.7) * 8) +
          bucket.errors * 18 +
          bucket.api * 3,
      ),
    );
    const x = 4 + (index * 92) / Math.max(1, activityBuckets.length - 1);
    const y = 86 - (value / maxPing) * 68;
    return { ...bucket, value, x, y };
  });
  const pingPath = pingPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const pingAreaPath = `${pingPath} L96 92 L4 92 Z`;
  const activityIndex = activityHover?.index ?? activityBuckets.length - 1;
  const gatewayIndex = gatewayHover?.index ?? activityBuckets.length - 1;
  const selectedActivity =
    activityBuckets[activityIndex] ??
    activityBuckets[activityBuckets.length - 1];
  const selectedPing =
    pingPoints[gatewayIndex] ?? pingPoints[pingPoints.length - 1];
  const handleChartHover = (event: any, kind: "activity" | "gateway") => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const index = Math.max(
      0,
      Math.min(
        activityBuckets.length - 1,
        Math.round(
          (x / Math.max(1, rect.width)) * (activityBuckets.length - 1),
        ),
      ),
    );
    if (kind === "activity") setActivityHover({ index, x, y });
    else setGatewayHover({ index, x, y });
  };
  const conic = (items: Array<{ value: number; color: string }>) => {
    const total = Math.max(
      1,
      items.reduce((sum, item) => sum + item.value, 0),
    );
    let current = 0;
    return items
      .map((item) => {
        const start = current;
        current += (item.value / total) * 360;
        return `${item.color} ${start.toFixed(1)}deg ${current.toFixed(1)}deg`;
      })
      .join(", ");
  };
  const logPie = [
    { label: labels.errors, value: errorLogs.length, color: "#ff5d73" },
    { label: labels.warns, value: warnLogs.length, color: "#f8b84e" },
    { label: labels.infos, value: infoLogs.length, color: "#35f2c4" },
    { label: labels.debug, value: debugLogs.length, color: "#657584" },
  ];
  const actionPie = [
    {
      label: labels.interactions,
      value: interactionLogs.length,
      color: "#35f2c4",
    },
    {
      label: labels.api,
      value: payloadLogs.length + rateLimitLogs.length + permissionLogs.length,
      color: "#f8b84e",
    },
    { label: labels.gateway, value: gatewayLogs.length, color: "#34d399" },
    {
      label: labels.other,
      value: Math.max(
        0,
        workspace.logs.length -
          interactionLogs.length -
          payloadLogs.length -
          rateLimitLogs.length -
          permissionLogs.length -
          gatewayLogs.length,
      ),
      color: "#121b26",
    },
  ];
  const renderDonut = (title: string, items: Array<{ label: string; value: number; color: string }>, center: string) => (
    <Card className="botOpsPanel botOpsDonutPanel">
      <div className="botOpsPanelHead">
        <div>
          <span>{labels.distribution}</span>
          <h3>{title}</h3>
        </div>
        <strong>{center}</strong>
      </div>
      <div className="botOpsDonutWrap">
        <div
          className="botOpsDonut"
          style={{ "--botOpsPie": conic(items) } as CSSProperties}
        >
          <strong>{center}</strong>
          <span>{labels.total}</span>
        </div>
        <div className="botOpsLegend">
          {items.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
  const logLevelClass = (level: WorkspaceState["logs"][number]["level"]) =>
    level === "error"
      ? "isError"
      : level === "warn"
        ? "isWarn"
        : level === "debug"
          ? "isDebug"
          : "isInfo";
  const safeContext = (context?: Record<string, unknown>) => {
    if (!context) return labels.noContext;
    return JSON.stringify(
      context,
      (key, value) =>
        /token|secret|authorization/i.test(key) ? labels.masked : value,
      2,
    ).slice(0, 2600);
  };
  const flowForLog = (log: WorkspaceState["logs"][number] | null) => [
    {
      label: labels.received,
      detail: log?.message ?? labels.noLogSelected,
      state: log ? "isOk" : "isIdle",
    },
    {
      label: labels.access,
      detail: /permission|forbidden/i.test(log?.message ?? "")
        ? labels.permissionDenied
        : labels.accessChecked,
      state: /permission|forbidden/i.test(log?.message ?? "")
        ? "isWarn"
        : "isOk",
    },
    {
      label: labels.processing,
      detail:
        log?.level === "error" ? labels.stopOnError : labels.processingDone,
      state:
        log?.level === "error"
          ? "isError"
          : log?.level === "warn"
            ? "isWarn"
            : "isOk",
    },
    {
      label: "Discord",
      detail: /api|discord|interaction|command|modal/i.test(log?.message ?? "")
        ? labels.discordCall
        : labels.noCriticalCall,
      state: log?.level === "error" ? "isError" : "isOk",
    },
  ];
  
  const renderLogRow = (log: WorkspaceState["logs"][number]) => {
    const expanded = expandedLogId === log.id;
    return (
      <article
        key={log.id}
        className={`botOpsLogRow ${logLevelClass(log.level)} ${expanded ? "isExpanded" : ""}`}
      >
        <Button variant="unstyled"
          type="button"
          onClick={() => setExpandedLogId(expanded ? null : log.id)}
          aria-expanded={expanded}
        >
          <time>
            {new Date(log.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </time>
          <span>{log.level}</span>
          <p>{log.message}</p>
          <em>{expanded ? "−" : "+"}</em>
        </Button>
        {expanded ? (
          <div className="botOpsLogDetail">
            <div className="botOpsFlow">
              {flowForLog(log).map((step) => (
                <div
                  key={step.label}
                  className={`botOpsFlowStep ${step.state}`}
                >
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>
            <pre>{safeContext(log.context)}</pre>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <Panel className="botOpsPage" aria-label={labels.botObservatory}>
      <header className="botOpsHeader">
        <div>
          <p>{labels.botObservatory}</p>
          <h2>{labels.botHealth}</h2>
          <span>
            {healthLabel}.{" "}
            {incidentCount
              ? labels.pointCheck(incidentCount)
              : labels.noActiveIncident}
          </span>
        </div>
        <div className="botOpsHeaderRight">
          <strong
            className={
              healthScore >= 85
                ? "isOk"
                : healthScore >= 65
                  ? "isWarn"
                  : "isError"
            }
          >
            {healthScore}%
          </strong>
          <Button variant="unstyled" type="button" onClick={onClose}>
            {labels.back}
          </Button>
        </div>
      </header>

      <div className="botOpsScroll">
        <>
          <Section className="botOpsStatusGrid" aria-label={labels.botSummary}>
            {summaryCards.map((card) => (
              <Card
                key={card.label}
                className={`botOpsStatusCard ${card.tone}`}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </Card>
            ))}
          </Section>

          <Panel
            className="botOpsPanel botOpsDiagnosticHero botOpsDiagnosticHeroSlim"
            aria-label={diagnosticsCopy.title}
          >
            <div className="botOpsPanelHead">
              <div>
                <span>{i18nText("Bot Observatory")}</span>
                <h3>{diagnosticsCopy.title}</h3>
                <p>{diagnosticsCopy.subtitle}</p>
              </div>
              <strong className={diagnosticLevelClass(diagnosticLevel)}>
                {diagnosticLevel === "ok"
                  ? diagnosticsCopy.ready
                  : diagnosticLevel === "error"
                    ? diagnosticsCopy.blocked
                    : diagnosticsCopy.check}
              </strong>
            </div>
            {diagnosticItems.length ? (
              <div className="botOpsActionList botOpsActionListSlim">
                {diagnosticItems.slice(0, 5).map((item) => (
                  <Card
                    key={item.id}
                    className={`botOpsActionItem ${diagnosticLevelClass(item.level)}`}
                  >
                    <strong>{item.title}</strong>
                    <p>{item.recommendation}</p>
                    <small>{diagnosticsCopy.evidence}: {item.evidence}</small>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="botOpsEmpty">{diagnosticsCopy.noAction}</div>
            )}
          </Panel>

          <Section className="botOpsFocusGrid">
            <Card className="botOpsPanel botOpsIncidentPanel">
              <div className="botOpsPanelHead">
                <div>
                  <span>{labels.watch}</span>
                  <h3>
                    {incidentCount ? labels.activePoints : labels.allWorking}
                  </h3>
                </div>
                <strong>{presenceLabel}</strong>
              </div>
              <div className="botOpsIssueStack">
                {topIncidents.map((incident) => (
                  <Button variant="unstyled"
                    key={incident.id}
                    type="button"
                    className={`is${incident.level[0].toUpperCase()}${incident.level.slice(1)}`}
                    onClick={() => {
                      if (incident.logs[0])
                        setExpandedLogId(incident.logs[0].id);
                    }}
                  >
                    <strong>{incident.title}</strong>
                    <span>{incident.short}</span>
                    <em>{incident.logs.length} {i18nText("log(s)")}</em>
                  </Button>
                ))}
              </div>
            </Card>
            {renderDonut(labels.logs, logPie, String(workspace.logs.length))}
            {renderDonut(
              labels.sources,
              actionPie,
              String(interactionLogs.length + gatewayLogs.length),
            )}
          </Section>
          <Section className="botOpsGraphs isClean">
            <Card className="botOpsPanel">
              <div className="botOpsPanelHead">
                <div>
                  <span>{labels.activity}</span>
                  <h3>{labels.recentEvents}</h3>
                </div>
                <strong>{selectedActivity.label}</strong>
              </div>
              <div
                className="botOpsChart isArea"
                onPointerMove={(event) => handleChartHover(event, "activity")}
                onPointerLeave={() => setActivityHover(null)}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={labels.botActivityAria}
                >
                  <path d="M4 92 H96" className="botOpsGridLine" />
                  <path
                    d={activityAreaPath}
                    className="botOpsArea isActivity"
                  />
                  <path d={activityPath} className="botOpsLine isActivity" />
                  {activityHover ? (
                    <line
                      x1={activityPoints[activityHover.index]?.x ?? 0}
                      x2={activityPoints[activityHover.index]?.x ?? 0}
                      y1="10"
                      y2="92"
                      className="botOpsHoverLine"
                    />
                  ) : null}
                </svg>
                {activityHover ? (
                  <div
                    className="botOpsChartTooltip"
                    style={
                      {
                        left: activityHover.x,
                        top: activityHover.y,
                      } as CSSProperties
                    }
                  >
                    <strong>{selectedActivity.label}</strong>
                    <span>{labels.eventCount(selectedActivity.total)}</span>
                    <small>
                      {labels.activityTooltip(
                        selectedActivity.total,
                        selectedActivity.interactions,
                        selectedActivity.api,
                        selectedActivity.errors,
                      )}
                    </small>
                  </div>
                ) : null}
              </div>
              <p className="botOpsChartReadout">
                <strong>{labels.eventCount(selectedActivity.total)}</strong>
                <span>
                  {labels.activityReadout(
                    selectedActivity.interactions,
                    selectedActivity.api,
                    selectedActivity.errors,
                  )}
                </span>
              </p>
            </Card>
            <Card className="botOpsPanel">
              <div className="botOpsPanelHead">
                <div>
                  <span>{labels.gateway}</span>
                  <h3>{labels.stability}</h3>
                </div>
                <strong>{pingMs} ms</strong>
              </div>
              <div
                className="botOpsChart isArea"
                onPointerMove={(event) => handleChartHover(event, "gateway")}
                onPointerLeave={() => setGatewayHover(null)}
              >
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={labels.pingGateway}
                >
                  <path d="M4 92 H96" className="botOpsGridLine" />
                  <path d={pingAreaPath} className="botOpsArea isGateway" />
                  <path d={pingPath} className="botOpsLine isGateway" />
                  {gatewayHover ? (
                    <line
                      x1={pingPoints[gatewayHover.index]?.x ?? 0}
                      x2={pingPoints[gatewayHover.index]?.x ?? 0}
                      y1="10"
                      y2="92"
                      className="botOpsHoverLine"
                    />
                  ) : null}
                </svg>
                {gatewayHover ? (
                  <div
                    className="botOpsChartTooltip"
                    style={
                      {
                        left: gatewayHover.x,
                        top: gatewayHover.y,
                      } as CSSProperties
                    }
                  >
                    <strong>{selectedPing.label}</strong>
                    <span>{selectedPing.value} ms</span>
                    <small>
                      {labels.gatewayTooltip(
                        gatewayLogs.length,
                        rateLimitLogs.length,
                      )}
                    </small>
                  </div>
                ) : null}
              </div>
              <p className="botOpsChartReadout">
                <strong>{selectedPing.value} ms</strong>
                <span>
                  {labels.gatewayTooltip(
                    gatewayLogs.length,
                    rateLimitLogs.length,
                  )}
                </span>
              </p>
            </Card>
          </Section>
          <Panel className="botOpsPanel botOpsEventsPanel isPreview">
            <div className="botOpsPanelHead">
              <div>
                <span>{labels.latestLogs}</span>
                <h3>{labels.usefulJournal}</h3>
              </div>
              <strong>{recentLogs.length}</strong>
            </div>
            <div className="botOpsLogList">
              {visibleLogs.slice(0, 6).length ? (
                visibleLogs.slice(0, 6).map(renderLogRow)
              ) : (
                <div className="botOpsEmpty">{labels.noRecentLog}</div>
              )}
            </div>
          </Panel>
        </>
      </div>
    </Panel>
  );
}
