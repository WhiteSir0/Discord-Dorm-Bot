import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } from 'discord.js';
import { config } from '../../config.js';

function isPublicCommand(command) {
  const required = command.data.toJSON().default_member_permissions;
  return !required;
}

function commandLines(command) {
  const data = command.data.toJSON();
  const subcommands = data.options?.filter((option) => option.type === 1) ?? [];
  if (subcommands.length) {
    return subcommands.map((subcommand) => `**/${data.name} ${subcommand.name}** — ${subcommand.description}`);
  }
  return [`**/${data.name}** — ${data.description}`];
}

function buildHelpEmbed(client) {
  const lines = [...client.commands.values()]
    .filter(isPublicCommand)
    .flatMap((cmd) => {
      const prefixPart = config.prefix && typeof cmd.executePrefix === 'function' && cmd.aliases?.length
        ? ` (커맨드: ${cmd.aliases.map((a) => `\`${config.prefix}${a}\``).join(' ')})`
        : '';
      const entries = commandLines(cmd);
      if (prefixPart) entries[0] += prefixPart;
      return entries;
    });

  return new EmbedBuilder()
    .setTitle('📖 명령어 목록')
    .setDescription(lines.join('\n') || '등록된 명령어가 없습니다.')
    .setColor(0x5865f2);
}

export default {
  data: new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('사용 가능한 명령어 목록을 보여줍니다.')
    .setContexts(InteractionContextType.Guild),
  aliases: ['help', '도움', '도움말'],

  async execute(interaction) {
    await interaction.reply({ embeds: [buildHelpEmbed(interaction.client)], flags: MessageFlags.Ephemeral });
  },

  async executePrefix(message) {
    await message.reply({ embeds: [buildHelpEmbed(message.client)] });
  },
};
