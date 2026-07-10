import { ChannelType } from 'discord.js';
import { getSettings } from './meetingRoom.js';

export async function createRoomRequestThread(client, guildId, payload) {
  const settings = await getSettings(guildId);
  const channelId = settings.channels?.['회의실신청']?.channelId;
  if (!channelId) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;

  const message = await channel.send({ embeds: payload.embeds, components: payload.components });
  const thread = await message.startThread({ name: payload.name.slice(0, 100), autoArchiveDuration: 10_080 });
  return { channelId: channel.id, messageId: message.id, discussionThreadId: thread.id };
}
