import { createCanvas } from 'canvas';
import { todayKst } from './dateKst.js';

export const ROOMS = [
  { name: '2층', color: '#5865f2', text: '#ffffff' },
  { name: '3층', color: '#3ba55d', text: '#ffffff' },
  { name: '4층', color: '#e8873a', text: '#ffffff' },
];

const CELL_W = 150;
const CELL_H = 118;
const MARGIN = 16;
const HEADER_H = 64;
const WEEKDAY_H = 34;
const FOOTER_H = 14;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
  ctx.fillText(`${year}년 ${month}월 회의실 예약 현황`, MARGIN, HEADER_H / 2 + 2);

  let legendX = width - MARGIN;
  for (let i = ROOMS.length - 1; i >= 0; i--) {
    const room = ROOMS[i];
    ctx.font = '16px NanumGothic';
    const labelW = ctx.measureText(room.name).width;
    legendX -= labelW;
    ctx.fillStyle = '#444444';
    ctx.fillText(room.name, legendX, HEADER_H / 2 + 2);
    legendX -= 22;
    ctx.fillStyle = room.color;
    roundRect(ctx, legendX, HEADER_H / 2 - 7, 16, 16, 4);
    ctx.fill();
    legendX -= 18;
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
      const participants = Array.isArray(entry.participants) && entry.participants.length
        ? entry.participants
        : [{ studentId: '', name: entry.userName }];
      const names = participants.map((participant) => `${participant.studentId} ${participant.name}`.trim()).join(', ');
      let label = pending ? `${entry.room} 대기 ${participants.length}명` : `${entry.room} ${participants.length}명 ${names}`;
      if (ctx.measureText(label).width > CELL_W - 24) {
        const chars = [...label];
        while (chars.length > 3 && ctx.measureText(`${chars.join('')}…`).width > CELL_W - 24) {
          chars.pop();
        }
        label = `${chars.join('')}…`;
      }
      ctx.fillText(label, x + 12, pillY + 12);
      pillY += 27;
    }
  }

  return canvas.toBuffer('image/png');
}
