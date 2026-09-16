"use client";

// Paramètres serveur et automatisations serveur

import { Input, Select, Textarea } from "../../../components/ui/field";
import { Modal } from "../../../components/ui/modal";
import { useModalLayer } from "@/components/ui/modal-stack";
import { Card, Panel, Section } from "../../../components/ui/panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabButton } from "@/components/ui/tabs";
import {
  type ChannelSummary,
  type ClientCommand,
  type GuildAutomationConfig,
  type GuildAutomationKind,
  type GuildAutomationMessageConfig,
  type GuildBanSummary,
  type GuildInviteSummary,
  type GuildMemberSummary,
  type GuildRoleAutomationRuleConfig,
  type RoleSummary,
  type WorkspaceState,
} from "@botdeck/shared";
import { type CSSProperties, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { i18nText } from "@/features/workspace/core";

import {
  type AppToast,
  type UiText,
  uiText,
} from "@/features/workspace/core";
import { SlashStudioEmbedEditor } from "@/features/slash-studio/components/slash-studio-widgets";

import {
  serverLabels,
  type ServerSettingsText,
} from "@/features/server-settings/server-settings-text";

import {
  buildBotdeckPackage,
  downloadJsonPackage,
  parseBotdeckPackage,
  parseJsonFileContent,
  readTextFile,
  safePackageName,
  templateToPackageItem,
  type TemplateExportInput,
} from "@/lib/import-export/botdeck-package";

import { Badge } from "../../../components/ui/badge";

import {
  ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS,
  ROLE_AUTOMATION_MAX_MESSAGES,
  ROLE_AUTOMATION_MAX_VOICE_MINUTES,
  defaultGoodbyeTemplate,
  defaultLogEventConfigsJson,
  defaultWelcomeTemplate,
  type AutomationLogsDraft,
  type AutomationMessageDraft,
  type AutomationModalTarget,
  type LogEventDraft,
  type LogEventKey,
  type RoleAutomationDraftRule,
  type RoleAutomationModalTarget,
  type ServerSettingsTab,
  type SimpleAutomationEmbedDraft,
  logEventKeys,
  logEventVariables,
  welcomeGoodbyeVariables,
} from "@/features/server-settings/server-automation-model";

function AutomationVariableChips({
  variables,
  labels,
}: {
  variables: string[];
  labels: ServerSettingsText;
}) {
  return (
    <div
      className="serverAutomationVariableChips"
      aria-label={labels.usefulVariables}
    >
      <strong>{labels.usefulVariables}</strong>
      <div>
        {variables.map((variable) => (
          <code key={variable}>{`{${variable}}`}</code>
        ))}
      </div>
    </div>
  );
}

function EditAutomationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4.4L19.2 9.2a2.1 2.1 0 0 0 0-3L17.8 4.8a2.1 2.1 0 0 0-3 0L4 15.6V20Z" />
      <path d="m13.8 5.8 4.4 4.4" />
      <path d="M4 20h16" />
    </svg>
  );
}

function TestAutomationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5v4" />
      <path d="m16.25 5.25-2.1 3.65" />
      <path d="m7.75 5.25 2.1 3.65" />
      <path d="M5.6 11.2h12.8" />
      <path d="M7.25 11.2h9.5l-1.05 7.3a2.1 2.1 0 0 1-2.08 1.8h-3.24a2.1 2.1 0 0 1-2.08-1.8L7.25 11.2Z" />
      <path d="M10.2 15h3.6" />
    </svg>
  );
}

function ImportTemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5v10" />
      <path d="m8.2 9.9 3.8 3.8 3.8-3.8" />
      <path d="M5 14.5v3.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-3.2" />
    </svg>
  );
}

function ExportTemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 13.5v-10" />
      <path d="m8.2 7.3 3.8-3.8 3.8 3.8" />
      <path d="M5 14.5v3.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-3.2" />
    </svg>
  );
}

function automationMessageDraft(
  config: GuildAutomationMessageConfig | null,
  kind: "welcome" | "goodbye",
): AutomationMessageDraft {
  return {
    channelId: config?.channelId ?? "",
    messageType: config?.messageType === "embed" ? "embed" : "message",
    messageTemplate:
      config?.messageTemplate ??
      (kind === "welcome" ? defaultWelcomeTemplate : defaultGoodbyeTemplate),
    embedPagesJson: config?.embedPagesJson ?? "[]",
  };
}

function automationLogsDraft(
  config: GuildAutomationConfig["logs"] | null,
): AutomationLogsDraft {
  let eventConfigsJson = defaultLogEventConfigsJson;
  if (config?.eventConfigsJson) {
    try {
      eventConfigsJson = JSON.stringify(
        JSON.parse(config.eventConfigsJson),
        null,
        2,
      );
    } catch {
      eventConfigsJson = config.eventConfigsJson;
    }
  }
  return {
    channelId: config?.channelId ?? "",
    eventConfigsJson,
  };
}

function roleAutomationRuleDraft(
  rule?: GuildRoleAutomationRuleConfig | null,
): RoleAutomationDraftRule {
  return {
    id: rule?.id ?? `draft-${crypto.randomUUID()}`,
    roleId: rule?.roleId ?? "",
    enabled: rule?.enabled ?? true,
    conditionMode: rule?.conditionMode === "any" ? "any" : "all",
    minMessages: rule?.minMessages ? String(rule.minMessages) : "",
    minVoiceMinutes: rule?.minVoiceSeconds
      ? String(Math.ceil(rule.minVoiceSeconds / 60))
      : "",
    minMemberAgeDays: rule?.minMemberAgeSeconds
      ? String(Math.ceil(rule.minMemberAgeSeconds / 86400))
      : "",
    removeWhenInvalid: rule?.removeWhenInvalid ?? false,
    ignoreBots: rule?.ignoreBots ?? true,
    applyToExistingMembers: rule?.applyToExistingMembers ?? false,
  };
}

function roleAutomationDrafts(
  config: GuildAutomationConfig["roleAutomation"] | null | undefined,
): RoleAutomationDraftRule[] {
  return (config?.rules ?? []).map((rule) => roleAutomationRuleDraft(rule));
}

function normalizeRoleAutomationNumber(
  value: string,
  max = Number.MAX_SAFE_INTEGER,
): string {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return String(Math.min(Math.floor(parsed), max));
}

function sanitizeRoleAutomationInput(value: string, max: number): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return String(Math.min(Math.floor(parsed), max));
}

function stableRoleAutomationDraft(rule: RoleAutomationDraftRule) {
  return {
    id: rule.id.startsWith("draft-") ? "" : rule.id,
    roleId: rule.roleId,
    enabled: rule.enabled,
    conditionMode: rule.conditionMode,
    minMessages: normalizeRoleAutomationNumber(
      rule.minMessages,
      ROLE_AUTOMATION_MAX_MESSAGES,
    ),
    minVoiceMinutes: normalizeRoleAutomationNumber(
      rule.minVoiceMinutes,
      ROLE_AUTOMATION_MAX_VOICE_MINUTES,
    ),
    minMemberAgeDays: normalizeRoleAutomationNumber(
      rule.minMemberAgeDays,
      ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS,
    ),
    removeWhenInvalid: rule.removeWhenInvalid,
    ignoreBots: rule.ignoreBots,
    applyToExistingMembers: rule.applyToExistingMembers,
  };
}

function roleAutomationDraftsEqual(
  left: RoleAutomationDraftRule[],
  right: RoleAutomationDraftRule[],
): boolean {
  return (
    JSON.stringify(left.map(stableRoleAutomationDraft)) ===
    JSON.stringify(right.map(stableRoleAutomationDraft))
  );
}

function roleAutomationConditionText(
  rule: RoleAutomationDraftRule,
  labels: ServerSettingsText,
): string {
  const parts: string[] = [];
  const messages = normalizeRoleAutomationNumber(
    rule.minMessages,
    ROLE_AUTOMATION_MAX_MESSAGES,
  );
  const voiceMinutes = normalizeRoleAutomationNumber(
    rule.minVoiceMinutes,
    ROLE_AUTOMATION_MAX_VOICE_MINUTES,
  );
  const memberAgeDays = normalizeRoleAutomationNumber(
    rule.minMemberAgeDays,
    ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS,
  );
  if (messages) parts.push(labels.messagesCondition(messages));
  if (voiceMinutes) parts.push(labels.voiceCondition(voiceMinutes));
  if (memberAgeDays) parts.push(labels.memberAgeCondition(memberAgeDays));
  return parts.length
    ? parts.join(
        rule.conditionMode === "any" ? labels.conditionOr : labels.conditionAnd,
      )
    : labels.conditionJoin;
}

function stableAutomationJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value || "{}"));
  } catch {
    return value.trim();
  }
}

function stringFromRecord(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stableLogEmbedPage(pageValue: unknown) {
  const page = recordFrom(pageValue);
  const image = recordFrom(page.image);
  const thumbnail = recordFrom(page.thumbnail);
  const footer = recordFrom(page.footer);
  const author = recordFrom(page.author);
  const fields = Array.isArray(page.fields)
    ? page.fields.map((fieldValue) => {
        const field = recordFrom(fieldValue);
        return {
          name: stringFromRecord(field.name),
          value: stringFromRecord(field.value),
          inline: field.inline === true,
        };
      })
    : [];
  return {
    title: stringFromRecord(page.title),
    description: stringFromRecord(page.description),
    color:
      typeof page.color === "number" || typeof page.color === "string"
        ? String(page.color)
        : "",
    author: stringFromRecord(page.author, stringFromRecord(author.name)),
    authorIconUrl: stringFromRecord(
      page.authorIconUrl,
      stringFromRecord(author.icon_url),
    ),
    imageUrl: stringFromRecord(page.imageUrl, stringFromRecord(image.url)),
    thumbnailUrl: stringFromRecord(
      page.thumbnailUrl,
      stringFromRecord(thumbnail.url),
    ),
    footerText: stringFromRecord(
      page.footerText,
      stringFromRecord(footer.text),
    ),
    footerIconUrl: stringFromRecord(
      page.footerIconUrl,
      stringFromRecord(footer.icon_url),
    ),
    fields,
  };
}

function stableLogEventConfigsJson(value: string): string {
  try {
    const parsed = JSON.parse(value || "{}");
    const source = recordFrom(parsed);
    return JSON.stringify(
      Object.fromEntries(
        logEventKeys.map((key) => {
          const item = recordFrom(source[key]);
          const mode = item.mode === "embed" ? "embed" : "message";
          return [
            key,
            {
              enabled: item.enabled !== false,
              mode,
              messageTemplate: stringFromRecord(item.messageTemplate),
              embedPages:
                mode === "embed" && Array.isArray(item.embedPages)
                  ? item.embedPages.map(stableLogEmbedPage)
                  : [],
            },
          ];
        }),
      ),
    );
  } catch {
    return value.trim();
  }
}

function automationMessageDraftEquals(
  left: AutomationMessageDraft,
  right: AutomationMessageDraft,
): boolean {
  return (
    left.channelId === right.channelId &&
    left.messageType === right.messageType &&
    left.messageTemplate === right.messageTemplate &&
    stableAutomationJson(left.embedPagesJson) ===
      stableAutomationJson(right.embedPagesJson)
  );
}

function automationLogsDraftEquals(
  left: AutomationLogsDraft,
  right: AutomationLogsDraft,
): boolean {
  return (
    left.channelId === right.channelId &&
    stableLogEventConfigsJson(left.eventConfigsJson) ===
      stableLogEventConfigsJson(right.eventConfigsJson)
  );
}

function parseLogEventDrafts(
  value: string,
): Record<LogEventKey, LogEventDraft> {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    parsed = {};
  }
  const source =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const defaults = JSON.parse(defaultLogEventConfigsJson) as Record<
    LogEventKey,
    { enabled: boolean; mode: "message"; messageTemplate: string }
  >;
  return Object.fromEntries(
    logEventKeys.map((key) => {
      const item =
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
          ? (source[key] as Record<string, unknown>)
          : {};
      const rawEmbedPages = Array.isArray(item.embedPages)
        ? JSON.stringify(item.embedPages, null, 2)
        : "[]";
      return [
        key,
        {
          enabled: item.enabled !== false,
          mode: item.mode === "embed" ? "embed" : "message",
          messageTemplate:
            typeof item.messageTemplate === "string"
              ? item.messageTemplate
              : defaults[key].messageTemplate,
          embedPagesJson: rawEmbedPages,
        },
      ];
    }),
  ) as Record<LogEventKey, LogEventDraft>;
}

function serializeLogEventDrafts(
  drafts: Record<LogEventKey, LogEventDraft>,
): string {
  const payload = Object.fromEntries(
    logEventKeys.map((key) => {
      const draft = drafts[key];
      let embedPages: unknown[] = [];
      if (draft.mode === "embed" && draft.embedPagesJson.trim()) {
        try {
          const parsed = JSON.parse(draft.embedPagesJson);
          embedPages = Array.isArray(parsed) ? parsed : [];
        } catch {
          embedPages = [];
        }
      }
      return [
        key,
        {
          enabled: draft.enabled,
          mode: draft.mode,
          messageTemplate: draft.messageTemplate,
          ...(draft.mode === "embed" ? { embedPages } : {}),
        },
      ];
    }),
  );
  return JSON.stringify(payload, null, 2);
}

function automationEmbedDraftFromJson(
  value: string,
  fallbackDescription: string,
): SimpleAutomationEmbedDraft {
  let page: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(value || "[]");
    page =
      Array.isArray(parsed) && parsed[0] && typeof parsed[0] === "object"
        ? (parsed[0] as Record<string, unknown>)
        : {};
  } catch {
    page = {};
  }
  const colorValue =
    typeof page.color === "number"
      ? `#${page.color.toString(16).padStart(6, "0")}`
      : typeof page.color === "string"
        ? page.color
        : "#2de2b3";
  return {
    title: typeof page.title === "string" ? page.title : "",
    description:
      typeof page.description === "string"
        ? page.description
        : fallbackDescription,
    color: /^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue : "#2de2b3",
    imageUrl: typeof page.imageUrl === "string" ? page.imageUrl : "",
    thumbnailUrl:
      typeof page.thumbnailUrl === "string" ? page.thumbnailUrl : "",
    footerText: typeof page.footerText === "string" ? page.footerText : "",
  };
}

function automationEmbedDraftToJson(draft: SimpleAutomationEmbedDraft): string {
  return JSON.stringify(
    [
      {
        title: draft.title,
        description: draft.description || " ",
        color: Number.parseInt(draft.color.replace("#", ""), 16),
        imageUrl: draft.imageUrl || undefined,
        thumbnailUrl: draft.thumbnailUrl || undefined,
        footerText: draft.footerText || undefined,
        fields: [],
      },
    ],
    null,
    2,
  );
}

