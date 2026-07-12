import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } from 'discord.js';
import { updateSettings, refreshStatusBoard } from '../../utils/meetingRoom.js';
import { sendChannelGuide } from '../../utils/channelGuide.js';
import { log } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('채널-세팅')
    .setDescription('이 채널을 특정 용도로 지정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName('타입')
        .setDescription('채널 용도')
        .setRequired(true)
        .addChoices(
          { name: '회의실 현황', value: '회의실' },
          { name: '회의실 신청 채널', value: '회의실신청' },
          { name: '연장 신청 채널', value: '연장신청' },
          { name: '잔류 신청 채널', value: '잔류신청' },
          { name: '학습 영상 신청 채널', value: '학습영상신청' },
        ),
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const type = interaction.options.getString('타입');

    const previous = await updateSettings(interaction.guildId, (settings) => {
      settings.channels ??= {};
      const prev = settings.channels[type];
      if (prev?.channelId === interaction.channelId) {
        return { unchanged: true };
      }
      settings.channels[type] = { channelId: interaction.channelId };
      return { prev };
    });

    if (previous.unchanged) {
      await interaction.reply({ content: `이미 이 채널이 **${type}** 채널이에요.`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `이 채널이 **${type}** 채널로 지정됐어요.`, flags: MessageFlags.Ephemeral });
      const old = previous.prev;
      if (type === '회의실' && old?.channelId) {
        for (const oldMessageId of [old.messageId, old.monthMessageId, old.weekMessageId].filter(Boolean)) {
          try {
            const channel = await interaction.client.channels.fetch(old.channelId);
            const message = await channel.messages.fetch(oldMessageId);
            await message.delete();
          } catch {
          }
        }
      }
    }

    if (!previous.unchanged) {
      try {
        await sendChannelGuide(interaction.channel, type);
      } catch (err) {
        log('error', '채널 안내 전송 실패:', err.message);
        await interaction.followUp({ content: '채널은 설정됐지만 안내 메시지를 보내지 못했어요. 봇의 메시지 전송 권한을 확인해주세요.', flags: MessageFlags.Ephemeral });
      }
    }

    if (type === '회의실') {
      try {
        await refreshStatusBoard(interaction.client, interaction.guildId);
      } catch (err) {
        log('error', '현황판 갱신 실패:', err.message);
      }
    }
  },
};
