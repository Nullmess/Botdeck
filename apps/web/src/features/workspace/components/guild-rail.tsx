"use client";

// Rail de serveurs Botdeck.


import type { WorkspaceState } from "@botdeck/shared";
import { BotdeckLogo, type UiText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type GuildActivity = Record<string, { unreadCount: number; mentionCount: number } | undefined>;

export function GuildRail({
  text,
  botdeckHomeOpen,
  totalDmUnread,
  totalDmMentions,
  guilds,
  guildActivityById,
  activeGuildId,
  onOpenHome,
  onSelectGuild,
}: {
  text: UiText;
  botdeckHomeOpen: boolean;
  totalDmUnread: number;
  totalDmMentions: number;
  guilds: WorkspaceState["guilds"];
  guildActivityById: GuildActivity;
  activeGuildId: string | null;
  onOpenHome: () => void;
  onSelectGuild: (guildId: string) => void;
}) {
  return (
    <aside className="guildRail" aria-label={text.serverList}>
      <Button variant="unstyled" className={`brandMark${botdeckHomeOpen ? " isActive" : ""}`} type="button" title="Botdeck" onClick={onOpenHome}>
        <BotdeckLogo />
        {totalDmUnread ? <Badge className={`navUnreadBadge${totalDmMentions ? " hasMention" : ""}`} tone="unstyled">{totalDmUnread > 99 ? "99+" : totalDmUnread}</Badge> : null}
      </Button>
      <div className="guildSeparator" aria-hidden="true" />
      {guilds.length ? (
        guilds.map((guild) => {
          const active = guild.id === activeGuildId;
          const guildActivity = guildActivityById[guild.id];
          const guildBadgeCount = guildActivity?.mentionCount || guildActivity?.unreadCount || 0;
          return (
            <Button variant="unstyled"
              key={guild.id}
              className={`guildButton${active ? " isActive" : ""}`}
              type="button"
              title={guild.name}
              onClick={() => onSelectGuild(guild.id)}
            >
              {guild.iconUrl ? <img className="guildIcon" src={guild.iconUrl} alt="" aria-hidden="true" /> : <span>{guild.name.slice(0, 1).toUpperCase()}</span>}
              {guildBadgeCount ? <Badge className={`guildUnreadBadge${guildActivity?.mentionCount ? " hasMention" : ""}`} tone="unstyled">{guildBadgeCount > 99 ? "99+" : guildBadgeCount}</Badge> : null}
            </Button>
          );
        })
      ) : (
        <Button variant="unstyled" className="guildButton isActive" type="button">
          <span>?</span>
        </Button>
      )}
    </aside>
  );
}
