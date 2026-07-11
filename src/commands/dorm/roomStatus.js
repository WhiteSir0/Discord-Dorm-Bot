import { SlashCommandBuilder, EmbedBuilder, MessageFlags, InteractionContextType } from 'discord.js';
import { getReservations, participantList, participantsOf, ROOM_NAMES } from '../../utils/meetingRoom.js';
import { isValidDateString, normalizeDateInput, todayKst } from '../../utils/dateKst.js';

export default {
  data: new SlashCommandBuilder()
    .setName('회의실현황')
    .setDescription('특정 날짜의 회의실 예약 상세를 봅니다.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt.setName('날짜').setDescription('조회할 날짜 (예: 07-15, 비우면 오늘)').setRequired(false),
    ),

  async execute(interaction) {
    const date = normalizeDateInput(interaction.options.getString('날짜')?.trim() || todayKst());
    if (!isValidDateString(date)) {
      await interaction.reply({ content: '날짜 형식이 잘못됐어요. `07-15` 형식으로 입력해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }
    const list = await getReservations(interaction.guildId);
    await interaction.reply({ embeds: [buildRoomStatusEmbed(list, date)], flags: MessageFlags.Ephemeral });
  },
};

export function buildRoomStatusEmbed(list, date) {
  const dayList = list.filter((reservation) => reservation.date === date && ['pending', 'approved'].includes(reservation.status));
  const roomNames = [...new Set([...ROOM_NAMES, ...dayList.map((reservation) => reservation.room)])];
  return new EmbedBuilder()
      .setTitle(`📅 ${date} 회의실 현황`)
      .setColor(0x5865f2)
      .addFields(roomNames.map((room) => {
        const reservations = dayList.filter((item) => item.room === room);
        if (!reservations.length) return { name: room, value: '🟢 비어있음', inline: false };
        const value = reservations.map((reservation) => {
          const mark = reservation.status === 'approved' ? '✅' : '⏳ 승인 대기';
          return `${mark} <@${reservation.userId}>\n인원: ${participantsOf(reservation).length}명\n명단: ${participantList(reservation)}\n> ${reservation.purpose}`;
        }).join('\n\n');
        return {
          name: room,
          value: value.length > 1024 ? `${value.slice(0, 1021)}…` : value,
          inline: false,
        };
      }));
}

export async function handleRoomStatusButton(interaction) {
  const date = interaction.customId.slice('room-status:'.length);
  if (!isValidDateString(date)) {
    await interaction.reply({ content: '조회할 날짜가 잘못됐어요.', flags: MessageFlags.Ephemeral });
    return;
  }
  const list = await getReservations(interaction.guildId);
  await interaction.reply({ embeds: [buildRoomStatusEmbed(list, date)], flags: MessageFlags.Ephemeral });
}
