// Actions messages et fils directs de BotSession.

import type { BotSessionContext } from "./bot-session-context";
import { type EmbedPayload, type MessageSummary } from "@botdeck/shared";
import { PermissionFlagsBits, type Message } from "discord.js";

import {
  DM_GUILD_ID,
  clampHistoryLimit,
  messageEmbedPagePayload,
  messageIsEphemeral,
  normalizeDirectMessageChannel,
  normalizeDirectMessageUser,
  normalizeMessage,
  reactionMatchesEmoji,
  removeOwnReactionFromSummary,
  resolveDirectMessagePeer,
  toDiscordEmbed,
} from "@/server/control-plane-helpers";

export async function syncChannelHistory(this: BotSessionContext,
  channelId: string,
  limit = 50,
): Promise<void> {
  const cachedMessages = this.messageCache.get(channelId);
  if (cachedMessages?.length) {
    this.publishEvent({
      type: "state.messages",
      channelId,
      messages: cachedMessages,
    });
  }
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) return;
  const fetched = await channel.messages.fetch({
    limit: clampHistoryLimit(limit),
  });
  const messages = [...fetched.values()].reverse().map(normalizeMessage);
  await this.persistMessagesSnapshot([...fetched.values()]).catch(
    () => undefined,
  );
  this.setMessageCache(channelId, messages);
  this.publishEvent({ type: "state.messages", channelId, messages });
}

export async function syncChannelPins(this: BotSessionContext, channelId: string): Promise<void> {
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) return;
  const fetched = await channel.messages.fetchPinned();
  const messages = [...fetched.values()]
    .sort((left, right) => right.createdTimestamp - left.createdTimestamp)
    .map(normalizeMessage);
  this.publishEvent({ type: "state.pins", channelId, messages });
}

export async function syncMessageContext(this: BotSessionContext,
  channelId: string,
  messageId: string,
  limit = 80,
): Promise<void> {
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) return;
  const fetched = await channel.messages.fetch({
    around: messageId,
    limit: clampHistoryLimit(limit),
  });
  const messages = [...fetched.values()].reverse().map(normalizeMessage);
  await this.persistMessagesSnapshot([...fetched.values()]).catch(
    () => undefined,
  );
  this.setMessageCache(channelId, messages);
  this.publishEvent({ type: "state.messages", channelId, messages });
}

export async function openDirectThread(this: BotSessionContext, userId: string, limit = 50): Promise<void> {
  const user = await this.client.users.fetch(userId);
  const dm = await user.createDM();
  const channel = normalizeDirectMessageChannel(dm.id, user);
  const existing = this.state.channelsByGuild[DM_GUILD_ID] ?? [];
  const channels = [
    channel,
    ...existing.filter((item: { id: string }) => item.id !== channel.id),
  ];
  this.publishEvent({
    type: "state.channels",
    guildId: DM_GUILD_ID,
    channels,
  });
  this.publishEvent({
    type: "state.users",
    users: [normalizeDirectMessageUser(user)],
  });
  await this.syncChannelHistory(dm.id, limit);
}

export function publishDirectThread(this: BotSessionContext, message: Message): void {
  const existing = this.state.channelsByGuild[DM_GUILD_ID] ?? [];
  const existingChannel = existing.find(
    (item: { id: string }) => item.id === message.channelId,
  );
  const peer = resolveDirectMessagePeer(message);
  const channel = peer
    ? normalizeDirectMessageChannel(
        message.channelId,
        peer,
        message.createdAt.toISOString(),
      )
    : existingChannel
      ? { ...existingChannel, lastMessageAt: message.createdAt.toISOString() }
      : null;
  if (!channel) return;
  this.publishEvent({
    type: "state.channels",
    guildId: DM_GUILD_ID,
    channels: [channel, ...existing.filter((item: { id: string }) => item.id !== channel.id)],
  });
  if (peer) {
    this.publishEvent({
      type: "state.users",
      users: [normalizeDirectMessageUser(peer)],
    });
  }
}

export async function sendMessage(this: BotSessionContext,
  channelId: string,
  content: string,
  replyToMessageId?: string,
  attachments: { filename: string; data: string }[] = [],
  embeds: EmbedPayload[] = [],
  embedPagination = false,
): Promise<void> {
  if (content.length > 2000) {
    throw new Error("Discord messages cannot exceed 2000 characters.");
  }
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    throw new Error("Selected channel does not support message sending.");
  }
  const discordEmbeds = embeds.map(toDiscordEmbed).slice(0, 10);
  const shouldPaginateEmbeds = embedPagination && discordEmbeds.length > 1;
  const pageToken = shouldPaginateEmbeds
    ? this.createMessageEmbedPageCache(content, discordEmbeds)
    : null;
  const paginatedPayload = shouldPaginateEmbeds
    ? messageEmbedPagePayload(
        content,
        discordEmbeds,
        0,
        `botdeck:messageembedpage:${pageToken}`,
      )
    : null;
  const sent = await channel.send({
    content: paginatedPayload
      ? paginatedPayload.content
      : content.trim() || undefined,
    embeds: paginatedPayload ? paginatedPayload.embeds : discordEmbeds,
    components: paginatedPayload?.components,
    files: attachments.map((attachment) => ({
      attachment: Buffer.from(attachment.data, "base64"),
      name: attachment.filename,
    })),
    allowedMentions: { parse: ["users"], repliedUser: false },
    ...(replyToMessageId
      ? {
          reply: {
            messageReference: replyToMessageId,
            failIfNotExists: false,
          },
        }
      : {}),
  });
  const summary = normalizeMessage(sent);
  if (!sent.inGuild()) {
    this.publishDirectThread(sent);
  }
  await this.persistMessageSnapshot(sent).catch(() => undefined);
  this.upsertMessageSummary(summary);
  this.publishEvent({ type: "message.created", message: summary });
}

