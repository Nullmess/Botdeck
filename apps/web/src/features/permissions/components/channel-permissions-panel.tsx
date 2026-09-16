"use client";

// Inspecteur contextuel des permissions.

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, Panel, Section } from "@/components/ui/panel";
import { Tabs, TabButton } from "@/components/ui/tabs";
import { useMemo, useState } from "react";

import {
  type ChannelPermissionsSummary,
  type ChannelSummary,
  type GuildMemberSummary,
  type RoleSummary,
} from "@botdeck/shared";

import { channelCanSend, UiText } from "@/features/workspace/core";

type PermissionKey = keyof ChannelPermissionsSummary;
type PermissionState = "allowed" | "denied" | "unknown";
type InspectorMode = "bot" | "user";

type PermissionPanelItem = {
  key: PermissionKey | string;
  label: string;
  description: string;
  state: PermissionState;
  source: string;
};

type PermissionPanelGroup = {
  key: string;
  title: string;
  items: PermissionPanelItem[];
};

type PermissionCopy = {
  botView: string;
  userView: string;
  contextText: string;
  contextVoice: string;
  contextForum: string;
  contextThread: string;
  contextDm: string;
  currentSubject: string;
  botSubject: string;
  genericUserSubject: string;
  selectedRoles: string;
  noRoleSelected: string;
  noRoleLoaded: string;
  roleBaseIncluded: string;
  everyoneRoleLabel: string;
  realBotResult: string;
  simulatedUserResult: string;
  dmBotResult: string;
  dmUserResult: string;
  unknownShort: string;
  primary: string;
  botSummary: string;
  userSummary: string;
  dmBotSummary: string;
  dmUserSummary: string;
};

const permissionBits: Partial<Record<PermissionKey, bigint>> = {
  createInstantInvite: 1n,
  kickMembers: 2n,
  banMembers: 4n,
  administrator: 8n,
  manageChannels: 16n,
  manageGuild: 32n,
  addReactions: 64n,
  viewAuditLog: 128n,
  prioritySpeaker: 256n,
  stream: 512n,
  viewChannel: 1024n,
  sendMessages: 2048n,
  sendTTSMessages: 4096n,
  manageMessages: 8192n,
  embedLinks: 16384n,
  attachFiles: 32768n,
  readMessageHistory: 65536n,
  mentionEveryone: 131072n,
  useExternalEmojis: 262144n,
  viewGuildInsights: 524288n,
  connect: 1048576n,
  speak: 2097152n,
  muteMembers: 4194304n,
  deafenMembers: 8388608n,
  moveMembers: 16777216n,
  useVAD: 33554432n,
  changeNickname: 67108864n,
  manageNicknames: 134217728n,
  manageRoles: 268435456n,
  manageWebhooks: 536870912n,
  manageEmojisAndStickers: 1073741824n,
  manageGuildExpressions: 1073741824n,
  useApplicationCommands: 2147483648n,
  requestToSpeak: 4294967296n,
  manageEvents: 8589934592n,
  manageThreads: 17179869184n,
  createPublicThreads: 34359738368n,
  createPrivateThreads: 68719476736n,
  useExternalStickers: 137438953472n,
  sendMessagesInThreads: 274877906944n,
  useEmbeddedActivities: 549755813888n,
  moderateMembers: 1099511627776n,
  viewCreatorMonetizationAnalytics: 2199023255552n,
  useSoundboard: 4398046511104n,
  createGuildExpressions: 8796093022208n,
  createEvents: 17592186044416n,
  useExternalSounds: 35184372088832n,
  sendVoiceMessages: 70368744177664n,
  sendPolls: 562949953421312n,
  useExternalApps: 1125899906842624n,
};

const parsePermissions = (value?: string | null): bigint | null => {
  if (!value) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
};

const bitfieldHasPermission = (
  bitfield: bigint | null,
  key: PermissionKey,
): boolean | null => {
  if (bitfield === null) return null;
  const bit = permissionBits[key];
  if (!bit) return null;
  if ((bitfield & (permissionBits.administrator ?? 8n)) !== 0n) return true;
  return (bitfield & bit) !== 0n;
};

const roleBitfield = (role: RoleSummary | null): bigint | null =>
  parsePermissions(role?.permissions ?? null);

