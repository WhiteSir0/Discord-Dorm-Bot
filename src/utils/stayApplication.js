import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { readJson, updateJson } from './jsonStore.js';

const applicationsPath = (guildId) => `guilds/${guildId}/stay-applications.json`;

export function startStayApplication(guildId, durationMinutes = null) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const active = data.applications.find((application) => application.status === 'active');
    if (active) return { application: active, existing: true };
    const application = {
      id: randomUUID(),
      status: 'active',
      entries: [],
      createdAt: new Date().toISOString(),
      closesAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null,
    };
    data.applications.push(application);
    return { application, existing: false };
  });
}

export function getStayApplication(guildId, id) {
  return readJson(applicationsPath(guildId), { applications: [] })
    .then((data) => data.applications.find((application) => application.id === id) ?? null);
}

export function getActiveStayApplication(guildId) {
  return readJson(applicationsPath(guildId), { applications: [] })
    .then((data) => data.applications.find((application) => application.status === 'active') ?? null);
}

export function getLatestStayApplication(guildId) {
  return readJson(applicationsPath(guildId), { applications: [] })
    .then((data) => data.applications.at(-1) ?? null);
}

export function setStayMessage(guildId, id, channelId, messageId) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (application) Object.assign(application, { channelId, messageId });
  });
}

export function toggleStayApplication(guildId, id, participant) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (!application || application.status !== 'active') return { reason: 'closed' };
    const index = application.entries.findIndex((entry) => entry.userId === participant.userId);
    if (index >= 0) {
      application.entries.splice(index, 1);
      return { application, selected: false };
    }
    application.entries.push({ ...participant, appliedAt: new Date().toISOString() });
    return { application, selected: true };
  });
}

export function closeStayApplication(guildId, id) {
  return updateJson(applicationsPath(guildId), { applications: [] }, (data) => {
    const application = data.applications.find((item) => item.id === id);
    if (!application || application.status !== 'active') return { reason: 'closed' };
    application.status = 'closed';
    application.closedAt = new Date().toISOString();
    return { application };
  });
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function stayResultCsv(application) {
  const rows = [['학번', '이름', '호실', '신청 시각']];
  const entries = [...application.entries].sort((a, b) => a.studentId.localeCompare(b.studentId, 'ko'));
  for (const entry of entries) rows.push([entry.studentId, entry.name, entry.room, entry.appliedAt]);
  return Buffer.from(`\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
}

function entryList(application) {
  const entries = [...application.entries].sort((a, b) => a.studentId.localeCompare(b.studentId, 'ko'));
  if (!entries.length) return '신청한 사람이 없습니다.';
  const lines = entries.map((entry) => `${entry.studentId} ${entry.name} ${entry.room}호`);
  let text = '';
  for (const line of lines) {
    if (`${text}${text ? '\n' : ''}${line}`.length > 3900) return `${text}\n외 ${lines.length - text.split('\n').length}명`;
    text += `${text ? '\n' : ''}${line}`;
  }
  return text;
}

export function stayEmbed(application) {
  const deadline = application.closesAt
    ? `자동 종료: <t:${Math.floor(new Date(application.closesAt).getTime() / 1000)}:R>`
    : '종료: 수동';
  return new EmbedBuilder()
    .setTitle('잔류 신청')
    .setColor(application.status === 'active' ? 0x5865f2 : 0xd83c3e)
    .setDescription(`${deadline}\n\n${entryList(application)}`)
    .setFooter({ text: application.status === 'active' ? `신청 진행 중 · ${application.entries.length}명` : `신청 종료 · ${application.entries.length}명` });
}

export function stayButtons(application) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`stay:toggle:${application.id}`)
      .setLabel('신청 / 취소')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(application.status !== 'active'),
    new ButtonBuilder()
      .setCustomId(`stay:close:${application.id}`)
      .setLabel('종료')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(application.status !== 'active'),
  );
}
