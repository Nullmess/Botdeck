"use client";

// Recherche mess locaux

import { Input } from "../ui/field";
import { type MessageSummary, type WorkspaceState } from "@botdeck/shared";
import { useState, type ReactNode } from "react";
import { i18nText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Inline, Split, Stack } from "@/components/ui/layout";
import { Card, Panel, Section } from "@/components/ui/panel";

import {
  AppBadge,
  displayMessageAuthor,
  formatTime,
  MessageSearchGroup,
  messageSnippet,
  UiText,
} from "@/features/workspace/core";

// Fusionne les groupes de résultats.
export function mergeMessageSearchGroups(
  localGroups: MessageSearchGroup[],
  serverGroups: MessageSearchGroup[],
): MessageSearchGroup[] {
  const byChannel = new Map<string, MessageSearchGroup>();
  for (const group of [...serverGroups, ...localGroups]) {
    const existing = byChannel.get(group.channel.id) ?? {
      channel: group.channel,
      messages: [],
    };
    const seen = new Set(existing.messages.map((message) => message.id));
    for (const message of group.messages) {
      if (!seen.has(message.id)) {
        existing.messages.push(message);
        seen.add(message.id);
      }
    }
    existing.messages.sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
    byChannel.set(group.channel.id, existing);
  }
  return Array.from(byChannel.values()).sort(
    (left, right) =>
      Date.parse(right.messages[0]?.createdAt ?? "0") -
      Date.parse(left.messages[0]?.createdAt ?? "0"),
  );
}

// Surlignage résultat recherche.
export function HighlightedSearchText({
  value,
  query,
}: {
  value: string;
  query: string;
}) {
  const needle = query.trim();
  if (!needle) return <>{value}</>;

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let index = lowerValue.indexOf(lowerNeedle);

  while (index !== -1) {
    if (index > cursor) parts.push(value.slice(cursor, index));
    parts.push(
      <mark key={`${index}-${parts.length}`}>
        {value.slice(index, index + needle.length)}
      </mark>,
    );
    cursor = index + needle.length;
    index = lowerValue.indexOf(lowerNeedle, cursor);
  }

  if (cursor < value.length) parts.push(value.slice(cursor));
  return <>{parts}</>;
}

