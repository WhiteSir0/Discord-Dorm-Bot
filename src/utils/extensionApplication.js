import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readJson, updateJson } from './jsonStore.js';
import { todayKst } from './dateKst.js';

export const EXTENSION_DAYS = [
  { key: 'mon', label: '월요일', short: '월' },
  { key: 'tue', label: '화요일', short: '화' },
  { key: 'wed', label: '수요일', short: '수' },
  { key: 'thu', label: '목요일', short: '목' },
];

const applicationsPath = (guildId) => `guilds/${guildId}/extension-applications.json`;

export function currentExtensionWeek() {
  const today = new Date(`${todayKst()}T00:00:00Z`);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - mondayOffset);
  return {
    key: monday.toISOString().slice(0, 10),
    label: `${today.getUTCMonth() + 1}월 ${Math.floor((today.getUTCDate() - 1) / 7) + 1}주차`,
  };
}

export function startExtensionApplication(guildId, durationMinutes = null) {
  const week = currentExtensionWeek();
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const active = data.applications.find((application) => application.status === 'active');
    if (active?.weekKey === week.key) return { application: active, existing: true };
    if (active) {
      active.status = 'closed';
      active.closedAt = new Date().toISOString();
    }
    const application = {
      id: randomUUID(),
      weekKey: week.key,
      label: week.label,
      status: 'active',
      closedDays: [],
      excludedDays: [],
      entries: Object.fromEntries(EXTENSION_DAYS.map((day) => [day.key, []])),
      createdAt: new Date().toISOString(),
      closesAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null,
    };
    data.applications.push(application);
    return { application, previous: active ?? null, existing: false };
  });
}

export function getExtensionApplication(guildId, id) {
  return readJson(applicationsPath(guildId), { applications: [] })
    .then((data) => data.applications.find((application) => application.id === id) ?? null);
}

export function getActiveExtensionApplication(guildId) {
  return readJson(applicationsPath(guildId), { applications: [] })
    .then((data) => data.applications.find((application) => application.status === 'active') ?? null);
}

export function getLatestExtensionApplication(guildId) {
  return readJson(applicationsPath(guildId), { applications: [] })
    .then((data) => data.applications.at(-1) ?? null);
}

export function setExtensionMessage(guildId, id, channelId, messageId) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (application) Object.assign(application, { channelId, messageId });
  });
}

export function toggleExtensionDay(guildId, id, dayKey, participant) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (!application || application.status !== 'active') return { reason: 'closed' };
    if (application.excludedDays?.includes(dayKey)) return { reason: 'dayExcluded' };
    if (application.closedDays.includes(dayKey)) return { reason: 'dayClosed' };
    const entries = application.entries[dayKey];
    if (!entries) return { reason: 'missing' };
    const index = entries.findIndex((entry) => entry.userId === participant.userId);
    if (index >= 0) {
      entries.splice(index, 1);
      return { application, selected: false };
    }
    const total = EXTENSION_DAYS.reduce((count, day) => count + application.entries[day.key].filter((entry) => entry.userId === participant.userId).length, 0);
    if (total >= 2) return { reason: 'limit' };
    entries.push({ ...participant, appliedAt: new Date().toISOString() });
    return { application, selected: true };
  });
}

export function closeExtensionApplication(guildId, id) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (!application || application.status !== 'active') return { reason: 'closed' };
    application.status = 'closed';
    application.closedDays = EXTENSION_DAYS.map((day) => day.key);
    application.closedAt = new Date().toISOString();
    return { application };
  });
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function extensionResultCsv(application) {
  const rows = [['주차', '요일', '학번', '이름', '호실', '신청 시각']];
  for (const day of EXTENSION_DAYS) {
    const entries = [...(application.entries[day.key] ?? [])]
      .sort((a, b) => a.studentId.localeCompare(b.studentId, 'ko'));
    for (const entry of entries) {
      rows.push([application.label, day.label, entry.studentId, entry.name, entry.room ?? '', entry.appliedAt]);
    }
  }
  return Buffer.from(`\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
}

export function cancelExtensionEntries(guildId, id, userId) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (!application || application.status !== 'active') return { reason: 'closed' };
    let removed = 0;
    for (const day of EXTENSION_DAYS) {
      const entries = application.entries[day.key];
      const kept = entries.filter((entry) => entry.userId !== userId);
      removed += entries.length - kept.length;
      application.entries[day.key] = kept;
    }
    return removed ? { application, removed } : { reason: 'empty' };
  });
}

export function toggleExtensionDayExclusion(guildId, id, dayKey) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (!application || application.status !== 'active') return { reason: 'closed' };
    application.excludedDays ??= [];
    const index = application.excludedDays.indexOf(dayKey);
    if (index >= 0) {
      application.excludedDays.splice(index, 1);
      return { application, excluded: false, removed: 0 };
    }
    const removed = application.entries[dayKey]?.length ?? 0;
    application.entries[dayKey] = [];
    application.excludedDays.push(dayKey);
    return { application, excluded: true, removed };
  });
}

export function extensionEmbed(application) {
  const deadline = application.closesAt
    ? `\n자동 종료: <t:${Math.floor(new Date(application.closesAt).getTime() / 1000)}:R>`
    : '';
  return new EmbedBuilder()
    .setTitle(`${application.label} 연장 신청`)
    .setColor(application.status === 'active' ? 0x5865f2 : 0xd83c3e)
    .setDescription(`월요일부터 목요일 중 최대 2일을 선택할 수 있습니다. 같은 요일을 다시 누르면 취소됩니다.${deadline}`)
    .addFields(EXTENSION_DAYS.map((day) => ({
      name: day.label,
      value: application.excludedDays?.includes(day.key)
        ? '제외'
        : application.closedDays.includes(day.key)
          ? `마감 · ${application.entries[day.key].length}명`
          : `신청 ${application.entries[day.key].length}명`,
      inline: true,
    })))
    .setFooter({ text: application.status === 'active' ? '신청 진행 중' : '신청 종료' });
}

export function extensionButtons(application) {
  return new ActionRowBuilder().addComponents(...EXTENSION_DAYS.map((day) =>
    new ButtonBuilder()
      .setCustomId(`ex:toggle:${application.id}:${day.key}`)
      .setLabel(day.short)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(application.status !== 'active' || application.closedDays.includes(day.key) || application.excludedDays?.includes(day.key)),
  ));
}

export function extensionControlButtons(application) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ex:manage:${application.id}`)
      .setLabel('종료')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(application.status !== 'active'),
    new ButtonBuilder()
      .setCustomId(`ex:settings:${application.id}`)
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(application.status !== 'active'),
  );
}

export function extensionExcludeButtons(application) {
  return new ActionRowBuilder().addComponents(...EXTENSION_DAYS.map((day) => {
    const excluded = application.excludedDays?.includes(day.key);
    return new ButtonBuilder()
      .setCustomId(`ex:exclude:${application.id}:${day.key}`)
      .setLabel(`${day.short} ${excluded ? '제외 취소' : '제외'}`)
      .setStyle(excluded ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(application.status !== 'active');
  }));
}
