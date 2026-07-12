import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const originalCwd = process.cwd();
const workDir = await mkdtemp(join(tmpdir(), 'dorm-applications-'));
process.chdir(workDir);
const extension = await import('../src/utils/extensionApplication.js');
const stay = await import('../src/utils/stayApplication.js');
const timers = await import('../src/utils/applicationTimers.js');
const dates = await import('../src/utils/dateKst.js');

test.after(async () => {
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

test('연장 신청 자동 종료 시각과 수동 종료를 저장한다', async () => {
  const started = await extension.startExtensionApplication('extension-guild', 1);
  assert.equal(started.application.status, 'active');
  assert.ok(new Date(started.application.closesAt).getTime() > Date.now());

  const closed = await extension.closeExtensionApplication('extension-guild', started.application.id);
  assert.equal(closed.application.status, 'closed');
  assert.equal(closed.application.closedDays.length, 4);
});

test('설정 시간이 지나면 연장 신청을 자동으로 종료한다', async () => {
  const started = await extension.startExtensionApplication('timer-guild', 0.001);
  Object.assign(started.application, { channelId: 'channel', messageId: 'message' });
  let edited = false;
  const client = {
    channels: {
      fetch: async () => ({
        messages: {
          fetch: async () => ({ edit: async () => { edited = true; } }),
        },
      }),
    },
  };

  timers.scheduleExtensionClose(client, 'timer-guild', started.application);
  await new Promise((resolve) => setTimeout(resolve, 120));

  const application = await extension.getExtensionApplication('timer-guild', started.application.id);
  assert.equal(application.status, 'closed');
  assert.equal(edited, true);
});

test('잔류 신청을 등록하고 같은 사용자가 다시 누르면 취소한다', async () => {
  const started = await stay.startStayApplication('stay-guild', null);
  assert.equal(started.application.closesAt, null);
  const participant = { userId: '1', studentId: '70707', name: '홍길동', room: '707' };

  const selected = await stay.toggleStayApplication('stay-guild', started.application.id, participant);
  assert.equal(selected.selected, true);
  assert.equal(selected.application.entries.length, 1);

  const cancelled = await stay.toggleStayApplication('stay-guild', started.application.id, participant);
  assert.equal(cancelled.selected, false);
  assert.equal(cancelled.application.entries.length, 0);
});

test('잔류 결과 CSV는 학번 이름 호실만 식별 정보로 포함한다', async () => {
  const csv = stay.stayResultCsv({
    entries: [{ userId: 'discord-id', studentId: '70707', name: '홍길동', room: '707', appliedAt: '2026-07-12T00:00:00.000Z' }],
  }).toString('utf8');
  assert.match(csv, /학번,이름,호실,신청 시각/);
  assert.match(csv, /70707,홍길동,707/);
  assert.doesNotMatch(csv, /discord-id/);
});

test('회의실 신청 날짜는 이번 주 일요일부터 토요일까지만 허용한다', () => {
  const start = dates.currentWeekStartKst();
  const sunday = new Date(`${start}T00:00:00Z`);
  const saturday = new Date(sunday);
  saturday.setUTCDate(saturday.getUTCDate() + 6);
  const nextSunday = new Date(sunday);
  nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);

  assert.equal(dates.isCurrentWeekKst(start), true);
  assert.equal(dates.isCurrentWeekKst(saturday.toISOString().slice(0, 10)), true);
  assert.equal(dates.isCurrentWeekKst(nextSunday.toISOString().slice(0, 10)), false);
});
