import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { log } from '../utils/logger.js';

const eventsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'events');

export async function loadEvents(client) {
  if (!existsSync(eventsDir)) return;
  let count = 0;

  for (const file of readdirSync(eventsDir).filter((f) => f.endsWith('.js'))) {
    let mod;
    try {
      mod = (await import(pathToFileURL(join(eventsDir, file)).href)).default;
    } catch (err) {
      log('error', `이벤트 파일 로드 실패, 건너뜀: ${file} — ${err.message}`);
      continue;
    }
    if (!mod?.name || typeof mod.execute !== 'function') {
      log('warn', `이벤트 형식이 아님 (name/execute 누락), 건너뜀: ${file}`);
      continue;
    }
    if (mod.once) client.once(mod.name, (...args) => mod.execute(...args));
    else client.on(mod.name, (...args) => mod.execute(...args));
    count++;
  }

  log('info', `🔔 이벤트 ${count}개 로드됨`);
}
