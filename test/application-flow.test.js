import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { cancelReservation, createReservation, decideReservation, getReservations, withdrawReservation } from '../src/utils/meetingRoom.js';
import { createVideoRequest, getVideoRequests, withdrawVideoRequest } from '../src/utils/learningVideo.js';
import { sendChannelGuide } from '../src/utils/channelGuide.js';

const interaction = (userId = 'admin') => ({
  guildId: 'guild-a',
  user: { id: userId, username: userId },
  member: { displayName: userId },
});

test.beforeEach(async () => {
  await fs.rm('database', { recursive: true, force: true });
});

test.after(async () => {
  await fs.rm('database', { recursive: true, force: true });
});

test('한 신청을 승인하면 같은 날짜와 회의실의 다른 대기 신청을 거절한다', async () => {
  const first = await createReservation('guild-a', {
    room: '2층 회의실_1', date: '2026-07-20', purpose: '회의', userId: 'user-a', userName: '10101 홍길동', requesterDisplayName: '홍길동', participants: [],
  });
  await createReservation('guild-b', {
    room: '2층 회의실_1', date: '2026-07-20', purpose: '다른 회의', userId: 'user-b', userName: '10102 김철수', requesterDisplayName: '김철수', participants: [],
  });

  const result = await decideReservation(interaction(), first.reservation.id, 'approved');
  const reservations = await getReservations();

  assert.equal(result.autoRejected.length, 1);
  assert.deepEqual(reservations.map(({ status }) => status), ['approved', 'rejected']);
  assert.equal(reservations[1].rejectionReason, '같은 날짜와 회의실의 다른 신청이 승인됨');
});

test('회의실과 학습 영상 신청은 신청자만 승인 전에 취소한다', async () => {
  const room = await createReservation('guild-a', {
    room: '3층 회의실_1', date: '2026-07-21', purpose: '회의', userId: 'user-a', userName: '10101 홍길동', requesterDisplayName: '홍길동', participants: [],
  });
  const video = await createVideoRequest('guild-a', { userId: 'user-a', duration: '20분', purpose: '학습', reference: '설명' });

  const forbiddenRoom = await withdrawReservation(interaction('user-b'), room.reservation.id);
  const cancelledRoom = await withdrawReservation(interaction('user-a'), room.reservation.id);
  const forbiddenVideo = await withdrawVideoRequest(interaction('user-b'), video.id);
  const cancelledVideo = await withdrawVideoRequest(interaction('user-a'), video.id);

  assert.equal(forbiddenRoom.forbidden, true);
  assert.equal(cancelledRoom.reservation.status, 'cancelled');
  assert.equal(forbiddenVideo.forbidden, true);
  assert.equal(cancelledVideo.request.status, 'cancelled');
  assert.equal((await getVideoRequests('guild-a'))[0].status, 'cancelled');
});

test('채널 안내는 임베드 없이 PNG 한 장만 보낸다', async () => {
  let payload;
  const channel = {
    isTextBased: () => true,
    send: async (value) => {
      payload = value;
      return { id: 'message' };
    },
  };

  await sendChannelGuide(channel, '회의실신청');
  const image = payload.files[0].attachment;

  assert.equal(payload.embeds, undefined);
  assert.equal(payload.files.length, 1);
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.ok(image.length > 20_000);
});

test('관리자는 다른 서버에서 만든 회의실 예약도 사유와 함께 취소한다', async () => {
  await createReservation('guild-b', {
    room: '4층 회의실_2', date: '2026-07-22', purpose: '회의', userId: 'user-b', userName: '10102 김철수', requesterDisplayName: '김철수', participants: [],
  });

  const result = await cancelReservation('guild-a', {
    room: '4층 회의실_2', date: '2026-07-22', requesterId: 'admin', requesterName: '관리자', reason: '시설 점검', isAdmin: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reservation.status, 'cancelled');
  assert.equal(result.reservation.cancellationReason, '시설 점검');
  assert.equal(result.reservation.cancelledByName, '관리자');
});
