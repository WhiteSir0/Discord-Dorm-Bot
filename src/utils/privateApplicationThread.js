import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';

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
  const message = await channel.send({ embeds: payload.embeds, components: payload.components });
  const thread = await channel.threads.create({
    name: payload.name.slice(0, 100),
    type: ChannelType.PrivateThread,
    autoArchiveDuration: 10_080,
    invitable: false,
  });
  await thread.members.add(payload.applicantUserId);
  await thread.send({
    content: `<@${payload.applicantUserId}> 신청 관련 대화 스레드입니다.`,
    embeds: payload.embeds,
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