const combineRoleBitfields = (
  roles: Array<RoleSummary | null | undefined>,
): bigint | null => {
  let combined: bigint | null = null;
  for (const role of roles) {
    const bits = roleBitfield(role ?? null);
    if (bits === null) continue;
    combined = (combined ?? 0n) | bits;
  }
  return combined;
};

const applyOverwrite = (
  bitfield: bigint,
  allow: bigint | null,
  deny: bigint | null,
): bigint => {
  let next = bitfield;
  if (deny !== null) next &= ~deny;
  if (allow !== null) next |= allow;
  return next;
};

const resolveRoleOverwrite = (channel: ChannelSummary, roleId: string) =>
  channel.permissionOverwrites?.find(
    (overwrite) => overwrite.type === "role" && overwrite.id === roleId,
  ) ?? null;

const applyChannelRoleOverwrites = (
  channel: ChannelSummary,
  baseBits: bigint | null,
  roles: Array<RoleSummary | null | undefined>,
): bigint | null => {
  if (baseBits === null) return null;
  if ((baseBits & (permissionBits.administrator ?? 8n)) !== 0n) return baseBits;

  let effectiveBits = baseBits;
  const everyoneRole = roles.find((role): role is RoleSummary =>
    Boolean(role && isEveryoneRole(role)),
  );
  const everyoneOverwrite = resolveRoleOverwrite(
    channel,
    everyoneRole?.id ?? channel.guildId,
  );
  if (everyoneOverwrite) {
    effectiveBits = applyOverwrite(
      effectiveBits,
      parsePermissions(everyoneOverwrite.allow),
      parsePermissions(everyoneOverwrite.deny),
    );
  }

  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const role of roles) {
    if (!role || isEveryoneRole(role)) continue;
    const overwrite = resolveRoleOverwrite(channel, role.id);
    if (!overwrite) continue;
    roleAllow |= parsePermissions(overwrite.allow) ?? 0n;
    roleDeny |= parsePermissions(overwrite.deny) ?? 0n;
  }

  return applyOverwrite(effectiveBits, roleAllow, roleDeny);
};

const stateFromBool = (value: boolean | null | undefined): PermissionState => {
  if (typeof value !== "boolean") return "unknown";
  return value ? "allowed" : "denied";
};

const channelTypeLabel = (channel: ChannelSummary, copy: PermissionCopy) => {
  if (channel.type === "voice") return copy.contextVoice;
  if (channel.type === "forum") return copy.contextForum;
  if (channel.type === "thread") return copy.contextThread;
  if (channel.type === "dm") return copy.contextDm;
  return copy.contextText;
};

const sortedRoles = (roles: RoleSummary[]) =>
  [...roles].sort(
    (a, b) => b.position - a.position || a.name.localeCompare(b.name),
  );

const isEveryoneRole = (role: RoleSummary) =>
  role.id === role.guildId || role.name === "@everyone";

const uniqueByKey = (items: PermissionPanelItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const itemKey = String(item.key);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
};

