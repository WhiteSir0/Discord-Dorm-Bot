import { Events } from 'discord.js';
import { config } from '../config.js';
import { log } from '../utils/logger.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (!config.prefix) return;
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(config.prefix)) return;

    const [rawName, ...args] = message.content.slice(config.prefix.length).trim().split(/\s+/);
    if (!rawName) return;
    const name = rawName.toLowerCase();

    const { commands, aliases } = message.client;
    const aliasTarget = aliases.get(name);
    const command = commands.get(name) ?? (aliasTarget ? commands.get(aliasTarget) : undefined);
    if (!command) return;

    if (typeof command.executePrefix !== 'function') {
      await message.reply(`이 명령어는 슬래시로만 사용할 수 있어요: \`/${command.data.name}\``).catch(() => {});
      return;
    }

    try {
      await command.executePrefix(message, args);
    } catch (err) {
      log('error', `${config.prefix}${name} 실행 오류:`, err);
      await message.reply('⚠️ 명령어 실행 중 오류가 발생했습니다.').catch(() => {});
    }
  },
};
