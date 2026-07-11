import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { createDraft, takeDraft } from '../../utils/interactionDrafts.js';
import { attachVideoRequestMessage, createVideoRequest, videoPreviewEmbeds, videoReferenceLinks, videoRequestEmbed } from '../../utils/learningVideo.js';
import { formatUser, getUserInfo } from '../../utils/userRegistry.js';
import { createApplicationPost } from '../../utils/applicationForum.js';
import { serverDisplayName } from '../../utils/discordNames.js';
import { getSettings } from '../../utils/meetingRoom.js';

export default {
  data: new SlashCommandBuilder()
    .setName('학습영상신청')
    .setDescription('학습 영상을 신청합니다. 관리자 승인 후 확정돼요.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const settings = await getSettings(interaction.guildId);
    const channelId = settings.channels?.['학습영상신청']?.channelId;
    if (!channelId) {
      await interaction.reply({ content: '학습 영상 신청 채널이 설정되지 않았어요.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.channelId !== channelId) {
      await interaction.reply({ content: `이 명령어는 <#${channelId}>에서만 사용할 수 있어요.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const info = await getUserInfo(interaction.guildId, interaction.user.id);
    if (!info) {
      await interaction.reply({ content: '먼저 `/학번등록`으로 학번과 이름을 등록해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = await createDraft({ guildId: interaction.guildId, userId: interaction.user.id, userName: formatUser(info), requesterDisplayName: serverDisplayName(interaction) });
    const reference = new TextInputBuilder().setCustomId('reference').setLabel('링크 또는 설명').setPlaceholder('여러 개면 쉼표 또는 줄바꿈으로 구분').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
    const purpose = new TextInputBuilder().setCustomId('purpose').setLabel('학습 목적').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    const duration = new TextInputBuilder().setCustomId('duration').setLabel('학습 시간').setPlaceholder('예: 약 20분').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
    await interaction.showModal(new ModalBuilder()
      .setCustomId(`lv:submit:${id}`)
      .setTitle('학습 영상 신청')
      .addComponents(new ActionRowBuilder().addComponents(reference), new ActionRowBuilder().addComponents(purpose), new ActionRowBuilder().addComponents(duration)));
  },
};

export async function handleLearningVideoModal(interaction) {
  const id = interaction.customId.split(':')[2];
  const draft = await takeDraft(id, interaction.guildId, interaction.user.id);
  if (!draft) {
    await interaction.reply({ content: '신청 시간이 만료됐어요. `/학습영상신청`을 다시 실행해주세요.', flags: MessageFlags.Ephemeral });
    return;
  }
  const request = await createVideoRequest(interaction.guildId, {
    userId: interaction.user.id,
    userName: draft.userName,
    requesterDisplayName: draft.requesterDisplayName,
    reference: interaction.fields.getTextInputValue('reference').trim(),
    purpose: interaction.fields.getTextInputValue('purpose').trim(),
    duration: interaction.fields.getTextInputValue('duration').trim(),
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lv:approve:${request.id}`).setLabel('승인').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`lv:reject:${request.id}`).setLabel('거절').setStyle(ButtonStyle.Danger),
  );
  const embed = videoRequestEmbed(request);
  const previewUrls = videoReferenceLinks(request);
  await interaction.reply({ embeds: [embed], components: [row] });
  const parentMessage = await interaction.fetchReply();
  const previewEmbeds = await videoPreviewEmbeds(previewUrls);
  const post = await createApplicationPost(interaction.client, interaction.guildId, '학습영상신청', {
    name: `학습 영상 · ${request.requesterDisplayName}`,
    embeds: [embed],
    components: [row],
    applicantUserId: request.userId,
    fallbackChannelId: interaction.channelId,
    parentMessage,
    previewEmbeds,
  });
  if (post) {
    await attachVideoRequestMessage(interaction.guildId, request.id, post.channelId, post.messageId, post.discussionThreadId);
  } else {
    await attachVideoRequestMessage(interaction.guildId, request.id, parentMessage.channelId, parentMessage.id);
  }
}
