import { getSettings } from './meetingRoom.js';
import { createPrivateApplicationThread } from './privateApplicationThread.js';

export async function createRoomRequestThread(client, guildId, payload) {
  const settings = await getSettings(guildId);
  const channelId = settings.channels?.['회의실신청']?.channelId;
  if (!channelId) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  return createPrivateApplicationThread(channel, guildId, payload);
}
