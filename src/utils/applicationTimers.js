import { closeExtensionApplication, extensionButtons, extensionControlButtons, extensionEmbed, getActiveExtensionApplication } from './extensionApplication.js';
import { closeStayApplication, getActiveStayApplication, stayButtons, stayEmbed } from './stayApplication.js';
import { log } from './logger.js';

const timers = new Map();

function timerKey(type, guildId) {
  return `${type}:${guildId}`;
}

async function editApplicationMessage(client, application, embed, components) {
  const channel = await client.channels.fetch(application.channelId).catch(() => null);
  const message = await channel?.messages.fetch(application.messageId).catch(() => null);
  await message?.edit({ embeds: [embed(application)], components: components(application) }).catch(() => {});
}

function schedule(type, client, guildId, application, close, embed, components) {
  const key = timerKey(type, guildId);
  clearTimeout(timers.get(key));
  if (!application?.closesAt || application.status !== 'active') return;

  const fail = (err) => log('error', `${type} 자동 종료 실패:`, err.message);
  const run = async () => {
    const remaining = new Date(application.closesAt).getTime() - Date.now();
    if (remaining > 0) {
      timers.set(key, setTimeout(() => run().catch(fail), Math.min(remaining, 2_147_000_000)));
      return;
    }
    const result = await close(guildId, application.id);
    if (!result.reason) await editApplicationMessage(client, result.application, embed, components);
    timers.delete(key);
  };
  run().catch(fail);
}

export function scheduleExtensionClose(client, guildId, application) {
  schedule('연장 신청', client, guildId, application, closeExtensionApplication, extensionEmbed, (item) => [extensionButtons(item), extensionControlButtons(item)]);
}

export function scheduleStayClose(client, guildId, application) {
  schedule('잔류 신청', client, guildId, application, closeStayApplication, stayEmbed, (item) => [stayButtons(item)]);
}

export function clearGuildTimers(guildId) {
  for (const [key, timer] of timers) {
    if (!key.endsWith(`:${guildId}`)) continue;
    clearTimeout(timer);
    timers.delete(key);
  }
}

export async function restoreApplicationTimers(client) {
  for (const guild of client.guilds.cache.values()) {
    const extension = await getActiveExtensionApplication(guild.id);
    const stay = await getActiveStayApplication(guild.id);
    scheduleExtensionClose(client, guild.id, extension);
    scheduleStayClose(client, guild.id, stay);
  }
}
