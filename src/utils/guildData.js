import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export async function removeGuildData(guildId) {
  const database = join(process.cwd(), 'database');
  await Promise.all([
    fs.rm(join(database, 'guilds', guildId), { recursive: true, force: true }),
    fs.rm(join(database, 'requester-names', `${guildId}.json`), { force: true }),
  ]);
}
