import { AttachmentBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getRegisteredUsers, registeredUsersCsv } from '../../utils/userRegistry.js';

export default {
  data: new SlashCommandBuilder()
    .setName('학번명단')
    .setDescription('등록된 학번, 이름, 호실 명단을 CSV로 받습니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const users = await getRegisteredUsers(interaction.guildId);
    const file = new AttachmentBuilder(registeredUsersCsv(users), { name: 'registered-students.csv' });
    await interaction.reply({
      content: `등록 인원 ${users.length}명의 명단입니다.`,
      files: [file],
      flags: MessageFlags.Ephemeral,
    });
  },
};
