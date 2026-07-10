import { join } from 'node:path';
import { readJson, updateJson } from './jsonStore.js';

const usersPath = (guildId) => join('guilds', guildId, 'users.json');

export async function getUserInfo(guildId, userId) {
  const users = await readJson(usersPath(guildId), {});
  return users[userId] ?? null;
}

export async function resolveRegisteredUsers(guildId, input) {
  const users = await readJson(usersPath(guildId), {});
  const tokens = input.split(',').map((value) => value.trim()).filter(Boolean);
  const resolved = [];

  for (const token of tokens) {
    const mentionId = token.match(/^<@!?(\d+)>$/)?.[1] ?? (token.match(/^\d{17,20}$/) ? token : null);
    const matches = Object.entries(users)
      .filter(([userId, info]) => userId === mentionId || info.studentId === token || info.name === token)
      .map(([userId, info]) => ({ userId, studentId: info.studentId, name: info.name }));
    if (matches.length !== 1) {
      return { ok: false, token, ambiguous: matches.length > 1 };
    }
    if (!resolved.some((user) => user.userId === matches[0].userId)) resolved.push(matches[0]);
  }

  return { ok: true, users: resolved };
}

export function setUserInfo(guildId, userId, { studentId, name }) {
  return updateJson(usersPath(guildId), {}, (users) => {
    users[userId] = { studentId, name, updatedAt: new Date().toISOString() };
  });
}

export function formatUser(info) {
  return `${info.studentId} ${info.name}`;
}

export function formatParticipant(participant) {
  return `${participant.studentId} ${participant.name}`;
}

export const STUDENT_ID_RE = /^\d{5}$/;
export const NAME_RE = /^[가-힣]{2,5}$/;
