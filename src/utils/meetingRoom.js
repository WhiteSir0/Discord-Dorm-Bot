import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AttachmentBuilder, EmbedBuilder, ModalBuilder, PermissionFlagsBits, MessageFlags, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { readJson, updateJson, withLock } from './jsonStore.js';
import { renderMonthImage, renderWeekImage, ROOMS } from './statusImage.js';
import { todayKst, currentMonthKst, currentWeekStartKst } from './dateKst.js';
import { createAllDayEvent, deleteEvent, eventExists } from './gcal.js';
import { log } from './logger.js';
import { sendDecisionNotice } from './applicationForum.js';
import { serverDisplayName } from './discordNames.js';
import { roomStatusButtons } from './roomStatusButtons.js';
import { addPrivateThreadMember, findPrivateThreadRequestMessage, privateThreadLinkRow } from './privateApplicationThread.js';

export const ROOM_NAMES = ROOMS.map((r) => r.name);

const settingsPath = (guildId) => join('guilds', guildId, 'settings.json');
const reservationsPath = 'meeting-reservations.json';
const calendarLink = '[회의실 캘린더에서 보기](https://calendar.google.com/calendar/u/0?cid=NGE1YWJjY2FiM2ZiMDNkOTZlNmE2ZGQ3MjVlMTgxYTAxOTUyMDE2NWQ3NDBlNjQ0OThlMTMyZTY0Njc3M2RjOUBncm91cC5jYWxlbmRhci5nb29nbGUuY29t)';

export function getSettings(guildId) {
  return readJson(settingsPath(guildId), { channels: {} });
}

export function updateSettings(guildId, mutator) {
  return updateJson(settingsPath(guildId), { channels: {} }, mutator);
}

export function getReservations() {
  return readJson(reservationsPath, []);
}

export async function isRoomOccupied(guildId, room, date) {
  const reservations = await getReservations(guildId);
  return reservations.some((reservation) => reservation.room === room && reservation.date === date && reservation.status === 'approved');
}

export function updateReservations(_guildId, mutator) {
  return updateJson(reservationsPath, [], mutator);
}

export function participantsOf(reservation) {
  if (Array.isArray(reservation.participants) && reservation.participants.length) return reservation.participants;
  const [studentId = '', ...name] = String(reservation.userName ?? '').split(' ');
  return [{ userId: reservation.userId, studentId, name: name.join(' ') || reservation.userName }];
}

export function participantList(reservation, maxLength = 1000) {
  const names = participantsOf(reservation).map((participant) => `${participant.studentId} ${participant.name}`.trim());
  const text = names.join(', ');
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function isActive(r) {
  return r.status === 'pending' || r.status === 'approved';
}

function statusLabel(status) {
  return { pending: '승인 대기', approved: '승인됨', rejected: '거절됨', cancelled: '취소됨' }[status] ?? status;
}

export function createReservation(guildId, { room, date, purpose, userId, userName, requesterDisplayName, participants }) {
  return updateReservations(guildId, (list) => {
    const conflict = list.find((r) => r.room === room && r.date === date && r.status === 'approved');
    if (conflict) return { ok: false, conflict };
    const reservation = {
      id: randomUUID(),
      guildId,
      room,
      date,
      purpose,
      userId,
      userName,
      requesterDisplayName,
      participants,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    list.push(reservation);
    return { ok: true, reservation };
  });
}

export function attachRequestMessage(guildId, id, channelId, messageId, discussionThreadId = null) {
  return updateReservations(guildId, (list) => {
    const r = list.find((x) => x.id === id);
    if (r) {
      r.requestChannelId = channelId;
      r.requestMessageId = messageId;
      r.discussionThreadId = discussionThreadId;
    }
  });
}

export function requestEmbed(reservation) {
  const participants = participantsOf(reservation);
  return new EmbedBuilder()
    .setTitle('📋 회의실 신청')
    .setColor(0xf0b232)
    .addFields(
      { name: '회의실', value: reservation.room, inline: true },
      { name: '날짜', value: reservation.date, inline: true },
      { name: '신청자', value: `<@${reservation.userId}>`, inline: true },
      { name: `회의 인원 (${participants.length}명)`, value: participantList(reservation) },
      { name: '목적', value: reservation.purpose },
    )
    .setFooter({ text: `승인 대기 중 · ${reservation.id}` });
}

export async function handleReservationButton(interaction) {
  const [, action, id] = interaction.customId.split(':');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'reject') {
    const reason = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('거절 사유')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);
    await interaction.showModal(new ModalBuilder()
      .setCustomId(`mr:reject-reason:${id}`)
      .setTitle('회의실 신청 거절')
      .addComponents(new ActionRowBuilder().addComponents(reason)));
    return;
  }

  await interaction.deferUpdate();
  const decision = await decideReservation(interaction, id, 'approved');
  await finishReservationDecision(interaction, decision);
}

