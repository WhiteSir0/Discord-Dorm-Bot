import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';
import { log } from '../utils/logger.js';

const commandsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'commands');

function walk(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (entry.endsWith('.js')) files.push(full);
  }
  return files;
}

export async function loadCommands() {
  const commands = new Collection();
  const aliases = new Collection();

  for (const file of walk(commandsDir)) {
    let mod;
    try {
      mod = (await import(pathToFileURL(file).href)).default;
    } catch (err) {
      log('error', `명령어 파일 로드 실패, 건너뜀: ${file} — ${err.message}`);
      continue;
    }
    if (!mod?.data || typeof mod.data.name !== 'string' || typeof mod.execute !== 'function') {
      log('warn', `명령어 형식이 아님 (data.name/execute 누락), 건너뜀: ${file}`);
      continue;
    }
    const name = mod.data.name;
    if (commands.has(name)) {
      log('warn', `중복 명령어 이름 "${name}", 나중 파일이 무시됨: ${file}`);
      continue;
    }
    commands.set(name, mod);
    for (const alias of mod.aliases ?? []) {
      aliases.set(alias.toLowerCase(), name);
    }
  }

  log('info', `📦 명령어 ${commands.size}개 로드됨`);
  return { commands, aliases };
}
