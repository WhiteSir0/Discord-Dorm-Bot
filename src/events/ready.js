import { Events } from 'discord.js';
import { log } from '../utils/logger.js';
import { refreshAllStatusBoards, startDailyRefresh, syncAllCalendarEvents } from '../utils/meetingRoom.js';
import { logCalendarState } from '../utils/gcal.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log('info', `✅ 로그인 완료: ${client.user.tag}`);
    logCalendarState();
    await syncAllCalendarEvents(client);
    await refreshAllStatusBoards(client);
    startDailyRefresh(client);
  },
};
