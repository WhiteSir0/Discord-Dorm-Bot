import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';

const baseDir = join(process.cwd(), 'database');

export async function readJson(relPath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(join(baseDir, relPath), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(relPath, data) {
  const filePath = join(baseDir, relPath);
  await fs.mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}
