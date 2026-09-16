"use client";

// Panneau des messages épinglés

import { type MessageSummary, type WorkspaceState } from "@botdeck/shared";
import { Button } from "@/components/ui/button";
import { Inline, Split, Stack } from "@/components/ui/layout";
import { Card, Panel } from "@/components/ui/panel";

import {
  AppBadge,
  PinIcon,
  displayMessageAuthor,
  formatTime,
  messageSnippet,
  type UiText,
} from "@/features/workspace/core";

// Messages épinglés.
export function PinnedMessagesPanel({
  channelName,
  messages,
  usersById,
  onClose,
  onJump,
  onUnpin,
  text,
}: {
  channelName: string;
  messages: MessageSummary[];
  usersById: WorkspaceState["usersById"];
  onClose: () => void;
  onJump: (message: MessageSummary) => void;
  onUnpin: (message: MessageSummary) => void;
  text: UiText;
}) {
  return (
    <Panel as="aside" className="pinsPanel" aria-label={text.pinnedMessages}>
      <Split as="header" className="pinsPanelHeader">
        <Inline className="pinsPanelTitle" gap="sm">
          <PinIcon className="discordPinIcon pinsPanelTitleIcon" />
          <div>
            <h3>{text.pinnedMessages}</h3>
            <span>{channelName}</span>
          </div>
        </Inline>
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
      <Stack className="pinsPanelList" gap="sm">
        {messages.length ? (
          messages.map((message) => {
            const author = usersById[message.authorId];
            const label = displayMessageAuthor(message, author);
            const avatarUrl =
              message.authorAvatarUrl ?? author?.avatarUrl ?? null;
            return (
              <Card key={message.id} className="pinPanelItem">
                <div className="pinPanelAvatar" aria-hidden="true">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" />
                  ) : (
                    label.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="pinPanelContent">
                  <div className="pinPanelMeta">
                    <span className="authorNameLine">
                      <strong>{label}</strong>
                      {author?.bot ? <AppBadge /> : null}
                    </span>
                    <small>{formatTime(message.createdAt)}</small>
                  </div>
                  <p>{messageSnippet(message, text)}</p>
                </div>
                <Inline className="pinPanelActions" gap="xs">
                  <Button
                    variant="secondary"
                    className="pinPanelJumpButton"
                    type="button"
                    onClick={() => onJump(message)}
                  >
                    {text.goToPinnedMessage}
                  </Button>
                  <Button
                    variant="icon"
                    className="pinPanelCloseItemButton"
                    type="button"
                    aria-label={text.unpinMessage}
                    title={text.unpinMessage}
                    onClick={() => onUnpin(message)}
                  >
                    ×
                  </Button>
                </Inline>
              </Card>
            );
          })
        ) : (
          <p className="pinsPanelEmpty">{text.noPinnedMessages}</p>
        )}
      </Stack>
    </Panel>
  );
}
