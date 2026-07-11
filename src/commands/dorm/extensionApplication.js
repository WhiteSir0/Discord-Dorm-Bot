import { AttachmentBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getSettings } from '../../utils/meetingRoom.js';
import { extensionButtons, extensionControlButtons, extensionEmbed, extensionResultCsv, getLatestExtensionApplication, setExtensionMessage, startExtensionApplication } from '../../utils/extensionApplication.js';

export default {
  data: new SlashCommandBuilder()
    .setName('연장신청')
    .setDescription('주차별 연장 신청을 시작합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) => subcommand.setName('시작').setDescription('이번 주 연장 신청을 시작합니다.'))
    .addSubcommand((subcommand) => subcommand.setName('결과').setDescription('최근 연장 신청 결과를 CSV 파일로 받습니다.')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.options.getSubcommand() === '결과') {
      const application = await getLatestExtensionApplication(interaction.guildId);
      if (!application) {
        await interaction.reply({ content: '저장된 연장 신청 결과가 없어요.', flags: MessageFlags.Ephemeral });
        return;
      }
      const file = new AttachmentBuilder(extensionResultCsv(application), {
        name: `extension-${application.weekKey}.csv`,
      });
      await interaction.reply({
        content: `${application.label} 연장 신청 결과입니다.`,
        files: [file],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = await getSettings(interaction.guildId);
    const channelId = settings.channels?.['연장신청']?.channelId;
    if (!channelId) {
      await interaction.reply({ content: '연장 신청 채널이 설정되지 않았어요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.channelId !== channelId) {
      await interaction.reply({ content: `이 명령어는 <#${channelId}>에서만 사용할 수 있어요.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const result = await startExtensionApplication(interaction.guildId);
    if (result.existing) {
      const location = result.application.channelId ? `<#${result.application.channelId}>` : '현재 채널';
      await interaction.reply({ content: `이미 ${result.application.label} 연장 신청이 진행 중이에요: ${location}`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (result.previous?.channelId && result.previous?.messageId) {
      const oldChannel = await interaction.client.channels.fetch(result.previous.channelId).catch(() => null);
      const oldMessage = await oldChannel?.messages.fetch(result.previous.messageId).catch(() => null);
      await oldMessage?.edit({ embeds: [extensionEmbed(result.previous)], components: [extensionButtons(result.previous), extensionControlButtons(result.previous)] }).catch(() => {});
    }

    const payload = {
      content: '@everyone',
      allowedMentions: { parse: ['everyone'] },
      embeds: [extensionEmbed(result.application)],
      components: [extensionButtons(result.application), extensionControlButtons(result.application)],
    };
    await interaction.reply(payload);
    const message = await interaction.fetchReply();
    await setExtensionMessage(interaction.guildId, result.application.id, message.channelId, message.id);
  },
};
