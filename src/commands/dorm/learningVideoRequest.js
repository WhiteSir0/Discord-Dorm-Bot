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
import { attachVideoRequestMessage, createVideoRequest, videoRequestEmbed } from '../../utils/learningVideo.js';
import { formatUser, getUserInfo } from '../../utils/userRegistry.js';
import { createApplicationPost } from '../../utils/applicationForum.js';
import { serverDisplayName } from '../../utils/discordNames.js';

export default {
  data: new SlashCommandBuilder()
    .setName('학습영상신청')
    .setDescription('학습 영상을 신청합니다. 관리자 승인 후 확정돼요.')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const info = await getUserInfo(interaction.guildId, interaction.user.id);
    if (!info) {
      await interaction.reply({ content: '먼저 `/학번등록`으로 학번과 이름을 등록해주세요.', flags: MessageFlags.Ephemeral });
      return;
    }
    const id = await createDraft({ guildId: interaction.guildId, userId: interaction.user.id, userName: formatUser(info), requesterDisplayName: serverDisplayName(interaction) });
    const url = new TextInputBuilder().setCustomId('url').setLabel('영상 링크').setPlaceholder('https://...').setStyle(TextInputStyle.Short).setRequired(true);
    const purpose = new TextInputBuilder().setCustomId('purpose').setLabel('학습 목적').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    const duration = new TextInputBuilder().setCustomId('duration').setLabel('학습 시간').setPlaceholder('예: 약 20분').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60);
    await interaction.showModal(new ModalBuilder()
      .setCustomId(`lv:submit:${id}`)
      .setTitle('학습 영상 신청')
      .addComponents(new ActionRowBuilder().addComponents(url), new ActionRowBuilder().addComponents(purpose), new ActionRowBuilder().addComponents(duration)));
  },
};

export async function handleLearningVideoModal(interaction) {
  const id = interaction.customId.split(':')[2];
  const draft = await takeDraft(id, interaction.guildId, interaction.user.id);
  if (!draft) {
    await interaction.reply({ content: '신청 시간이 만료됐어요. `/학습영상신청`을 다시 실행해주세요.', flags: MessageFlags.Ephemeral });
    return;
  }
  const url = interaction.fields.getTextInputValue('url').trim();
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
  } catch {
    await interaction.reply({ content: 'http 또는 https 영상 링크를 입력해주세요.', flags: MessageFlags.Ephemeral });
    return;
  }
  const request = await createVideoRequest(interaction.guildId, {
    userId: interaction.user.id,
    userName: draft.userName,
    requesterDisplayName: draft.requesterDisplayName,
    url,
    purpose: interaction.fields.getTextInputValue('purpose').trim(),
    duration: interaction.fields.getTextInputValue('duration').trim(),
  });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`lv:approve:${request.id}`).setLabel('승인').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`lv:reject:${request.id}`).setLabel('거절').setStyle(ButtonStyle.Danger),
  );
  const post = await createApplicationPost(interaction.client, interaction.guildId, '학습영상신청', {
    name: `학습 영상 · ${request.requesterDisplayName}`,
    embeds: [videoRequestEmbed(request)],
    components: [row],
    applicantUserId: request.userId,
    fallbackChannelId: interaction.channelId,
  });
  if (post) {
    await attachVideoRequestMessage(interaction.guildId, request.id, post.channelId, post.messageId, post.discussionThreadId);
    await interaction.reply({ content: `신청글을 <#${post.channelId}>에 등록했습니다.`, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ embeds: [videoRequestEmbed(request)], components: [row] });
    const sent = await interaction.fetchReply();
    await attachVideoRequestMessage(interaction.guildId, request.id, sent.channelId, sent.id);
  }
}
