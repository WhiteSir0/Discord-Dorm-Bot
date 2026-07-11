import { createCanvas } from 'canvas';
import { todayKst } from './dateKst.js';

export const ROOMS = [
  { name: '2층 회의실_1', color: '#5865f2', text: '#ffffff' },
  { name: '2층 회의실_2', color: '#5865f2', text: '#ffffff' },
  { name: '3층 회의실_1', color: '#3ba55d', text: '#ffffff' },
  { name: '3층 회의실_2', color: '#3ba55d', text: '#ffffff' },
  { name: '4층 회의실_1', color: '#e8873a', text: '#ffffff' },
  { name: '4층 회의실_2', color: '#e8873a', text: '#ffffff' },
];

const CELL_W = 150;
const CELL_H = 118;
const MARGIN = 16;
const HEADER_H = 98;
const WEEKDAY_H = 34;
const FOOTER_H = 14;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_CELL_W = 210;
const WEEK_CELL_H = 150;
const WEEK_LABEL_W = 138;
const WEEK_HEADER_H = 70;

function participantsOf(entry) {
  return Array.isArray(entry.participants) && entry.participants.length
    ? entry.participants
    : [{ studentId: '', name: entry.userName }];
}

function clippedText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 3 && ctx.measureText(`${chars.join('')}…`).width > maxWidth) {
    chars.pop();
  }
  return `${chars.join('')}…`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderMonthImage(reservations, year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rows = Math.ceil((offset + daysInMonth) / 7);

  const width = MARGIN * 2 + CELL_W * 7;
  const height = HEADER_H + WEEKDAY_H + rows * CELL_H + FOOTER_H;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const today = todayKst();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#222222';
  ctx.font = 'bold 30px NanumGothic';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${year}년 ${month}월 회의실 예약 현황`, MARGIN, 30);

  ctx.font = '16px NanumGothic';
  const legendItems = ROOMS.map((room) => ({
    room,
    width: 16 + 8 + ctx.measureText(room.name).width,
  }));
  const legendGap = 24;
  const legendWidth = legendItems.reduce((sum, item) => sum + item.width, 0)
    + legendGap * (legendItems.length - 1);
  let legendX = Math.max(MARGIN, (width - legendWidth) / 2);
  const legendY = 76;
  for (const item of legendItems) {
    ctx.fillStyle = item.room.color;
    roundRect(ctx, legendX, legendY - 8, 16, 16, 4);
    ctx.fill();
    legendX += 24;
    ctx.fillStyle = '#444444';
    ctx.fillText(item.room.name, legendX, legendY);
    legendX += item.width - 24 + legendGap;
  }

  ctx.font = 'bold 17px NanumGothic';
  for (let i = 0; i < 7; i++) {
    const x = MARGIN + i * CELL_W;
    ctx.fillStyle = i === 0 ? '#d83c3e' : i === 6 ? '#3b6ad8' : '#555555';
    ctx.textAlign = 'center';
    ctx.fillText(WEEKDAYS[i], x + CELL_W / 2, HEADER_H + WEEKDAY_H / 2);
  }
  ctx.textAlign = 'left';

  const byDate = new Map();
  for (const r of reservations) {
    if (r.status !== 'approved' && r.status !== 'pending') continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const idx = offset + day - 1;
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const x = MARGIN + col * CELL_W;
    const y = HEADER_H + WEEKDAY_H + row * CELL_H;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isPast = dateStr < today;

    ctx.strokeStyle = '#dddddd';
    ctx.strokeRect(x + 0.5, y + 0.5, CELL_W, CELL_H);
    if (isPast) {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
    }

    if (dateStr === today) {
      ctx.fillStyle = '#5865f2';
      ctx.beginPath();
      ctx.arc(x + 18, y + 17, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = isPast ? '#aaaaaa' : col === 0 ? '#d83c3e' : col === 6 ? '#3b6ad8' : '#333333';
    }
    ctx.font = 'bold 16px NanumGothic';
    ctx.textAlign = 'center';
    ctx.fillText(String(day), x + 18, y + 18);
    ctx.textAlign = 'left';

    const entries = (byDate.get(dateStr) ?? []).sort(
      (a, b) => ROOMS.findIndex((r) => r.name === a.room) - ROOMS.findIndex((r) => r.name === b.room),
    );
    let pillY = y + 34;
    for (const entry of entries.slice(0, 3)) {
      const room = ROOMS.find((r) => r.name === entry.room);
      const pending = entry.status === 'pending';
      ctx.fillStyle = pending ? '#b5b5b5' : room?.color ?? '#888888';
      roundRect(ctx, x + 6, pillY, CELL_W - 12, 23, 6);
      ctx.fill();
      ctx.fillStyle = pending ? '#ffffff' : room?.text ?? '#ffffff';
      ctx.font = '14px NanumGothic';
      const participants = participantsOf(entry);
      const names = participants.map((participant) => `${participant.studentId} ${participant.name}`.trim()).join(', ');
      let label = pending ? `${entry.room} 대기 ${participants.length}명` : `${entry.room} ${participants.length}명 ${names}`;
      label = clippedText(ctx, label, CELL_W - 24);
      ctx.fillText(label, x + 12, pillY + 12);
      pillY += 27;
    }
  }

  return canvas.toBuffer('image/png');
}

export function renderWeekImage(reservations, weekStart) {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const width = MARGIN * 2 + WEEK_LABEL_W + WEEK_CELL_W * 7;
  const height = WEEK_HEADER_H + WEEKDAY_H + WEEK_CELL_H * ROOMS.length + FOOTER_H;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const today = todayKst();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#222222';
  ctx.font = 'bold 30px NanumGothic';
  ctx.textBaseline = 'middle';
  ctx.fillText(`주간 회의실 현황 ${dates[0].slice(5).replace('-', '.')} ~ ${dates[6].slice(5).replace('-', '.')}`, MARGIN, WEEK_HEADER_H / 2 + 2);

  const byRoomAndDate = new Map();
  for (const reservation of reservations) {
    if (reservation.status !== 'approved' && reservation.status !== 'pending') continue;
    byRoomAndDate.set(`${reservation.room}:${reservation.date}`, reservation);
  }

  ctx.font = 'bold 17px NanumGothic';
  ctx.textAlign = 'center';
  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    const x = MARGIN + WEEK_LABEL_W + index * WEEK_CELL_W;
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    ctx.fillStyle = day === 0 ? '#d83c3e' : day === 6 ? '#3b6ad8' : '#555555';
    ctx.fillText(`${WEEKDAYS[day]} ${date.slice(5).replace('-', '/')}`, x + WEEK_CELL_W / 2, WEEK_HEADER_H + WEEKDAY_H / 2);
  }
  ctx.textAlign = 'left';

  for (let roomIndex = 0; roomIndex < ROOMS.length; roomIndex++) {
    const room = ROOMS[roomIndex];
    const y = WEEK_HEADER_H + WEEKDAY_H + roomIndex * WEEK_CELL_H;
    ctx.fillStyle = room.color;
    roundRect(ctx, MARGIN, y + 10, WEEK_LABEL_W - 12, 34, 7);
    ctx.fill();
    ctx.fillStyle = room.text;
    ctx.font = 'bold 16px NanumGothic';
    ctx.textAlign = 'center';
    ctx.fillText(room.name, MARGIN + (WEEK_LABEL_W - 12) / 2, y + 27);
    ctx.textAlign = 'left';

    for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
      const date = dates[dayIndex];
      const x = MARGIN + WEEK_LABEL_W + dayIndex * WEEK_CELL_W;
      const entry = byRoomAndDate.get(`${room.name}:${date}`);
      const isPast = date < today;
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      const closed = dow === 0 || dow === 5 || dow === 6;
      ctx.fillStyle = closed ? '#ececec' : isPast ? '#f5f5f5' : '#ffffff';
      ctx.fillRect(x, y, WEEK_CELL_W, WEEK_CELL_H);
      ctx.strokeStyle = '#dddddd';
      ctx.strokeRect(x + 0.5, y + 0.5, WEEK_CELL_W, WEEK_CELL_H);

      if (closed) {
        ctx.fillStyle = '#999999';
        ctx.font = 'bold 14px NanumGothic';
        ctx.fillText('운영 X', x + 12, y + 28);
        continue;
      }

      if (!entry) {
        ctx.fillStyle = isPast ? '#aaaaaa' : '#777777';
        ctx.font = '14px NanumGothic';
        ctx.fillText(isPast ? '지난 날짜' : '사용 가능', x + 12, y + 28);
        continue;
      }

      const participants = participantsOf(entry);
      const names = participants.map((participant) => `${participant.studentId} ${participant.name}`.trim()).join(', ');
      const pending = entry.status === 'pending';
      ctx.fillStyle = pending ? '#b5b5b5' : room.color;
      roundRect(ctx, x + 8, y + 10, WEEK_CELL_W - 16, 32, 7);
      ctx.fill();
      ctx.fillStyle = pending ? '#ffffff' : room.text;
      ctx.font = 'bold 15px NanumGothic';
      ctx.fillText(pending ? `승인 대기 · ${participants.length}명` : `예약 완료 · ${participants.length}명`, x + 16, y + 26);
      ctx.fillStyle = '#333333';
      ctx.font = '13px NanumGothic';
      ctx.fillText(clippedText(ctx, names, WEEK_CELL_W - 24), x + 12, y + 66);
      ctx.font = '12px NanumGothic';
      ctx.fillStyle = '#666666';
      ctx.fillText(clippedText(ctx, entry.purpose ?? '', WEEK_CELL_W - 24), x + 12, y + 92);
    }
  }

  return canvas.toBuffer('image/png');
}
