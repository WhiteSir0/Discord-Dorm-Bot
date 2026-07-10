import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } from 'discord.js';
import { updateSettings, refreshStatusBoard } from '../../utils/meetingRoom.js';
import { log } from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('채널-세팅')
    .setDescription('이 채널을 특정 용도로 지정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) =>
      opt
        .setName('타입')
        .setDescription('채널 용도')
        .setRequired(true)
        .addChoices({ name: '회의실', value: '회의실' }),
    ),

  async execute(interaction) {
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
      await interaction.reply({ content: `이미 이 채널이 **${type}** 채널이에요. 현황판을 새로 고칠게요.`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: `이 채널이 **${type}** 채널로 지정됐어요. 예약 현황판을 게시할게요.`, flags: MessageFlags.Ephemeral });
      const old = previous.prev;
      if (old?.channelId && old.messageId) {
        try {
          const channel = await interaction.client.channels.fetch(old.channelId);
          const message = await channel.messages.fetch(old.messageId);
          await message.delete();
        } catch {
          // 이전 현황판이 이미 지워졌으면 무시
        }
      }
    }

    try {
      await refreshStatusBoard(interaction.client, interaction.guildId);
    } catch (err) {
      log('error', '현황판 갱신 실패:', err.message);
    }
  },
};
