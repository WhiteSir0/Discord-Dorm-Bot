import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AttachmentBuilder, EmbedBuilder, ModalBuilder, PermissionFlagsBits, MessageFlags, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { readJson, updateJson, withLock } from './jsonStore.js';
import { renderMonthImage, ROOMS } from './statusImage.js';
import { todayKst, currentMonthKst } from './dateKst.js';
import { createAllDayEvent, deleteEvent } from './gcal.js';
import { log } from './logger.js';
import { sendDecisionNotice } from './applicationForum.js';
import { serverDisplayName } from './discordNames.js';

export const ROOM_NAMES = ROOMS.map((r) => r.name);

const settingsPath = (guildId) => join('guilds', guildId, 'settings.json');
const reservationsPath = (guildId) => join('guilds', guildId, 'reservations.json');

export function getSettings(guildId) {
  return readJson(settingsPath(guildId), { channels: {} });
}

export function updateSettings(guildId, mutator) {
  return updateJson(settingsPath(guildId), { channels: {} }, mutator);
}

export function getReservations(guildId) {
  return readJson(reservationsPath(guildId), []);
}

export function updateReservations(guildId, mutator) {
  return updateJson(reservationsPath(guildId), [], mutator);
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
    const conflict = list.find((r) => r.room === room && r.date === date && isActive(r));
    if (conflict) return { ok: false, conflict };
    const reservation = {
      id: randomUUID(),
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
      { name: '신청자', value: `<@${reservation.userId}> · ${reservation.requesterDisplayName ?? reservation.userName}`, inline: true },
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const decision = await decideReservation(interaction, id, 'rejected', interaction.fields.getTextInputValue('reason').trim());
  await finishReservationDecision(interaction, decision);
  if (decision.reservation) await interaction.editReply({ content: '거절 처리했습니다.' });
}

async function decideReservation(interaction, id, status, rejectionReason = null) {
  const decision = await updateReservations(interaction.guildId, (list) => {
    const reservation = list.find((item) => item.id === id);
    if (!reservation) return { missing: true };
    if (reservation.status !== 'pending') return { already: reservation.status };
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

  const reservation = decision.reservation;
  if (reservation.status === 'approved') await createReservationCalendarEvent(interaction.guildId, reservation);
  await updateReservationRequestMessage(interaction.client, reservation);
  const notice = reservation.status === 'approved'
    ? `<@${reservation.userId}> 회의실 사용 신청이 승인되었습니다.\n처리: **${reservation.decidedByName}**`
    : `<@${reservation.userId}> 회의실 사용 신청이 거절되었습니다.\n사유: ${reservation.rejectionReason}\n처리: **${reservation.decidedByName}**`;
  await sendDecisionNotice(interaction.client, reservation.discussionThreadId ?? reservation.requestChannelId, notice, reservation.userId);
  await refreshStatusBoard(interaction.client, interaction.guildId).catch((err) => log('error', '현황판 갱신 실패:', err.message));
}

async function createReservationCalendarEvent(guildId, reservation) {
  let eventId = null;
  try {
    eventId = await createAllDayEvent({
      date: reservation.date,
      summary: `[${reservation.room}] ${reservation.purpose}`,
      description: `신청자: ${reservation.userName}\n회의 인원: ${participantsOf(reservation).length}\n명단: ${participantList(reservation, 4000)}\n\n${reservation.purpose}`,
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
  const embed = EmbedBuilder.from(message.embeds[0])
    .setColor(approved ? 0x3ba55d : 0xd83c3e)
    .setFooter({ text: `${statusLabel(reservation.status)} · 처리: ${reservation.decidedByName}` });
  if (reservation.rejectionReason) embed.addFields({ name: '거절 사유', value: reservation.rejectionReason });
  await message.edit({ embeds: [embed], components: [] }).catch(() => {});
}

export async function cancelReservation(guildId, { room, date, requesterId, isAdmin }) {
  const result = await updateReservations(guildId, (list) => {
    const r = list.find((x) => x.room === room && x.date === date && isActive(x));
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

export function refreshStatusBoard(client, guildId) {
  return withLock(`board:${guildId}`, async () => {
    const settings = await getSettings(guildId);
    const board = settings.channels?.['회의실'];
    if (!board?.channelId) return;

    const month = currentMonthKst();
    const [year, monthNum] = month.split('-').map(Number);
    const reservations = (await getReservations(guildId)).filter((r) => r.date.startsWith(month));
    const png = renderMonthImage(reservations, year, monthNum);
    const file = new AttachmentBuilder(png, { name: 'meeting-rooms.png' });

    let channel;
    try {
      channel = await client.channels.fetch(board.channelId);
    } catch {
      return;
    }

    let messageId = board.messageId ?? null;
    if (messageId) {
      try {
        const message = await channel.messages.fetch(messageId);
        await message.edit({ content: '', files: [file], attachments: [] });
      } catch {
        messageId = null;
      }
    }
    if (!messageId) {
      const sent = await channel.send({ files: [file] });
      messageId = sent.id;
    }

    await updateSettings(guildId, (s) => {
      const b = s.channels?.['회의실'];
      if (b && b.channelId === board.channelId) {
        b.messageId = messageId;
        b.lastRenderedMonth = month;
      }
    });
  });
}

export async function refreshAllStatusBoards(client) {
  const guildsDir = join(process.cwd(), 'database', 'guilds');
  let guildIds = [];
  try {
    guildIds = await fs.readdir(guildsDir);
  } catch {
    return;
  }
  for (const guildId of guildIds) {
    try {
      await refreshStatusBoard(client, guildId);
    } catch (err) {
      log('error', `현황판 갱신 실패 (${guildId}):`, err.message);
    }
  }
}

export function startDailyRefresh(client) {
  let lastRenderedDay = todayKst();
  setInterval(async () => {
    const day = todayKst();
    if (day === lastRenderedDay) return;
    try {
      await refreshAllStatusBoards(client);
      lastRenderedDay = day;
    } catch (err) {
      log('error', '일일 현황판 갱신 실패:', err.message);
    }
  }, 15 * 60 * 1000);
}