export async function editMessage(this: BotSessionContext,
  channelId: string,
  messageId: string,
  content: string,
): Promise<void> {
  if (content.length > 2000) {
    throw new Error("Discord messages cannot exceed 2000 characters.");
  }
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) {
    throw new Error("Selected channel does not support editing.");
  }
  const message = await channel.messages.fetch(messageId);
  if (message.author.id !== this.client.user?.id) {
    throw new Error("Botdeck can only edit messages authored by the bot.");
  }
  const edited = await message.edit({ content });
  const summary = normalizeMessage(edited);
  this.upsertMessageSummary(summary);
  await this.persistMessageSnapshot(edited).catch(() => undefined);
  this.publishEvent({ type: "message.updated", message: summary });
}

export async function deleteMessage(this: BotSessionContext,
  channelId: string,
  messageId: string,
): Promise<void> {
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) {
    throw new Error("Selected channel does not support message deletion.");
  }
  const message = await channel.messages.fetch(messageId);
  const botUserId = this.client.user?.id;
  const isOwnMessage = Boolean(botUserId && message.author.id === botUserId);

  if (channel.isDMBased() && !isOwnMessage) {
    throw new Error("The bot can only delete its own direct messages.");
  }

  if (message.inGuild() && !isOwnMessage) {
    const canManageMessages = Boolean(
      botUserId &&
      message.channel
        .permissionsFor(botUserId)
        ?.has(PermissionFlagsBits.ManageMessages),
    );
    if (!canManageMessages) {
      throw new Error("The bot cannot manage messages in this channel.");
    }
  }

  await message.delete();
  this.updateMessageCache(channelId, (current: MessageSummary[]) =>
    current.filter((item: MessageSummary) => item.id !== messageId),
  );
  await this.deleteMessageSnapshot(messageId);
  this.publishEvent({ type: "message.deleted", channelId, messageId });
}

export async function setMessagePinned(this: BotSessionContext,
  channelId: string,
  messageId: string,
  pinned: boolean,
): Promise<void> {
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) {
    throw new Error("Selected channel does not support pinning.");
  }
  const message = await channel.messages.fetch(messageId);
  const updated = pinned ? await message.pin() : await message.unpin();
  const summary = normalizeMessage(updated);
  this.upsertMessageSummary(summary);
  await this.persistMessageSnapshot(updated).catch(() => undefined);
  this.publishEvent({ type: "message.updated", message: summary });
}

export async function reactToMessage(this: BotSessionContext,
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) {
    throw new Error("Selected channel does not support reactions.");
  }
  const message = await channel.messages.fetch(messageId);
  if (messageIsEphemeral(message)) {
    throw new Error("Ephemeral messages cannot receive reactions.");
  }
  const updatedReaction = await message.react(emoji);
  const updatedMessage = updatedReaction.message.partial
    ? await updatedReaction.message.fetch()
    : await updatedReaction.message.fetch();
  const summary = normalizeMessage(updatedMessage);
  this.upsertMessageSummary(summary);
  await this.persistMessageSnapshot(updatedMessage).catch(() => undefined);
  this.publishEvent({ type: "message.updated", message: summary });
}

export async function unreactToMessage(this: BotSessionContext,
  channelId: string,
  messageId: string,
  emoji: string,
): Promise<void> {
  const channel = await this.client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased() || !("messages" in channel)) {
    throw new Error("Selected channel does not support reactions.");
  }
  const message = await channel.messages.fetch(messageId);
  if (messageIsEphemeral(message)) {
    throw new Error("Ephemeral messages cannot receive reactions.");
  }
  const customEmojiId = emoji.includes(":") ? emoji.split(":").pop() : null;
  const reaction =
    message.reactions.resolve(emoji) ??
    (customEmojiId
      ? (message.reactions.cache.get(customEmojiId) ?? null)
      : null) ??
    message.reactions.cache.find((item: any) =>
      reactionMatchesEmoji(
        item.emoji.id
          ? `${item.emoji.name}:${item.emoji.id}`
          : (item.emoji.name ?? item.emoji.toString()),
        emoji,
      ),
    ) ??
    null;
  if (!reaction) return;
  const previousCount = reaction.count;
  await reaction.users.remove(this.client.user?.id);
  const updated = await message.fetch();
  const summary = removeOwnReactionFromSummary(
    normalizeMessage(updated),
    emoji,
    previousCount,
  );
  this.upsertMessageSummary(summary);
  await this.persistMessageSnapshot(updated).catch(() => undefined);
  this.publishEvent({ type: "message.updated", message: summary });
}

