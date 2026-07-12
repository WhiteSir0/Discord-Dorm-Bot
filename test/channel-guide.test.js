import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas } from 'canvas';
import { getGuideFieldLines, guides } from '../src/utils/channelGuide.js';

test('회의실 안내는 승인된 규칙을 모두 표시하고 노쇼 문구를 나누지 않는다', () => {
  const guide = guides['회의실'];
  const approvedConcepts = [
    '오전 10시 ~ 오후 11시 50분',
    '혼성 팀은 4층 회의실만 이용',
    '큰소리를 자제',
    '승인 전에는 회의실을 사용할 수 없',
    '전원 노쇼 시 팀 전원에게 벌점',
  ];
  const configuredText = guide.fields.map(({ value }) => value).join('\n');

  for (const concept of approvedConcepts) {
    assert.ok(configuredText.includes(concept), `missing approved concept: ${concept}`);
  }

  const ctx = createCanvas(1200, 630).getContext('2d');
  ctx.font = '23px sans-serif';
  const renderedText = guide.fields
    .flatMap((field) => getGuideFieldLines(ctx, field))
    .join('\n');

  for (const concept of approvedConcepts) {
    assert.ok(renderedText.includes(concept), `concept omitted from rendered lines: ${concept}`);
  }
  assert.doesNotMatch(renderedText, /전원\n노쇼/);
});
