"use client";

// Panneaux d'interface principaux BotDeck

import { Input } from "@/components/ui/field";
import {
  type BotAccountSummary,
  type ChannelSummary,
  type ClientCommand,
  type WorkspaceState,
} from "@botdeck/shared";
import { type CSSProperties, type FormEvent } from "react";
import { i18nText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useModalLayer } from "@/components/ui/modal-stack";
import { Card, Panel, Section } from "@/components/ui/panel";

import {
  AppBadge,
  ApplicationCommandBadge,
  type BotCustomStatusState,
  botCustomStatusMaxLength,
  defaultBotCustomStatus,
  discordSnowflakeCreatedAt,
  displayUserName,
  dmGuildId,
  formatBotCustomStatus,
  formatTime,
  handleExternalLinkClick,
  memberProfileKey,
  type PresenceChoice,
  profileAccentFromId,
  stripDiscriminator,
  type UiText,
} from "@/features/workspace/core";

// Token: enregistrement local, jamais réaffiché.
export function BotTokenModal({
  onClose,
  onSubmit,
  token,
  setToken,
  readOnlyMode,
  setReadOnlyMode,
  readOnlyBlockMessages,
  setReadOnlyBlockMessages,
  readOnlyBlockChannels,
  setReadOnlyBlockChannels,
  readOnlyBlockModeration,
  setReadOnlyBlockModeration,
  loading,
  error,
  closing,
  text,
  onExternalLink,
}: {
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  token: string;
  setToken: (value: string) => void;
  readOnlyMode: boolean;
  setReadOnlyMode: (value: boolean) => void;
  readOnlyBlockMessages: boolean;
  setReadOnlyBlockMessages: (value: boolean) => void;
  readOnlyBlockChannels: boolean;
  setReadOnlyBlockChannels: (value: boolean) => void;
  readOnlyBlockModeration: boolean;
  setReadOnlyBlockModeration: (value: boolean) => void;
  loading: boolean;
  error: string | null;
  closing: boolean;
  text: UiText;
  onExternalLink: (url: string, label?: string) => void;
}) {
  return (
    <Modal
      surfaceClassName={`botModal botTokenModal${closing ? " isClosing" : ""}`}
      aria-label={text.addBotDialog}
      onClose={loading || closing ? undefined : onClose}
    >
        <div className="botModalHeader">
          <div className="botModalTitleBlock">
            <div>
              <p className="eyebrow">{text.addBot}</p>
              <h2>{text.pasteToken}</h2>
            </div>
          </div>
          <Button
            variant="unstyled"
            className="modalClose"
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label={text.close}
          >
            ×
          </Button>
        </div>
        <p className="subtle botTokenHelp">
          {text.pasteTokenHelp}{" "}
          <a
            className="discordHelpLink"
            href="https://discord.com/developers/home"
            target="_blank"
            rel="noreferrer"
            onClick={(event) =>
              handleExternalLinkClick(
                event,
                "https://discord.com/developers/home",
                text.discordDeveloperPortal,
                onExternalLink,
              )
            }
          >
            {text.discordDeveloperPortal}
          </a>
          .
        </p>
        <div
          className={`botTokenSafetyPanel${readOnlyMode ? " isExpanded" : ""}`}
        >
          <div
            className={`botTokenSafetyOption botTokenSafetyOptionPrimary${readOnlyMode ? " isExpanded" : ""}`}
          >
            <label className="botTokenSafetyOptionToggle">
              <Input
                type="checkbox"
                checked={readOnlyMode}
                onChange={(event) => {
                  const nextReadOnlyMode = event.target.checked;
                  setReadOnlyMode(nextReadOnlyMode);
                  if (!nextReadOnlyMode) {
                    setReadOnlyBlockMessages(false);
                    setReadOnlyBlockChannels(false);
                    setReadOnlyBlockModeration(false);
                  }
                }}
                disabled={loading}
              />
              <span>
                <strong>{text.disableSlashStudio}</strong>
                <small>{text.disableSlashStudioHelp}</small>
              </span>
              <span className="botTokenSafetyChevron" aria-hidden="true">
                ⌄
              </span>
            </label>
            <div
              className="botTokenSafetyDetails"
              aria-label={text.readOnlyPolicyTitle}
              aria-hidden={!readOnlyMode}
            >
              <div className="botTokenSafetyDetailsScroll">
                <p className="botTokenSafetyDetailsTitle">
                  {text.readOnlyPolicyTitle}
                </p>
                <label className="botTokenSafetyOption isLocked">
                  <Input
                    type="checkbox"
                    checked
                    readOnly
                    disabled
                    tabIndex={readOnlyMode ? 0 : -1}
                  />
                  <span>
                    <strong>{text.readOnlyBlockSlashStudio}</strong>
                    <small>{text.readOnlyBlockSlashStudioHelp}</small>
                  </span>
                </label>
                <label className="botTokenSafetyOption isLocked">
                  <Input
                    type="checkbox"
                    checked
                    readOnly
                    disabled
                    tabIndex={readOnlyMode ? 0 : -1}
                  />
                  <span>
                    <strong>{text.readOnlyBlockAutomationTemplates}</strong>
                    <small>{text.readOnlyBlockAutomationTemplatesHelp}</small>
                  </span>
                </label>
                <label className="botTokenSafetyOption">
                  <Input
                    type="checkbox"
                    checked={readOnlyBlockMessages}
                    onChange={(event) =>
                      setReadOnlyBlockMessages(event.target.checked)
                    }
                    disabled={loading || !readOnlyMode}
                    tabIndex={readOnlyMode ? 0 : -1}
                  />
                  <span>
                    <strong>{text.readOnlyBlockMessaging}</strong>
                    <small>{text.readOnlyBlockMessagingHelp}</small>
                  </span>
                </label>
                <label className="botTokenSafetyOption">
                  <Input
                    type="checkbox"
                    checked={readOnlyBlockChannels}
                    onChange={(event) =>
                      setReadOnlyBlockChannels(event.target.checked)
                    }
                    disabled={loading || !readOnlyMode}
                    tabIndex={readOnlyMode ? 0 : -1}
                  />
                  <span>
                    <strong>{text.readOnlyBlockChannels}</strong>
                    <small>{text.readOnlyBlockChannelsHelp}</small>
                  </span>
                </label>
                <label className="botTokenSafetyOption">
                  <Input
                    type="checkbox"
                    checked={readOnlyBlockModeration}
                    onChange={(event) =>
                      setReadOnlyBlockModeration(event.target.checked)
                    }
                    disabled={loading || !readOnlyMode}
                    tabIndex={readOnlyMode ? 0 : -1}
                  />
                  <span>
                    <strong>{text.readOnlyBlockModeration}</strong>
                    <small>{text.readOnlyBlockModerationHelp}</small>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
        {error ? <p className="modalError">{error}</p> : null}
        <form className="botForm" onSubmit={onSubmit}>
          <Input
            className="composerInput botTokenInput"
            type="password"
            placeholder={text.botToken}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoFocus
            disabled={loading}
          />
          <Button type="submit" disabled={!token.trim()} isLoading={loading}>
            {text.addBot}
          </Button>
        </form>
    </Modal>
  );
}

