import { Client, GatewayIntentBits } from 'discord.js';
import { config, assertConfig } from './config.js';
import { loadCommands } from './bootstrap/loadCommands.js';
import { loadEvents } from './bootstrap/loadEvents.js';
import { deployCommands } from './bootstrap/deployCommands.js';
import { log } from './utils/logger.js';

assertConfig();

const intents = [GatewayIntentBits.Guilds];
if (config.prefix) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });

const { commands, aliases } = await loadCommands();
client.commands = commands;
client.aliases = aliases;

await loadEvents(client);

try {
  await deployCommands(client.commands);
} catch (err) {
  log('error', '슬래시 명령 등록 실패:', err.message);
}

client.login(config.token).catch((err) => {
  log('error', '로그인 실패:', err.message);
  process.exit(1);
});
