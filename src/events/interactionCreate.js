import { Events, MessageFlags } from 'discord.js';
import { log } from '../utils/logger.js';
import { handleReservationButton } from '../utils/meetingRoom.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('mr:')) {
      try {
        await handleReservationButton(interaction);
      } catch (err) {
        log('error', '회의실 버튼 처리 오류:', err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      log('error', `/${interaction.commandName} 실행 오류:`, err);
      const payload = { content: '⚠️ 명령어 실행 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
