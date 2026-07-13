import { getSettings } from './meetingRoom.js';
import { createPrivateApplicationThread } from './privateApplicationThread.js';

export async function createApplicationPost(client, guildId, type, payload) {
  const settings = await getSettings(guildId);
  const channelId = settings.channels?.[type]?.channelId;
  if (!channelId) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  return createPrivateApplicationThread(channel, guildId, payload);
}

export async function sendDecisionNotice(client, channelId, content) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  if (channel.isThread() && channel.archived) await channel.setArchived(false).catch(() => {});
  await channel.send({ content, allowedMentions: { parse: [] } }).catch(() => {});
}
