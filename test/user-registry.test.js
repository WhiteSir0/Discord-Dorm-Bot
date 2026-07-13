import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalCwd = process.cwd();
const workDir = await mkdtemp(join(tmpdir(), 'dorm-user-registry-'));
process.chdir(workDir);
const { setUserInfo } = await import('../src/utils/userRegistry.js');
const { removeGuildData } = await import('../src/utils/guildData.js');
const { writeJson } = await import('../src/utils/jsonStore.js');

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

test('서버에서 추방되면 해당 서버 데이터만 지우고 회의실 예약은 유지한다', async () => {
  await setUserInfo('guild-a', 'user-a', { studentId: '70707', name: '홍길동', room: '707' });
  await setUserInfo('guild-b', 'user-b', { studentId: '80808', name: '김철수', room: '808' });
  await writeJson('meeting-reservations.json', [{ guildId: 'guild-a', status: 'approved' }]);

  await removeGuildData('guild-a');

  await assert.rejects(readFile(join('database', 'guilds', 'guild-a', 'users.json')), { code: 'ENOENT' });
  await assert.rejects(readFile(join('database', 'requester-names', 'guild-a.json')), { code: 'ENOENT' });
  assert.equal(JSON.parse(await readFile(join('database', 'guilds', 'guild-b', 'users.json'), 'utf8'))['user-b'].name, '김철수');
  assert.equal(JSON.parse(await readFile(join('database', 'meeting-reservations.json'), 'utf8')).length, 1);
});
