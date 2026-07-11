import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, EmbedBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from 'discord.js';
import { readJson, updateJson } from './jsonStore.js';
import { sendDecisionNotice } from './applicationForum.js';
import { serverDisplayName } from './discordNames.js';
import { addPrivateThreadMember, findPrivateThreadRequestMessage, privateThreadLinkRow } from './privateApplicationThread.js';

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

function referenceParts(request) {
  const reference = request.reference ?? request.url;
  const links = [];
  const descriptions = [];
  for (const item of reference.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(item);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        links.push(parsed.href);
        continue;
      }
    } catch {
    }
    descriptions.push(item);
  }
  return { links, descriptions };
}

export function videoReferenceLinks(request) {
  return referenceParts(request).links;
}

export function videoRequestEmbed(request) {
  const { links, descriptions } = referenceParts(request);
  const embed = new EmbedBuilder()
    .setTitle('학습 영상 신청')
    .setColor(0xf0b232)
    .addFields(
      { name: '신청자', value: `<@${request.userId}>`, inline: true },
      { name: '학습 시간', value: request.duration, inline: true },
      { name: '학습 목적', value: request.purpose, inline: true },
    )
    .setFooter({ text: `승인 대기 중 · ${request.id}` });
  if (links.length) {
    embed.addFields({
      name: '영상 링크',
      value: links.map((link, index) => `[링크 ${index + 1} 열기](${link})`).join('\n').slice(0, 1024),
    });
    embed.setURL(links[0]);
  }
  if (descriptions.length) {
    embed.addFields({
      name: '설명',
      value: descriptions.map((description) => `• ${description}`).join('\n').slice(0, 1024),
    });
  }
  return embed;
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
  await interaction.deferUpdate();
  const decision = await decideVideoRequest(interaction, id, 'rejected', interaction.fields.getTextInputValue('reason').trim());
  await finishVideoDecision(interaction, decision);
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
  await addPrivateThreadMember(interaction.client, request.discussionThreadId, interaction.user.id);
  await updateVideoRequestMessage(interaction.client, request);
  const notice = request.status === 'approved'
    ? `<@${request.userId}> 확인했습니다. 관리실에서 머리띠 받아가세요.\n처리: <@${request.decidedBy}>`
    : `<@${request.userId}> 학습 영상 신청이 거절되었습니다.\n사유: ${request.rejectionReason}\n처리: <@${request.decidedBy}>`;
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
  const components = request.discussionThreadId ? [privateThreadLinkRow(message.guildId, request.discussionThreadId)] : [];
  await message.edit({ embeds: [embed], components }).catch(() => {});
  const threadMessage = await findPrivateThreadRequestMessage(client, request.discussionThreadId, request.id);
  if (threadMessage?.embeds[0]) {
    const threadEmbed = EmbedBuilder.from(threadMessage.embeds[0])
      .setColor(approved ? 0x3ba55d : 0xd83c3e)
      .setFooter({ text: `${approved ? '승인됨' : '거절됨'} · 처리: ${request.decidedByName}` });
    if (request.rejectionReason) threadEmbed.addFields({ name: '거절 사유', value: request.rejectionReason });
    await threadMessage.edit({ embeds: [threadEmbed] }).catch(() => {});
  }
}

export async function getVideoRequests(guildId) {
  return readJson(requestsPath(guildId), []);
}
