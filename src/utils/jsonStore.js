import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const baseDir = join(process.cwd(), 'database');
const locks = new Map();

// 같은 키의 작업을 순차 실행해서 읽기-수정-쓰기 유실을 방지
export function withLock(key, fn) {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  locks.set(key, run.catch(() => {}));
  return run;
}

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
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
  await fs.rename(tmpPath, filePath);
}

export function updateJson(relPath, fallback, mutator) {
  return withLock(relPath, async () => {
    const data = await readJson(relPath, fallback);
    const result = await mutator(data);
    await writeJson(relPath, data);
    return result;
  });
}
