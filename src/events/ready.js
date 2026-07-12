import { Events } from 'discord.js';
import { log } from '../utils/logger.js';
import { refreshAllStatusBoards, startDailyRefresh, syncAllCalendarEvents } from '../utils/meetingRoom.js';
import { logCalendarState } from '../utils/gcal.js';
import { startBotPresence } from '../utils/botPresence.js';
import { restoreApplicationTimers } from '../utils/applicationTimers.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log('info', `✅ 로그인 완료: ${client.user.tag}`);
    startBotPresence(client);
    logCalendarState();
    try {
      await syncAllCalendarEvents(client);
    } catch (err) {
      log('error', '캘린더 동기화 실패:', err.message);
    }
    await refreshAllStatusBoards(client, { skipUnchanged: true });
    startDailyRefresh(client);
    await restoreApplicationTimers(client);
  },
};
