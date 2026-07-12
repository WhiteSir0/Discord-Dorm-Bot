import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const SOURCE_URL = 'https://github.com/WhiteSir0/Discord-Dorm-Bot';

function buildInfoEmbed() {
  return new EmbedBuilder()
    .setTitle('Discord-Dorm-Bot 정보')
    .addFields(
      { name: '제작자', value: 'WhiteSir0' },
      { name: '소스 저장소', value: `[GitHub에서 보기](${SOURCE_URL})` },
    )
    .setColor(0x5865f2);
}

export default {
  data: new SlashCommandBuilder()
    .setName('정보')
    .setDescription('봇 제작자와 소스 저장소를 보여줍니다.')
    .setContexts(InteractionContextType.Guild),
  aliases: ['정보', 'info'],

  async execute(interaction) {
    await interaction.reply({ embeds: [buildInfoEmbed()] });
  },

  async executePrefix(message) {
    await message.reply({ embeds: [buildInfoEmbed()] });
  },
};