export function ChannelPermissionsPanel({
  channel,
  roles,
  text,
  onClose,
}: {
  channel: ChannelSummary;
  roles?: RoleSummary[];
  members?: GuildMemberSummary[];
  text: UiText;
  onClose: () => void;
}) {
  const isFrench = text.allowed === "autorisé";
  const copy: PermissionCopy = isFrench
    ? {
        botView: "Bot",
        userView: "Utilisateur",
        contextText: "Salon texte",
        contextVoice: "Salon vocal",
        contextForum: "Forum",
        contextThread: "Thread",
        contextDm: "DM",
        currentSubject: "Point de vue",
        botSubject: "Bot actif",
        genericUserSubject: "Utilisateur simulé",
        selectedRoles: "Rôles de l’utilisateur simulé",
        noRoleSelected: "Aucun rôle supplémentaire sélectionné",
        noRoleLoaded: "Aucun rôle chargé pour ce serveur.",
        roleBaseIncluded: "@everyone est visible et inclus automatiquement.",
        everyoneRoleLabel: "@everyone",
        realBotResult: "Résultat effectif du bot dans ce salon.",
        simulatedUserResult:
          "Simulation avec @everyone et les rôles sélectionnés.",
        dmBotResult: "Point de vue du bot dans cette discussion privée.",
        dmUserResult:
          "Point de vue du participant dans cette discussion privée.",
        unknownShort: "inconnu",
        primary: "Résumé utile",
        botSummary: "Ce que le bot peut faire ici.",
        userSummary:
          "Ce que peut faire un utilisateur avec cette liste de rôles.",
        dmBotSummary: "Ce que le bot peut faire dans ce DM.",
        dmUserSummary: "Ce que le participant peut faire dans ce DM.",
      }
    : {
        botView: "Bot",
        userView: "User",
        contextText: "Text channel",
        contextVoice: "Voice channel",
        contextForum: "Forum",
        contextThread: "Thread",
        contextDm: "DM",
        currentSubject: "Point of view",
        botSubject: "Active bot",
        genericUserSubject: "Simulated user",
        selectedRoles: "Simulated user roles",
        noRoleSelected: "No extra role selected",
        noRoleLoaded: "No role loaded for this server.",
        roleBaseIncluded: "@everyone is visible and included automatically.",
        everyoneRoleLabel: "@everyone",
        realBotResult: "Effective bot result in this channel.",
        simulatedUserResult: "Simulation with @everyone and selected roles.",
        dmBotResult: "Bot point of view in this private discussion.",
        dmUserResult: "Participant point of view in this private discussion.",
        unknownShort: "unknown",
        primary: "Useful summary",
        botSummary: "What the bot can do here.",
        userSummary: "What a user with this role list can do.",
        dmBotSummary: "What the bot can do in this DM.",
        dmUserSummary: "What the participant can do in this DM.",
      };

  const availableRoles = useMemo(() => sortedRoles(roles ?? []), [roles]);
  const selectableRoles = useMemo(
    () => availableRoles.filter((role) => !isEveryoneRole(role)),
    [availableRoles],
  );
  const loadedEveryoneRole = availableRoles.find(isEveryoneRole) ?? null;
  const everyoneRole = useMemo<RoleSummary | null>(() => {
    if (loadedEveryoneRole) return loadedEveryoneRole;
    if (!channel.guildId || !channel.everyonePermissions) return null;

    return {
      id: channel.guildId,
      guildId: channel.guildId,
      name: "@everyone",
      position: 0,
      managed: false,
      editable: false,
      hoist: false,
      mentionable: false,
      permissions: channel.everyonePermissions,
    };
  }, [channel.everyonePermissions, channel.guildId, loadedEveryoneRole]);
  const isDm = channel.type === "dm";
  const [mode, setMode] = useState<InspectorMode>("bot");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const activeMode: InspectorMode = mode;
  const selectedRoles = selectableRoles.filter((role) =>
    selectedRoleIds.includes(role.id),
  );
  const everyoneRoleLabel = everyoneRole?.name || copy.everyoneRoleLabel;
  const simulatedUserRoles = [everyoneRole, ...selectedRoles];
  const simulatedUserBaseBits = combineRoleBitfields(simulatedUserRoles);
  const simulatedUserBits = applyChannelRoleOverwrites(
    channel,
    simulatedUserBaseBits,
    simulatedUserRoles,
  );
  const permissions = channel.permissions;
  const dmPeerLabel = channel.name || copy.userView;
  const userTabLabel = isDm ? dmPeerLabel : copy.userView;

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((id) => id !== roleId)
        : [...current, roleId],
    );
  };

  const getState = (
    key: PermissionKey,
    fallback?: boolean,
  ): PermissionState => {
    if (isDm) {
      const value = (
        permissions as unknown as
          Record<string, boolean | undefined> | undefined
      )?.[key];
      return typeof value === "boolean"
        ? stateFromBool(value)
        : typeof fallback === "boolean"
          ? stateFromBool(fallback)
          : "unknown";
    }

    if (activeMode === "user")
      return stateFromBool(bitfieldHasPermission(simulatedUserBits, key));
    if (!permissions)
      return typeof fallback === "boolean"
        ? stateFromBool(fallback)
        : "unknown";
    if (key === "sendMessages") return stateFromBool(channelCanSend(channel));
    const value = (
      permissions as unknown as Record<string, boolean | undefined>
    )[key];
    return typeof value === "boolean"
      ? stateFromBool(value)
      : typeof fallback === "boolean"
        ? stateFromBool(fallback)
        : "unknown";
  };

  const sourceLabel = isDm
    ? activeMode === "bot"
      ? copy.dmBotResult
      : copy.dmUserResult
    : activeMode === "user"
      ? copy.simulatedUserResult
      : copy.realBotResult;

  const makeItem = (
    key: PermissionKey,
    label: string,
    description: string,
    fallback?: boolean,
  ): PermissionPanelItem => ({
    key,
    label,
    description,
    state: getState(key, fallback),
    source: sourceLabel,
  });

  const textPrimary = [
    makeItem(
      "viewChannel",
      text.permissionView,
      text.permissionDescriptions.viewChannel,
      true,
    ),
    makeItem(
      "sendMessages",
      text.permissionSend,
      text.permissionDescriptions.sendMessages,
    ),
    makeItem(
      "embedLinks",
      text.permissionEmbeds,
      text.permissionDescriptions.embedLinks,
      true,
    ),
    makeItem(
      "attachFiles",
      text.permissionFiles,
      text.permissionDescriptions.attachFiles,
      true,
    ),
    makeItem(
      "readMessageHistory",
      text.permissionLabels.readMessageHistory,
      text.permissionDescriptions.readMessageHistory,
      true,
    ),
    makeItem(
      "useApplicationCommands",
      text.permissionLabels.useApplicationCommands,
      text.permissionDescriptions.useApplicationCommands,
    ),
  ];

  const voicePrimary = [
    makeItem(
      "viewChannel",
      text.permissionView,
      text.permissionDescriptions.viewChannel,
      true,
    ),
    makeItem(
      "connect",
      text.permissionLabels.connect,
      text.permissionDescriptions.connect,
    ),
    makeItem(
      "speak",
      text.permissionLabels.speak,
      text.permissionDescriptions.speak,
    ),
    makeItem(
      "stream",
      text.permissionLabels.stream,
      text.permissionDescriptions.stream,
    ),
    makeItem(
      "useVAD",
      text.permissionLabels.useVAD,
      text.permissionDescriptions.useVAD,
    ),
    makeItem(
      "moveMembers",
      text.permissionLabels.moveMembers,
      text.permissionDescriptions.moveMembers,
    ),
  ];

  const primaryItems = channel.type === "voice" ? voicePrimary : textPrimary;
  const permissionGroups: PermissionPanelGroup[] = [
    {
      key: "primary",
      title: copy.primary,
      items: primaryItems,
    },
    {
      key: "messages",
      title: text.permissionGroupMessages,
      items: uniqueByKey([
        makeItem(
          "sendMessages",
          text.permissionSend,
          text.permissionDescriptions.sendMessages,
        ),
        makeItem(
          "sendMessagesInThreads",
          text.permissionLabels.sendMessagesInThreads,
          text.permissionDescriptions.sendMessagesInThreads,
          channel.type !== "thread",
        ),
        makeItem(
          "embedLinks",
          text.permissionEmbeds,
          text.permissionDescriptions.embedLinks,
          true,
        ),
        makeItem(
          "attachFiles",
          text.permissionFiles,
          text.permissionDescriptions.attachFiles,
          true,
        ),
        makeItem(
          "addReactions",
          text.permissionReactions,
          text.permissionDescriptions.addReactions,
          true,
        ),
        makeItem(
          "manageMessages",
          text.permissionManage,
          text.permissionDescriptions.manageMessages,
        ),
        makeItem(
          "mentionEveryone",
          text.permissionLabels.mentionEveryone,
          text.permissionDescriptions.mentionEveryone,
        ),
        makeItem(
          "useApplicationCommands",
          text.permissionLabels.useApplicationCommands,
          text.permissionDescriptions.useApplicationCommands,
        ),
      ]),
    },
    {
      key: "threads",
      title: text.permissionGroupThreads,
      items: [
        makeItem(
          "createPublicThreads",
          text.permissionLabels.createPublicThreads,
          text.permissionDescriptions.createPublicThreads,
        ),
        makeItem(
          "createPrivateThreads",
          text.permissionLabels.createPrivateThreads,
          text.permissionDescriptions.createPrivateThreads,
        ),
        makeItem(
          "manageThreads",
          text.permissionLabels.manageThreads,
          text.permissionDescriptions.manageThreads,
        ),
      ],
    },
    {
      key: "voice",
      title: text.permissionGroupVoice,
      items: [
        makeItem(
          "connect",
          text.permissionLabels.connect,
          text.permissionDescriptions.connect,
        ),
        makeItem(
          "speak",
          text.permissionLabels.speak,
          text.permissionDescriptions.speak,
        ),
        makeItem(
          "stream",
          text.permissionLabels.stream,
          text.permissionDescriptions.stream,
        ),
        makeItem(
          "prioritySpeaker",
          text.permissionLabels.prioritySpeaker,
          text.permissionDescriptions.prioritySpeaker,
        ),
        makeItem(
          "muteMembers",
          text.permissionLabels.muteMembers,
          text.permissionDescriptions.muteMembers,
        ),
        makeItem(
          "deafenMembers",
          text.permissionLabels.deafenMembers,
          text.permissionDescriptions.deafenMembers,
        ),
        makeItem(
          "moveMembers",
          text.permissionLabels.moveMembers,
          text.permissionDescriptions.moveMembers,
        ),
        makeItem(
          "requestToSpeak",
          text.permissionLabels.requestToSpeak,
          text.permissionDescriptions.requestToSpeak,
        ),
      ],
    },
    {
      key: "server",
      title: text.permissionGroupServer,
      items: [
        makeItem(
          "administrator",
          text.permissionLabels.administrator,
          text.permissionDescriptions.administrator,
        ),
        makeItem(
          "manageChannels",
          text.permissionLabels.manageChannels,
          text.permissionDescriptions.manageChannels,
        ),
        makeItem(
          "manageRoles",
          text.permissionLabels.manageRoles,
          text.permissionDescriptions.manageRoles,
        ),
        makeItem(
          "viewAuditLog",
          text.permissionLabels.viewAuditLog,
          text.permissionDescriptions.viewAuditLog,
        ),
        makeItem(
          "kickMembers",
          text.permissionLabels.kickMembers,
          text.permissionDescriptions.kickMembers,
        ),
        makeItem(
          "banMembers",
          text.permissionLabels.banMembers,
          text.permissionDescriptions.banMembers,
        ),
        makeItem(
          "moderateMembers",
          text.permissionLabels.moderateMembers,
          text.permissionDescriptions.moderateMembers,
        ),
        makeItem(
          "manageGuild",
          text.permissionLabels.manageGuild,
          text.permissionDescriptions.manageGuild,
        ),
      ],
    },
    {
      key: "integrations",
      title: text.permissionGroupIntegrations,
      items: [
        makeItem(
          "manageWebhooks",
          text.permissionLabels.manageWebhooks,
          text.permissionDescriptions.manageWebhooks,
        ),
        makeItem(
          "manageEmojisAndStickers",
          text.permissionLabels.manageEmojisAndStickers,
          text.permissionDescriptions.manageEmojisAndStickers,
        ),
        makeItem(
          "manageEvents",
          text.permissionLabels.manageEvents,
          text.permissionDescriptions.manageEvents,
        ),
        makeItem(
          "createEvents",
          text.permissionLabels.createEvents,
          text.permissionDescriptions.createEvents,
        ),
        makeItem(
          "useExternalApps",
          text.permissionLabels.useExternalApps,
          text.permissionDescriptions.useExternalApps,
        ),
        makeItem(
          "useEmbeddedActivities",
          text.permissionLabels.useEmbeddedActivities,
          text.permissionDescriptions.useEmbeddedActivities,
        ),
      ],
    },
  ];

  const permissionItems = permissionGroups.flatMap((group) => group.items);
  const allowedCount = permissionItems.filter(
    (item) => item.state === "allowed",
  ).length;
  const deniedCount = permissionItems.filter(
    (item) => item.state === "denied",
  ).length;
  const unknownCount = permissionItems.filter(
    (item) => item.state === "unknown",
  ).length;
  const selectedRoleNames = [
    everyoneRoleLabel,
    ...selectedRoles.map((role) => role.name),
  ].join(", ");
  const subjectLabel = isDm
    ? activeMode === "bot"
      ? copy.botSubject
      : dmPeerLabel
    : activeMode === "bot"
      ? copy.botSubject
      : selectedRoleNames || copy.genericUserSubject;

  const renderStateIcon = (state: PermissionState) =>
    state === "allowed" ? "✓" : state === "denied" ? "×" : "?";
  const renderStateLabel = (state: PermissionState) =>
    state === "allowed"
      ? text.allowed
      : state === "denied"
        ? text.denied
        : copy.unknownShort;
  const panelHint = isDm
    ? activeMode === "bot"
      ? copy.dmBotSummary
      : copy.dmUserSummary
    : activeMode === "bot"
      ? copy.botSummary
      : copy.userSummary;

  return (
    <Modal
      as="div"
      backdropClassName="permissionPanelOverlay"
      surfaceClassName="permissionPanelCard permissionInspectorCard"
      aria-label={text.channelPermissions}
      onClose={onClose}
    >
        <div className="permissionPanelHeader">
          <div>
            <p className="permissionPanelEyebrow">{text.channelPermissions}</p>
            <h2>{isDm ? channel.name : `#${channel.name}`}</h2>
            <p className="permissionPanelSubtitle">
              {channelTypeLabel(channel, copy)} · {copy.currentSubject} :{" "}
              {subjectLabel}
            </p>
          </div>

          <Button
            variant="unstyled"
            className="permissionPanelClose"
            type="button"
            onClick={onClose}
            aria-label={text.close}
          >
            ×
          </Button>
        </div>

        <Tabs
          className="permissionInspectorTabs"
          aria-label={text.channelPermissions}
        >
          <TabButton
            type="button"
            active={activeMode === "bot"}
            onClick={() => setMode("bot")}
          >
            {copy.botView}
          </TabButton>
          <TabButton
            type="button"
            active={activeMode === "user"}
            onClick={() => setMode("user")}
          >
            {userTabLabel}
          </TabButton>
        </Tabs>

        {!isDm && activeMode === "user" ? (
          <div className="permissionInspectorSelector">
            <div className="permissionInspectorSelectorHead">
              <span>{copy.selectedRoles}</span>
              <small>{copy.roleBaseIncluded}</small>
            </div>
            {everyoneRole || selectableRoles.length > 0 ? (
              <div
                className="permissionInspectorRoleList"
                aria-label={copy.selectedRoles}
              >
                <Button
                  variant="unstyled"
                  type="button"
                  className="isSelected isBaseRole"
                  aria-pressed="true"
                  aria-disabled="true"
                  tabIndex={-1}
                >
                  {everyoneRoleLabel}
                </Button>
                {selectableRoles.map((role) => {
                  const selected = selectedRoleIds.includes(role.id);
                  return (
                    <Button
                      variant="unstyled"
                      key={role.id}
                      type="button"
                      className={selected ? "isSelected" : ""}
                      aria-pressed={selected}
                      onClick={() => toggleRole(role.id)}
                    >
                      {role.name}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="permissionInspectorRoleEmpty">
                {copy.noRoleLoaded}
              </p>
            )}
            {(everyoneRole || selectableRoles.length > 0) &&
            selectedRoles.length === 0 ? (
              <p className="permissionInspectorRoleEmpty">
                {copy.noRoleSelected}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="permissionPanelSummary permissionInspectorSummary">
          <div className="permissionPanelSummaryItem isAllowed">
            <strong>{allowedCount}</strong>
            <span>{text.allowed}</span>
          </div>
          <div className="permissionPanelSummaryItem isDenied">
            <strong>{deniedCount}</strong>
            <span>{text.denied}</span>
          </div>
          <div className="permissionPanelSummaryItem isUnknown">
            <strong>{unknownCount}</strong>
            <span>{copy.unknownShort}</span>
          </div>
        </div>

        <div className="permissionPanelScroll">
          {permissionGroups.map((group) => (
            <Section key={group.key} className="permissionPanelGroup">
              <h3>{group.title}</h3>
              <div className="permissionPanelGrid">
                {group.items.map((item) => (
                  <div
                    key={String(item.key)}
                    className={`permissionPanelItem is${item.state === "allowed" ? "Allowed" : item.state === "denied" ? "Denied" : "Unknown"}`}
                  >
                    <div className="permissionPanelItemIcon" aria-hidden="true">
                      {renderStateIcon(item.state)}
                    </div>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                      <small>
                        {renderStateLabel(item.state)} · {item.source}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ))}
        </div>

        <p className="permissionPanelHint">{panelHint}</p>
    </Modal>
  );
}
