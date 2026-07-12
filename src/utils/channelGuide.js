import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { fileURLToPath } from 'node:url';

const imagePath = fileURLToPath(new URL('../../assets/teto-chibi.png', import.meta.url));

const guides = {
  회의실: {
    title: '회의실 현황',
    description: '월간·주간 예약 현황이 이 채널에 올라와요.',
    fields: [
      { name: '자세히 보기', value: '사진 아래 요일 버튼을 누르거나 `/회의실현황`을 사용하세요.' },
      { name: '날짜 입력', value: '`/회의실현황 날짜:07-15`\n날짜를 비우면 오늘 현황이 보여요.' },
    ],
  },
  회의실신청: {
    title: '회의실 신청',
    description: '회의실을 사용하려면 이 채널에서 신청하세요.',
    fields: [
      { name: '신청', value: '`/회의실신청`\n회의실, 날짜, 목적을 적고 함께 쓸 사람을 선택하세요.' },
      { name: '취소', value: '`/회의실취소`\n승인 전이나 승인 후 모두 같은 명령어로 취소할 수 있어요.' },
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

export async function sendChannelGuide(channel, type) {
  const guide = guides[type];
  if (!guide || !channel?.isTextBased()) return null;

  const image = new AttachmentBuilder(imagePath, { name: 'teto-guide.png' });
  const embed = new EmbedBuilder()
    .setColor(0xd95377)
    .setAuthor({ name: '기숙사 봇' })
    .setTitle(guide.title)
    .setURL('https://siru-archive.kr/teto-bot/')
    .setDescription(guide.description)
    .addFields(guide.fields)
    .setThumbnail('attachment://teto-guide.png')
    .setFooter({ text: '모르면 /도움말' });

  return channel.send({ embeds: [embed], files: [image], allowedMentions: { parse: [] } });
}
