import { Events } from 'discord.js';
import { log } from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    log('info', `✅ 로그인 완료: ${client.user.tag}`);
  },
};
