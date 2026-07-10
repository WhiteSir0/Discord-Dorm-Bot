import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildIds: (process.env.DISCORD_GUILD_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  prefix: (process.env.BOT_PREFIX ?? '').trim(),
};

export function assertConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('DISCORD_CLIENT_ID');
  if (missing.length > 0) {
    console.error(`환경변수가 설정되지 않았습니다: ${missing.join(', ')} — .env 파일을 확인하세요.`);
    process.exit(1);
  }
}
