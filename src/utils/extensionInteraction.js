import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { EXTENSION_DAYS, cancelExtensionEntries, closeExtensionApplication, extensionButtons, extensionControlButtons, extensionEmbed, extensionExcludeButtons, getExtensionApplication, toggleExtensionDay, toggleExtensionDayExclusion } from './extensionApplication.js';
import { getUserInfo } from './userRegistry.js';

export async function handleExtensionButton(interaction) {
  const [, action, id, dayKey] = interaction.customId.split(':');
  if (action === 'settings') {
    await openExtensionSettings(interaction, id);
    return;
  }
  if (action === 'manage') {
    await closeEntireExtension(interaction, id);
    return;
  }
  if (action === 'cancel') {
    await cancelExtensionApplication(interaction, id);
    return;
  }
  if (action === 'exclude') {
    await toggleExtensionExclusion(interaction, id, dayKey);
    return;
  }
  const day = EXTENSION_DAYS.find((item) => item.key === dayKey);
  if (!day) return;

  await toggleExtensionDayButton(interaction, id, day);
}

async function toggleExtensionDayButton(interaction, id, day) {
  const info = await getUserInfo(interaction.guildId, interaction.user.id);
  if (!info) {
    await interaction.reply({ content: '먼저 `/학번등록`으로 학번과 이름을 등록해주세요.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferUpdate();
  const result = await toggleExtensionDay(interaction.guildId, id, day.key, { userId: interaction.user.id, studentId: info.studentId, name: info.name });
  if (result.reason) {
    const content = result.reason === 'limit'
      ? '연장 신청은 월요일부터 목요일 중 최대 2일만 선택할 수 있어요.'
      : result.reason === 'dayExcluded'
        ? `${day.label}은 이번 주 연장 신청에서 제외됐어요.`
        : result.reason === 'dayClosed'
          ? `${day.label} 연장 신청은 마감됐어요.`
          : '이 연장 신청은 종료됐어요.';
    await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    return;
  }
  await updateApplicationMessage(interaction.client, result.application);
  await interaction.followUp({
    content: result.selected ? `${day.label} 연장 신청을 완료했어요.` : `${day.label} 연장 신청을 취소했어요.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function openExtensionSettings(interaction, id) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  const application = await getExtensionApplication(interaction.guildId, id);
  if (!application || application.status !== 'active') {
    await interaction.reply({ content: '이 연장 신청은 종료됐어요.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: '이번 주 연장 신청에서 제외할 요일을 선택하세요. 여러 요일을 계속 선택할 수 있습니다.',
    components: [extensionExcludeButtons(application)],
    flags: MessageFlags.Ephemeral,
  });
}

async function cancelExtensionApplication(interaction, id) {
  await interaction.deferUpdate();
  const result = await cancelExtensionEntries(interaction.guildId, id, interaction.user.id);
  if (result.reason) {
    await interaction.followUp({ content: result.reason === 'empty' ? '취소할 연장 신청이 없어요.' : '이 연장 신청은 종료됐어요.', flags: MessageFlags.Ephemeral });
    return;
  }
  await updateApplicationMessage(interaction.client, result.application);
  await interaction.followUp({ content: `연장 신청 ${result.removed}건을 취소했어요.`, flags: MessageFlags.Ephemeral });
}

async function closeEntireExtension(interaction, id) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  const result = await closeExtensionApplication(interaction.guildId, id);
  if (result.reason) return;
  await updateApplicationMessage(interaction.client, result.application);
}

async function toggleExtensionExclusion(interaction, id, dayKey) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '자치회 인원이 아닙니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  const day = EXTENSION_DAYS.find((item) => item.key === dayKey);
  if (!day) return;
  const result = await toggleExtensionDayExclusion(interaction.guildId, id, dayKey);
  if (result.reason) {
    await interaction.reply({ content: '이 연장 신청은 종료됐어요.', flags: MessageFlags.Ephemeral });
    return;
  }
  await updateApplicationMessage(interaction.client, result.application);
  await interaction.update({
    content: result.excluded
      ? `${day.label}을 제외하고 기존 신청 ${result.removed}건을 철회했습니다.`
      : `${day.label} 제외를 취소했습니다. 이제 다시 신청할 수 있어요.`,
    components: [extensionExcludeButtons(result.application)],
  });
}

async function updateApplicationMessage(client, application) {
  const channel = await client.channels.fetch(application.channelId).catch(() => null);
  const message = await channel?.messages.fetch(application.messageId).catch(() => null);
  await message?.edit({ embeds: [extensionEmbed(application)], components: [extensionButtons(application), extensionControlButtons(application)] });
}
