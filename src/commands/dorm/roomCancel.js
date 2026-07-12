import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } from 'discord.js';
import { cancelReservation, refreshAllStatusBoards, ROOM_NAMES, updateReservationRequestMessage } from '../../utils/meetingRoom.js';
import { isValidDateString, normalizeDateInput } from '../../utils/dateKst.js';
import { log } from '../../utils/logger.js';
import { sendDecisionNotice } from '../../utils/applicationForum.js';
import { serverDisplayName } from '../../utils/discordNames.js';

export default {
  data: new SlashCommandBuilder()
    .setName('회의실취소')
    .setDescription('관리자가 회의실 예약이나 신청을 취소합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName('회의실')
        .setDescription('취소할 회의실')
        .setRequired(true)
        .addChoices(...ROOM_NAMES.map((name) => ({ name, value: name }))),
    )
    .addStringOption((opt) =>
      opt.setName('날짜').setDescription('취소할 날짜 (예: 07-15)').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('사유').setDescription('취소 사유').setRequired(true).setMaxLength(500),
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const room = interaction.options.getString('회의실');
    const date = normalizeDateInput(interaction.options.getString('날짜'));
    const reason = interaction.options.getString('사유').trim();

    if (!isValidDateString(date)) {
      await interaction.reply({ content: '날짜 형식이 잘못됐어요. `07-15` 형식으로 입력해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await cancelReservation(interaction.guildId, {
      room,
      date,
      requesterId: interaction.user.id,
      requesterName: serverDisplayName(interaction),
      reason,
      isAdmin: true,
    });

    if (!result.ok) {
      await interaction.reply({ content: result.reason, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: `**${date} ${room}** 예약을 취소했습니다.`, flags: MessageFlags.Ephemeral });
    await updateReservationRequestMessage(interaction.client, result.reservation);
    await sendDecisionNotice(
      interaction.client,
      result.reservation.discussionThreadId ?? result.reservation.requestChannelId,
      `<@${result.reservation.userId}> 회의실 예약이 취소되었습니다.\n사유: ${reason}\n처리: ${result.reservation.cancelledByName}`,
      result.reservation.userId,
    );
    try {
      await refreshAllStatusBoards(interaction.client);
    } catch (err) {
      log('error', '현황판 갱신 실패:', err.message);
    }
  },
};
