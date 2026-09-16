import { Input, Textarea } from "@/components/ui/field";
import type { ChannelSummary, ForumPostSummary } from "@botdeck/shared";
import type { UiLanguage, UiText } from "@/features/workspace/core";
import { ChannelMessagesSkeleton } from "@/components/botdeck-app-widgets";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Grid, Inline, Split, Stack } from "@/components/ui/layout";
import { Card, Panel } from "@/components/ui/panel";

type ForumPostCommandType =
  "forum.post.delete" | "forum.post.archive" | "forum.post.lock";

type BotdeckForumChannelViewProps = {
  activeBotChannelsLocked: boolean;
  activeChannel: ChannelSummary;
  activeForumCanCreate: boolean;
  activeForumCanManage: boolean;
  activeForumPosts: ForumPostSummary[];
  forumCreating: boolean;
  forumDraftContent: string;
  forumDraftTagIds: string[];
  forumDraftTitle: string;
  forumSearch: string;
  language: UiLanguage;
  syncingForumId: string | null;
  text: UiText;
  visibleForumPosts: ForumPostSummary[];
  onCreateForumPost: () => void;
  onForumCreatingChange: (
    value: boolean | ((current: boolean) => boolean),
  ) => void;
  onForumDraftContentChange: (value: string) => void;
  onForumDraftTagIdsChange: (
    value: string[] | ((current: string[]) => string[]),
  ) => void;
  onForumDraftTitleChange: (value: string) => void;
  onForumSearchChange: (value: string) => void;
  onOpenForumPost: (post: ForumPostSummary) => void;
  onRefreshForumPosts: () => void;
  onSendForumPostCommand: (
    type: ForumPostCommandType,
    post: ForumPostSummary,
    value?: boolean,
  ) => void;
};