function AutomationEmbedControls({
  value,
  fallbackDescription,
  onChange,
}: {
  value: string;
  fallbackDescription: string;
  onChange: (value: string) => void;
}) {
  const draft = automationEmbedDraftFromJson(value, fallbackDescription);
  const update = (patch: Partial<SimpleAutomationEmbedDraft>) =>
    onChange(automationEmbedDraftToJson({ ...draft, ...patch }));
  return (
    <div className="serverAutomationEmbedControls">
      <div className="serverAutomationEmbedGrid">
        <label className="serverSettingsField">
          <span>{i18nText("Titre")}</span>
          <Input
            value={draft.title}
            maxLength={256}
            onChange={(event) => update({ title: event.target.value })}
          />
        </label>
        <label className="serverSettingsField">
          <span>{i18nText("Couleur")}</span>
          <Input
            type="color"
            value={draft.color}
            onChange={(event) => update({ color: event.target.value })}
          />
        </label>
      </div>
      <label className="serverSettingsField">
        <span>{i18nText("Description embed")}</span>
        <Textarea
          rows={5}
          value={draft.description}
          maxLength={4096}
          onChange={(event) => update({ description: event.target.value })}
        />
      </label>
      <div className="serverAutomationEmbedGrid">
        <label className="serverSettingsField">
          <span>{i18nText("Image URL")}</span>
          <Input
            value={draft.imageUrl}
            onChange={(event) => update({ imageUrl: event.target.value })}
            placeholder={i18nText("https://... ou variable")}
          />
        </label>
        <label className="serverSettingsField">
          <span>{i18nText("Thumbnail URL")}</span>
          <Input
            value={draft.thumbnailUrl}
            onChange={(event) => update({ thumbnailUrl: event.target.value })}
            placeholder={i18nText("https://... ou variable")}
          />
        </label>
      </div>
      <label className="serverSettingsField">
        <span>{i18nText("Footer")}</span>
        <Input
          value={draft.footerText}
          maxLength={2048}
          onChange={(event) => update({ footerText: event.target.value })}
        />
      </label>
    </div>
  );
}

function AutomationChannelSelect({
  value,
  channels,
  disabled,
  labels,
  onChange,
}: {
  value: string;
  channels: ChannelSummary[];
  disabled: boolean;
  labels: ServerSettingsText;
  onChange: (value: string) => void;
}) {
  return (
    <label className="serverSettingsField automationChannelField">
      <span className="srOnly">{labels.selectChannelSr}</span>
      <Select
        value={value}
        disabled={disabled || channels.length === 0}
        onChange={(event) => onChange(event.target.value)}
        aria-label={labels.selectChannelPlaceholder}
      >
        <option value="">{labels.selectChannelPlaceholder}</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function AutomationMessageCard({
  title,
  description,
  draft,
  active,
  channels,
  botId,
  readOnly,
  onChange,
  onTest,
  testDisabled,
  labels,
}: {
  title: string;
  description: string;
  draft: AutomationMessageDraft;
  active: boolean;
  channels: ChannelSummary[];
  botId: string | null;
  readOnly: boolean;
  onChange: (draft: AutomationMessageDraft) => void;
  onTest: () => void;
  testDisabled: boolean;
  labels: ServerSettingsText;
}) {
  const disabled = !botId || readOnly;
  return (
    <Card
      as="article"
      className="serverAutomationCard serverAutomationSettingRow"
    >
      <div className="serverAutomationCardHeader serverAutomationSettingCopy">
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
        <span className={active ? "isActive" : ""}>
          {active ? labels.active : labels.inactive}
        </span>
      </div>
      <div className="serverAutomationSettingControls">
        <AutomationChannelSelect
          value={draft.channelId}
          channels={channels}
          disabled={disabled}
          labels={labels}
          onChange={(channelId) => onChange({ ...draft, channelId })}
        />
        <Button
          variant="unstyled"
          type="button"
          className="iconButton automationTestButton"
          disabled={!botId || readOnly || testDisabled}
          onClick={onTest}
          aria-label={labels.testAutomation(title)}
          title={
            readOnly
              ? labels.readOnlyModeActionBlocked
              : testDisabled
                ? labels.saveFirstAutomation
                : labels.testAutomation(title)
          }
        >
          <TestAutomationIcon />
        </Button>
      </div>
    </Card>
  );
}

function AutomationLogsCard({
  draft,
  active,
  channels,
  botId,
  readOnly,
  onChange,
  onTest,
  testDisabled,
  labels,
}: {
  draft: AutomationLogsDraft;
  active: boolean;
  channels: ChannelSummary[];
  botId: string | null;
  readOnly: boolean;
  onChange: (draft: AutomationLogsDraft) => void;
  onTest: () => void;
  testDisabled: boolean;
  labels: ServerSettingsText;
}) {
  const disabled = !botId || readOnly;
  return (
    <Card
      as="article"
      className="serverAutomationCard serverAutomationSettingRow"
    >
      <div className="serverAutomationCardHeader serverAutomationSettingCopy">
        <div>
          <h4>{labels.logsChannelTitle}</h4>
          <p>{labels.logsChannelDescription}</p>
        </div>
        <span className={active ? "isActive" : ""}>
          {active ? labels.active : labels.inactive}
        </span>
      </div>
      <div className="serverAutomationSettingControls">
        <AutomationChannelSelect
          value={draft.channelId}
          channels={channels}
          disabled={disabled}
          labels={labels}
          onChange={(channelId) => onChange({ ...draft, channelId })}
        />
        <Button
          variant="unstyled"
          type="button"
          className="iconButton automationTestButton"
          disabled={!botId || readOnly || testDisabled}
          onClick={onTest}
          aria-label={labels.testLogs}
          title={
            readOnly
              ? labels.readOnlyModeActionBlocked
              : testDisabled
                ? labels.saveFirstAutomation
                : labels.testLogs
          }
        >
          <TestAutomationIcon />
        </Button>
      </div>
    </Card>
  );
}

function RoleAutomationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M3.5 20.5a5.5 5.5 0 0 1 11 0" />
      <path d="M17 7.5h4" />
      <path d="M19 5.5v4" />
      <path d="M16.5 14.5h5" />
      <path d="M16.5 18h5" />
    </svg>
  );
}

function roleName(
  roles: RoleSummary[],
  roleId: string,
  labels: ServerSettingsText,
): string {
  return (
    roles.find((role) => role.id === roleId)?.name ??
    (roleId ? labels.roleIdFallback(roleId) : labels.noRole)
  );
}

function RoleAutomationCard({
  rules,
  savedRules,
  roles,
  botId,
  readOnly,
  labels,
  onAdd,
  onEdit,
  onDelete,
  onSync,
  onTest,
}: {
  rules: RoleAutomationDraftRule[];
  savedRules: RoleAutomationDraftRule[];
  roles: RoleSummary[];
  botId: string | null;
  readOnly: boolean;
  labels: ServerSettingsText;
  onAdd: () => void;
  onEdit: (rule: RoleAutomationDraftRule, index: number) => void;
  onDelete: (index: number) => void;
  onSync: () => void;
  onTest: () => void;
}) {
  const activeCount = savedRules.filter((rule) => rule.enabled).length;
  const disabled = !botId || readOnly;
  return (
    <Card
      as="article"
      className="serverAutomationCard serverRoleAutomationCard"
    >
      <div className="serverAutomationCardHeader serverAutomationSettingCopy">
        <div>
          <h4>{labels.roleAutomationTitle}</h4>
          <p>{labels.roleAutomationDescription}</p>
        </div>
        <span className={activeCount ? "isActive" : ""}>
          {activeCount ? labels.activeCount(activeCount) : labels.inactive}
        </span>
      </div>
      <div className="serverRoleAutomationToolbar">
        <Button
          variant="unstyled"
          type="button"
          className="secondary"
          disabled={disabled}
          onClick={onAdd}
          title={readOnly ? labels.readOnlyModeActionBlocked : undefined}
        >
          <RoleAutomationIcon /> {labels.add}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          className="iconButton automationTestButton"
          disabled={disabled || !savedRules.length}
          onClick={onTest}
          aria-label={labels.testRoleAutomation}
          title={
            readOnly
              ? labels.readOnlyModeActionBlocked
              : labels.testRoleAutomation
          }
        >
          <TestAutomationIcon />
        </Button>
        <Button
          variant="unstyled"
          type="button"
          className="secondary"
          disabled={disabled || !savedRules.length}
          onClick={onSync}
          title={readOnly ? labels.readOnlyModeActionBlocked : undefined}
        >
          {labels.sync}
        </Button>
      </div>
      <div className="serverRoleAutomationList">
        {rules.length ? (
          rules.map((rule, index) => (
            <div className="serverRoleAutomationRow" key={rule.id}>
              <div>
                <strong>@{roleName(roles, rule.roleId, labels)}</strong>
                <span>
                  {roleAutomationConditionText(rule, labels)} ·{" "}
                  {rule.conditionMode === "any"
                    ? labels.oneConditionEnough
                    : labels.allConditionsRequired}
                </span>
              </div>
              <Badge
                as="small"
                className={rule.enabled ? "discordSettingsBadge" : "discordMutedBadge"}
                tone="unstyled"
              >
                {rule.enabled ? labels.active : labels.inactive}
              </Badge>
              <Button
                variant="unstyled"
                type="button"
                className="iconButton automationEditButton"
                disabled={disabled}
                onClick={() => onEdit(rule, index)}
                aria-label={labels.editRule}
                title={
                  readOnly ? labels.readOnlyModeActionBlocked : labels.editRule
                }
              >
                <EditAutomationIcon />
              </Button>
              <Button
                variant="unstyled"
                type="button"
                className="iconButton dangerIconButton"
                disabled={disabled}
                onClick={() => onDelete(index)}
                aria-label={labels.deleteRule}
                title={
                  readOnly
                    ? labels.readOnlyModeActionBlocked
                    : labels.deleteRule
                }
              >
                ×
              </Button>
            </div>
          ))
        ) : (
          <div className="serverRoleAutomationEmpty">{labels.noRoleRule}</div>
        )}
      </div>
    </Card>
  );
}

function RoleAutomationEditorModal({
  target,
  roles,
  labels,
  text,
  onSave,
  onClose,
}: {
  target: Exclude<RoleAutomationModalTarget, null>;
  roles: RoleSummary[];
  labels: ServerSettingsText;
  text: UiText;
  onSave: (rule: RoleAutomationDraftRule, index: number | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoleAutomationDraftRule>(
    () => target.rule ?? roleAutomationRuleDraft(null),
  );
  const update = (patch: Partial<RoleAutomationDraftRule>) =>
    setDraft((current) => ({ ...current, ...patch }));
  return createPortal(
    <Modal
      backdropClassName="modalBackdrop serverAutomationModalBackdrop"
      surfaceClassName="serverAutomationModal roleAutomationModal"
      aria-label={labels.roleAutomationDialog}
      onClose={onClose}
    >
        <header className="serverAutomationModalHeader">
          <div>
            <p className="eyebrow">{labels.serverAutomationEyebrow}</p>
            <h2>{labels.roleAutomationDialog}</h2>
            <span>{labels.roleAutomationHelp}</span>
          </div>
          <Button
            variant="unstyled"
            className="panelCloseButton"
            type="button"
            aria-label={text.close}
            onClick={onClose}
          >
            ×
          </Button>
        </header>
        <div className="serverAutomationModalBody roleAutomationModalBody">
          <div className="serverAutomationEmbedGrid">
            <label className="serverSettingsField">
              <span>{labels.roleToAssign}</span>
              <Select
                value={draft.roleId}
                onChange={(event) => update({ roleId: event.target.value })}
              >
                <option value="">{labels.selectRolePlaceholder}</option>
                {roles
                  .filter((role) => role.id !== role.guildId && !role.managed)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      @{role.name}
                    </option>
                  ))}
              </Select>
            </label>
            <label className="serverSettingsField">
              <span>{labels.mode}</span>
              <Select
                value={draft.conditionMode}
                onChange={(event) =>
                  update({
                    conditionMode: event.target.value === "any" ? "any" : "all",
                  })
                }
              >
                <option value="all">{labels.allConditions}</option>
                <option value="any">{labels.anyCondition}</option>
              </Select>
            </label>
          </div>
          <div className="serverAutomationEmbedGrid">
            <label className="serverSettingsField">
              <span>{labels.requiredMessages}</span>
              <Input
                inputMode="numeric"
                value={draft.minMessages}
                onChange={(event) =>
                  update({
                    minMessages: sanitizeRoleAutomationInput(
                      event.target.value,
                      ROLE_AUTOMATION_MAX_MESSAGES,
                    ),
                  })
                }
                placeholder={labels.disabledZero}
              />
            </label>
            <label className="serverSettingsField">
              <span>{labels.requiredVoiceMinutes}</span>
              <Input
                inputMode="numeric"
                value={draft.minVoiceMinutes}
                onChange={(event) =>
                  update({
                    minVoiceMinutes: sanitizeRoleAutomationInput(
                      event.target.value,
                      ROLE_AUTOMATION_MAX_VOICE_MINUTES,
                    ),
                  })
                }
                placeholder={labels.disabledZero}
              />
            </label>
            <label className="serverSettingsField">
              <span>{labels.memberAgeDays}</span>
              <Input
                inputMode="numeric"
                value={draft.minMemberAgeDays}
                onChange={(event) =>
                  update({
                    minMemberAgeDays: sanitizeRoleAutomationInput(
                      event.target.value,
                      ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS,
                    ),
                  })
                }
                placeholder={labels.joinZero}
              />
            </label>
          </div>
          <div className="roleAutomationToggles">
            <label>
              <Input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => update({ enabled: event.target.checked })}
              />{" "}
              <span>{labels.ruleEnabled}</span>
            </label>
            <label>
              <Input
                type="checkbox"
                checked={draft.applyToExistingMembers}
                onChange={(event) =>
                  update({ applyToExistingMembers: event.target.checked })
                }
              />{" "}
              <span>{labels.applyExistingMembers}</span>
            </label>
            <label>
              <Input
                type="checkbox"
                checked={draft.ignoreBots}
                onChange={(event) =>
                  update({ ignoreBots: event.target.checked })
                }
              />{" "}
              <span>{labels.ignoreBots}</span>
            </label>
            <label>
              <Input
                type="checkbox"
                checked={draft.removeWhenInvalid}
                onChange={(event) =>
                  update({ removeWhenInvalid: event.target.checked })
                }
              />{" "}
              <span>{labels.removeWhenInvalid}</span>
            </label>
          </div>
          <p className="commandFlowNote">{labels.roleAutomationNote}</p>
        </div>
        <footer className="serverAutomationModalFooter">
          <div />{" "}
          <div>
            <Button variant="unstyled" type="button" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button
              variant="unstyled"
              type="button"
              className="primary"
              disabled={!draft.roleId}
              onClick={() => {
                onSave(draft, target.index);
                onClose();
              }}
            >
              {text.save}
            </Button>
          </div>
        </footer>
    </Modal>,
    document.body,
  );
}

