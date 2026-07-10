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
    try {
      await syncAllCalendarEvents(client);
    } catch (err) {
      log('error', '캘린더 동기화 실패:', err.message);
    }
    await refreshAllStatusBoards(client);
    startDailyRefresh(client);
  },
};