export async function handleReservationRejectionModal(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const id = interaction.customId.split(':')[2];
  await interaction.deferUpdate();
  const decision = await decideReservation(interaction, id, 'rejected', interaction.fields.getTextInputValue('reason').trim());
  await finishReservationDecision(interaction, decision);
}

async function decideReservation(interaction, id, status, rejectionReason = null) {
  const decision = await updateReservations(interaction.guildId, (list) => {
    const reservation = list.find((item) => item.id === id);
    if (!reservation) return { missing: true };
    if (reservation.status !== 'pending') return { already: reservation.status };
    const conflict = list.find((item) => item.id !== id && item.room === reservation.room && item.date === reservation.date && item.status === 'approved');
    if (conflict) return { conflict };
    reservation.status = status;
    reservation.decidedBy = interaction.user.id;
    reservation.decidedByName = serverDisplayName(interaction);
    reservation.decidedAt = new Date().toISOString();
    if (rejectionReason) reservation.rejectionReason = rejectionReason;
    return { reservation: { ...reservation } };
  });
  return decision;
}

async function finishReservationDecision(interaction, decision) {
  if (decision.missing) {
    await interaction.followUp({ content: '해당 신청을 찾을 수 없어요.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  if (decision.already) {
    await interaction.followUp({ content: `이미 처리된 신청이에요 (${statusLabel(decision.already)}).`, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  if (decision.conflict) {
    await interaction.followUp({ content: `**${decision.conflict.date} ${decision.conflict.room}**은 이미 승인된 예약이 있어요.`, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const reservation = decision.reservation;
  if (reservation.status === 'approved') await createReservationCalendarEvent(interaction.guildId, reservation);
  await addPrivateThreadMember(interaction.client, reservation.discussionThreadId, interaction.user.id);
  await updateReservationRequestMessage(interaction.client, reservation);
  const notice = reservation.status === 'approved'
    ? `<@${reservation.userId}> 회의실 사용 신청이 승인되었습니다.\n처리: <@${reservation.decidedBy}>`
    : `<@${reservation.userId}> 회의실 사용 신청이 거절되었습니다.\n사유: ${reservation.rejectionReason}\n처리: <@${reservation.decidedBy}>`;
  await sendDecisionNotice(interaction.client, reservation.discussionThreadId ?? reservation.requestChannelId, notice, reservation.userId);
  await refreshAllStatusBoards(interaction.client).catch((err) => log('error', '현황판 갱신 실패:', err.message));
}

const ROOM_CALENDAR_COLORS = {
  '2층': '11',
  '2층 회의실_1': '11',
  '2층 회의실_2': '11',
  '3층': '6',
  '3층 회의실_1': '6',
  '3층 회의실_2': '6',
  '4층': '10',
  '4층 회의실_1': '10',
  '4층 회의실_2': '10',
};

async function createReservationCalendarEvent(guildId, reservation) {
  let eventId = null;
  try {
    eventId = await createAllDayEvent({
      date: reservation.date,
      summary: `[${reservation.room}] ${reservation.purpose}`,
      description: `신청자: ${reservation.userName}\n회의 인원: ${participantsOf(reservation).length}\n명단: ${participantList(reservation, 4000)}\n\n${reservation.purpose}`,
      colorId: ROOM_CALENDAR_COLORS[reservation.room],
    });
  } catch (err) {
    log('error', '캘린더 등록 실패 (예약은 승인됨):', err.message);
  }
  if (!eventId) return;
  const kept = await updateReservations(guildId, (list) => {
    const item = list.find((reservationItem) => reservationItem.id === reservation.id);
    if (item?.status !== 'approved') return false;
    item.gcalEventId = eventId;
    return true;
  });
  if (!kept) await deleteEvent(eventId).catch((err) => log('error', '취소된 예약의 캘린더 정리 실패:', err.message));
}

async function updateReservationRequestMessage(client, reservation) {
  if (!reservation.requestChannelId || !reservation.requestMessageId) return;
  const channel = await client.channels.fetch(reservation.requestChannelId).catch(() => null);
  const message = await channel?.messages.fetch(reservation.requestMessageId).catch(() => null);
  if (!message?.embeds[0]) return;
  const approved = reservation.status === 'approved';
  const actorName = reservation.decidedByName ?? reservation.cancelledByName ?? '구글 캘린더';
  const embed = EmbedBuilder.from(message.embeds[0])
    .setColor(approved ? 0x3ba55d : reservation.status === 'cancelled' ? 0x99aab5 : 0xd83c3e)
    .setFooter({ text: `${statusLabel(reservation.status)} · 처리: ${actorName}` });
  if (reservation.rejectionReason) embed.addFields({ name: '거절 사유', value: reservation.rejectionReason });
  const components = reservation.discussionThreadId ? [privateThreadLinkRow(message.guildId, reservation.discussionThreadId)] : [];
  await message.edit({ embeds: [embed], components }).catch(() => {});
  const threadMessage = await findPrivateThreadRequestMessage(client, reservation.discussionThreadId, reservation.id);
  if (threadMessage?.embeds[0]) {
    const threadEmbed = EmbedBuilder.from(threadMessage.embeds[0])
      .setColor(approved ? 0x3ba55d : reservation.status === 'cancelled' ? 0x99aab5 : 0xd83c3e)
      .setFooter({ text: `${statusLabel(reservation.status)} · 처리: ${actorName}` });
    if (reservation.rejectionReason) threadEmbed.addFields({ name: '거절 사유', value: reservation.rejectionReason });
    const previews = threadMessage.embeds.slice(1).map((preview) => EmbedBuilder.from(preview));
    await threadMessage.edit({ embeds: [threadEmbed, ...previews], components: [] }).catch(() => {});
  }
}

export async function syncDeletedCalendarEvents() {
  const reservations = await getReservations();
  const candidates = reservations.filter((reservation) => reservation.status === 'approved' && reservation.gcalEventId);
  const missingEvents = new Map();
  for (const reservation of candidates) {
    try {
      if (!(await eventExists(reservation.gcalEventId))) missingEvents.set(reservation.id, reservation.gcalEventId);
    } catch (err) {
      log('error', '캘린더 일정 조회 실패:', err.message);
    }
  }
  if (!missingEvents.size) return [];

  return updateReservations(null, (list) => {
    const cancelled = [];
    for (const reservation of list) {
      if (reservation.status !== 'approved' || reservation.gcalEventId !== missingEvents.get(reservation.id)) continue;
      reservation.status = 'cancelled';
      reservation.cancelledAt = new Date().toISOString();
      reservation.cancelledByName = '구글 캘린더';
      reservation.cancellationReason = '구글 캘린더 일정 삭제';
      cancelled.push({ ...reservation });
    }
    return cancelled;
  });
}

export async function syncAllCalendarEvents(client) {
  try {
    const cancelled = await syncDeletedCalendarEvents();
    if (!cancelled.length) return;
    for (const reservation of cancelled) {
      await updateReservationRequestMessage(client, reservation);
      await sendDecisionNotice(
        client,
        reservation.discussionThreadId ?? reservation.requestChannelId,
        `<@${reservation.userId}> 구글 캘린더 일정이 삭제되어 회의실 예약도 취소되었습니다.`,
        reservation.userId,
      );
    }
    await refreshAllStatusBoards(client);
  } catch (err) {
    log('error', '캘린더 동기화 실패:', err.message);
  }
}

export async function cancelReservation(guildId, { room, date, requesterId, isAdmin }) {
  const result = await updateReservations(guildId, (list) => {
    const r = list.find((x) => x.guildId === guildId && x.room === room && x.date === date && isActive(x));
    if (!r) return { ok: false, reason: '해당 날짜에 그 회의실 예약이 없어요.' };
    if (r.userId !== requesterId && !isAdmin) {
      return { ok: false, reason: '본인 예약이거나 관리자만 취소할 수 있어요.' };
    }
    r.status = 'cancelled';
    r.cancelledAt = new Date().toISOString();
    r.cancelledBy = requesterId;
    return { ok: true, reservation: { ...r } };
  });

  if (result.ok && result.reservation.gcalEventId) {
    try {
      await deleteEvent(result.reservation.gcalEventId);
    } catch (err) {
      log('error', '캘린더 삭제 실패:', err.message);
    }
  }
  return result;
}

export async function closeRequestMessage(client, reservation, footerText) {
  if (!reservation.requestChannelId || !reservation.requestMessageId) return;
  try {
    const channel = await client.channels.fetch(reservation.requestChannelId);
    const message = await channel.messages.fetch(reservation.requestMessageId);
    const embed = EmbedBuilder.from(message.embeds[0]).setColor(0x99aab5).setFooter({ text: footerText });
    await message.edit({ embeds: [embed], components: [] });
  } catch {
  }
}

export function refreshStatusBoard(client, guildId, { skipUnchanged = false } = {}) {
  return withLock(`board:${guildId}`, async () => {
    const settings = await getSettings(guildId);
    const board = settings.channels?.['회의실'];
    if (!board?.channelId) return;

    const month = currentMonthKst();
    const [year, monthNum] = month.split('-').map(Number);
    const allReservations = await getReservations(guildId);
    const monthReservations = allReservations.filter((r) => r.date.startsWith(month));
    const weekStart = currentWeekStartKst();

    let channel;
    try {
      channel = await client.channels.fetch(board.channelId);
    } catch {
      return;
    }

    let monthMessage = board.monthMessageId
      ? await channel.messages.fetch(board.monthMessageId).catch(() => null)
      : null;
    let weekMessage = board.weekMessageId
      ? await channel.messages.fetch(board.weekMessageId).catch(() => null)
      : null;
    if (
      skipUnchanged
      && board.lastRenderedMonth === month
      && board.lastRenderedWeek === weekStart
      && monthMessage
      && weekMessage
    ) {
      return;
    }

    const monthFile = new AttachmentBuilder(renderMonthImage(monthReservations, year, monthNum), { name: 'meeting-rooms-month.png' });
    const weekFile = new AttachmentBuilder(renderWeekImage(allReservations, weekStart), { name: 'meeting-rooms-week.png' });
    let createdMonthMessage = false;
    let createdWeekMessage = false;
    try {
      if (monthMessage) {
        await monthMessage.edit({ content: calendarLink, attachments: [], files: [monthFile], components: [], flags: MessageFlags.SuppressEmbeds });
      } else {
        monthMessage = await channel.send({ content: calendarLink, files: [monthFile], flags: MessageFlags.SuppressEmbeds });
        createdMonthMessage = true;
      }
      if (weekMessage) {
        await weekMessage.edit({ attachments: [], files: [weekFile], components: [roomStatusButtons(weekStart)] });
      } else {
        weekMessage = await channel.send({ files: [weekFile], components: [roomStatusButtons(weekStart)] });
        createdWeekMessage = true;
      }
    } catch (err) {
      if (createdMonthMessage) await monthMessage?.delete().catch(() => {});
      if (createdWeekMessage) await weekMessage?.delete().catch(() => {});
      throw err;
    }

    if (board.messageId && board.messageId !== monthMessage.id && board.messageId !== weekMessage.id) {
      const legacyMessage = await channel.messages.fetch(board.messageId).catch(() => null);
      await legacyMessage?.delete().catch(() => {});
    }

    await updateSettings(guildId, (s) => {
      const b = s.channels?.['회의실'];
      if (b && b.channelId === board.channelId) {
        delete b.messageId;
        b.monthMessageId = monthMessage.id;
        b.weekMessageId = weekMessage.id;
        b.lastRenderedMonth = month;
        b.lastRenderedWeek = weekStart;
      }
    });
  });
}

export async function refreshAllStatusBoards(client, options) {
  const guildsDir = join(process.cwd(), 'database', 'guilds');
  let guildIds = [];
  try {
    guildIds = await fs.readdir(guildsDir);
  } catch {
    return;
  }
  for (const guildId of guildIds) {
    try {
      await refreshStatusBoard(client, guildId, options);
    } catch (err) {
      log('error', `현황판 갱신 실패 (${guildId}):`, err.message);
    }
  }
}

export function startDailyRefresh(client) {
  let lastRenderedDay = todayKst();
  setInterval(async () => {
    const day = todayKst();
    try {
      if (day !== lastRenderedDay) {
        await refreshAllStatusBoards(client);
        lastRenderedDay = day;
      }
      await syncAllCalendarEvents(client);
    } catch (err) {
      log('error', '일일 현황판 갱신 실패:', err.message);
    }
  }, 15 * 60 * 1000);
}
