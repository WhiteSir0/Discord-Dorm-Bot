import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } from 'discord.js';
import { cancelReservation, closeRequestMessage, refreshAllStatusBoards, ROOM_NAMES } from '../../utils/meetingRoom.js';
import { isValidDateString } from '../../utils/dateKst.js';
import { log } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('회의실취소')
    .setDescription('회의실 예약/신청을 취소합니다.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName('회의실')
        .setDescription('취소할 회의실')
        .setRequired(true)
        .addChoices(...ROOM_NAMES.map((name) => ({ name, value: name }))),
    )
    .addStringOption((opt) =>
      opt.setName('날짜').setDescription('취소할 날짜 (예: 2026-07-15)').setRequired(true),
    ),

  async execute(interaction) {
    const room = interaction.options.getString('회의실');
    const date = interaction.options.getString('날짜');

    if (!isValidDateString(date)) {
      await interaction.reply({ content: '날짜 형식이 잘못됐어요. `2026-07-15` 형식으로 입력해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
    const result = await cancelReservation(interaction.guildId, {
      room,
      date,
      requesterId: interaction.user.id,
      isAdmin,
    });

    if (!result.ok) {
      await interaction.reply({ content: result.reason, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply(`🗑️ **${date} ${room}** 예약이 취소됐어요.`);

    await closeRequestMessage(
      interaction.client,
      result.reservation,
      `취소됨 · 취소: ${interaction.user.tag}`,
    );
    try {
      await refreshAllStatusBoards(interaction.client);
    } catch (err) {
      log('error', '현황판 갱신 실패:', err.message);
    }
  },
};