export function BotdeckForumChannelView({
  activeBotChannelsLocked,
  activeChannel,
  activeForumCanCreate,
  activeForumCanManage,
  activeForumPosts,
  forumCreating,
  forumDraftContent,
  forumDraftTagIds,
  forumDraftTitle,
  forumSearch,
  language,
  syncingForumId,
  text,
  visibleForumPosts,
  onCreateForumPost,
  onForumCreatingChange,
  onForumDraftContentChange,
  onForumDraftTagIdsChange,
  onForumDraftTitleChange,
  onForumSearchChange,
  onOpenForumPost,
  onRefreshForumPosts,
  onSendForumPostCommand,
}: BotdeckForumChannelViewProps) {
  return (
    <Panel className="forumChannelView">
      <div className="forumChannelHero">
        <div>
          <p className="forumKicker">
            {language === "fr" ? "Salon forum" : "Forum channel"}
          </p>
          <h3>{activeChannel.name}</h3>
          <p>
            {language === "fr"
              ? "Les posts du forum sont des fils Discord. Ouvre un post pour voir ses messages ou crée-en un avec le bot."
              : "Forum posts are Discord threads. Open a post to read its messages or create one with the bot."}
          </p>
        </div>
        <Inline className="forumHeroActions" gap="sm">
          <Button
            type="button"
            variant="secondary"
            onClick={onRefreshForumPosts}
          >
            {syncingForumId === activeChannel.id
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : language === "fr"
                ? "Actualiser"
                : "Refresh"}
          </Button>
          <Button
            type="button"
            disabled={!activeForumCanCreate}
            onClick={() => onForumCreatingChange((current) => !current)}
          >
            {language === "fr" ? "Nouveau post" : "New post"}
          </Button>
        </Inline>
      </div>
      <Split className="forumToolbar">
        <Input
          value={forumSearch}
          onChange={(event) => onForumSearchChange(event.target.value)}
          placeholder={
            language === "fr" ? "Rechercher un post..." : "Search posts..."
          }
        />
        <span>
          {visibleForumPosts.length}/{activeForumPosts.length}{" "}
          {language === "fr" ? "post(s)" : "post(s)"}
        </span>
      </Split>
      {forumCreating ? (
        <div className="forumCreatePanel">
          <Grid className="forumCreateGrid" gap="md">
            <label>
              <span>{language === "fr" ? "Titre" : "Title"}</span>
              <Input
                value={forumDraftTitle}
                onChange={(event) =>
                  onForumDraftTitleChange(event.target.value)
                }
                maxLength={100}
                placeholder={language === "fr" ? "Titre du post" : "Post title"}
              />
            </label>
            <label>
              <span>{language === "fr" ? "Description" : "Description"}</span>
              <Textarea
                value={forumDraftContent}
                onChange={(event) =>
                  onForumDraftContentChange(event.target.value)
                }
                maxLength={2000}
                rows={4}
                placeholder={
                  language === "fr"
                    ? "Premier message du post"
                    : "First message of the post"
                }
              />
            </label>
          </Grid>
          {activeChannel.availableTags?.length ? (
            <div className="forumTagPicker">
              <span>{language === "fr" ? "Tags" : "Tags"}</span>
              <div>
                {activeChannel.availableTags.map((tag) => (
                  <Button
                    variant="unstyled"
                    key={tag.id}
                    type="button"
                    className={
                      forumDraftTagIds.includes(tag.id) ? "isSelected" : ""
                    }
                    onClick={() =>
                      onForumDraftTagIdsChange((current) =>
                        current.includes(tag.id)
                          ? current.filter((id) => id !== tag.id)
                          : [...current, tag.id].slice(0, 5),
                      )
                    }
                  >
                    {tag.emoji ? `${tag.emoji} ` : ""}
                    {tag.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          <Inline className="forumCreateActions" justify="end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onForumCreatingChange(false)}
            >
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="button"
              className={activeBotChannelsLocked ? "isReadonlyLocked" : ""}
              disabled={
                activeBotChannelsLocked ||
                !forumDraftTitle.trim() ||
                !forumDraftContent.trim()
              }
              title={
                activeBotChannelsLocked
                  ? text.readOnlyModeWriteBlocked
                  : undefined
              }
              onClick={onCreateForumPost}
            >
              {language === "fr" ? "Créer le post" : "Create post"}
            </Button>
          </Inline>
        </div>
      ) : null}
      <Stack className="forumPostList" gap="sm">
        {syncingForumId === activeChannel.id && !activeForumPosts.length ? (
          <ChannelMessagesSkeleton />
        ) : visibleForumPosts.length ? (
          visibleForumPosts.map((post) => {
            const tagNames =
              activeChannel.availableTags?.filter((tag) =>
                post.tagIds.includes(tag.id),
              ) ?? [];
            return (
              <Card
                key={post.id}
                className={`forumPostCard${post.archived ? " isArchived" : ""}`}
              >
                <Button
                  variant="unstyled"
                  type="button"
                  className="forumPostMain"
                  onClick={() => onOpenForumPost(post)}
                >
                  <span className="forumPostIcon" aria-hidden="true">
                    #
                  </span>
                  <span>
                    <strong>{post.name}</strong>
                    <small>
                      {post.archived
                        ? language === "fr"
                          ? "Archivé"
                          : "Archived"
                        : language === "fr"
                          ? "Actif"
                          : "Active"}{" "}
                      ·{" "}
                      {post.locked
                        ? language === "fr"
                          ? "verrouillé"
                          : "locked"
                        : language === "fr"
                          ? "ouvert"
                          : "open"}{" "}
                      · {post.messageCount ?? 0}{" "}
                      {language === "fr" ? "message(s)" : "message(s)"}
                    </small>
                  </span>
                </Button>
                {tagNames.length ? (
                  <div className="forumPostTags">
                    {tagNames.map((tag) => (
                      <Badge key={tag.id} tone="unstyled">
                        {tag.emoji ? `${tag.emoji} ` : ""}
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <Inline className="forumPostActions" gap="sm">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onOpenForumPost(post)}
                  >
                    {language === "fr" ? "Ouvrir" : "Open"}
                  </Button>
                  {activeForumCanManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className={
                        activeBotChannelsLocked ? "isReadonlyLocked" : ""
                      }
                      disabled={activeBotChannelsLocked}
                      title={
                        activeBotChannelsLocked
                          ? text.readOnlyModeWriteBlocked
                          : undefined
                      }
                      onClick={() =>
                        onSendForumPostCommand(
                          "forum.post.archive",
                          post,
                          !post.archived,
                        )
                      }
                    >
                      {post.archived
                        ? language === "fr"
                          ? "Désarchiver"
                          : "Unarchive"
                        : language === "fr"
                          ? "Archiver"
                          : "Archive"}
                    </Button>
                  ) : null}
                  {activeForumCanManage ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className={
                        activeBotChannelsLocked ? "isReadonlyLocked" : ""
                      }
                      disabled={activeBotChannelsLocked}
                      title={
                        activeBotChannelsLocked
                          ? text.readOnlyModeWriteBlocked
                          : undefined
                      }
                      onClick={() =>
                        onSendForumPostCommand(
                          "forum.post.lock",
                          post,
                          !post.locked,
                        )
                      }
                    >
                      {post.locked
                        ? language === "fr"
                          ? "Déverrouiller"
                          : "Unlock"
                        : language === "fr"
                          ? "Verrouiller"
                          : "Lock"}
                    </Button>
                  ) : null}
                  {activeForumCanManage ? (
                    <Button
                      type="button"
                      variant="danger"
                      className={
                        activeBotChannelsLocked
                          ? "isReadonlyLocked"
                          : "isDanger"
                      }
                      disabled={activeBotChannelsLocked}
                      title={
                        activeBotChannelsLocked
                          ? text.readOnlyModeWriteBlocked
                          : undefined
                      }
                      onClick={() =>
                        onSendForumPostCommand("forum.post.delete", post)
                      }
                    >
                      {language === "fr" ? "Supprimer" : "Delete"}
                    </Button>
                  ) : null}
                </Inline>
              </Card>
            );
          })
        ) : (
          <Card className="emptyState">
            <h3>
              {language === "fr" ? "Aucun post trouvé" : "No posts found"}
            </h3>
            <p>
              {language === "fr"
                ? "Crée un nouveau post ou actualise le forum."
                : "Create a new post or refresh the forum."}
            </p>
          </Card>
        )}
      </Stack>
    </Panel>
  );
}
