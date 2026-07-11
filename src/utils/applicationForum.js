import { ChannelType } from 'discord.js';
import { getSettings } from './meetingRoom.js';

export async function createApplicationPost(client, guildId, type, payload) {
  const settings = await getSettings(guildId);
  const channelId = settings.channels?.[type]?.channelId;
  if (!channelId) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return null;

  if (channel.type === ChannelType.GuildText) {
    const message = await channel.send({ embeds: payload.embeds, components: payload.components });
    const thread = await message.startThread({ name: payload.name.slice(0, 100), autoArchiveDuration: 10_080 });
    return { channelId: channel.id, messageId: message.id, discussionThreadId: thread.id };
  }

  if (channel.type !== ChannelType.GuildForum) return null;

  const thread = await channel.threads.create({
    name: payload.name.slice(0, 100),
    message: { embeds: payload.embeds, components: payload.components },
  });
  const message = await thread.fetchStarterMessage();
  return { channelId: thread.id, messageId: message.id };
}

export async function sendDecisionNotice(client, channelId, content, mentionedUserId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  if (channel.isThread() && channel.archived) await channel.setArchived(false).catch(() => {});
  await channel.send({ content, allowedMentions: { users: [mentionedUserId] } }).catch(() => {});
}
