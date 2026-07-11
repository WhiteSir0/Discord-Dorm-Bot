import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, EmbedBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from 'discord.js';
import { readJson, updateJson } from './jsonStore.js';
import { sendDecisionNotice } from './applicationForum.js';
import { serverDisplayName } from './discordNames.js';

const requestsPath = (guildId) => `guilds/${guildId}/learning-videos.json`;

export function createVideoRequest(guildId, data) {
  return updateJson(requestsPath(guildId), [], (requests) => {
    const request = { id: randomUUID(), status: 'pending', requestedAt: new Date().toISOString(), ...data };
    requests.push(request);
    return request;
  });
}

export function attachVideoRequestMessage(guildId, id, channelId, messageId, discussionThreadId = null) {
  return updateJson(requestsPath(guildId), [], (requests) => {
    const request = requests.find((item) => item.id === id);
    if (request) Object.assign(request, { requestChannelId: channelId, requestMessageId: messageId, discussionThreadId });
  });
}

export function videoRequestEmbed(request) {
  return new EmbedBuilder()
    .setTitle('학습 영상 신청')
    .setURL(request.url)
    .setColor(0xf0b232)
    .addFields(
      { name: '신청자', value: `<@${request.userId}> · ${request.requesterDisplayName ?? request.userName}`, inline: true },
      { name: '학습 시간', value: request.duration, inline: true },
      { name: '학습 목적', value: request.purpose },
      { name: '영상 링크', value: `[영상 열기](${request.url})` },
    )
    .setFooter({ text: `승인 대기 중 · ${request.id}` });
}

export async function handleVideoRequestButton(interaction) {
  const [, action, id] = interaction.customId.split(':');
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (action === 'reject') {
    const reason = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('거절 사유')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);
    await interaction.showModal(new ModalBuilder()
      .setCustomId(`lv:reject-reason:${id}`)
      .setTitle('학습 영상 신청 거절')
      .addComponents(new ActionRowBuilder().addComponents(reason)));
    return;
  }

  await interaction.deferUpdate();
  const decision = await decideVideoRequest(interaction, id, 'approved');
  await finishVideoDecision(interaction, decision);
}

export async function handleVideoRejectionModal(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const id = interaction.customId.split(':')[2];
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const decision = await decideVideoRequest(interaction, id, 'rejected', interaction.fields.getTextInputValue('reason').trim());
  await finishVideoDecision(interaction, decision);
  if (decision.request) await interaction.editReply({ content: '거절 처리했습니다.' });
}

async function decideVideoRequest(interaction, id, status, rejectionReason = null) {
  return updateJson(requestsPath(interaction.guildId), [], (requests) => {
    const request = requests.find((item) => item.id === id);
    if (!request) return { missing: true };
    if (request.status !== 'pending') return { already: request.status };
    request.status = status;
    request.decidedBy = interaction.user.id;
    request.decidedByName = serverDisplayName(interaction);
    request.decidedAt = new Date().toISOString();
    if (rejectionReason) request.rejectionReason = rejectionReason;
    return { request: { ...request } };
  });
}

async function finishVideoDecision(interaction, decision) {
  if (decision.missing) {
    await interaction.followUp({ content: '해당 신청을 찾을 수 없어요.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  if (decision.already) {
    await interaction.followUp({ content: '이미 처리된 신청이에요.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const request = decision.request;
  await updateVideoRequestMessage(interaction.client, request);
  const notice = request.status === 'approved'
    ? `<@${request.userId}> 확인했습니다. 관리실에서 머리띠 받아가세요.\n처리: **${request.decidedByName}**`
    : `<@${request.userId}> 학습 영상 신청이 거절되었습니다.\n사유: ${request.rejectionReason}\n처리: **${request.decidedByName}**`;
  await sendDecisionNotice(interaction.client, request.discussionThreadId ?? request.requestChannelId, notice, request.userId);
}

async function updateVideoRequestMessage(client, request) {
  if (!request.requestChannelId || !request.requestMessageId) return;
  const channel = await client.channels.fetch(request.requestChannelId).catch(() => null);
  const message = await channel?.messages.fetch(request.requestMessageId).catch(() => null);
  if (!message?.embeds[0]) return;
  const approved = request.status === 'approved';
  const embed = EmbedBuilder.from(message.embeds[0])
    .setColor(approved ? 0x3ba55d : 0xd83c3e)
    .setFooter({ text: `${approved ? '승인됨' : '거절됨'} · 처리: ${request.decidedByName}` });
  if (request.rejectionReason) embed.addFields({ name: '거절 사유', value: request.rejectionReason });
  await message.edit({ embeds: [embed], components: [] }).catch(() => {});
}

export async function getVideoRequests(guildId) {
  return readJson(requestsPath(guildId), []);
}
