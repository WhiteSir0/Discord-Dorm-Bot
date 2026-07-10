import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getSettings } from '../../utils/meetingRoom.js';
import { extensionButtons, extensionControlButtons, extensionEmbed, setExtensionMessage, startExtensionApplication } from '../../utils/extensionApplication.js';

export default {
  data: new SlashCommandBuilder()
    .setName('연장신청')
    .setDescription('주차별 연장 신청을 시작합니다.')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((subcommand) => subcommand.setName('시작').setDescription('이번 주 연장 신청을 시작합니다.')),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
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

    const payload = { embeds: [extensionEmbed(result.application)], components: [extensionButtons(result.application), extensionControlButtons(result.application)] };
    const settings = await getSettings(interaction.guildId);
    const configuredChannel = await interaction.client.channels.fetch(settings.channels?.['연장신청']?.channelId).catch(() => null);
    if (configuredChannel?.type === ChannelType.GuildText) {
      const message = await configuredChannel.send(payload);
      await setExtensionMessage(interaction.guildId, result.application.id, message.channelId, message.id);
      await interaction.reply({ content: `${result.application.label} 연장 신청을 <#${message.channelId}>에 시작했습니다.`, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply(payload);
    const message = await interaction.fetchReply();
    await setExtensionMessage(interaction.guildId, result.application.id, message.channelId, message.id);
  },
};
