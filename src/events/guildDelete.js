import { Events } from 'discord.js';
import { clearGuildTimers } from '../utils/applicationTimers.js';
import { removeGuildData } from '../utils/guildData.js';
import { log } from '../utils/logger.js';

export default {
  name: Events.GuildDelete,
  async execute(guild) {
    clearGuildTimers(guild.id);
    await removeGuildData(guild.id);
    log('info', `서버 데이터 정리 완료 (${guild.id})`);
  },
};