function AutomationEditorModal({
  target,
  welcomeDraft,
  goodbyeDraft,
  logsDraft,
  labels,
  text,
  onWelcomeChange,
  onGoodbyeChange,
  onLogsChange,
  onSave,
  onClose,
}: {
  target: Exclude<AutomationModalTarget, null>;
  welcomeDraft: AutomationMessageDraft;
  goodbyeDraft: AutomationMessageDraft;
  logsDraft: AutomationLogsDraft;
  labels: ServerSettingsText;
  text: UiText;
  onWelcomeChange: (draft: AutomationMessageDraft) => void;
  onGoodbyeChange: (draft: AutomationMessageDraft) => void;
  onLogsChange: (draft: AutomationLogsDraft) => void;
  onSave: (kind: GuildAutomationKind) => void;
  onClose: () => void;
}) {
  const [activeLogKey, setActiveLogKey] = useState<LogEventKey>("message_edit");
  const messageDraft =
    target.kind === "welcome"
      ? welcomeDraft
      : target.kind === "goodbye"
        ? goodbyeDraft
        : null;
  const updateMessageDraft =
    target.kind === "welcome" ? onWelcomeChange : onGoodbyeChange;
  const logDrafts = parseLogEventDrafts(logsDraft.eventConfigsJson);
  const updateLog = (key: LogEventKey, patch: Partial<LogEventDraft>) => {
    onLogsChange({
      ...logsDraft,
      eventConfigsJson: serializeLogEventDrafts({
        ...logDrafts,
        [key]: { ...logDrafts[key], ...patch },
      }),
    });
  };
  const activeLog = logDrafts[activeLogKey];
  const usefulVariables =
    target.kind === "logs"
      ? logEventVariables[activeLogKey]
      : welcomeGoodbyeVariables;
  return createPortal(
    <Modal
      backdropClassName="modalBackdrop serverAutomationModalBackdrop"
      surfaceClassName="serverAutomationModal"
      aria-label={target.title}
      onClose={onClose}
    >
        <header className="serverAutomationModalHeader">
          <div>
            <p className="eyebrow">{labels.serverAutomationEyebrow}</p>
            <h2>{target.title}</h2>
            <span>
              {target.kind === "logs"
                ? labels.customizeLogEvents
                : labels.customizeAutoMessage}
            </span>
          </div>
          <Button
            variant="unstyled"
            className="panelCloseButton"
            type="button"
            aria-label={text.close}
            onClick={onClose}
          >
            ×
          </Button>
        </header>
        <div className="serverAutomationModalBody">
          {messageDraft ? (
            <>
              <div
                className="serverAutomationModeSwitch"
                role="group"
                aria-label={labels.messageFormat}
              >
                <Button
                  variant="unstyled"
                  type="button"
                  className={
                    messageDraft.messageType === "message" ? "isSelected" : ""
                  }
                  onClick={() =>
                    updateMessageDraft({
                      ...messageDraft,
                      messageType: "message",
                    })
                  }
                >
                  {labels.simpleMessage}
                </Button>
                <Button
                  variant="unstyled"
                  type="button"
                  className={
                    messageDraft.messageType === "embed" ? "isSelected" : ""
                  }
                  onClick={() =>
                    updateMessageDraft({
                      ...messageDraft,
                      messageType: "embed",
                    })
                  }
                >
                  {labels.embed}
                </Button>
              </div>
              {messageDraft.messageType === "message" ? (
                <label className="serverSettingsField">
                  <span>
                    {target.kind === "welcome"
                      ? labels.welcomeMessage
                      : labels.goodbyeMessage}
                  </span>
                  <Textarea
                    rows={7}
                    value={messageDraft.messageTemplate}
                    onChange={(event) =>
                      updateMessageDraft({
                        ...messageDraft,
                        messageTemplate: event.target.value,
                      })
                    }
                  />
                </label>
              ) : (
                <SlashStudioEmbedEditor
                  value={messageDraft.embedPagesJson}
                  fallbackTitle={
                    target.kind === "welcome"
                      ? labels.fallbackWelcomeTitle
                      : labels.fallbackGoodbyeTitle
                  }
                  fallbackDescription={messageDraft.messageTemplate}
                  previewMode={target.kind}
                  onChange={(embedPagesJson) =>
                    updateMessageDraft({ ...messageDraft, embedPagesJson })
                  }
                />
              )}
            </>
          ) : (
            <div className="serverLogEditor">
              <nav className="serverLogEventTabs" aria-label={labels.logEvents}>
                {logEventKeys.map((key) => (
                  <Button
                    variant="unstyled"
                    key={key}
                    type="button"
                    className={activeLogKey === key ? "isActive" : ""}
                    onClick={() => setActiveLogKey(key)}
                  >
                    <span>{labels.logEventLabels[key]}</span>
                    <Badge as="small" tone="muted">
                      {logDrafts[key].enabled ? labels.active : labels.inactive}
                    </Badge>
                  </Button>
                ))}
              </nav>
              <div className="serverLogEventEditor">
                <div
                  className="serverAutomationModeSwitch"
                  role="group"
                  aria-label={labels.logStateFormat}
                >
                  <Button
                    variant="unstyled"
                    type="button"
                    className={activeLog.mode === "message" ? "isSelected" : ""}
                    onClick={() => updateLog(activeLogKey, { mode: "message" })}
                  >
                    {labels.message}
                  </Button>
                  <Button
                    variant="unstyled"
                    type="button"
                    className={activeLog.mode === "embed" ? "isSelected" : ""}
                    onClick={() => updateLog(activeLogKey, { mode: "embed" })}
                  >
                    {labels.embed}
                  </Button>
                </div>
                {activeLog.mode === "message" ? (
                  <label className="serverSettingsField">
                    <span>{labels.logEventText}</span>
                    <Textarea
                      rows={7}
                      value={activeLog.messageTemplate}
                      onChange={(event) =>
                        updateLog(activeLogKey, {
                          messageTemplate: event.target.value,
                        })
                      }
                    />
                  </label>
                ) : (
                  <SlashStudioEmbedEditor
                    value={activeLog.embedPagesJson}
                    fallbackTitle={labels.logEventLabels[activeLogKey]}
                    fallbackDescription={activeLog.messageTemplate}
                    previewMode="logs"
                    onChange={(embedPagesJson) =>
                      updateLog(activeLogKey, { embedPagesJson })
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>
        <footer className="serverAutomationModalFooter">
          <AutomationVariableChips
            variables={usefulVariables}
            labels={labels}
          />
          <div>
            <Button variant="unstyled" type="button" onClick={onClose}>
              {text.cancel}
            </Button>
            <Button
              variant="unstyled"
              type="button"
              className="primary"
              onClick={() => {
                onSave(target.kind);
                onClose();
              }}
            >
              {text.save}
            </Button>
          </div>
        </footer>
    </Modal>,
    document.body,
  );
}

function ServerTemplatesPanel({
  welcomeDraft,
  goodbyeDraft,
  logsDraft,
  labels,
  readOnly,
  onWelcomeChange,
  onGoodbyeChange,
  onLogsChange,
  onToast,
}: {
  welcomeDraft: AutomationMessageDraft;
  goodbyeDraft: AutomationMessageDraft;
  logsDraft: AutomationLogsDraft;
  labels: ServerSettingsText;
  readOnly: boolean;
  onWelcomeChange: (draft: AutomationMessageDraft) => void;
  onGoodbyeChange: (draft: AutomationMessageDraft) => void;
  onLogsChange: (draft: AutomationLogsDraft) => void;
  onToast: (message: string, tone?: AppToast["tone"]) => void;
}) {
  type TemplateId = "welcome" | "goodbye" | LogEventKey;
  const [activeTemplateId, setActiveTemplateId] =
    useState<TemplateId>("welcome");
  const [templateQuery, setTemplateQuery] = useState("");
  const logDrafts = parseLogEventDrafts(logsDraft.eventConfigsJson);
  const updateLog = (key: LogEventKey, patch: Partial<LogEventDraft>) => {
    if (readOnly) return;
    onLogsChange({
      ...logsDraft,
      eventConfigsJson: serializeLogEventDrafts({
        ...logDrafts,
        [key]: { ...logDrafts[key], ...patch },
      }),
    });
  };
  const logTemplateMeta = (key: LogEventKey) => {
    if (key === "channel_recreate_purge")
      return {
        description: labels.templatesPurgeDescription,
        tag: labels.templatesTagLogs,
      };
    if (key.startsWith("message_"))
      return {
        description: labels.templatesMessageLogDescription,
        tag: labels.templatesTagLogs,
      };
    if (key.startsWith("channel_"))
      return {
        description: labels.templatesChannelLogDescription,
        tag: labels.templatesTagLogs,
      };
    return {
      description: labels.templatesModerationLogDescription,
      tag: labels.templatesTagLogs,
    };
  };
  const templateItems = useMemo(
    () => [
      {
        id: "welcome" as const,
        title: labels.welcomeMessage,
        description: labels.templatesWelcomeDescription,
        tag: labels.templatesTagWelcome,
        isLog: false,
        enabled: Boolean(welcomeDraft.channelId),
        mode:
          welcomeDraft.messageType === "embed"
            ? labels.embed
            : labels.simpleMessage,
      },
      {
        id: "goodbye" as const,
        title: labels.goodbyeMessage,
        description: labels.templatesGoodbyeDescription,
        tag: labels.templatesTagGoodbye,
        isLog: false,
        enabled: Boolean(goodbyeDraft.channelId),
        mode:
          goodbyeDraft.messageType === "embed"
            ? labels.embed
            : labels.simpleMessage,
      },
      ...logEventKeys.map((key) => {
        const meta = logTemplateMeta(key);
        return {
          id: key,
          title: labels.logEventLabels[key],
          description: meta.description,
          tag: meta.tag,
          isLog: true,
          enabled: logDrafts[key].enabled,
          mode: logDrafts[key].mode === "embed" ? labels.embed : labels.message,
        };
      }),
    ],
    [
      goodbyeDraft.channelId,
      goodbyeDraft.messageType,
      labels,
      logDrafts,
      welcomeDraft.channelId,
      welcomeDraft.messageType,
    ],
  );
  const filteredTemplateItems = useMemo(() => {
    const query = templateQuery.trim().toLocaleLowerCase();
    if (!query) return templateItems;
    return templateItems.filter((item) =>
      [item.title, item.description, item.tag, item.mode]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [templateItems, templateQuery]);
  const activeItem =
    templateItems.find((item) => item.id === activeTemplateId) ??
    templateItems[0];
  const isAutoMessage =
    activeTemplateId === "welcome" || activeTemplateId === "goodbye";
  const messageDraft =
    activeTemplateId === "welcome" ? welcomeDraft : goodbyeDraft;
  const updateMessageDraft =
    activeTemplateId === "welcome" ? onWelcomeChange : onGoodbyeChange;
  const activeLogKey = isAutoMessage ? null : (activeTemplateId as LogEventKey);
  const activeLog = activeLogKey ? logDrafts[activeLogKey] : null;
  const usefulVariables = activeLogKey
    ? logEventVariables[activeLogKey]
    : welcomeGoodbyeVariables;
  const templateImportInputRef = useRef<HTMLInputElement | null>(null);
  const templateImportTargetRef = useRef<TemplateId | "all">("all");
  const triggerTemplateImport = (target: TemplateId | "all") => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    templateImportTargetRef.current = target;
    templateImportInputRef.current?.click();
  };
  const templatePayload = (id: TemplateId): TemplateExportInput => {
    if (id === "welcome") {
      return {
        templateType: "welcome",
        name: labels.templatesWelcomeExportName,
        payload: {
          messageType: welcomeDraft.messageType,
          messageTemplate: welcomeDraft.messageTemplate,
          embedPagesJson: welcomeDraft.embedPagesJson,
        },
      };
    }
    if (id === "goodbye") {
      return {
        templateType: "goodbye",
        name: labels.templatesGoodbyeExportName,
        payload: {
          messageType: goodbyeDraft.messageType,
          messageTemplate: goodbyeDraft.messageTemplate,
          embedPagesJson: goodbyeDraft.embedPagesJson,
        },
      };
    }
    const log = logDrafts[id];
    return {
      templateType: "log",
      name: labels.templatesLogExportName(labels.logEventLabels[id]),
      payload: {
        logEventKey: id,
        enabled: log.enabled,
        mode: log.mode,
        messageTemplate: log.messageTemplate,
        embedPagesJson: log.embedPagesJson,
      },
    };
  };
  const exportTemplate = (id: TemplateId) => {
    const template = templatePayload(id);
    const pkg = buildBotdeckPackage({
      kind: "template",
      name: template.name,
      items: [templateToPackageItem(template)],
    });
    downloadJsonPackage(
      pkg,
      `botdeck-template-${safePackageName(template.name, "template")}.botdeck.json`,
    );
  };
  const exportAllTemplates = () => {
    const templates = ["welcome", "goodbye", ...logEventKeys] as TemplateId[];
    const pkg = buildBotdeckPackage({
      kind: "templates",
      name: labels.templatesPackName,
      items: templates.map((id) => templateToPackageItem(templatePayload(id))),
    });
    downloadJsonPackage(pkg, "botdeck-templates-pack.botdeck.json");
  };
  const stringPayload = (
    payload: Record<string, unknown>,
    key: string,
    fallback = "",
  ) => (typeof payload[key] === "string" ? String(payload[key]) : fallback);
  const templateMatchesTarget = (
    template: TemplateExportInput,
    target: TemplateId,
  ) => {
    if (target === "welcome" || target === "goodbye")
      return template.templateType === target;
    return (
      template.templateType === "log" &&
      stringPayload(template.payload, "logEventKey") === target
    );
  };
  const applyImportedTemplate = (template: TemplateExportInput) => {
    if (readOnly) return false;
    const payload = template.payload;
    if (template.templateType === "welcome") {
      onWelcomeChange({
        ...welcomeDraft,
        messageType: payload.messageType === "embed" ? "embed" : "message",
        messageTemplate: stringPayload(
          payload,
          "messageTemplate",
          defaultWelcomeTemplate,
        ),
        embedPagesJson: stringPayload(payload, "embedPagesJson", "[]"),
      });
      return true;
    }
    if (template.templateType === "goodbye") {
      onGoodbyeChange({
        ...goodbyeDraft,
        messageType: payload.messageType === "embed" ? "embed" : "message",
        messageTemplate: stringPayload(
          payload,
          "messageTemplate",
          defaultGoodbyeTemplate,
        ),
        embedPagesJson: stringPayload(payload, "embedPagesJson", "[]"),
      });
      return true;
    }
    if (template.templateType === "log") {
      const key = stringPayload(payload, "logEventKey");
      if (!logEventKeys.includes(key as LogEventKey)) return false;
      updateLog(key as LogEventKey, {
        enabled: payload.enabled !== false,
        mode: payload.mode === "embed" ? "embed" : "message",
        messageTemplate: stringPayload(payload, "messageTemplate"),
        embedPagesJson: stringPayload(payload, "embedPagesJson", "[]"),
      });
      return true;
    }
    return false;
  };
  const applyImportedTemplateToTarget = (
    template: TemplateExportInput,
    target: TemplateId,
  ) => {
    if (readOnly) return false;
    const payload = template.payload;
    const nextMode =
      payload.messageType === "embed" || payload.mode === "embed"
        ? "embed"
        : "message";
    if (target === "welcome") {
      onWelcomeChange({
        ...welcomeDraft,
        messageType: nextMode,
        messageTemplate: stringPayload(
          payload,
          "messageTemplate",
          welcomeDraft.messageTemplate || defaultWelcomeTemplate,
        ),
        embedPagesJson: stringPayload(
          payload,
          "embedPagesJson",
          welcomeDraft.embedPagesJson || "[]",
        ),
      });
      return true;
    }
    if (target === "goodbye") {
      onGoodbyeChange({
        ...goodbyeDraft,
        messageType: nextMode,
        messageTemplate: stringPayload(
          payload,
          "messageTemplate",
          goodbyeDraft.messageTemplate || defaultGoodbyeTemplate,
        ),
        embedPagesJson: stringPayload(
          payload,
          "embedPagesJson",
          goodbyeDraft.embedPagesJson || "[]",
        ),
      });
      return true;
    }
    const currentLog = logDrafts[target];
    updateLog(target, {
      enabled:
        typeof payload.enabled === "boolean"
          ? payload.enabled
          : currentLog.enabled,
      mode: nextMode,
      messageTemplate: stringPayload(
        payload,
        "messageTemplate",
        currentLog.messageTemplate,
      ),
      embedPagesJson: stringPayload(
        payload,
        "embedPagesJson",
        currentLog.embedPagesJson || "[]",
      ),
    });
    return true;
  };
  const handleTemplatePackageImport = async (file: File) => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    const importTarget = templateImportTargetRef.current;
    try {
      const parsed = parseJsonFileContent(await readTextFile(file));
      const { package: pkg, validation } = parseBotdeckPackage(parsed);
      if (!pkg || !validation.valid) {
        window.alert(labels.templatesImportInvalidPackage);
        return;
      }
      const templates = pkg.items
        .filter((item) => item.kind === "template")
        .map((item) => ({
          templateType: item.templateType,
          name: item.name,
          payload: item.payload,
        }));
      if (!templates.length) {
        window.alert(labels.templatesImportNoTemplates);
        return;
      }
      if (importTarget !== "all") {
        const selectedTemplate =
          templates.find((template) =>
            templateMatchesTarget(template, importTarget),
          ) ?? (templates.length === 1 ? templates[0] : null);
        if (!selectedTemplate) {
          window.alert(labels.templatesImportNoCompatibleTemplate);
          return;
        }
        if (applyImportedTemplateToTarget(selectedTemplate, importTarget)) {
          onToast(labels.templatesImportSingleSuccess, "success");
        }
        return;
      }
      if (
        templates.length > 1 &&
        !window.confirm(labels.templatesImportConfirmAll(templates.length))
      )
        return;
      const applied = templates.filter(applyImportedTemplate).length;
      onToast(labels.templatesImportSuccess(applied), "success");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : labels.templatesImportError,
      );
    } finally {
      templateImportTargetRef.current = "all";
      if (templateImportInputRef.current)
        templateImportInputRef.current.value = "";
    }
  };
  return (
    <Panel className="serverSettingsFormSurface serverTemplatesPanel">
      <div className="discordSettingsBlockHeader">
        <h3>{labels.templatesTitle}</h3>
        <p>{labels.templatesHelp}</p>
      </div>
      {readOnly ? (
        <section className="discordSettingsBlock serverSettingsReadOnlyNotice">
          <div className="discordSettingsBlockHeader">
            <h3>{labels.readOnlyModeTitle}</h3>
            <p>{labels.readOnlyModeHelp}</p>
          </div>
        </section>
      ) : null}

      <section className="discordSettingsBlock serverTemplateBlock">
        <div className="serverTemplateListHeader">
          <div className="discordSettingsBlockHeader">
            <h3>{labels.templatesAllMessages}</h3>
          </div>
          <label
            className="serverTemplateSearch"
            aria-label={labels.templatesSearch}
          >
            <Input
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
              placeholder={labels.templatesSearchPlaceholder}
            />
          </label>
          <div className="serverTemplateImportExport">
            <Button
              variant="unstyled"
              type="button"
              disabled={readOnly}
              onClick={() => triggerTemplateImport("all")}
              title={readOnly ? labels.readOnlyModeActionBlocked : undefined}
            >
              {i18nText("Import")}
            </Button>
            <Button
              variant="unstyled"
              type="button"
              onClick={exportAllTemplates}
            >
              {i18nText("Export all")}
            </Button>
            <Input
              ref={templateImportInputRef}
              type="file"
              accept=".json,.botdeck.json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleTemplatePackageImport(file);
              }}
            />
          </div>
        </div>
        <div
          className="serverTemplateList"
          role="listbox"
          aria-label={labels.templatesAllMessages}
        >
          {filteredTemplateItems.map((item) => (
            <Button
              variant="unstyled"
              key={item.id}
              type="button"
              className={`${item.id === activeTemplateId ? "isActive" : ""}${item.isLog ? " isLogTemplate" : ""}`}
              onClick={() => setActiveTemplateId(item.id)}
              title={`${item.title} — ${item.description}`}
            >
              <Badge className="serverTemplateTag" tone="unstyled">{item.tag}</Badge>
              <span className="serverTemplateCardMain">
                <strong>{item.title}</strong>
              </span>
              {item.isLog ? (
                <span
                  className={
                    item.enabled
                      ? "serverTemplateInlineSwitch isOn"
                      : "serverTemplateInlineSwitch"
                  }
                  role="switch"
                  aria-checked={item.enabled}
                  tabIndex={readOnly ? -1 : 0}
                  aria-disabled={readOnly}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (readOnly) return;
                    updateLog(item.id as LogEventKey, {
                      enabled: !item.enabled,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (readOnly) return;
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    updateLog(item.id as LogEventKey, {
                      enabled: !item.enabled,
                    });
                  }}
                  aria-label={
                    item.enabled
                      ? labels.templatesDisableLog
                      : labels.templatesEnableLog
                  }
                >
                  <span />
                </span>
              ) : null}
            </Button>
          ))}
          {filteredTemplateItems.length === 0 ? (
            <p className="serverTemplateEmpty">{labels.templatesNoResults}</p>
          ) : null}
        </div>
      </section>

      <Section className="discordSettingsBlock serverTemplateEditorBlock">
        <div className="discordSettingsBlockHeader">
          <h3>{activeItem.title}</h3>
          <p>{activeItem.description}</p>
          <div
            className="serverTemplateEditorActions"
            aria-label={labels.templatesTemplateActions}
          >
            <Button
              variant="unstyled"
              type="button"
              className="serverTemplateEditorIconButton"
              disabled={readOnly}
              onClick={() => triggerTemplateImport(activeTemplateId)}
              aria-label={labels.templatesImportTemplate}
              title={
                readOnly
                  ? labels.readOnlyModeActionBlocked
                  : labels.templatesImportTemplate
              }
            >
              <ImportTemplateIcon />
            </Button>
            <Button
              variant="unstyled"
              type="button"
              className="serverTemplateEditorIconButton"
              onClick={() => exportTemplate(activeTemplateId)}
              aria-label={labels.templatesExportTemplate}
              title={labels.templatesExportTemplate}
            >
              <ExportTemplateIcon />
            </Button>
          </div>
        </div>
        <fieldset
          className="serverSettingsReadonlyFieldset"
          disabled={readOnly}
        >
          <Card className="discordSettingsPanel serverTemplateEditorPanel">
            {isAutoMessage ? (
              <>
                <div
                  className="serverAutomationModeSwitch"
                  role="group"
                  aria-label={labels.messageFormat}
                >
                  <Button
                    variant="unstyled"
                    type="button"
                    className={
                      messageDraft.messageType === "message" ? "isSelected" : ""
                    }
                    onClick={() =>
                      !readOnly &&
                      updateMessageDraft({
                        ...messageDraft,
                        messageType: "message",
                      })
                    }
                  >
                    {labels.simpleMessage}
                  </Button>
                  <Button
                    variant="unstyled"
                    type="button"
                    className={
                      messageDraft.messageType === "embed" ? "isSelected" : ""
                    }
                    onClick={() =>
                      !readOnly &&
                      updateMessageDraft({
                        ...messageDraft,
                        messageType: "embed",
                      })
                    }
                  >
                    {labels.embed}
                  </Button>
                </div>
                {messageDraft.messageType === "message" ? (
                  <label className="serverSettingsField">
                    <span>{activeItem.title}</span>
                    <Textarea
                      rows={7}
                      value={messageDraft.messageTemplate}
                      readOnly={readOnly}
                      onChange={(event) =>
                        !readOnly &&
                        updateMessageDraft({
                          ...messageDraft,
                          messageTemplate: event.target.value,
                        })
                      }
                    />
                  </label>
                ) : (
                  <SlashStudioEmbedEditor
                    value={messageDraft.embedPagesJson}
                    fallbackTitle={
                      activeTemplateId === "welcome"
                        ? labels.fallbackWelcomeTitle
                        : labels.fallbackGoodbyeTitle
                    }
                    fallbackDescription={messageDraft.messageTemplate}
                    previewMode={
                      activeTemplateId === "welcome" ? "welcome" : "goodbye"
                    }
                    onChange={(embedPagesJson) =>
                      !readOnly &&
                      updateMessageDraft({ ...messageDraft, embedPagesJson })
                    }
                  />
                )}
              </>
            ) : activeLog && activeLogKey ? (
              <>
                <div
                  className="serverAutomationModeSwitch"
                  role="group"
                  aria-label={labels.logStateFormat}
                >
                  <Button
                    variant="unstyled"
                    type="button"
                    className={activeLog.mode === "message" ? "isSelected" : ""}
                    onClick={() => updateLog(activeLogKey, { mode: "message" })}
                  >
                    {labels.message}
                  </Button>
                  <Button
                    variant="unstyled"
                    type="button"
                    className={activeLog.mode === "embed" ? "isSelected" : ""}
                    onClick={() => updateLog(activeLogKey, { mode: "embed" })}
                  >
                    {labels.embed}
                  </Button>
                </div>
                {activeLog.mode === "message" ? (
                  <label className="serverSettingsField">
                    <span>{labels.logEventText}</span>
                    <Textarea
                      rows={7}
                      value={activeLog.messageTemplate}
                      readOnly={readOnly}
                      onChange={(event) =>
                        updateLog(activeLogKey, {
                          messageTemplate: event.target.value,
                        })
                      }
                    />
                  </label>
                ) : (
                  <SlashStudioEmbedEditor
                    value={activeLog.embedPagesJson}
                    fallbackTitle={labels.logEventLabels[activeLogKey]}
                    fallbackDescription={activeLog.messageTemplate}
                    previewMode="logs"
                    onChange={(embedPagesJson) =>
                      updateLog(activeLogKey, { embedPagesJson })
                    }
                  />
                )}
              </>
            ) : null}
          </Card>
        </fieldset>
      </Section>

      <Section className="discordSettingsBlock serverTemplateVariablesBlock">
        <AutomationVariableChips variables={usefulVariables} labels={labels} />
        <p className="serverTemplateSaveHint">{labels.templatesSaveHint}</p>
      </Section>
    </Panel>
  );
}

const SERVER_MEMBERS_PAGE_SIZE = 24;

type MemberSortKey = "displayName" | "joinedAt" | "roles";
type SortDirection = "asc" | "desc";

type MemberRolePickerState = {
  userId: string;
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function memberDisplayName(member: GuildMemberSummary): string {
  return (member.displayName?.trim() || member.username?.trim() || member.userId).trim();
}

function roleDisplayName(role: RoleSummary, labels: ServerSettingsText): string {
  return role.name?.trim() || labels.roleIdFallback(role.id);
}

function roleColorValue(role: RoleSummary): string {
  return role.colorHex ?? (role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "rgba(255,255,255,0.16)");
}

function memberRoleSummaries(
  member: GuildMemberSummary,
  roles: RoleSummary[],
): RoleSummary[] {
  const memberRoleIds = new Set(member.roleIds);
  return roles
    .filter((role) => role.id !== member.guildId && memberRoleIds.has(role.id))
    .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

function memberAvailableRoles(
  member: GuildMemberSummary,
  roles: RoleSummary[],
): RoleSummary[] {
  const memberRoleIds = new Set(member.roleIds);
  return roles
    .filter((role) => role.id !== member.guildId && !role.managed && !memberRoleIds.has(role.id))
    .sort((left, right) => right.position - left.position || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

function memberSearchValue(
  member: GuildMemberSummary,
  roleNames: string[],
): string {
  return [
    memberDisplayName(member),
    member.username,
    member.userId,
    member.roleIds.join(" "),
    roleNames.join(" "),
    member.bot ? "app bot" : "user",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function formatMemberJoinedAt(value: string | null | undefined, labels: ServerSettingsText): string {
  if (!value) return labels.notLoaded;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return labels.notLoaded;
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function memberJoinedTime(member: GuildMemberSummary): number {
  if (!member.joinedAt) return 0;
  const joinedAt = new Date(member.joinedAt).getTime();
  return Number.isFinite(joinedAt) ? joinedAt : 0;
}

function compareMemberRows(
  left: GuildMemberSummary,
  right: GuildMemberSummary,
  sortKey: MemberSortKey,
  direction: SortDirection,
  roleById: Map<string, RoleSummary>,
): number {
  const directionMultiplier = direction === "asc" ? 1 : -1;
  let result = 0;
  if (sortKey === "displayName") {
    result = memberDisplayName(left).localeCompare(memberDisplayName(right), undefined, { sensitivity: "base" });
  } else if (sortKey === "joinedAt") {
    result = memberJoinedTime(left) - memberJoinedTime(right);
  } else {
    const leftRoles = left.roleIds.map((roleId) => roleById.get(roleId)?.name ?? roleId).join(" ");
    const rightRoles = right.roleIds.map((roleId) => roleById.get(roleId)?.name ?? roleId).join(" ");
    result = leftRoles.localeCompare(rightRoles, undefined, { sensitivity: "base" }) || left.roleIds.length - right.roleIds.length;
  }
  if (result === 0) {
    result = memberDisplayName(left).localeCompare(memberDisplayName(right), undefined, { sensitivity: "base" });
  }
  return result * directionMultiplier;
}

function visibleMemberPages(currentPage: number, pageCount: number): Array<number | "ellipsis-left" | "ellipsis-right"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set([1, pageCount]);
  for (let page = Math.max(2, currentPage - 2); page <= Math.min(pageCount - 1, currentPage + 2); page += 1) {
    pages.add(page);
  }
  const ordered = Array.from(pages).sort((left, right) => left - right);
  const result: Array<number | "ellipsis-left" | "ellipsis-right"> = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const page = ordered[index];
    const previous = ordered[index - 1];
    if (previous && page - previous > 1) {
      result.push(previous === 1 ? "ellipsis-left" : "ellipsis-right");
    }
    result.push(page);
  }
  return result;
}

function ServerMembersPanel({
  guildId,
  botId,
  members,
  roles,
  configuredMemberCount,
  readOnly,
  labels,
  onCommand,
  onToast,
  onOpenMemberContextMenu,
  overlayLayer,
}: {
  guildId: string;
  botId: string | null;
  members: GuildMemberSummary[];
  roles: RoleSummary[];
  configuredMemberCount: number;
  readOnly: boolean;
  labels: ServerSettingsText;
  onCommand: (command: ClientCommand) => void;
  onToast: (message: string, tone?: AppToast["tone"]) => void;
  onOpenMemberContextMenu?: (event: ReactMouseEvent<HTMLElement>, guildId: string, userId: string) => boolean;
  overlayLayer: number;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<MemberSortKey>("displayName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [rolePicker, setRolePicker] = useState<MemberRolePickerState | null>(null);
  const roleById = useMemo(
    () => new Map(roles.map((role) => [role.id, role])),
    [roles],
  );
  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visibleMembers = normalizedQuery
      ? members.filter((member) => {
          const roleNames = member.roleIds.map((roleId) => roleById.get(roleId)?.name ?? roleId);
          return memberSearchValue(member, roleNames).includes(normalizedQuery);
        })
      : members;
    return [...visibleMembers].sort((left, right) => compareMemberRows(left, right, sortKey, sortDirection, roleById));
  }, [members, query, roleById, sortDirection, sortKey]);
  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / SERVER_MEMBERS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageMembers = filteredMembers.slice(
    (safePage - 1) * SERVER_MEMBERS_PAGE_SIZE,
    safePage * SERVER_MEMBERS_PAGE_SIZE,
  );
  const pageNumbers = visibleMemberPages(safePage, pageCount);
  const canManageRoles = Boolean(botId) && !readOnly;

  useEffect(() => {
    setPage(1);
  }, [query, members.length, sortDirection, sortKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (rolePicker && !members.some((member) => member.userId === rolePicker.userId)) {
      setRolePicker(null);
    }
  }, [members, rolePicker]);

  useEffect(() => {
    if (!rolePicker) return;

    const closePicker = () => setRolePicker(null);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".serverMemberRolePicker") || target?.closest(".serverMemberRoleAdd")) return;
      closePicker();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePicker();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closePicker);
    window.addEventListener("scroll", closePicker, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closePicker);
      window.removeEventListener("scroll", closePicker, true);
    };
  }, [rolePicker]);

  const toggleSort = (nextSortKey: MemberSortKey) => {
    setSortKey((currentSortKey) => {
      if (currentSortKey !== nextSortKey) {
        setSortDirection(nextSortKey === "joinedAt" ? "desc" : "asc");
        return nextSortKey;
      }
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return currentSortKey;
    });
  };

  const sortLabel = (nextSortKey: MemberSortKey) => {
    if (sortKey !== nextSortKey) return labels.membersSortInactive;
    return sortDirection === "asc" ? labels.membersSortAscending : labels.membersSortDescending;
  };

  const sortIndicator = (nextSortKey: MemberSortKey) => {
    if (sortKey !== nextSortKey) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const changeMemberRole = (member: GuildMemberSummary, role: RoleSummary, action: "add" | "remove") => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) {
      onToast(labels.noActiveBot, "warning");
      return;
    }
    if (role.managed) return;
    onCommand({
      requestId: crypto.randomUUID(),
      botId,
      type: action === "add" ? "member.role.add" : "member.role.remove",
      guildId,
      userId: member.userId,
      roleId: role.id,
    } satisfies ClientCommand);
    setRolePicker(null);
    onToast(
      action === "add"
        ? labels.memberRoleAdding(roleDisplayName(role, labels), memberDisplayName(member))
        : labels.memberRoleRemoving(roleDisplayName(role, labels), memberDisplayName(member)),
      "info",
    );
  };

  const toggleMemberRolePicker = (member: GuildMemberSummary, anchor: HTMLButtonElement) => {
    if (!canManageRoles) return;
    setRolePicker((current) => {
      if (current?.userId === member.userId) return null;
      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(320, Math.max(240, window.innerWidth - viewportPadding * 2));
      const maxHeight = Math.min(280, Math.max(160, window.innerHeight - viewportPadding * 2));
      const maxLeft = Math.max(viewportPadding, window.innerWidth - width - viewportPadding);
      const left = Math.min(Math.max(viewportPadding, rect.right - width), maxLeft);
      const belowTop = rect.bottom + 8;
      const aboveTop = rect.top - maxHeight - 8;
      const top = belowTop + maxHeight <= window.innerHeight - viewportPadding
        ? belowTop
        : Math.max(viewportPadding, aboveTop);
      return { userId: member.userId, top, left, width, maxHeight };
    });
  };

  const rolePickerMember = rolePicker ? members.find((member) => member.userId === rolePicker.userId) ?? null : null;
  const rolePickerAvailableRoles = rolePickerMember ? memberAvailableRoles(rolePickerMember, roles) : [];

  const sortableHeader = (key: MemberSortKey, label: string) => (
    <Button variant="unstyled" type="button" className="serverMembersSortButton" onClick={() => toggleSort(key)} title={sortLabel(key)}>
      <span>{label}</span>
      <small aria-hidden="true">{sortIndicator(key)}</small>
    </Button>
  );

  return (
    <Panel className="serverSettingsFormSurface serverMembersPanel">
      <div className="discordSettingsBlockHeader">
        <h3>{labels.serverMembersTitle}</h3>
        <p>{labels.serverMembersHelp}</p>
      </div>

      <section className="serverMembersToolbar" aria-label={labels.membersSearchLabel}>
        <label className="serverSettingsField serverMembersSearchField">
          <span className="serverMembersSearchHeader">
            <span>{labels.membersSearchLabel}</span>
            <Badge as="small" tone="muted">
              {labels.membersResultSummary(filteredMembers.length, configuredMemberCount || members.length)}
            </Badge>
          </span>
          <Input
            type="search"
            value={query}
            placeholder={labels.membersSearchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </section>

      <section className="serverMembersListCard" aria-label={labels.serverMembersTitle}>
        {members.length === 0 ? (
          <p className="serverMembersEmpty">{labels.membersEmpty}</p>
        ) : pageMembers.length === 0 ? (
          <p className="serverMembersEmpty">{labels.membersNoResults}</p>
        ) : (
          <div className="serverMembersTable" role="table" aria-label={labels.serverMembersTitle}>
            <div className="serverMembersTableHeader" role="rowgroup">
              <div className="serverMembersTableRow serverMembersTableHeaderRow" role="row">
                <div
                  className="serverMembersTableHeadCell"
                  role="columnheader"
                  aria-sort={sortKey === "displayName" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  {sortableHeader("displayName", labels.memberColumnUsername)}
                </div>
                <div
                  className="serverMembersTableHeadCell"
                  role="columnheader"
                  aria-sort={sortKey === "joinedAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  {sortableHeader("joinedAt", labels.memberJoinedAt)}
                </div>
                <div
                  className="serverMembersTableHeadCell"
                  role="columnheader"
                  aria-sort={sortKey === "roles" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  {sortableHeader("roles", labels.memberRoles)}
                </div>
              </div>
            </div>

            <div className="serverMembersTableScroller" role="rowgroup">
              {pageMembers.map((member) => {
                const memberName = memberDisplayName(member);
                const memberRoles = memberRoleSummaries(member, roles);
                const pickerOpen = rolePicker?.userId === member.userId;
                return (
                  <div
                    className="serverMembersTableRow serverMemberTableRow"
                    key={member.userId}
                    role="row"
                    onContextMenu={(event: ReactMouseEvent<HTMLDivElement>) => {
                      onOpenMemberContextMenu?.(event, guildId, member.userId);
                    }}
                  >
                    <div className="serverMembersTableCell serverMemberPseudoCell" role="cell">
                      <strong>{memberName}</strong>
                      {member.bot ? (
                        <Badge as="small" tone="app" size="sm">
                          {labels.memberBotBadge}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="serverMembersTableCell" role="cell">
                      <span className="serverMemberJoinedValue">{formatMemberJoinedAt(member.joinedAt, labels)}</span>
                    </div>
                    <div className="serverMembersTableCell serverMemberRolesCell" role="cell">
                      <div className="serverMemberRolePills">
                        {memberRoles.length ? (
                          memberRoles.map((role) => {
                            const roleName = roleDisplayName(role, labels);
                            const roleDisabled = !canManageRoles || role.managed;
                            return (
                              <span
                                key={role.id}
                                className={`serverMemberRolePill${role.managed ? " isManaged" : ""}`}
                                style={{ "--role-color": roleColorValue(role) } as CSSProperties}
                              >
                                <span className="serverMemberRoleSwatch" aria-hidden="true" />
                                <span>{roleName}</span>
                                <Button
                                  variant="unstyled"
                                  type="button"
                                  className="serverMemberRoleRemove"
                                  disabled={roleDisabled}
                                  title={role.managed ? labels.memberManagedRole : labels.memberRemoveRole(roleName)}
                                  aria-label={labels.memberRemoveRole(roleName)}
                                  onClick={() => changeMemberRole(member, role, "remove")}
                                >
                                  ×
                                </Button>
                              </span>
                            );
                          })
                        ) : (
                          <span className="serverMemberNoRoles">{labels.memberNoRoles}</span>
                        )}
                        <Button
                          variant="unstyled"
                          type="button"
                          className="serverMemberRoleAdd"
                          disabled={!canManageRoles}
                          title={canManageRoles ? labels.memberAddRole : labels.readOnlyModeTooltip}
                          aria-haspopup="menu"
                          aria-expanded={pickerOpen}
                          aria-label={labels.memberAddRole}
                          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            toggleMemberRolePicker(member, event.currentTarget);
                          }}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {rolePicker && rolePickerMember && typeof document !== "undefined" ? createPortal(
        <div
          className="serverMemberRolePicker serverMemberRolePickerPortal"
          role="menu"
          style={{
            top: rolePicker.top,
            left: rolePicker.left,
            width: rolePicker.width,
            maxHeight: rolePicker.maxHeight,
            zIndex: overlayLayer,
          }}
        >
          {rolePickerAvailableRoles.length ? (
            rolePickerAvailableRoles.map((role) => {
              const roleName = roleDisplayName(role, labels);
              return (
                <Button
                  key={role.id}
                  variant="unstyled"
                  type="button"
                  role="menuitem"
                  style={{ "--role-color": roleColorValue(role) } as CSSProperties}
                  onClick={() => changeMemberRole(rolePickerMember, role, "add")}
                >
                  <span className="serverMemberRoleSwatch" aria-hidden="true" />
                  <span>{roleName}</span>
                </Button>
              );
            })
          ) : (
            <p>{labels.memberNoRoleToAdd}</p>
          )}
        </div>,
        document.body,
      ) : null}

      <nav className="serverMembersPagination" aria-label={labels.membersPageStatus(safePage, pageCount)}>
        <Button
          variant="unstyled"
          type="button"
          disabled={safePage <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          {labels.membersPreviousPage}
        </Button>
        <div className="serverMembersPageNumbers">
          {pageNumbers.map((pageNumber) =>
            typeof pageNumber === "number" ? (
              <Button
                key={pageNumber}
                variant="unstyled"
                type="button"
                className={pageNumber === safePage ? "isActive" : ""}
                aria-current={pageNumber === safePage ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            ) : (
              <span key={pageNumber}>…</span>
            ),
          )}
        </div>
        <Button
          variant="unstyled"
          type="button"
          disabled={safePage >= pageCount}
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
        >
          {labels.membersNextPage}
        </Button>
      </nav>
      <p className="serverMembersPageStatus">{labels.membersPageStatus(safePage, pageCount)}</p>
    </Panel>
  );
}


const SERVER_INVITES_PAGE_SIZE = 18;

type InviteSortKey = "code" | "channel" | "uses" | "expiresAt";

type InviteCreateDraft = {
  channelId: string;
  maxAge: string;
  maxUses: string;
  temporary: boolean;
  unique: boolean;
};

const inviteDurationOptions = [
  { value: "1800", labelKey: "inviteDuration30m" },
  { value: "3600", labelKey: "inviteDuration1h" },
  { value: "21600", labelKey: "inviteDuration6h" },
  { value: "43200", labelKey: "inviteDuration12h" },
  { value: "86400", labelKey: "inviteDuration1d" },
  { value: "604800", labelKey: "inviteDuration7d" },
  { value: "0", labelKey: "inviteDurationNever" },
] as const;

const inviteMaxUsesOptions = [
  { value: "0", labelKey: "inviteMaxUsesNone" },
  { value: "1", labelKey: "inviteMaxUsesOne" },
  { value: "5", labelKey: "inviteMaxUsesFive" },
  { value: "10", labelKey: "inviteMaxUsesTen" },
  { value: "25", labelKey: "inviteMaxUsesTwentyFive" },
  { value: "50", labelKey: "inviteMaxUsesFifty" },
  { value: "100", labelKey: "inviteMaxUsesHundred" },
] as const;

function inviteSearchValue(invite: GuildInviteSummary): string {
  return [
    invite.code,
    invite.url,
    invite.channelName,
    invite.channelId,
    invite.inviterName,
    invite.inviterId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function inviteTimestamp(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function formatInviteDate(value: string | null | undefined, labels: ServerSettingsText): string {
  if (!value) return labels.inviteNeverExpires;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return labels.inviteNeverExpires;
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function inviteUsesText(invite: GuildInviteSummary, labels: ServerSettingsText): string {
  const uses = invite.uses ?? 0;
  if (!invite.maxUses) return `${uses} / ${labels.inviteUnlimited}`;
  return `${uses} / ${invite.maxUses}`;
}

function compareInviteRows(
  left: GuildInviteSummary,
  right: GuildInviteSummary,
  sortKey: InviteSortKey,
  direction: SortDirection,
): number {
  const directionMultiplier = direction === "asc" ? 1 : -1;
  let result = 0;
  if (sortKey === "code") {
    result = left.code.localeCompare(right.code, undefined, { sensitivity: "base" });
  } else if (sortKey === "channel") {
    result = (left.channelName ?? "").localeCompare(right.channelName ?? "", undefined, { sensitivity: "base" });
  } else if (sortKey === "uses") {
    result = (left.uses ?? 0) - (right.uses ?? 0);
  } else {
    result = inviteTimestamp(left.expiresAt) - inviteTimestamp(right.expiresAt);
  }
  if (result === 0) result = left.code.localeCompare(right.code, undefined, { sensitivity: "base" });
  return result * directionMultiplier;
}

function channelCanCreateInvite(channel: ChannelSummary): boolean {
  if (channel.type === "category" || channel.type === "thread" || channel.type === "dm") return false;
  return channel.permissions?.createInstantInvite !== false;
}

function inviteChannelLabel(channel: ChannelSummary): string {
  const prefix = channel.type === "voice" ? "🔊" : channel.type === "forum" ? "▣" : "#";
  return `${prefix} ${channel.name}`;
}

function ServerInviteCreateModal({
  draft,
  channels,
  labels,
  text,
  onChange,
  onClose,
  onCreate,
}: {
  draft: InviteCreateDraft;
  channels: ChannelSummary[];
  labels: ServerSettingsText;
  text: UiText;
  onChange: (draft: InviteCreateDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Modal surfaceClassName="botModal actionConfirmModal serverInviteCreateModal" aria-label={labels.inviteCreateDialog} onClose={onClose}>
      <div className="botModalHeader">
        <p className="eyebrow">{labels.serverInvitesTitle}</p>
        <Button variant="unstyled" className="uiButton uiButton--icon uiButton--md iconButton modalClose" type="button" aria-label={text.close} onClick={onClose}>
          ×
        </Button>
      </div>
      <div className="actionConfirmBody">
        <h3>{labels.inviteCreateDialog}</h3>
        <p>{labels.inviteCreateHelp}</p>
        <div className="serverInviteCreateGrid">
          <label className="serverSettingsField">
            <span>{labels.inviteChannelToUse}</span>
            <Select
              value={draft.channelId}
              disabled={channels.length === 0}
              onChange={(event) => onChange({ ...draft, channelId: event.target.value })}
            >
              <option value="">{channels.length ? labels.selectChannelPlaceholder : labels.inviteNoChannelAvailable}</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{inviteChannelLabel(channel)}</option>
              ))}
            </Select>
          </label>
          <label className="serverSettingsField">
            <span>{labels.inviteExpiration}</span>
            <Select value={draft.maxAge} onChange={(event) => onChange({ ...draft, maxAge: event.target.value })}>
              {inviteDurationOptions.map((option) => (
                <option key={option.value} value={option.value}>{labels[option.labelKey]}</option>
              ))}
            </Select>
          </label>
          <label className="serverSettingsField">
            <span>{labels.inviteMaxUses}</span>
            <Select value={draft.maxUses} onChange={(event) => onChange({ ...draft, maxUses: event.target.value })}>
              {inviteMaxUsesOptions.map((option) => (
                <option key={option.value} value={option.value}>{labels[option.labelKey]}</option>
              ))}
            </Select>
          </label>
          <label className="serverInviteCheckRow">
            <Input
              type="checkbox"
              checked={draft.temporary}
              onChange={(event) => onChange({ ...draft, temporary: event.target.checked })}
            />
            <span>{labels.inviteTemporaryMembership}</span>
          </label>
          <label className="serverInviteCheckRow">
            <Input
              type="checkbox"
              checked={draft.unique}
              onChange={(event) => onChange({ ...draft, unique: event.target.checked })}
            />
            <span>{labels.inviteUnique}</span>
          </label>
        </div>
      </div>
      <div className="actionConfirmActions">
        <Button variant="secondary" type="button" onClick={onClose}>{text.cancel}</Button>
        <Button type="button" disabled={!draft.channelId} onClick={onCreate}>{labels.inviteCreate}</Button>
      </div>
    </Modal>
  );
}

function ServerInvitesPanel({
  guildId,
  botId,
  invites,
  channels,
  readOnly,
  labels,
  text,
  onCommand,
  onToast,
}: {
  guildId: string;
  botId: string | null;
  invites: GuildInviteSummary[];
  channels: ChannelSummary[];
  readOnly: boolean;
  labels: ServerSettingsText;
  text: UiText;
  onCommand: (command: ClientCommand) => void;
  onToast: (message: string, tone?: AppToast["tone"]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<InviteSortKey>("code");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [createOpen, setCreateOpen] = useState(false);
  const inviteChannels = useMemo(() => channels.filter(channelCanCreateInvite), [channels]);
  const [draft, setDraft] = useState<InviteCreateDraft>(() => ({
    channelId: inviteChannels[0]?.id ?? "",
    maxAge: "86400",
    maxUses: "0",
    temporary: false,
    unique: true,
  }));

  useEffect(() => {
    if (!draft.channelId && inviteChannels[0]) {
      setDraft((current) => ({ ...current, channelId: inviteChannels[0]?.id ?? "" }));
    }
  }, [draft.channelId, inviteChannels]);

  const filteredInvites = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const visibleInvites = normalizedQuery
      ? invites.filter((invite) => inviteSearchValue(invite).includes(normalizedQuery))
      : invites;
    return [...visibleInvites].sort((left, right) => compareInviteRows(left, right, sortKey, sortDirection));
  }, [invites, query, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filteredInvites.length / SERVER_INVITES_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageInvites = filteredInvites.slice(
    (safePage - 1) * SERVER_INVITES_PAGE_SIZE,
    safePage * SERVER_INVITES_PAGE_SIZE,
  );
  const pageNumbers = visibleMemberPages(safePage, pageCount);
  const canManageInvites = Boolean(botId) && !readOnly;

  useEffect(() => {
    setPage(1);
  }, [query, invites.length, sortDirection, sortKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const toggleSort = (nextSortKey: InviteSortKey) => {
    setSortKey((currentSortKey) => {
      if (currentSortKey !== nextSortKey) {
        setSortDirection(nextSortKey === "expiresAt" || nextSortKey === "uses" ? "desc" : "asc");
        return nextSortKey;
      }
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return currentSortKey;
    });
  };

  const sortLabel = (nextSortKey: InviteSortKey) => {
    if (sortKey !== nextSortKey) return labels.membersSortInactive;
    return sortDirection === "asc" ? labels.membersSortAscending : labels.membersSortDescending;
  };

  const sortIndicator = (nextSortKey: InviteSortKey) => {
    if (sortKey !== nextSortKey) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const sortableHeader = (key: InviteSortKey, label: string) => (
    <Button variant="unstyled" type="button" className="serverMembersSortButton" onClick={() => toggleSort(key)} title={sortLabel(key)}>
      <span>{label}</span>
      <small aria-hidden="true">{sortIndicator(key)}</small>
    </Button>
  );

  const copyInvite = async (invite: GuildInviteSummary) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(invite.url);
    onToast(labels.inviteCopied, "success");
  };

  const createInvite = () => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) {
      onToast(labels.noActiveBot, "warning");
      return;
    }
    if (!draft.channelId) {
      onToast(labels.inviteSelectChannelBeforeCreate, "warning");
      return;
    }
    onCommand({
      requestId: crypto.randomUUID(),
      botId,
      type: "guild.invite.create",
      guildId,
      channelId: draft.channelId,
      maxAge: Number.parseInt(draft.maxAge, 10),
      maxUses: Number.parseInt(draft.maxUses, 10),
      temporary: draft.temporary,
      unique: draft.unique,
    } satisfies ClientCommand);
    onToast(labels.inviteCreating, "info");
    setCreateOpen(false);
  };

  const deleteInvite = (invite: GuildInviteSummary) => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) {
      onToast(labels.noActiveBot, "warning");
      return;
    }
    onCommand({
      requestId: crypto.randomUUID(),
      botId,
      type: "guild.invite.delete",
      guildId,
      code: invite.code,
    } satisfies ClientCommand);
    onToast(labels.inviteDeleting(invite.code), "info");
  };

  return (
    <Panel className="serverSettingsFormSurface serverInvitesPanel">
      <div className="discordSettingsBlockHeader">
        <h3>{labels.serverInvitesTitle}</h3>
        <p>{labels.serverInvitesHelp}</p>
      </div>

      <section className="serverInvitesToolbar" aria-label={labels.invitesSearchLabel}>
        <label className="serverSettingsField serverInvitesSearchField">
          <span className="serverMembersSearchHeader">
            <span>{labels.invitesSearchLabel}</span>
            <Badge as="small" tone="muted">
              {labels.invitesResultSummary(filteredInvites.length, invites.length)}
            </Badge>
          </span>
          <Input
            type="search"
            value={query}
            placeholder={labels.invitesSearchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={!canManageInvites || inviteChannels.length === 0}
          title={readOnly ? labels.readOnlyModeActionBlocked : inviteChannels.length === 0 ? labels.inviteNoChannelAvailable : labels.inviteCreate}
          onClick={() => setCreateOpen(true)}
        >
          {labels.inviteCreate}
        </Button>
      </section>

      <section className="serverInvitesListCard" aria-label={labels.serverInvitesTitle}>
        {invites.length === 0 ? (
          <p className="serverMembersEmpty">{labels.invitesEmpty}</p>
        ) : pageInvites.length === 0 ? (
          <p className="serverMembersEmpty">{labels.invitesNoResults}</p>
        ) : (
          <div className="serverInvitesTable" role="table" aria-label={labels.serverInvitesTitle}>
            <div className="serverInvitesTableHeader" role="rowgroup">
              <div className="serverInvitesTableRow serverInvitesTableHeaderRow" role="row">
                <div className="serverMembersTableHeadCell" role="columnheader" aria-sort={sortKey === "code" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                  {sortableHeader("code", labels.inviteCode)}
                </div>
                <div className="serverMembersTableHeadCell" role="columnheader" aria-sort={sortKey === "channel" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                  {sortableHeader("channel", labels.inviteChannel)}
                </div>
                <div className="serverMembersTableHeadCell" role="columnheader">
                  <span>{labels.inviteCreator}</span>
                </div>
                <div className="serverMembersTableHeadCell" role="columnheader" aria-sort={sortKey === "uses" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                  {sortableHeader("uses", labels.inviteUses)}
                </div>
                <div className="serverMembersTableHeadCell" role="columnheader" aria-sort={sortKey === "expiresAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                  {sortableHeader("expiresAt", labels.inviteExpires)}
                </div>
                <div className="serverMembersTableHeadCell" role="columnheader">
                  <span>{labels.inviteActions}</span>
                </div>
              </div>
            </div>
            <div className="serverInvitesTableScroller" role="rowgroup">
              {pageInvites.map((invite) => (
                <div className="serverInvitesTableRow" key={invite.code} role="row">
                  <div className="serverMembersTableCell serverInviteCodeCell" role="cell">
                    <strong>{invite.code}</strong>
                    <span>{invite.url}</span>
                  </div>
                  <div className="serverMembersTableCell" role="cell">{invite.channelName ? `#${invite.channelName}` : labels.notLoaded}</div>
                  <div className="serverMembersTableCell" role="cell">{invite.inviterName ?? labels.notLoaded}</div>
                  <div className="serverMembersTableCell" role="cell">{inviteUsesText(invite, labels)}</div>
                  <div className="serverMembersTableCell" role="cell">
                    <span>{formatInviteDate(invite.expiresAt, labels)}</span>
                    <small>{invite.temporary ? labels.inviteTemporary : labels.invitePermanent}</small>
                  </div>
                  <div className="serverMembersTableCell serverInviteActions" role="cell">
                    <Button variant="secondary" type="button" onClick={() => void copyInvite(invite)}>{labels.inviteCopy}</Button>
                    <Button
                      variant="danger"
                      type="button"
                      disabled={!canManageInvites}
                      title={readOnly ? labels.readOnlyModeActionBlocked : labels.inviteDelete}
                      onClick={() => deleteInvite(invite)}
                    >
                      {labels.inviteDelete}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <nav className="serverMembersPagination" aria-label={labels.invitesPageStatus(safePage, pageCount)}>
        <Button variant="unstyled" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          {labels.invitesPreviousPage}
        </Button>
        <div className="serverMembersPageNumbers">
          {pageNumbers.map((pageNumber) =>
            typeof pageNumber === "number" ? (
              <Button
                key={pageNumber}
                variant="unstyled"
                type="button"
                className={pageNumber === safePage ? "isActive" : ""}
                aria-current={pageNumber === safePage ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            ) : (
              <span key={pageNumber}>…</span>
            ),
          )}
        </div>
        <Button variant="unstyled" type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
          {labels.invitesNextPage}
        </Button>
      </nav>
      <p className="serverMembersPageStatus">{labels.invitesPageStatus(safePage, pageCount)}</p>

      {createOpen ? (
        <ServerInviteCreateModal
          draft={draft}
          channels={inviteChannels}
          labels={labels}
          text={text}
          onChange={setDraft}
          onClose={() => setCreateOpen(false)}
          onCreate={createInvite}
        />
      ) : null}
    </Panel>
  );
}

const SERVER_RESOURCE_PAGE_SIZE = 18;

function ServerBanCreateModal({
  userId,
  reason,
  labels,
  text,
  onUserIdChange,
  onReasonChange,
  onClose,
  onCreate,
}: {
  userId: string;
  reason: string;
  labels: ServerSettingsText;
  text: UiText;
  onUserIdChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Modal surfaceClassName="botModal actionConfirmModal serverInviteCreateModal" aria-label={labels.banCreateDialog} onClose={onClose}>
      <div className="botModalHeader">
        <p className="eyebrow">{labels.serverBansTitle}</p>
        <Button variant="unstyled" className="uiButton uiButton--icon uiButton--md iconButton modalClose" type="button" aria-label={text.close} onClick={onClose}>×</Button>
      </div>
      <div className="actionConfirmBody">
        <h3>{labels.banCreateDialog}</h3>
        <p>{labels.banCreateHelp}</p>
        <div className="serverInviteCreateGrid">
          <label className="serverSettingsField">
            <span>{labels.banUserId}</span>
            <Input value={userId} placeholder={labels.banUserIdPlaceholder} onChange={(event) => onUserIdChange(event.target.value)} />
          </label>
          <label className="serverSettingsField">
            <span>{labels.banReason}</span>
            <Textarea value={reason} placeholder={labels.banReasonPlaceholder} rows={3} maxLength={512} onChange={(event) => onReasonChange(event.target.value)} />
          </label>
        </div>
      </div>
      <div className="actionConfirmActions">
        <Button variant="secondary" type="button" onClick={onClose}>{text.cancel}</Button>
        <Button type="button" disabled={!userId.trim()} onClick={onCreate}>{labels.banCreate}</Button>
      </div>
    </Modal>
  );
}

function ServerBansPanel({
  guildId,
  botId,
  bans,
  readOnly,
  labels,
  text,
  onCommand,
  onToast,
}: {
  guildId: string;
  botId: string | null;
  bans: GuildBanSummary[];
  readOnly: boolean;
  labels: ServerSettingsText;
  text: UiText;
  onCommand: (command: ClientCommand) => void;
  onToast: (message: string, tone?: AppToast["tone"]) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const canManage = Boolean(botId) && !readOnly;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const visible = normalized
      ? bans.filter((ban) => [ban.username, ban.displayName, ban.userId, ban.reason].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized))
      : bans;
    return [...visible].sort((left, right) => left.username.localeCompare(right.username, undefined, { sensitivity: "base" }));
  }, [bans, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / SERVER_RESOURCE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * SERVER_RESOURCE_PAGE_SIZE, safePage * SERVER_RESOURCE_PAGE_SIZE);
  const pageNumbers = visibleMemberPages(safePage, pageCount);

  useEffect(() => setPage(1), [query, bans.length]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const createBan = () => {
    if (readOnly) return onToast(labels.readOnlyModeActionBlocked, "warning");
    if (!botId) return onToast(labels.noActiveBot, "warning");
    onCommand({ requestId: crypto.randomUUID(), botId, type: "guild.ban.create", guildId, userId: userId.trim(), reason: reason.trim() || undefined } satisfies ClientCommand);
    onToast(labels.banCreating, "info");
    setCreateOpen(false);
    setUserId("");
    setReason("");
  };

  const unban = (ban: GuildBanSummary) => {
    if (readOnly) return onToast(labels.readOnlyModeActionBlocked, "warning");
    if (!botId) return onToast(labels.noActiveBot, "warning");
    onCommand({ requestId: crypto.randomUUID(), botId, type: "guild.ban.delete", guildId, userId: ban.userId } satisfies ClientCommand);
    onToast(labels.banDeleting(ban.displayName || ban.username || ban.userId), "info");
  };

  return (
    <Panel className="serverSettingsFormSurface serverResourcePanel serverBansPanel">
      <div className="discordSettingsBlockHeader">
        <h3>{labels.serverBansTitle}</h3>
        <p>{labels.serverBansHelp}</p>
      </div>
      <section className="serverInvitesToolbar" aria-label={labels.bansSearchLabel}>
        <label className="serverSettingsField serverInvitesSearchField">
          <span className="serverMembersSearchHeader">
            <span>{labels.bansSearchLabel}</span>
            <Badge as="small" tone="muted">{labels.bansResultSummary(filtered.length, bans.length)}</Badge>
          </span>
          <Input type="search" value={query} placeholder={labels.bansSearchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Button type="button" disabled={!canManage} title={readOnly ? labels.readOnlyModeActionBlocked : labels.banCreate} onClick={() => setCreateOpen(true)}>{labels.banCreate}</Button>
      </section>
      <section className="serverInvitesListCard" aria-label={labels.serverBansTitle}>
        {bans.length === 0 ? <p className="serverMembersEmpty">{labels.bansEmpty}</p> : pageItems.length === 0 ? <p className="serverMembersEmpty">{labels.bansNoResults}</p> : (
          <div className="serverResourceTable" role="table" aria-label={labels.serverBansTitle}>
            <div className="serverResourceTableHeader serverResourceTableRow" role="row">
              <div role="columnheader">{labels.memberColumnUsername}</div>
              <div role="columnheader">{labels.banUserId}</div>
              <div role="columnheader">{labels.banReason}</div>
              <div role="columnheader">{labels.inviteActions}</div>
            </div>
            <div className="serverResourceTableScroller" role="rowgroup">
              {pageItems.map((ban) => (
                <div className="serverResourceTableRow" key={ban.userId} role="row">
                  <div className="serverMembersTableCell serverResourceNameCell" role="cell"><strong>{ban.displayName || ban.username}</strong><span>{ban.username}</span></div>
                  <div className="serverMembersTableCell" role="cell">{ban.userId}</div>
                  <div className="serverMembersTableCell" role="cell">{ban.reason || "—"}</div>
                  <div className="serverMembersTableCell serverInviteActions" role="cell"><Button variant="danger" type="button" disabled={!canManage} onClick={() => unban(ban)}>{labels.unban}</Button></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
      <nav className="serverMembersPagination" aria-label={labels.membersPageStatus(safePage, pageCount)}>
        <Button variant="unstyled" type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{labels.membersPreviousPage}</Button>
        <div className="serverMembersPageNumbers">{pageNumbers.map((pageNumber) => typeof pageNumber === "number" ? <Button key={pageNumber} variant="unstyled" type="button" className={pageNumber === safePage ? "isActive" : ""} onClick={() => setPage(pageNumber)}>{pageNumber}</Button> : <span key={pageNumber}>…</span>)}</div>
        <Button variant="unstyled" type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>{labels.membersNextPage}</Button>
      </nav>
      {createOpen ? <ServerBanCreateModal userId={userId} reason={reason} labels={labels} text={text} onUserIdChange={setUserId} onReasonChange={setReason} onClose={() => setCreateOpen(false)} onCreate={createBan} /> : null}
    </Panel>
  );
}

export function ServerSettingsPanel({
  guild,
  channels,
  roles,
  members,
  invites,
  bans,
  config,
  botId,
  readOnly = false,
  onCommand,
  onToast,
  text,
  onClose,
  onOpenMemberContextMenu,
}: {
  guild: WorkspaceState["guilds"][number];
  channels: ChannelSummary[];
  roles: RoleSummary[];
  members: GuildMemberSummary[];
  invites: GuildInviteSummary[];
  bans: GuildBanSummary[];
  config: GuildAutomationConfig | null;
  botId: string | null;
  readOnly?: boolean;
  onCommand: (command: ClientCommand) => void;
  onToast: (message: string, tone?: AppToast["tone"]) => void;
  text: UiText;
  onClose: () => void;
  onOpenMemberContextMenu?: (event: ReactMouseEvent<HTMLElement>, guildId: string, userId: string) => boolean;
}) {
  const [tab, setTab] = useState<ServerSettingsTab>("overview");
  const layer = useModalLayer();
  const labels = serverLabels(text);
  const [welcomeDraft, setWelcomeDraft] = useState(() =>
    automationMessageDraft(config?.welcome ?? null, "welcome"),
  );
  const [goodbyeDraft, setGoodbyeDraft] = useState(() =>
    automationMessageDraft(config?.goodbye ?? null, "goodbye"),
  );
  const [logsDraft, setLogsDraft] = useState(() =>
    automationLogsDraft(config?.logs ?? null),
  );
  const [roleAutomationDraft, setRoleAutomationDraft] = useState<
    RoleAutomationDraftRule[]
  >(() => roleAutomationDrafts(config?.roleAutomation ?? null));
  const [roleAutomationModal, setRoleAutomationModal] =
    useState<RoleAutomationModalTarget>(null);
  const memberFetchKeyRef = useRef<string | null>(null);
  const inviteFetchKeyRef = useRef<string | null>(null);
  const banFetchKeyRef = useRef<string | null>(null);
  const textChannels = channels.filter(
    (channel) => channel.type === "text",
  ).length;
  const selectableTextChannels = channels.filter(
    (channel) =>
      channel.type === "text" && channel.permissions?.sendMessages !== false,
  );
  const voiceChannels = channels.filter(
    (channel) => channel.type === "voice",
  ).length;
  const forumChannels = channels.filter(
    (channel) => channel.type === "forum",
  ).length;
  const categories = channels.filter(
    (channel) => channel.type === "category",
  ).length;
  const configuredMemberCount = guild.memberCount ?? members.length;
  const readableGuildId = guild.id;

  useEffect(() => {
    setWelcomeDraft(automationMessageDraft(config?.welcome ?? null, "welcome"));
    setGoodbyeDraft(automationMessageDraft(config?.goodbye ?? null, "goodbye"));
    setLogsDraft(automationLogsDraft(config?.logs ?? null));
    setRoleAutomationDraft(
      roleAutomationDrafts(config?.roleAutomation ?? null),
    );
  }, [
    config?.welcome?.channelId,
    config?.welcome?.messageType,
    config?.welcome?.messageTemplate,
    config?.welcome?.embedPagesJson,
    config?.goodbye?.channelId,
    config?.goodbye?.messageType,
    config?.goodbye?.messageTemplate,
    config?.goodbye?.embedPagesJson,
    config?.logs?.channelId,
    config?.logs?.eventConfigsJson,
    JSON.stringify(config?.roleAutomation?.rules ?? []),
  ]);

  useEffect(() => {
    if (!botId) return;
    onCommand({
      requestId: crypto.randomUUID(),
      botId,
      type: "guild.automation.fetch",
      guildId: guild.id,
    } satisfies ClientCommand);
  }, [botId, guild.id]);

  useEffect(() => {
    if (readOnly && tab !== "overview" && tab !== "members" && tab !== "invites" && tab !== "bans") setTab("overview");
  }, [readOnly, tab]);

  useEffect(() => {
    if (tab !== "members" || !botId) return;
    const fetchKey = `${botId}:${guild.id}`;
    if (memberFetchKeyRef.current === fetchKey) return;
    memberFetchKeyRef.current = fetchKey;
    onCommand({
      requestId: crypto.randomUUID(),
      botId,
      type: "guild.members.fetch",
      guildId: guild.id,
    } satisfies ClientCommand);
  }, [botId, guild.id, onCommand, tab]);

  useEffect(() => {
    if (tab !== "invites" || !botId) return;
    const fetchKey = `${botId}:${guild.id}`;
    if (inviteFetchKeyRef.current === fetchKey) return;
    inviteFetchKeyRef.current = fetchKey;
    onCommand({
      requestId: crypto.randomUUID(),
      botId,
      type: "guild.invites.fetch",
      guildId: guild.id,
    } satisfies ClientCommand);
  }, [botId, guild.id, onCommand, tab]);

  useEffect(() => {
    if (tab !== "bans" || !botId) return;
    const fetchKey = `${botId}:${guild.id}`;
    if (banFetchKeyRef.current === fetchKey) return;
    banFetchKeyRef.current = fetchKey;
    onCommand({ requestId: crypto.randomUUID(), botId, type: "guild.bans.fetch", guildId: guild.id } satisfies ClientCommand);
  }, [botId, guild.id, onCommand, tab]);



  const commandBase = () => ({
    requestId: crypto.randomUUID(),
    botId: botId ?? undefined,
  });
  const savedWelcomeDraft = automationMessageDraft(
    config?.welcome ?? null,
    "welcome",
  );
  const savedGoodbyeDraft = automationMessageDraft(
    config?.goodbye ?? null,
    "goodbye",
  );
  const savedLogsDraft = automationLogsDraft(config?.logs ?? null);
  const savedRoleAutomationDraft = roleAutomationDrafts(
    config?.roleAutomation ?? null,
  );
  const welcomeDirty = !automationMessageDraftEquals(
    welcomeDraft,
    savedWelcomeDraft,
  );
  const goodbyeDirty = !automationMessageDraftEquals(
    goodbyeDraft,
    savedGoodbyeDraft,
  );
  const logsDirty = !automationLogsDraftEquals(logsDraft, savedLogsDraft);
  const roleAutomationDirty = !roleAutomationDraftsEqual(
    roleAutomationDraft,
    savedRoleAutomationDraft,
  );
  const serverAutomationDirty =
    !readOnly &&
    (welcomeDirty || goodbyeDirty || logsDirty || roleAutomationDirty);
  const resetAutomationDrafts = () => {
    setWelcomeDraft(savedWelcomeDraft);
    setGoodbyeDraft(savedGoodbyeDraft);
    setLogsDraft(savedLogsDraft);
    setRoleAutomationDraft(savedRoleAutomationDraft);
  };
  const previewConfig = (
    nextWelcome: AutomationMessageDraft = welcomeDraft,
    nextGoodbye: AutomationMessageDraft = goodbyeDraft,
    nextLogs: AutomationLogsDraft = logsDraft,
  ): GuildAutomationConfig => ({
    guildId: guild.id,
    welcome: {
      guildId: guild.id,
      channelId: nextWelcome.channelId,
      messageType: nextWelcome.messageType,
      messageTemplate: nextWelcome.messageTemplate,
      embedPagesJson: nextWelcome.embedPagesJson,
      enabled: Boolean(nextWelcome.channelId),
    },
    goodbye: {
      guildId: guild.id,
      channelId: nextGoodbye.channelId,
      messageType: nextGoodbye.messageType,
      messageTemplate: nextGoodbye.messageTemplate,
      embedPagesJson: nextGoodbye.embedPagesJson,
      enabled: Boolean(nextGoodbye.channelId),
    },
    logs: nextLogs.channelId
      ? {
          guildId: guild.id,
          channelId: nextLogs.channelId,
          eventConfigsJson: nextLogs.eventConfigsJson,
          enabled: true,
        }
      : null,
  });
  const saveAutomation = (kind: GuildAutomationKind) => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) return;
    if (kind === "logs") {
      onCommand({
        ...commandBase(),
        type: "guild.automation.update",
        guildId: guild.id,
        kind,
        channelId: logsDraft.channelId,
        eventConfigsJson: logsDraft.eventConfigsJson,
      } satisfies ClientCommand);
      onToast(
        logsDraft.channelId ? labels.logsSaving : labels.templatesSaving,
        "info",
      );
      return;
    }
    const draft = kind === "welcome" ? welcomeDraft : goodbyeDraft;
    onCommand({
      ...commandBase(),
      type: "guild.automation.update",
      guildId: guild.id,
      kind,
      channelId: draft.channelId,
      messageType: draft.messageType,
      messageTemplate: draft.messageTemplate,
      embedPagesJson: draft.embedPagesJson,
    } satisfies ClientCommand);
    onToast(
      draft.channelId
        ? labels.automationSaving(automationKindLabel(kind))
        : labels.templatesSaving,
      "info",
    );
  };
  const removeAutomation = (kind: GuildAutomationKind) => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) return;
    onCommand({
      ...commandBase(),
      type: "guild.automation.remove",
      guildId: guild.id,
      kind,
    } satisfies ClientCommand);
  };
  const saveDirtyAutomations = () => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      resetAutomationDrafts();
      return;
    }
    if (!botId || !serverAutomationDirty) return;
    let savedCount = 0;
    const saveOrRemoveMessage = (
      kind: "welcome" | "goodbye",
      draft: AutomationMessageDraft,
      savedDraft: AutomationMessageDraft,
      dirty: boolean,
    ) => {
      if (!dirty) return;
      // Les modèles welcome/goodbye doivent rester sauvegardables même sans salon.
      // Un salon vide signifie simplement que l'automatisation n'est pas armée.
      saveAutomation(kind);
      savedCount += 1;
    };
    saveOrRemoveMessage(
      "welcome",
      welcomeDraft,
      savedWelcomeDraft,
      welcomeDirty,
    );
    saveOrRemoveMessage(
      "goodbye",
      goodbyeDraft,
      savedGoodbyeDraft,
      goodbyeDirty,
    );
    if (logsDirty) {
      saveAutomation("logs");
      savedCount += 1;
    }
    if (roleAutomationDirty) {
      saveRoleAutomationDrafts();
      savedCount += 1;
      onToast(labels.roleAutomationSaving, "info");
    }
    if (!savedCount) {
      resetAutomationDrafts();
      return;
    }
    // La barre disparaît uniquement quand l'état réel revient depuis le bot.
    // Ça évite d'afficher "Actif" si Discord, la base ou les permissions refusent la sauvegarde.
  };
  const automationKindLabel = (kind: GuildAutomationKind) =>
    kind === "welcome"
      ? labels.welcomeKind
      : kind === "goodbye"
        ? labels.goodbyeKind
        : labels.logsKind;
  const testAutomation = (kind: GuildAutomationKind) => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) return;
    onCommand({
      ...commandBase(),
      type: "guild.automation.test",
      guildId: guild.id,
      kind,
    } satisfies ClientCommand);
    onToast(labels.testRunning(automationKindLabel(kind)), "info");
  };
  const saveRoleAutomationRule = (rule: RoleAutomationDraftRule) => {
    if (readOnly) return;
    if (!botId || !rule.roleId) return;
    onCommand({
      ...commandBase(),
      type: "guild.roleAutomation.upsert",
      guildId: guild.id,
      ruleId: rule.id.startsWith("draft-") ? null : rule.id,
      roleId: rule.roleId,
      enabled: rule.enabled,
      conditionMode: rule.conditionMode,
      minMessages: normalizeRoleAutomationNumber(
        rule.minMessages,
        ROLE_AUTOMATION_MAX_MESSAGES,
      )
        ? Number.parseInt(
            normalizeRoleAutomationNumber(
              rule.minMessages,
              ROLE_AUTOMATION_MAX_MESSAGES,
            ),
            10,
          )
        : null,
      minVoiceSeconds: normalizeRoleAutomationNumber(
        rule.minVoiceMinutes,
        ROLE_AUTOMATION_MAX_VOICE_MINUTES,
      )
        ? Number.parseInt(
            normalizeRoleAutomationNumber(
              rule.minVoiceMinutes,
              ROLE_AUTOMATION_MAX_VOICE_MINUTES,
            ),
            10,
          ) * 60
        : null,
      minMemberAgeSeconds: normalizeRoleAutomationNumber(
        rule.minMemberAgeDays,
        ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS,
      )
        ? Number.parseInt(
            normalizeRoleAutomationNumber(
              rule.minMemberAgeDays,
              ROLE_AUTOMATION_MAX_MEMBER_AGE_DAYS,
            ),
            10,
          ) * 86400
        : null,
      removeWhenInvalid: rule.removeWhenInvalid,
      ignoreBots: rule.ignoreBots,
      applyToExistingMembers: rule.applyToExistingMembers,
    } satisfies ClientCommand);
  };
  const saveRoleAutomationDrafts = () => {
    if (readOnly) return;
    const savedById = new Map(
      savedRoleAutomationDraft
        .filter((rule) => !rule.id.startsWith("draft-"))
        .map((rule) => [rule.id, rule]),
    );
    const nextIds = new Set(
      roleAutomationDraft
        .filter((rule) => !rule.id.startsWith("draft-"))
        .map((rule) => rule.id),
    );
    for (const savedRule of savedRoleAutomationDraft) {
      if (!savedRule.id.startsWith("draft-") && !nextIds.has(savedRule.id)) {
        onCommand({
          ...commandBase(),
          type: "guild.roleAutomation.delete",
          guildId: guild.id,
          ruleId: savedRule.id,
        } satisfies ClientCommand);
      }
    }
    for (const rule of roleAutomationDraft) {
      if (!rule.roleId) continue;
      const saved = savedById.get(rule.id);
      if (
        !saved ||
        JSON.stringify(stableRoleAutomationDraft(saved)) !==
          JSON.stringify(stableRoleAutomationDraft(rule))
      )
        saveRoleAutomationRule(rule);
    }
  };
  const syncRoleAutomation = () => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) return;
    onCommand({
      ...commandBase(),
      type: "guild.roleAutomation.sync",
      guildId: guild.id,
    } satisfies ClientCommand);
    onToast(labels.roleAutomationSyncing, "info");
  };
  const testRoleAutomation = () => {
    if (readOnly) {
      onToast(labels.readOnlyModeActionBlocked, "warning");
      return;
    }
    if (!botId) return;
    onCommand({
      ...commandBase(),
      type: "guild.roleAutomation.test",
      guildId: guild.id,
    } satisfies ClientCommand);
    onToast(labels.roleAutomationTesting, "info");
  };
  const channelOptions = selectableTextChannels.length
    ? selectableTextChannels
    : channels.filter((channel) => channel.type === "text");
  const readOnlyServerTabTitle = readOnly
    ? labels.readOnlyModeTooltip
    : undefined;
  const openServerSettingsTab = (nextTab: ServerSettingsTab) => {
    if (readOnly && nextTab !== "overview" && nextTab !== "members" && nextTab !== "invites" && nextTab !== "bans") {
      onToast(labels.readOnlyModeTooltip, "warning");
      return;
    }
    setTab(nextTab);
  };

  return createPortal(
    <>
      <Button
        variant="unstyled"
        className="serverSettingsBackdrop"
        type="button"
        aria-label={labels.serverSettingsTitle}
        onClick={onClose}
        style={{ "--server-settings-backdrop-z": layer.backdrop } as CSSProperties}
      />
      <aside
        className="serverSettingsPanel"
        aria-label={labels.serverSettingsTitle}
        style={{ "--server-settings-panel-z": layer.surface } as CSSProperties}
      >
        <header className="serverSettingsHeader">
          <div className="serverSettingsIdentity">
            <div className="serverSettingsIcon" aria-hidden="true">
              {guild.iconUrl ? (
                <img src={guild.iconUrl} alt="" />
              ) : (
                guild.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <p className="eyebrow">{labels.serverSettingsTitle}</p>
              <h2>{guild.name}</h2>
            </div>
          </div>
          <Button
            variant="unstyled"
            className="panelCloseButton"
            type="button"
            aria-label={text.close}
            onClick={onClose}
          >
            ×
          </Button>
        </header>

        <div className="serverSettingsBody">
          <Tabs
            as="nav"
            className="serverSettingsNav"
            aria-label={labels.serverSettingsSections}
          >
            <TabButton
              active={tab === "overview"}
              type="button"
              onClick={() => openServerSettingsTab("overview")}
            >
              {labels.overviewTab}
            </TabButton>
            <TabButton
              active={tab === "members"}
              type="button"
              onClick={() => openServerSettingsTab("members")}
            >
              {labels.membersTab}
            </TabButton>
            <TabButton
              active={tab === "invites"}
              type="button"
              onClick={() => openServerSettingsTab("invites")}
            >
              {labels.invitesTab}
            </TabButton>
            <TabButton
              active={tab === "bans"}
              type="button"
              onClick={() => openServerSettingsTab("bans")}
            >
              {labels.bansTab}
            </TabButton>
            <TabButton
              active={tab === "automations"}
              locked={readOnly}
              type="button"
              onClick={
                readOnly
                  ? undefined
                  : () => openServerSettingsTab("automations")
              }
              aria-disabled={readOnly}
              tabIndex={readOnly ? -1 : 0}
              title={readOnlyServerTabTitle}
            >
              <span>{labels.automationsTab}</span>
            </TabButton>
            <TabButton
              active={tab === "templates"}
              locked={readOnly}
              type="button"
              onClick={
                readOnly ? undefined : () => openServerSettingsTab("templates")
              }
              aria-disabled={readOnly}
              tabIndex={readOnly ? -1 : 0}
              title={readOnlyServerTabTitle}
            >
              <span>{labels.templatesTab}</span>
            </TabButton>
          </Tabs>

          <section className="serverSettingsContent">
            {tab === "overview" ? (
              <Panel className="serverSettingsFormSurface isProfileEditor serverInfoPanel">
                <div className="serverInfoHero">
                  <div className="serverInfoIcon" aria-hidden="true">
                    {guild.iconUrl ? (
                      <img src={guild.iconUrl} alt="" />
                    ) : (
                      guild.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3>{guild.name}</h3>
                    <p>
                      {guild.description?.trim() ||
                        text.memberCount(configuredMemberCount || 0)}
                    </p>
                  </div>
                </div>
                <section className="discordSettingsBlock">
                  <div className="discordSettingsBlockHeader">
                    <h3>{labels.overviewSummary}</h3>
                    <p>{labels.overviewSummaryHelp}</p>
                  </div>
                  <Card className="discordSettingsPanel">
                    <div className="discordSettingsRow">
                      <div>
                        <strong>{labels.members}</strong>
                      </div>
                      <Badge as="small" tone="success">
                        {configuredMemberCount || "—"}
                      </Badge>
                    </div>
                    <div className="discordSettingsRow">
                      <div>
                        <strong>{labels.serverChannels}</strong>
                        <span>
                          {labels.channelSummary(
                            textChannels,
                            voiceChannels,
                            forumChannels,
                            categories,
                          )}
                        </span>
                      </div>
                      <Badge as="small" tone="muted">
                        {channels.length}
                      </Badge>
                    </div>
                  </Card>
                </section>
                <section className="discordSettingsBlock">
                  <div className="discordSettingsBlockHeader">
                    <h3>{labels.identity}</h3>
                    <p>{labels.identityHelp}</p>
                  </div>
                  <Card className="discordSettingsPanel">
                    <div className="discordSettingsRow">
                      <div>
                        <strong>{labels.serverId}</strong>
                        <span>{readableGuildId}</span>
                      </div>
                    </div>
                    <div className="discordSettingsRow">
                      <div>
                        <strong>{labels.owner}</strong>
                        <span>{guild.ownerId ?? labels.notLoaded}</span>
                      </div>
                    </div>
                    <div className="discordSettingsRow">
                      <div>
                        <strong>{labels.activeBot}</strong>
                        <span>
                          {botId
                            ? labels.connectedWorkspace
                            : labels.noActiveBot}
                        </span>
                      </div>
                      <Badge
                        as="small"
                        className={botId ? "discordSettingsBadge" : "discordMutedBadge"}
                        tone="unstyled"
                      >
                        {botId ? labels.connected : labels.inactive}
                      </Badge>
                    </div>
                  </Card>
                </section>
              </Panel>
            ) : null}

            {tab === "members" ? (
              <ServerMembersPanel
                guildId={guild.id}
                botId={botId}
                members={members}
                roles={roles}
                configuredMemberCount={configuredMemberCount}
                readOnly={readOnly}
                labels={labels}
                onCommand={onCommand}
                onToast={onToast}
                onOpenMemberContextMenu={onOpenMemberContextMenu}
                overlayLayer={layer.surface + 2}
              />
            ) : null}

            {tab === "invites" ? (
              <ServerInvitesPanel
                guildId={guild.id}
                botId={botId}
                invites={invites}
                channels={channels}
                readOnly={readOnly}
                labels={labels}
                text={text}
                onCommand={onCommand}
                onToast={onToast}
              />
            ) : null}

            {tab === "bans" ? (
              <ServerBansPanel
                guildId={guild.id}
                botId={botId}
                bans={bans}
                readOnly={readOnly}
                labels={labels}
                text={text}
                onCommand={onCommand}
                onToast={onToast}
              />
            ) : null}


            {tab === "automations" ? (
              <Panel className="serverSettingsFormSurface serverAutomationPanel">
                <div className="discordSettingsBlockHeader">
                  <h3>{labels.serverAutomationsTitle}</h3>
                  <p>{labels.serverAutomationsHelp}</p>
                </div>
                {readOnly ? (
                  <section className="discordSettingsBlock serverSettingsReadOnlyNotice">
                    <div className="discordSettingsBlockHeader">
                      <h3>{labels.readOnlyModeTitle}</h3>
                      <p>{labels.readOnlyModeHelp}</p>
                    </div>
                  </section>
                ) : null}
                <div className="serverAutomationGrid">
                  <AutomationMessageCard
                    title={labels.welcomeChannelTitle}
                    description={labels.welcomeChannelDescription}
                    draft={welcomeDraft}
                    active={
                      Boolean(savedWelcomeDraft.channelId) && !welcomeDirty
                    }
                    channels={channelOptions}
                    botId={botId}
                    readOnly={readOnly}
                    onChange={setWelcomeDraft}
                    onTest={() => testAutomation("welcome")}
                    testDisabled={welcomeDirty || !savedWelcomeDraft.channelId}
                    labels={labels}
                  />
                  <AutomationMessageCard
                    title={labels.goodbyeChannelTitle}
                    description={labels.goodbyeChannelDescription}
                    draft={goodbyeDraft}
                    active={
                      Boolean(savedGoodbyeDraft.channelId) && !goodbyeDirty
                    }
                    channels={channelOptions}
                    botId={botId}
                    readOnly={readOnly}
                    onChange={setGoodbyeDraft}
                    onTest={() => testAutomation("goodbye")}
                    testDisabled={goodbyeDirty || !savedGoodbyeDraft.channelId}
                    labels={labels}
                  />
                  <AutomationLogsCard
                    draft={logsDraft}
                    active={Boolean(savedLogsDraft.channelId) && !logsDirty}
                    channels={channelOptions}
                    botId={botId}
                    readOnly={readOnly}
                    onChange={setLogsDraft}
                    onTest={() => testAutomation("logs")}
                    testDisabled={logsDirty || !savedLogsDraft.channelId}
                    labels={labels}
                  />
                  <RoleAutomationCard
                    rules={roleAutomationDraft}
                    savedRules={savedRoleAutomationDraft}
                    roles={roles}
                    botId={botId}
                    readOnly={readOnly}
                    labels={labels}
                    onAdd={() =>
                      setRoleAutomationModal({ rule: null, index: null })
                    }
                    onEdit={(rule, index) =>
                      setRoleAutomationModal({ rule, index })
                    }
                    onDelete={(index) =>
                      setRoleAutomationDraft((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    onSync={syncRoleAutomation}
                    onTest={testRoleAutomation}
                  />
                </div>
              </Panel>
            ) : null}

            {tab === "templates" ? (
              <ServerTemplatesPanel
                welcomeDraft={welcomeDraft}
                goodbyeDraft={goodbyeDraft}
                logsDraft={logsDraft}
                labels={labels}
                readOnly={readOnly}
                onWelcomeChange={setWelcomeDraft}
                onGoodbyeChange={setGoodbyeDraft}
                onLogsChange={setLogsDraft}
                onToast={onToast}
              />
            ) : null}
          </section>
        </div>
        <div
          className={`settingsSaveBar serverSettingsSaveNotice serverSettingsFloatingSaveBar${serverAutomationDirty ? " isVisible" : ""}`}
          aria-hidden={!serverAutomationDirty}
        >
          <span>{text.unsavedChanges}</span>
          <Button
            variant="unstyled"
            className="settingsCancelButton"
            type="button"
            onClick={resetAutomationDrafts}
          >
            {text.cancel}
          </Button>
          <Button
            variant="unstyled"
            className="settingsSaveButton"
            type="button"
            disabled={!botId}
            onClick={saveDirtyAutomations}
          >
            {text.save}
          </Button>
        </div>
        {roleAutomationModal ? (
          <RoleAutomationEditorModal
            target={roleAutomationModal}
            roles={roles}
            labels={labels}
            text={text}
            onSave={(rule, index) => {
              setRoleAutomationDraft((current) =>
                index === null
                  ? [...current, rule]
                  : current.map((item, itemIndex) =>
                      itemIndex === index ? rule : item,
                    ),
              );
            }}
            onClose={() => setRoleAutomationModal(null)}
          />
        ) : null}
      </aside>
    </>,
    document.body,
  );
}
