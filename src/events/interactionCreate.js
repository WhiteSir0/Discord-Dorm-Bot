import { Events, MessageFlags } from 'discord.js';
import { log } from '../utils/logger.js';
import { handleReservationButton, handleReservationRejectionModal } from '../utils/meetingRoom.js';
import { handleVideoRejectionModal, handleVideoRequestButton } from '../utils/learningVideo.js';
import { handleRoomParticipantCancel, handleRoomParticipantConfirm, handleRoomParticipantSelect } from '../commands/dorm/roomRequest.js';
import { handleLearningVideoModal } from '../commands/dorm/learningVideoRequest.js';
import { handleExtensionButton } from '../utils/extensionInteraction.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('ex:')) {
      try {
        await handleExtensionButton(interaction);
      } catch (err) {
        log('error', '연장 신청 버튼 처리 오류:', err);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('mr:confirm:')) {
      try {
        await handleRoomParticipantConfirm(interaction);
      } catch (err) {
        log('error', '회의실 신청 등록 처리 오류:', err);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('mr:cancel:')) {
      try {
        await handleRoomParticipantCancel(interaction);
      } catch (err) {
        log('error', '회의실 신청 취소 처리 오류:', err);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('mr:')) {
      try {
        await handleReservationButton(interaction);
      } catch (err) {
        log('error', '회의실 버튼 처리 오류:', err);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('lv:')) {
      try {
        await handleVideoRequestButton(interaction);
      } catch (err) {
        log('error', '학습 영상 버튼 처리 오류:', err);
      }
      return;
    }

    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('mr:members:')) {
      try {
        await handleRoomParticipantSelect(interaction);
      } catch (err) {
        log('error', '회의실 인원 선택 처리 오류:', err);
        await interaction.reply({ content: '신청 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('mr:reject-reason:')) {
      try {
        await handleReservationRejectionModal(interaction);
      } catch (err) {
        log('error', '회의실 거절 처리 오류:', err);
        await interaction.reply({ content: '거절 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('lv:reject-reason:')) {
      try {
        await handleVideoRejectionModal(interaction);
      } catch (err) {
        log('error', '학습 영상 거절 처리 오류:', err);
        await interaction.reply({ content: '거절 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('lv:submit:')) {
      try {
        await handleLearningVideoModal(interaction);
      } catch (err) {
        log('error', '학습 영상 신청 처리 오류:', err);
        await interaction.reply({ content: '신청 처리 중 오류가 발생했습니다.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
