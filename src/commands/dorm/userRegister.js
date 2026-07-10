import { SlashCommandBuilder, MessageFlags, InteractionContextType } from 'discord.js';
import { setUserInfo, formatUser, STUDENT_ID_RE, NAME_RE } from '../../utils/userRegistry.js';

export default {
  data: new SlashCommandBuilder()
    .setName('학번등록')
    .setDescription('학번과 이름을 등록합니다. 회의실 신청에 사용돼요.')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt.setName('학번').setDescription('학번 5자리 (예: 10101)').setRequired(true).setMinLength(5).setMaxLength(5),
    )
    .addStringOption((opt) =>
      opt.setName('이름').setDescription('실명 (예: 홍길동)').setRequired(true).setMinLength(2).setMaxLength(5),
    ),

  async execute(interaction) {
    const studentId = interaction.options.getString('학번').trim();
    const name = interaction.options.getString('이름').trim();

    if (!STUDENT_ID_RE.test(studentId)) {
      await interaction.reply({ content: '학번은 숫자 5자리로 입력해주세요. (예: `10101`)', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!NAME_RE.test(name)) {
      await interaction.reply({ content: '이름은 한글 2~5자로 입력해주세요. (예: `홍길동`)', flags: MessageFlags.Ephemeral });
      return;
    }

    await setUserInfo(interaction.guildId, interaction.user.id, { studentId, name });
    await interaction.reply({
      content: `✅ **${formatUser({ studentId, name })}**(으)로 등록됐어요. 이제 회의실 신청 시 이 정보가 사용됩니다.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
