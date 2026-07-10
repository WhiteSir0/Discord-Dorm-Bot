import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { join } from 'node:path';
import { nextDay } from './dateKst.js';
import { log } from './logger.js';

const keyPath = join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'secrets/google-service-account.json');
const calendarId = process.env.GOOGLE_CALENDAR_ID || '';

let tokenCache = { token: null, exp: 0 };

export function gcalEnabled() {
  return Boolean(calendarId) && existsSync(keyPath);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;

  const key = JSON.parse(readFileSync(keyPath, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key, 'base64url');
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`구글 토큰 발급 실패: ${res.status} ${await res.text()}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

export async function createAllDayEvent({ date, summary, description }) {
  if (!gcalEnabled()) return null;
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary,
        description,
        start: { date },
        end: { date: nextDay(date) },
      }),
    },
  );
  if (!res.ok) throw new Error(`캘린더 등록 실패: ${res.status} ${await res.text()}`);
  const event = await res.json();
  return event.id;
}

export async function deleteEvent(eventId) {
  if (!gcalEnabled() || !eventId) return;
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`캘린더 삭제 실패: ${res.status} ${await res.text()}`);
  }
}

export async function eventExists(eventId) {
  if (!gcalEnabled() || !eventId) return true;
  const token = await getAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404 || res.status === 410) return false;
  if (!res.ok) throw new Error(`캘린더 일정 조회 실패: ${res.status} ${await res.text()}`);
  const event = await res.json();
  return event.status !== 'cancelled';
}

export function logCalendarState() {
  if (gcalEnabled()) log('info', '📆 구글 캘린더 연동 활성화됨');
  else log('info', '📆 구글 캘린더 미설정 — 예약은 봇 내부에만 기록됩니다');
}
