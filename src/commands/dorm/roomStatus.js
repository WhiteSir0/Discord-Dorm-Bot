import { SlashCommandBuilder, EmbedBuilder, MessageFlags, InteractionContextType } from 'discord.js';
import { getReservations, participantList, participantsOf, ROOM_NAMES } from '../../utils/meetingRoom.js';
import { isValidDateString, todayKst } from '../../utils/dateKst.js';

export default {
  data: new SlashCommandBuilder()
    .setName('회의실현황')
    .setDescription('특정 날짜의 회의실 예약 상세를 봅니다.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt.setName('날짜').setDescription('조회할 날짜 (예: 2026-07-15, 비우면 오늘)').setRequired(false),
    ),

  async execute(interaction) {
    const date = interaction.options.getString('날짜')?.trim() || todayKst();
    if (!isValidDateString(date)) {
      await interaction.reply({ content: '날짜 형식이 잘못됐어요. `2026-07-15` 형식으로 입력해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }

    const list = await getReservations(interaction.guildId);
    const dayList = list.filter((reservation) => reservation.date === date && ['pending', 'approved'].includes(reservation.status));
    const embed = new EmbedBuilder()
      .setTitle(`📅 ${date} 회의실 현황`)
      .setColor(0x5865f2)
      .addFields(ROOM_NAMES.map((room) => {
        const reservation = dayList.find((item) => item.room === room);
        if (!reservation) return { name: room, value: '🟢 비어있음', inline: false };
        const mark = reservation.status === 'approved' ? '✅' : '⏳ 승인 대기';
        return {
          name: room,
          value: `${mark} <@${reservation.userId}> · ${reservation.requesterDisplayName ?? reservation.userName}\n인원: ${participantsOf(reservation).length}명\n명단: ${participantList(reservation)}\n> ${reservation.purpose}`,
          inline: false,
        };
      }));

    await interaction.reply({ embeds: [embed] });
  },
};
