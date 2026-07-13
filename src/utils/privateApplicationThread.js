import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } from 'discord.js';

export function privateThreadLinkRow(guildId, threadId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('대화 스레드')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guildId}/${threadId}`),
  );
}

export async function createPrivateApplicationThread(channel, guildId, payload) {
  if (!channel || channel.type !== ChannelType.GuildText) return null;
  const message = payload.parentMessage
    ?? await channel.send({ embeds: payload.embeds, components: payload.components });
  const thread = await channel.threads.create({
    name: payload.name.slice(0, 100),
    type: ChannelType.PrivateThread,
    autoArchiveDuration: 10_080,
    invitable: false,
  });
  const staffUserIds = [...(channel.members?.values?.() ?? [])]
    .filter((member) => !member.user?.bot && (
      member.permissionsIn(channel).has(PermissionFlagsBits.Administrator)
      || member.permissionsIn(channel).has(PermissionFlagsBits.ManageThreads)
    ))
    .map((member) => member.id);
  const memberUserIds = [...new Set([...(payload.memberUserIds ?? [payload.applicantUserId]), ...staffUserIds])];
  for (const userId of memberUserIds) await thread.members.add(userId);
  await thread.send({
    content: `<@${payload.applicantUserId}> 신청 관련 대화 스레드입니다.`,
    embeds: [...payload.embeds, ...(payload.previewEmbeds ?? [])],
    components: payload.components,
    allowedMentions: { users: [payload.applicantUserId] },
  });
  await message.edit({ components: [...payload.components, privateThreadLinkRow(guildId, thread.id)] });
  return { channelId: channel.id, messageId: message.id, discussionThreadId: thread.id };
}

export async function addPrivateThreadMember(client, threadId, userId) {
  if (!threadId) return;
  const thread = await client.channels.fetch(threadId).catch(() => null);
  await thread?.members?.add(userId).catch(() => {});
}

export async function releasePrivateThreadMembers(client, threadId, userIds) {
  const thread = await client.channels.fetch(threadId).catch(() => null);
  for (const userId of new Set(userIds)) await thread?.members?.remove(userId).catch(() => {});
}

export async function notifyAndReleasePrivateThreadMembers(client, threadId, userIds, content) {
  const thread = await client.channels.fetch(threadId).catch(() => null);
  const failed = [];
  for (const userId of new Set(userIds)) {
    const user = await client.users.fetch(userId).catch(() => null);
    const sent = await user?.send({ content, allowedMentions: { parse: [] } }).then(() => true).catch(() => false) ?? false;
    if (!sent) {
      failed.push(userId);
      continue;
    }
    await thread?.members?.remove(userId).catch(() => {});
  }
  if (failed.length && thread?.isTextBased()) {
    if (thread.archived) await thread.setArchived(false).catch(() => {});
    await thread.send({
      content: `${failed.map((userId) => `<@${userId}>`).join(' ')} DM을 보낼 수 없어 이 스레드에 남겨뒀습니다.`,
      allowedMentions: { users: failed },
    }).catch(() => {});
  }
  return failed;
}

export async function findPrivateThreadRequestMessage(client, threadId, requestId) {
  if (!threadId) return null;
  const thread = await client.channels.fetch(threadId).catch(() => null);
  if (!thread?.isThread()) return null;
  if (thread.archived) await thread.setArchived(false).catch(() => {});
  const messages = await thread.messages.fetch({ limit: 100 }).catch(() => null);
  return messages?.find((message) =>
    message.author.id === client.user.id
    && message.embeds.some((embed) => embed.footer?.text?.includes(requestId)))
    ?? null;
}