// Panneau recherche messages.
export function MessageSearchPanel({
  channelName,
  query,
  onQueryChange,
  groups,
  resultCount,
  usersById,
  loading,
  error,
  source,
  onClose,
  onJump,
  text,
}: {
  channelName: string;
  query: string;
  onQueryChange: (value: string) => void;
  groups: MessageSearchGroup[];
  resultCount: number;
  usersById: WorkspaceState["usersById"];
  loading: boolean;
  error: string | null;
  source: "local" | "server";
  onClose: () => void;
  onJump: (message: MessageSummary) => void;
  text: UiText;
}) {
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">(
    "newest",
  );
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [includeBots, setIncludeBots] = useState(true);

  const filteredGroups = groups
    .map((group) => {
      const messages = group.messages
        .filter((message) => {
          const author = usersById[message.authorId];
          if (!includeBots && author?.bot) return false;
          if (attachmentsOnly && !(message.attachments?.length ?? 0))
            return false;
          return true;
        })
        .slice()
        .sort((left, right) => {
          const delta =
            Date.parse(right.createdAt) - Date.parse(left.createdAt);
          return sortDirection === "newest" ? delta : -delta;
        });

      return { ...group, messages };
    })
    .filter((group) => group.messages.length > 0);
  const filteredCount = filteredGroups.reduce(
    (count, group) => count + group.messages.length,
    0,
  );
  const hasQuery = Boolean(query.trim());
  const displayedCount = hasQuery ? filteredCount : resultCount;

  return (
    <Panel
      as="aside"
      className="discordSearchPanel"
      aria-label={text.searchMessages}
    >
      <Split as="header" className="discordSearchHeader">
        <div>
          <p className="eyebrow">{text.search}</p>
          <h3>{channelName}</h3>
        </div>
        <Button
          variant="icon"
          type="button"
          className="panelCloseButton"
          aria-label={text.close}
          onClick={onClose}
        >
          ×
        </Button>
      </Split>

      <label className="discordSearchInputWrap">
        <span>{text.searchTerm}</span>
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={text.messageSearchPlaceholder}
          autoFocus
        />
      </label>

      <Split className="discordSearchToolbar" align="baseline">
        <strong>
          {hasQuery
            ? text.searchResultCount(displayedCount)
            : text.searchInLoadedMessages}
        </strong>
        {hasQuery ? (
          <small className="discordSearchSource">
            {loading
              ? i18nText("Index SQLite…")
              : source === "server"
                ? i18nText("Index local + SQLite")
                : i18nText("Messages chargés")}
          </small>
        ) : null}
        <Inline className="discordSearchToolbarActions" gap="sm">
          <Button
            variant="ghost"
            className={`discordSearchPill${attachmentsOnly ? " isActive" : ""}`}
            type="button"
            onClick={() => setAttachmentsOnly((value) => !value)}
          >
            <span aria-hidden="true">☰</span>
            {text.searchFilters}
          </Button>
          <Button
            variant="ghost"
            className="discordSearchPill"
            type="button"
            onClick={() =>
              setSortDirection((value) =>
                value === "newest" ? "oldest" : "newest",
              )
            }
          >
            <span aria-hidden="true">↕</span>
            {sortDirection === "newest" ? text.newestFirst : text.oldestFirst}
          </Button>
        </Inline>
      </Split>

      <Inline
        className="discordSearchQuickFilters"
        aria-label={text.searchFilters}
      >
        <Button
          variant="ghost"
          className={includeBots ? "isActive" : ""}
          type="button"
          onClick={() => setIncludeBots((value) => !value)}
        >
          {text.includeBots}
        </Button>
        <Button
          variant="ghost"
          className={attachmentsOnly ? "isActive" : ""}
          type="button"
          onClick={() => setAttachmentsOnly((value) => !value)}
        >
          {text.attachmentsOnly}
        </Button>
      </Inline>

      {error ? <p className="discordSearchWarning">{error}</p> : null}
      <div className="discordSearchResults">
        {hasQuery && filteredGroups.length ? (
          filteredGroups.map((group) => (
            <Section
              key={group.channel.id}
              className="discordSearchChannelGroup"
            >
              <div className="discordSearchChannelHeader">
                <span className="discordSearchHash" aria-hidden="true">
                  #
                </span>
                <strong>{group.channel.name}</strong>
                <span>• {group.messages.length}</span>
                <small>{text.categoryChat}</small>
              </div>
              <Stack className="discordSearchMessageStack" gap="sm">
                {group.messages.map((message) => {
                  const author = usersById[message.authorId];
                  const label = displayMessageAuthor(message, author);
                  const avatarUrl =
                    message.authorAvatarUrl ?? author?.avatarUrl ?? null;
                  const snippet = messageSnippet(message, text);
                  return (
                    <Card
                      key={message.id}
                      className="discordSearchResultCard"
                      onDoubleClick={() => onJump(message)}
                    >
                      <div
                        className="pinPanelAvatar discordSearchAvatar"
                        aria-hidden="true"
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" />
                        ) : (
                          label.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="discordSearchResultBody">
                        <div className="discordSearchMeta">
                          <span className="authorNameLine">
                            <strong>{label}</strong>
                            {author?.bot ? <AppBadge /> : null}
                          </span>
                          <time dateTime={message.createdAt}>
                            {formatTime(message.createdAt)}
                          </time>
                        </div>
                        <p>
                          <HighlightedSearchText
                            value={snippet}
                            query={query}
                          />
                        </p>
                        {message.attachments?.length ? (
                          <small className="discordSearchAttachmentLine">
                            {text.attachmentCount(message.attachments.length)} ·{" "}
                            {message.attachments
                              .map((attachment) => attachment.filename)
                              .join(", ")}
                          </small>
                        ) : null}
                      </div>
                      <Button
                        variant="secondary"
                        className="discordSearchJumpButton"
                        type="button"
                        onClick={() => onJump(message)}
                      >
                        {text.goToMessage}
                      </Button>
                    </Card>
                  );
                })}
              </Stack>
            </Section>
          ))
        ) : (
          <p className="discordSearchEmpty">
            {hasQuery ? text.noMessageMatch : text.typeToSearchMessages}
          </p>
        )}
      </div>
    </Panel>
  );
}
