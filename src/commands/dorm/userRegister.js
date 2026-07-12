import { SlashCommandBuilder, MessageFlags, InteractionContextType } from 'discord.js';
import { setUserInfo, formatUser, STUDENT_ID_RE, NAME_RE, ROOM_RE } from '../../utils/userRegistry.js';

export default {
  data: new SlashCommandBuilder()
    .setName('학번등록')
    .setDescription('학번, 이름, 기숙사 호실을 등록합니다.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt.setName('학번').setDescription('학번 5자리 (예: 70707)').setRequired(true).setMinLength(5).setMaxLength(5),
    )
    .addStringOption((opt) =>
      opt.setName('이름').setDescription('실명 (예: 홍길동)').setRequired(true).setMinLength(2).setMaxLength(5),
    )
    .addStringOption((opt) =>
      opt.setName('호실').setDescription('기숙사 호실 3자리 (예: 707)').setRequired(true).setMinLength(3).setMaxLength(3),
    ),

  async execute(interaction) {
    const studentId = interaction.options.getString('학번').trim();
    const name = interaction.options.getString('이름').trim();
    const room = interaction.options.getString('호실').trim();

    if (!STUDENT_ID_RE.test(studentId)) {
      await interaction.reply({ content: '학번은 숫자 5자리로 입력해주세요. (예: `70707`)', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!NAME_RE.test(name)) {
      await interaction.reply({ content: '이름은 한글 2~5자로 입력해주세요. (예: `홍길동`)', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!ROOM_RE.test(room)) {
      await interaction.reply({ content: '호실은 숫자 3자리로 입력해주세요. (예: `707`)', flags: MessageFlags.Ephemeral });
      return;
    }

    await setUserInfo(interaction.guildId, interaction.user.id, { studentId, name, room });
    await interaction.reply({
      content: `**${formatUser({ studentId, name })} · ${room}호**로 등록됐어요.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
