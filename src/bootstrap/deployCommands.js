import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { log } from '../utils/logger.js';

// PUT은 전체 덮어쓰기 등록이라 삭제된 명령어가 디스코드에 남지 않는다
export async function deployCommands(commands) {
  const body = [...commands.values()].map((c) => c.data.toJSON());
  const rest = new REST().setToken(config.token);

  if (config.guildIds.length > 0) {
    await rest.put(Routes.applicationCommands(config.clientId), { body: [] });
    for (const guildId of config.guildIds) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, guildId), { body });
      log('info', `⚡ 슬래시 명령 ${body.length}개 재등록 완료 (길드 ${guildId})`);
    }
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    log('info', `⚡ 슬래시 명령 ${body.length}개 글로벌 재등록 완료`);
  }
}
