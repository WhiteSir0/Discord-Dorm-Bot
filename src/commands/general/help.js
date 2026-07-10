import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { config } from '../../config.js';

function buildHelpEmbed(client) {
  const lines = [...client.commands.values()].map((cmd) => {
    const prefixPart = config.prefix && typeof cmd.executePrefix === 'function' && cmd.aliases?.length
      ? ` (커맨드: ${cmd.aliases.map((a) => `\`${config.prefix}${a}\``).join(' ')})`
      : '';
    return `**/${cmd.data.name}** — ${cmd.data.description}${prefixPart}`;
  });

  return new EmbedBuilder()
    .setTitle('📖 명령어 목록')
    .setDescription(lines.join('\n') || '등록된 명령어가 없습니다.')
    .setColor(0x5865f2);
}

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('사용 가능한 명령어 목록을 보여줍니다.'),
  aliases: ['help', '도움', '도움말'],

  async execute(interaction) {
    await interaction.reply({ embeds: [buildHelpEmbed(interaction.client)] });
  },

  async executePrefix(message) {
    await message.reply({ embeds: [buildHelpEmbed(message.client)] });
  },
};
