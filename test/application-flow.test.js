import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { cancelReservation, createReservation, decideReservation, getReservations, requestEmbed, withdrawReservation } from '../src/utils/meetingRoom.js';
import { createVideoRequest, getVideoRequests, videoRequestEmbed, withdrawVideoRequest } from '../src/utils/learningVideo.js';
import { sendChannelGuide } from '../src/utils/channelGuide.js';
import { createPrivateApplicationThread, notifyAndReleasePrivateThreadMembers, releasePrivateThreadMembers } from '../src/utils/privateApplicationThread.js';
import { createApplicationPost } from '../src/utils/applicationForum.js';
import { createRoomRequestThread } from '../src/utils/roomRequestThread.js';

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

test('같은 날짜에 신청자나 추가 인원이 다른 회의실 신청에 중복되지 않는다', async () => {
  await createReservation('guild-a', {
    room: '2층 회의실_1', date: '2026-07-23', purpose: '회의', userId: 'user-a', userName: '70707 홍길동', requesterDisplayName: '홍길동',
    participants: [{ userId: 'user-a', name: '홍길동' }, { userId: 'user-c', name: '이영희' }],
  });

  const result = await createReservation('guild-a', {
    room: '3층 회의실_2', date: '2026-07-23', purpose: '다른 회의', userId: 'user-b', userName: '70708 김철수', requesterDisplayName: '김철수',
    participants: [{ userId: 'user-b', name: '김철수' }, { userId: 'user-c', name: '이영희' }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.participantConflict.participant.userId, 'user-c');
  assert.equal((await getReservations()).length, 1);
});

test('신청 임베드의 신청자는 멘션이 아닌 서버 프로필 이름으로 표시한다', () => {
  const roomEmbed = requestEmbed({
    id: 'room', room: '2층 회의실_1', date: '2026-07-23', purpose: '회의', userId: 'user-a', userName: '70707 홍길동', requesterDisplayName: '송시우 (1학년)', participants: [],
  }).toJSON();
  const videoEmbed = videoRequestEmbed({
    id: 'video', userId: 'user-a', requesterDisplayName: '송시우 (1학년)', duration: '20분', purpose: '학습', reference: '설명',
  }).toJSON();

  assert.equal(roomEmbed.fields.find(({ name }) => name === '신청자').value, '송시우 (1학년)');
  assert.equal(videoEmbed.fields.find(({ name }) => name === '신청자').value, '송시우 (1학년)');
});

test('DM 성공 사용자는 스레드에서 제거하고 실패 사용자는 남긴다', async () => {
  const removed = [];
  const fallbackMessages = [];
  const thread = {
    archived: false,
    isTextBased: () => true,
    members: { remove: async (userId) => removed.push(userId) },
    send: async (payload) => fallbackMessages.push(payload),
  };
  const client = {
    channels: { fetch: async () => thread },
    users: {
      fetch: async (userId) => ({
        send: userId === 'dm-ok' ? async () => {} : async () => { throw new Error('DM blocked'); },
      }),
    },
  };

  const failed = await notifyAndReleasePrivateThreadMembers(client, 'thread', ['dm-ok', 'dm-blocked'], '처리 결과');

  assert.deepEqual(removed, ['dm-ok']);
  assert.deepEqual(failed, ['dm-blocked']);
  assert.equal(fallbackMessages[0].content.includes('<@dm-blocked>'), true);
});

test('회의실 비공개 스레드에는 신청자와 추가 인원 및 관리자를 초대한다', async () => {
  const added = [];
  const thread = {
    id: 'thread',
    members: { add: async (userId) => added.push(userId) },
    send: async () => {},
  };
  const parentMessage = { id: 'message', edit: async () => {} };
  const channel = {
    id: 'channel',
    type: ChannelType.GuildText,
    members: new Map([
      ['admin', {
        id: 'admin', user: { bot: false },
        permissionsIn: () => ({ has: (permission) => permission === PermissionFlagsBits.Administrator }),
      }],
      ['student', {
        id: 'student', user: { bot: false },
        permissionsIn: () => ({ has: () => false }),
      }],
    ]),
    threads: { create: async () => thread },
  };

  await createPrivateApplicationThread(channel, 'guild', {
    parentMessage,
    name: '회의실 신청',
    embeds: [],
    components: [],
    applicantUserId: 'applicant',
    memberUserIds: ['applicant', 'participant', 'participant'],
  });

  assert.deepEqual(added, ['applicant', 'participant', 'admin']);
});

test('설정된 신청 채널이 없으면 현재 채널로 대신 게시하지 않는다', async () => {
  const client = { channels: { fetch: async () => assert.fail('설정되지 않은 채널을 조회하면 안 됩니다.') } };
  const payload = { fallbackChannelId: 'current-channel' };

  assert.equal(await createRoomRequestThread(client, 'guild', payload), null);
  assert.equal(await createApplicationPost(client, 'guild', '학습영상신청', payload), null);
});

test('회의실 추가 인원은 DM 없이 스레드에서 제거한다', async () => {
  const removed = [];
  const client = {
    channels: { fetch: async () => ({ members: { remove: async (userId) => removed.push(userId) } }) },
  };

  await releasePrivateThreadMembers(client, 'thread', ['participant-a', 'participant-b']);

  assert.deepEqual(removed, ['participant-a', 'participant-b']);
});
