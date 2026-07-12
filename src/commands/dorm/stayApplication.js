import { AttachmentBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { scheduleStayClose } from '../../utils/applicationTimers.js';
import { getSettings } from '../../utils/meetingRoom.js';
import { getLatestStayApplication, setStayMessage, startStayApplication, stayButtons, stayEmbed, stayResultCsv } from '../../utils/stayApplication.js';

export default {
  data: new SlashCommandBuilder()
    .setName('잔류신청')
    .setDescription('잔류 신청을 관리합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) => subcommand
      .setName('시작')
      .setDescription('잔류 신청을 시작합니다.')
      .addIntegerOption((option) => option
        .setName('시간')
        .setDescription('자동 종료까지의 시간(분). 비우면 수동 종료합니다.')
        .setMinValue(1)))
    .addSubcommand((subcommand) => subcommand.setName('결과').setDescription('최근 잔류 신청 결과를 CSV 파일로 받습니다.')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.options.getSubcommand() === '결과') {
      const application = await getLatestStayApplication(interaction.guildId);
      if (!application) {
        await interaction.reply({ content: '저장된 잔류 신청 결과가 없어요.', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({
        content: '잔류 신청 결과입니다.',
        files: [new AttachmentBuilder(stayResultCsv(application), { name: `stay-${application.createdAt.slice(0, 10)}.csv` })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const settings = await getSettings(interaction.guildId);
    const channelId = settings.channels?.['잔류신청']?.channelId;
    if (!channelId) {
      await interaction.reply({ content: '잔류 신청 채널이 설정되지 않았어요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.channelId !== channelId) {
      await interaction.reply({ content: `이 명령어는 <#${channelId}>에서만 사용할 수 있어요.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const durationMinutes = interaction.options.getInteger('시간');
    const result = await startStayApplication(interaction.guildId, durationMinutes);
    if (result.existing) {
      const location = result.application.channelId ? `<#${result.application.channelId}>` : '현재 채널';
      await interaction.reply({ content: `이미 잔류 신청이 진행 중이에요: ${location}`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({
      content: '@everyone',
      allowedMentions: { parse: ['everyone'] },
      embeds: [stayEmbed(result.application)],
      components: [stayButtons(result.application)],
    });
    const message = await interaction.fetchReply();
    await setStayMessage(interaction.guildId, result.application.id, message.channelId, message.id);
    Object.assign(result.application, { channelId: message.channelId, messageId: message.id });
    scheduleStayClose(interaction.client, interaction.guildId, result.application);
  },
};
