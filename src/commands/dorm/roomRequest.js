import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType } from 'discord.js';
import { createReservation, attachRequestMessage, requestEmbed, refreshStatusBoard, ROOM_NAMES } from '../../utils/meetingRoom.js';
import { isValidDateString, todayKst } from '../../utils/dateKst.js';
import { log } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('회의실신청')
    .setDescription('회의실 사용을 신청합니다. 관리자 승인 후 확정돼요.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName('회의실')
        .setDescription('사용할 회의실')
        .setRequired(true)
        .addChoices(...ROOM_NAMES.map((name) => ({ name, value: name }))),
    )
    .addStringOption((opt) =>
      opt.setName('날짜').setDescription('사용 날짜 (예: 2026-07-15)').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('목적').setDescription('사용 목적').setRequired(true).setMaxLength(80),
    ),

  async execute(interaction) {
    const room = interaction.options.getString('회의실');
    const date = interaction.options.getString('날짜');
    const purpose = interaction.options.getString('목적');

    if (!isValidDateString(date)) {
      await interaction.reply({ content: '날짜 형식이 잘못됐어요. `2026-07-15` 형식으로 입력해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (date < todayKst()) {
      await interaction.reply({ content: '지난 날짜는 신청할 수 없어요.', flags: MessageFlags.Ephemeral });
      return;
    }

    const userName = interaction.member?.displayName ?? interaction.user.username;
    const result = await createReservation(interaction.guildId, {
      room,
      date,
      purpose,
      userId: interaction.user.id,
      userName,
    });

    if (!result.ok) {
      const c = result.conflict;
      const label = c.status === 'approved' ? '이미 예약돼 있어요' : '승인 대기 중인 신청이 있어요';
      await interaction.reply({
        content: `**${date} ${room}**은 ${label} (<@${c.userId}>).`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mr:approve:${result.reservation.id}`).setLabel('승인').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`mr:reject:${result.reservation.id}`).setLabel('거절').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ embeds: [requestEmbed(result.reservation)], components: [row] });

    try {
      const sent = await interaction.fetchReply();
      await attachRequestMessage(interaction.guildId, result.reservation.id, sent.channelId, sent.id);
    } catch (err) {
      log('error', '신청 메시지 기록 실패:', err.message);
    }
    try {
      await refreshStatusBoard(interaction.client, interaction.guildId);
    } catch (err) {
      log('error', '현황판 갱신 실패:', err.message);
    }
  },
};
