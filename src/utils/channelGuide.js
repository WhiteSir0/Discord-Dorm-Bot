import { AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import { fileURLToPath } from 'node:url';

const imagePath = fileURLToPath(new URL('../../assets/teto-chibi.png', import.meta.url));

export const guides = {
  회의실: {
    title: '회의실 현황',
    description: '회의실 이용 전에 아래 내용을 확인하세요.',
    fields: [
      { name: '이용 시간', value: '오전 10시 ~ 오후 11시 50분' },
      { name: '이용 규칙', value: '혼성 팀은 4층 회의실만 이용할 수 있어요.\n다른 학생에게 피해가 가지 않도록 큰소리를 자제해주세요.' },
      { name: '주의', value: '승인 전에는 회의실을 사용할 수 없어요.\n사전 연락 없이 전원 노쇼 시 팀 전원에게 벌점이 부여됩니다.' },
    ],
  },
  회의실신청: {
    title: '회의실 신청',
    description: '회의실을 사용하려면 이 채널에서 신청하세요.',
    fields: [
      { name: '신청', value: '`/회의실신청`\n회의실, 날짜, 목적을 적고 함께 쓸 사람을 선택하세요.' },
      { name: '취소', value: '승인 전에는 신청 글의 `신청 취소` 버튼을 누르세요.' },
      { name: '처음이라면', value: '먼저 `/학번등록`으로 학번, 이름, 호실을 등록하세요.' },
    ],
  },
  연장신청: {
    title: '연장 신청',
    description: '연장 신청이 시작되면 원하는 요일 버튼을 누르세요.',
    fields: [
      { name: '신청 방법', value: '월~목 중 최대 2일을 선택할 수 있어요.' },
      { name: '취소 방법', value: '선택한 요일을 한 번 더 누르면 취소돼요.' },
    ],
  },
  잔류신청: {
    title: '잔류 신청',
    description: '잔류 신청이 시작되면 신청 버튼을 누르세요.',
    fields: [
      { name: '신청 방법', value: '`신청 / 취소` 버튼을 누르면 명단에 등록돼요.' },
      { name: '취소 방법', value: '같은 버튼을 한 번 더 누르면 취소돼요.' },
      { name: '처음이라면', value: '먼저 `/학번등록`으로 학번, 이름, 호실을 등록하세요.' },
    ],
  },
  학습영상신청: {
    title: '학습 영상 신청',
    description: '영상 시청이나 학습 활동을 이 채널에서 신청하세요.',
    fields: [
      { name: '신청', value: '`/학습영상신청`\n링크 또는 설명, 목적, 시간을 적으면 돼요.' },
      { name: '처리 결과', value: '신청 뒤 만들어지는 비공개 스레드에서 확인할 수 있어요.' },
      { name: '처음이라면', value: '먼저 `/학번등록`으로 학번, 이름, 호실을 등록하세요.' },
    ],
  },
};

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function getGuideFieldLines(ctx, field, maxWidth = 690) {
  return wrapText(ctx, field.value.replaceAll('`', ''), maxWidth).slice(0, 2);
}

export async function renderChannelGuide(type) {
  const guide = guides[type];
  if (!guide) return null;

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff8fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#f3d8df';
  ctx.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#211d26';
  ctx.fillRect(0, 0, 1200, 86);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px sans-serif';
  ctx.fillText('기숙사 봇', 64, 55);
  ctx.fillStyle = '#e05278';
  ctx.fillRect(64, 126, 72, 7);
  ctx.fillStyle = '#211d26';
  ctx.font = '700 56px sans-serif';
  ctx.fillText(guide.title, 64, 202);
  ctx.fillStyle = '#6e6570';
  ctx.font = '26px sans-serif';
  ctx.fillText(guide.description, 64, 248);

  let y = 318;
  for (const field of guide.fields.slice(0, 3)) {
    ctx.fillStyle = '#d94f75';
    ctx.font = '700 25px sans-serif';
    ctx.fillText(field.name, 64, y);
    ctx.fillStyle = '#302b33';
    ctx.font = '23px sans-serif';
    for (const line of getGuideFieldLines(ctx, field)) {
      y += 34;
      ctx.fillText(line, 64, y);
    }
    y += 42;
  }

  const teto = await loadImage(imagePath);
  const size = 350;
  ctx.drawImage(teto, 805, 205, size, size);
  ctx.fillStyle = '#211d26';
  ctx.font = '700 22px sans-serif';
  ctx.fillText('모르면 /도움말', 928, 585);
  return canvas.toBuffer('image/png');
}

export async function sendChannelGuide(channel, type) {
  const guide = guides[type];
  if (!guide || !channel?.isTextBased()) return null;

  const guideImage = await renderChannelGuide(type);
  if (!guideImage) return null;
  return channel.send({
    files: [new AttachmentBuilder(guideImage, { name: `${type}-guide.png` })],
    allowedMentions: { parse: [] },
  });
}