// Overlay de transition.
export function TransitionOverlay({
  bot,
  fallbackName,
  closing,
  text,
}: {
  bot: BotAccountSummary | null;
  fallbackName: string;
  closing: boolean;
  text: UiText;
}) {
  const displayBotName = stripDiscriminator(bot?.name ?? fallbackName);
  return (
    <div
      className={`transitionOverlay${closing ? " isClosing" : ""}`}
      role="status"
      aria-live="polite"
    >
      <Card as="div" className="transitionCard">
        <p className="eyebrow">{text.connectedBot}</p>
        <h2>{displayBotName}</h2>
        <div className="transitionBotAvatar" aria-hidden="true">
          {bot?.avatarUrl ? (
            <img src={bot.avatarUrl} alt="" />
          ) : (
            <span>{displayBotName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <p className="subtle">{text.preparingWorkspace}</p>
        <div className="transitionProgress">
          <span />
        </div>
      </Card>
    </div>
  );
}

// Accueil Botdeck.
export function BotdeckHomePanel({
  members,
  presences,
  latestMessageByUserId,
  search,
  onSearchChange,
  onOpenMember,
  text,
}: {
  members: WorkspaceState["usersById"][string][];
  presences: WorkspaceState["presencesByUserId"];
  latestMessageByUserId: Map<string, string>;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenMember: (userId: string) => void;
  text: UiText;
}) {
  const normalizedSearch = search.trim().toLowerCase();
  const filteredMembers = normalizedSearch
    ? members.filter((user) =>
        `${user.displayName ?? ""} ${user.username}`
          .toLowerCase()
          .includes(normalizedSearch),
      )
    : members;

  return (
    <Panel className="botdeckHome">
      <div className="botdeckHomeHero">
        <p className="eyebrow">{i18nText("Botdeck Home")}</p>
        <h3>{text.contactableMembers}</h3>
        <p className="subtle">{text.homeHelp}</p>
      </div>

      <Card className="botdeckHomeCard">
        <div className="botdeckHomeCardHeader">
          <h3>{text.knownUsers}</h3>
          <span>{filteredMembers.length}</span>
        </div>
        <label className="homeSearch">
          <span>{text.search}</span>
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={text.userSearchPlaceholder}
          />
        </label>
        <div className="homeMemberGrid">
          {filteredMembers.length ? (
            filteredMembers.map((user) => {
              const label = displayUserName(user);
              const presence =
                presences[user.id]?.status ?? user.status ?? "offline";
              const lastMessageAt = latestMessageByUserId.get(user.id);
              return (
                <Button
                  variant="unstyled"
                  key={user.id}
                  className="homeMemberCard"
                  type="button"
                  onClick={() => onOpenMember(user.id)}
                >
                  <span className="globalMemberAvatar">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" aria-hidden="true" />
                    ) : (
                      label.slice(0, 1).toUpperCase()
                    )}
                    <span className={`presenceDot ${presence}`} />
                  </span>
                  <span>
                    <span className="authorNameLine">
                      <strong>{label}</strong>
                      {user.bot ? <AppBadge /> : null}
                    </span>
                    <small>
                      {lastMessageAt
                        ? text.lastMessage(formatTime(lastMessageAt))
                        : presence}
                    </small>
                  </span>
                </Button>
              );
            })
          ) : (
            <p className="homeEmpty">{text.noUserMatch}</p>
          )}
        </div>
      </Card>
    </Panel>
  );
}

// Profil membre.
export function MemberProfilePanel({
  target,
  profile,
  fallbackUser,
  roles,
  voiceChannels,
  guildName,
  presenceStatus,
  presenceLabel,
  activeBotId,
  activeBotUserId,
  activeBotCommandCount,
  moderationLocked = false,
  botCustomStatus,
  botCustomStatusDirty,
  onBotCustomStatusChange,
  onCancelBotCustomStatus,
  onApplyBotCustomStatus,
  allGuilds,
  allProfiles,
  onClose,
  onCommand,
  onRequestModeration,
  onSwitchProfile,
  onOpenDm,
  text,
}: {
  target: { guildId: string; userId: string };
  profile: WorkspaceState["memberProfilesByKey"][string] | null;
  fallbackUser?: WorkspaceState["usersById"][string];
  roles: WorkspaceState["rolesByGuildId"][string];
  voiceChannels: ChannelSummary[];
  guildName: string | null;
  presenceStatus: PresenceChoice;
  presenceLabel: string;
  activeBotId: string | null;
  activeBotUserId: string | null;
  activeBotCommandCount: number;
  moderationLocked?: boolean;
  botCustomStatus: BotCustomStatusState;
  botCustomStatusDirty: boolean;
  onBotCustomStatusChange: (status: BotCustomStatusState) => void;
  onCancelBotCustomStatus: () => void;
  onApplyBotCustomStatus: () => void;
  allGuilds: WorkspaceState["guilds"];
  allProfiles: WorkspaceState["memberProfilesByKey"];
  onClose: () => void;
  onCommand: (command: ClientCommand) => void;
  onRequestModeration: (action: "kick" | "ban", target: { guildId: string; userId: string; displayName: string }) => void;
  onSwitchProfile: (guildId: string, userId: string) => void;
  onOpenDm: (userId: string) => void;
  text: UiText;
}) {
  const layer = useModalLayer();
  const isDmProfile = target.guildId === dmGuildId;
  const displayName =
    profile?.displayName ??
    fallbackUser?.displayName ??
    fallbackUser?.username ??
    profile?.username ??
    target.userId;
  const username = profile?.username ?? fallbackUser?.username ?? displayName;
  const avatarUrl = profile?.avatarUrl ?? fallbackUser?.avatarUrl ?? null;
  const bannerUrl = profile?.bannerUrl ?? null;
  const avatarDecorationUrl = profile?.avatarDecorationUrl ?? null;
  const isBot = Boolean(profile?.bot ?? fallbackUser?.bot);
  const supportsApplicationCommands = Boolean(
    isBot &&
    (profile?.supportsApplicationCommands ||
      fallbackUser?.supportsApplicationCommands ||
      (target.userId === activeBotUserId && activeBotCommandCount > 0)),
  );
  const accountCreatedAt = discordSnowflakeCreatedAt(target.userId);
  const memberRoleIds = new Set(profile?.roleIds ?? []);
  const currentVoiceChannel = profile?.voiceChannelId
    ? (voiceChannels.find((channel) => channel.id === profile.voiceChannelId) ??
      null)
    : null;
  const assignedRoles = roles.filter((role) => memberRoleIds.has(role.id));
  const canSend = Boolean(activeBotId) && !isDmProfile;
  const canModerate = canSend && !moderationLocked;
  const profileAccent = isDmProfile
    ? profileAccentFromId(target.userId)
    : "var(--accent)";
  const cachedMutualGuilds = allGuilds
    .filter((guild) =>
      Boolean(allProfiles[memberProfileKey(guild.id, target.userId)]),
    )
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl ?? null,
    }));
  const mutualGuildMap = new Map<
    string,
    { id: string; name: string; iconUrl?: string | null }
  >();
  for (const guild of cachedMutualGuilds) mutualGuildMap.set(guild.id, guild);
  for (const guild of profile?.mutualGuilds ?? [])
    mutualGuildMap.set(guild.id, guild);
  if (!isDmProfile) {
    const currentGuild = allGuilds.find((guild) => guild.id === target.guildId);
    mutualGuildMap.set(target.guildId, {
      id: target.guildId,
      name: currentGuild?.name ?? guildName ?? target.guildId,
      iconUrl: currentGuild?.iconUrl ?? null,
    });
  }
  const mutualGuilds = Array.from(mutualGuildMap.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const normalizedPresenceStatus: PresenceChoice = [
    "online",
    "idle",
    "dnd",
    "offline",
  ].includes(presenceStatus)
    ? presenceStatus
    : "offline";
  const customStatusValue = formatBotCustomStatus(botCustomStatus);

  const updateCustomStatus = (patch: Partial<BotCustomStatusState>) => {
    const next = { ...botCustomStatus, ...patch };
    next.text = next.text.slice(0, botCustomStatusMaxLength);
    next.emoji = "";
    next.enabled = Boolean(next.text.trim());
    onBotCustomStatusChange(next);
  };

  const buildCommandBase = () => ({
    requestId: crypto.randomUUID(),
    botId: activeBotId ?? undefined,
    guildId: target.guildId,
    userId: target.userId,
  });

  return (
    <>
      <Button
        variant="unstyled"
        className="profileModalBackdrop"
        type="button"
        aria-label={text.closeMemberProfile}
        onClick={onClose}
        style={{ zIndex: layer.backdrop }}
      />
      <aside
        className={`memberProfilePanel memberProfileRedesign${isDmProfile ? " isDmProfile" : " isServerProfile"}`}
        aria-label={isDmProfile ? text.dmProfile : text.serverProfile}
        style={
          {
            "--profile-accent": profileAccent,
            "--profile-banner": bannerUrl ? `url(${bannerUrl})` : undefined,
            zIndex: layer.surface,
          } as CSSProperties
        }
      >
        <div className="memberProfileHero">
          <div className="memberProfileBanner memberProfileBannerEnhanced">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                alt=""
                aria-hidden="true"
                className="memberProfileBannerImage"
              />
            ) : null}
            <div className="memberProfileBannerOverlay" />
          </div>
          <header className="memberProfileHeader memberProfileHeaderEnhanced">
            <span className="memberProfileAvatar memberProfileAvatarEnhanced">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" aria-hidden="true" />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
              {avatarDecorationUrl ? (
                <img
                  src={avatarDecorationUrl}
                  alt=""
                  aria-hidden="true"
                  className="memberProfileAvatarDecoration"
                />
              ) : null}
              <span
                className={`presenceDot isProfileStatus ${normalizedPresenceStatus}`}
                title={presenceLabel}
                aria-label={presenceLabel}
              />
            </span>
          </header>
          <div className="memberProfileIdentity memberProfileIdentityEnhanced">
            <div className="memberProfileTitleStack">
              <h3 className="memberProfileNameLine">
                <span>{displayName}</span>
                {isBot ? <AppBadge /> : null}
              </h3>
              <p className="memberProfileUsernameLine">
                <span>@{username}</span>
                {supportsApplicationCommands ? (
                  <ApplicationCommandBadge label={text.supportsCommands} />
                ) : null}
              </p>
              <Button
                variant="unstyled"
                type="button"
                className="memberProfileHeroMessageButton"
                onClick={() => {
                  onOpenDm(target.userId);
                  onClose();
                }}
              >
                💬 {text.openDm}
              </Button>
            </div>
          </div>
          {target.userId === activeBotUserId ? (
            <div className="memberProfileCustomStatusBubble isEditableDiscord">
              <div className="customStatusTextWrap">
                <Input
                  className="customStatusTextInput"
                  value={botCustomStatus.text}
                  maxLength={botCustomStatusMaxLength}
                  onChange={(event) =>
                    updateCustomStatus({ text: event.target.value })
                  }
                  placeholder={text.botCustomStatusPlaceholder}
                />
                <span>
                  {botCustomStatus.text.length}/{botCustomStatusMaxLength}
                </span>
              </div>
              {customStatusValue ? (
                <Button
                  variant="unstyled"
                  type="button"
                  className="customStatusClearButton"
                  aria-label={text.botCustomStatusRemove}
                  onClick={() => updateCustomStatus(defaultBotCustomStatus)}
                >
                  ×
                </Button>
              ) : null}
            </div>
          ) : customStatusValue && isBot ? (
            <div className="memberProfileCustomStatusBubble isReadOnly">
              <span className="memberProfileCustomStatusText">
                {customStatusValue}
              </span>
            </div>
          ) : null}
        </div>

        {!isDmProfile ? (
          <Card
            as="section"
            className="memberProfileCard memberProfileSwitchCard"
          >
            <div className="memberProfileSectionHeader">
              <h4>{text.mutualServers}</h4>
              {mutualGuilds.length > 1 ? (
                <small>{text.mutualServersCount(mutualGuilds.length)}</small>
              ) : null}
            </div>
            <div className="memberProfileContextSwitcher isServerOnly">
              {mutualGuilds.map((guild) => {
                const active = guild.id === target.guildId;
                return (
                  <Button
                    variant="unstyled"
                    key={guild.id}
                    type="button"
                    className={`memberProfileContextTab ${active ? "isActive" : ""}`}
                    onClick={() => onSwitchProfile(guild.id, target.userId)}
                    title={text.openServerProfile(guild.name)}
                  >
                    <span className="memberProfileServerIcon">
                      {guild.iconUrl ? (
                        <img src={guild.iconUrl} alt="" aria-hidden="true" />
                      ) : (
                        guild.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>
                      <strong>{guild.name}</strong>
                      <small>
                        {active ? text.serverProfile : text.viewAsServerMember}
                      </small>
                    </span>
                  </Button>
                );
              })}
            </div>
          </Card>
        ) : null}

        <Card
          as="section"
          className={`memberProfileCard memberProfileOverviewGrid${isDmProfile ? " isDmOnly" : " isServerUnified"}`}
        >
          <div className="memberProfileInfoPanel">
            <div className="memberProfileSectionHeader">
              <h4>{isDmProfile ? text.dmIdentity : text.serverIdentity}</h4>
            </div>
            <div className="memberProfileUnifiedFacts">
              <div className="memberFactGrid isProfileFacts">
                <span>
                  <strong>{text.displayNameLabel}</strong>
                  <small>{displayName}</small>
                </span>
                <span>
                  <strong>{text.usernameLabel}</strong>
                  <small>@{username}</small>
                </span>
                <span>
                  <strong>{text.status}</strong>
                  <small className="presenceInlineStatus">
                    <span
                      className={`presenceDot ${normalizedPresenceStatus}`}
                      aria-hidden="true"
                    />
                    {presenceLabel}
                  </small>
                </span>
                <span>
                  <strong>{text.accountCreated}</strong>
                  <small>
                    {accountCreatedAt
                      ? accountCreatedAt.toLocaleDateString()
                      : text.unknown}
                  </small>
                </span>
                <span>
                  <strong>{text.userKind}</strong>
                  <small>{isBot ? text.botAccount : text.humanAccount}</small>
                </span>
              </div>
              {!isDmProfile ? (
                <>
                  <div className="memberFactGrid isProfileFacts">
                    <span>
                      <strong>{text.memberSince}</strong>
                      <small>
                        {profile?.joinedAt
                          ? new Date(profile.joinedAt).toLocaleDateString()
                          : profile
                            ? text.unknown
                            : text.loadingProfile}
                      </small>
                    </span>
                    <span>
                      <strong>{text.timeout}</strong>
                      <small>
                        {profile?.timeoutUntil
                          ? new Date(profile.timeoutUntil).toLocaleString()
                          : text.none}
                      </small>
                    </span>
                    <span>
                      <strong>{text.voice}</strong>
                      <small>
                        {currentVoiceChannel?.name ?? text.notConnected}
                      </small>
                    </span>
                    <span>
                      <strong>{text.roles}</strong>
                      <small>{text.roleCount(assignedRoles.length)}</small>
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </Card>

        {!isDmProfile ? (
          <>
            <Card as="section" className="memberProfileCard">
              <div className="memberProfileSectionHeader">
                <h4>{text.moderation}</h4>
              </div>
              <div className="memberActionGrid">
                <Button
                  variant="unstyled"
                  type="button"
                  className={moderationLocked ? "isReadonlyLocked" : "danger"}
                  disabled={!canModerate || moderationLocked}
                  title={
                    moderationLocked ? text.readOnlyModeWriteBlocked : undefined
                  }
                  onClick={() =>
                    onRequestModeration("kick", {
                      guildId: target.guildId,
                      userId: target.userId,
                      displayName,
                    })
                  }
                >
                  {text.kick}
                </Button>
                <Button
                  variant="unstyled"
                  type="button"
                  className={moderationLocked ? "isReadonlyLocked" : "danger"}
                  disabled={!canModerate || moderationLocked}
                  title={
                    moderationLocked ? text.readOnlyModeWriteBlocked : undefined
                  }
                  onClick={() =>
                    onRequestModeration("ban", {
                      guildId: target.guildId,
                      userId: target.userId,
                      displayName,
                    })
                  }
                >
                  {text.ban}
                </Button>
              </div>
            </Card>

            <Card as="section" className="memberProfileCard">
              <div className="memberProfileSectionHeader">
                <h4>{text.roles}</h4>
              </div>
              <div className="memberRoleList">
                {roles.length ? (
                  roles.map((role) => {
                    const assigned = memberRoleIds.has(role.id);
                    return (
                      <Button
                        variant="unstyled"
                        key={role.id}
                        type="button"
                        disabled={!canSend || moderationLocked || role.managed}
                        className={`${assigned ? "isAssigned" : "isNotAssigned"}${moderationLocked ? " isReadonlyLocked" : ""}`}
                        title={
                          moderationLocked
                            ? text.readOnlyModeWriteBlocked
                            : undefined
                        }
                        style={
                          {
                            "--role-color": role.color
                              ? `#${role.color.toString(16).padStart(6, "0")}`
                              : "rgba(255,255,255,0.16)",
                          } as CSSProperties
                        }
                        onClick={() =>
                          onCommand({
                            ...buildCommandBase(),
                            type: assigned
                              ? "member.role.remove"
                              : "member.role.add",
                            roleId: role.id,
                          } satisfies ClientCommand)
                        }
                      >
                        <span
                          className="roleSwatch"
                          style={{
                            backgroundColor: role.color
                              ? `#${role.color.toString(16).padStart(6, "0")}`
                              : "rgba(255,255,255,0.16)",
                          }}
                        />
                        <span>{role.name}</span>
                        <small>
                          {role.managed
                            ? text.managed
                            : assigned
                              ? text.remove
                              : text.add}
                        </small>
                      </Button>
                    );
                  })
                ) : (
                  <p className="pinsPanelEmpty">{text.noServerRoleReceived}</p>
                )}
              </div>
            </Card>

            <Card as="section" className="memberProfileCard">
              <div className="memberProfileSectionHeader">
                <h4>{text.voice}</h4>
              </div>
              <div className="memberActionGrid">
                <Button
                  variant="unstyled"
                  type="button"
                  disabled={
                    !canModerate || !profile?.voiceChannelId || moderationLocked
                  }
                  className={moderationLocked ? "isReadonlyLocked" : ""}
                  title={
                    moderationLocked ? text.readOnlyModeWriteBlocked : undefined
                  }
                  onClick={() =>
                    onCommand({
                      ...buildCommandBase(),
                      type: "voice.member.move",
                      channelId: null,
                    } satisfies ClientCommand)
                  }
                >
                  {text.disconnect}
                </Button>
              </div>
              <div className="voiceMoveList">
                {voiceChannels.map((channel) => (
                  <Button
                    variant="unstyled"
                    key={channel.id}
                    type="button"
                    disabled={
                      !canModerate ||
                      profile?.voiceChannelId === channel.id ||
                      moderationLocked
                    }
                    className={moderationLocked ? "isReadonlyLocked" : ""}
                    title={
                      moderationLocked
                        ? text.readOnlyModeWriteBlocked
                        : undefined
                    }
                    onClick={() =>
                      onCommand({
                        ...buildCommandBase(),
                        type: "voice.member.move",
                        channelId: channel.id,
                      } satisfies ClientCommand)
                    }
                  >
                    {text.moveTo(channel.name)}
                  </Button>
                ))}
              </div>
            </Card>
          </>
        ) : null}
        {target.userId === activeBotUserId ? (
          <div
            className={`settingsSaveBar memberProfileSaveBar${botCustomStatusDirty ? " isVisible" : ""}`}
            aria-hidden={!botCustomStatusDirty}
          >
            <span>{text.unsavedChanges}</span>
            <Button
              variant="unstyled"
              className="settingsCancelButton"
              type="button"
              onClick={onCancelBotCustomStatus}
            >
              {text.cancel}
            </Button>
            <Button
              variant="unstyled"
              className="settingsSaveButton"
              type="button"
              onClick={onApplyBotCustomStatus}
            >
              {text.save}
            </Button>
          </div>
        ) : null}
      </aside>
    </>
  );
}
