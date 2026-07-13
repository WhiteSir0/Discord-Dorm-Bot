import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalCwd = process.cwd();
const workDir = await mkdtemp(join(tmpdir(), 'dorm-user-registry-'));
process.chdir(workDir);
const { setUserInfo } = await import('../src/utils/userRegistry.js');

test.after(async () => {
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

test('학번등록은 미쿠봇용 이름 파일에 디스코드 ID와 이름만 저장한다', async () => {
  await setUserInfo('guild-a', 'user-a', { studentId: '70707', name: '홍길동', room: '707' });

  const names = JSON.parse(await readFile(join('database', 'requester-names', 'guild-a.json'), 'utf8'));

  assert.deepEqual(names, { 'user-a': '홍길동' });
  assert.doesNotMatch(JSON.stringify(names), /70707|707/);
});
