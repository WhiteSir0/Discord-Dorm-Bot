import { randomUUID } from 'node:crypto';
import { updateJson } from './jsonStore.js';

const draftsPath = (guildId) => `guilds/${guildId}/interaction-drafts.json`;

export async function createDraft(data) {
  const id = randomUUID();
  await updateJson(draftsPath(data.guildId), {}, (drafts) => {
    drafts[id] = { ...data, createdAt: new Date().toISOString() };
  });
  return id;
}

export function takeDraft(id, guildId, userId) {
  return updateJson(draftsPath(guildId), {}, (drafts) => {
    const draft = drafts[id];
    if (!isOwnedBy(draft, guildId, userId)) return null;
    delete drafts[id];
    return draft;
  });
}

export function setDraftParticipants(id, guildId, userId, participantIds) {
  return updateJson(draftsPath(guildId), {}, (drafts) => {
    const draft = drafts[id];
    if (!isOwnedBy(draft, guildId, userId)) return null;
    draft.participantIds = participantIds;
    return draft;
  });
}

function isOwnedBy(draft, guildId, userId) {
  return draft?.guildId === guildId && draft.userId === userId;
}
