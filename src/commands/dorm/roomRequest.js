import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import { attachRequestMessage, createReservation, isRoomOccupied, refreshStatusBoard, requestEmbed, ROOM_NAMES } from '../../utils/meetingRoom.js';
import { createDraft, setDraftParticipants, takeDraft } from '../../utils/interactionDrafts.js';
import { formatUser, getUserInfo, resolveRegisteredUsers } from '../../utils/userRegistry.js';
import { dayOfWeek, isValidDateString, normalizeDateInput, todayKst } from '../../utils/dateKst.js';
import { log } from '../../utils/logger.js';
import { createRoomRequestThread } from '../../utils/roomRequestThread.js';
import { serverDisplayName } from '../../utils/discordNames.js';

export default {
  data: new SlashCommandBuilder()
    .setName('회의실신청')
    .setDescription('회의실 사용을 신청합니다. 관리자 승인 후 확정돼요.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) => opt.setName('회의실').setDescription('사용할 회의실').setRequired(true)
      .addChoices(...ROOM_NAMES.map((name) => ({ name, value: name }))))
    .addStringOption((opt) => opt.setName('날짜').setDescription('사용 날짜 (예: 07-16)').setRequired(true))
    .addStringOption((opt) => opt.setName('목적').setDescription('사용 목적').setRequired(true).setMaxLength(80)),

  async execute(interaction) {
    const room = interaction.options.getString('회의실');
    const date = normalizeDateInput(interaction.options.getString('날짜'));
    const purpose = interaction.options.getString('목적');
    if (!isValidDateString(date)) {
      await interaction.reply({ content: '날짜 형식이 잘못됐어요. `07-16` 형식으로 입력해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (date < todayKst()) {
      await interaction.reply({ content: '지난 날짜는 신청할 수 없어요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if ([0, 5, 6].includes(dayOfWeek(date))) {
      await interaction.reply({ content: '회의실은 월~목요일만 신청할 수 있어요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (await isRoomOccupied(interaction.guildId, room, date)) {
      await interaction.reply({ content: `**${date} ${room}**은 이미 사용 중이라 비어있지 않아요.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const info = await getUserInfo(interaction.guildId, interaction.user.id);
    if (!info) {
      await interaction.reply({ content: '먼저 `/학번등록`으로 학번과 이름을 등록해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }

    const id = await createDraft({ guildId: interaction.guildId, userId: interaction.user.id, room, date, purpose, applicant: { userId: interaction.user.id, studentId: info.studentId, name: info.name } });
    await interaction.reply({
      content: '신청자는 자동으로 포함됩니다. 추가 인원을 선택한 뒤 `신청 등록`을 눌러주세요.',
      components: participantComponents(id),
      flags: MessageFlags.Ephemeral,
    });
  },
};

export async function handleRoomParticipantSelect(interaction) {
  const id = interaction.customId.split(':')[2];
  const draft = await setDraftParticipants(id, interaction.guildId, interaction.user.id, interaction.values);
  if (!draft) {
    await interaction.update({ content: '신청 시간이 만료됐어요. `/회의실신청`을 다시 실행해주세요.', components: [] });
    return;
  }

  await interaction.update({
    content: `추가 인원 ${interaction.values.length}명을 선택했습니다. 확인 후 신청 등록을 눌러주세요.`,
    components: participantComponents(id),
  });
}

export async function handleRoomParticipantConfirm(interaction) {
  const id = interaction.customId.split(':')[2];
  const draft = await takeDraft(id, interaction.guildId, interaction.user.id);
  if (!draft) {
    await interaction.update({ content: '신청 시간이 만료됐어요. `/회의실신청`을 다시 실행해주세요.', components: [] });
    return;
  }
  const resolved = await resolveRegisteredUsers(interaction.guildId, (draft.participantIds ?? []).join(','));
  if (!resolved.ok) {
    await interaction.update({ content: '선택한 인원 중 `/학번등록`이 안 된 사람이 있어요. 등록 후 다시 신청해주세요.', components: [] });
    return;
  }
  const participants = [draft.applicant, ...resolved.users].filter((participant, index, list) => list.findIndex((item) => item.userId === participant.userId) === index);
  const result = await createReservation(interaction.guildId, {
    room: draft.room,
    date: draft.date,
    purpose: draft.purpose,
    userId: draft.applicant.userId,
    userName: formatUser(draft.applicant),
    requesterDisplayName: serverDisplayName(interaction),
    participants,
  });
  if (!result.ok) {
    const label = result.conflict.status === 'approved' ? '이미 예약돼 있어요' : '승인 대기 중인 신청이 있어요';
    await interaction.update({ content: `**${draft.date} ${draft.room}**은 ${label} (<@${result.conflict.userId}>).`, components: [] });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mr:approve:${result.reservation.id}`).setLabel('승인').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mr:reject:${result.reservation.id}`).setLabel('거절').setStyle(ButtonStyle.Danger),
  );
  await interaction.update({ content: '회의실 신청을 등록했습니다.', components: [] });
  try {
    const post = await createRoomRequestThread(interaction.client, interaction.guildId, {
      name: `${result.reservation.room} · ${result.reservation.date} · ${result.reservation.requesterDisplayName}`,
      embeds: [requestEmbed(result.reservation)],
      components: [row],
      applicantUserId: result.reservation.userId,
      fallbackChannelId: interaction.channelId,
    }).catch((err) => {
      log('error', '회의실 신청 스레드 생성 실패:', err.message);
      return null;
    });
    if (post) {
      await attachRequestMessage(interaction.guildId, result.reservation.id, post.channelId, post.messageId, post.discussionThreadId);
      await interaction.followUp({ content: `신청 스레드를 <#${post.discussionThreadId}>에 만들었습니다.`, flags: MessageFlags.Ephemeral });
    } else {
      const sent = await interaction.followUp({ embeds: [requestEmbed(result.reservation)], components: [row], fetchReply: true });
      await attachRequestMessage(interaction.guildId, result.reservation.id, sent.channelId, sent.id);
    }
    await refreshStatusBoard(interaction.client, interaction.guildId);
  } catch (err) {
    log('error', '회의실 신청 후처리 실패:', err.message);
  }
}

export async function handleRoomParticipantCancel(interaction) {
  const id = interaction.customId.split(':')[2];
  await takeDraft(id, interaction.guildId, interaction.user.id);
  await interaction.update({ content: '회의실 신청을 취소했습니다.', components: [] });
}

function participantComponents(id) {
  const members = new UserSelectMenuBuilder()
    .setCustomId(`mr:members:${id}`)
    .setPlaceholder('추가 인원을 선택하세요 (최대 24명)')
    .setMinValues(0)
    .setMaxValues(24);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mr:confirm:${id}`).setLabel('신청 등록').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mr:cancel:${id}`).setLabel('취소').setStyle(ButtonStyle.Secondary),
  );
  return [new ActionRowBuilder().addComponents(members), buttons];
}
