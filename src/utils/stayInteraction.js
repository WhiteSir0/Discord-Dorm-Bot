import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { closeStayApplication, stayButtons, stayEmbed, toggleStayApplication } from './stayApplication.js';
import { getUserInfo } from './userRegistry.js';

export async function handleStayButton(interaction) {
  const [, action, id] = interaction.customId.split(':');
  if (action === 'close') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate();
    const result = await closeStayApplication(interaction.guildId, id);
    if (!result.reason) await updateStayMessage(interaction.client, result.application);
    return;
  }

  const info = await getUserInfo(interaction.guildId, interaction.user.id);
  if (!info?.room) {
    await interaction.reply({ content: '먼저 `/학번등록`으로 학번, 이름, 호실을 등록해주세요.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  const result = await toggleStayApplication(interaction.guildId, id, {
    userId: interaction.user.id,
    studentId: info.studentId,
    name: info.name,
    room: info.room,
  });
  if (result.reason) {
    await interaction.followUp({ content: '이 잔류 신청은 종료됐어요.', flags: MessageFlags.Ephemeral });
    return;
  }
  await updateStayMessage(interaction.client, result.application);
  await interaction.followUp({
    content: result.selected ? '잔류 신청을 완료했어요.' : '잔류 신청을 취소했어요.',
    flags: MessageFlags.Ephemeral,
  });
}

async function updateStayMessage(client, application) {
  const channel = await client.channels.fetch(application.channelId).catch(() => null);
  const message = await channel?.messages.fetch(application.messageId).catch(() => null);
  await message?.edit({ embeds: [stayEmbed(application)], components: [stayButtons(application)] });
}
