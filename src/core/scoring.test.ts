import { describe, it, expect } from 'vitest';
import { autoScore, humanCodeToScore, responseScore } from './scoring';
import { makeItem, resp } from './testFixtures';

describe('autoScore', () => {
  it('simple_mc: 정답 1, 오답 0', () => {
    const item = makeItem({ id: 'CR901Q01', answer: 'a' });
    expect(autoScore(item, 'a')).toBe(1);
    expect(autoScore(item, 'b')).toBe(0);
    expect(autoScore(item, null)).toBe(0);
  });

  it('complex_mc: fullCredit=all 이면 전 행 정답일 때만 1', () => {
    const item = makeItem({
      id: 'CR901Q02',
      responseFormat: 'complex_mc',
      matrix: {
        rows: [
          { id: 'r1', text: '진술1', answer: 'T' },
          { id: 'r2', text: '진술2', answer: 'F' },
        ],
        cols: ['T', 'F'],
        fullCredit: 'all',
      },
    });
    expect(autoScore(item, { r1: 'T', r2: 'F' })).toBe(1);
    expect(autoScore(item, { r1: 'T', r2: 'T' })).toBe(0);
  });

  it('complex_mc: fullCredit=n 이면 n행 이상 정답일 때 1', () => {
    const item = makeItem({
      id: 'CR901Q03',
      responseFormat: 'complex_mc',
      matrix: {
        rows: [
          { id: 'r1', text: '', answer: 'T' },
          { id: 'r2', text: '', answer: 'T' },
          { id: 'r3', text: '', answer: 'T' },
        ],
        cols: ['T', 'F'],
        fullCredit: 2,
      },
    });
    expect(autoScore(item, { r1: 'T', r2: 'T', r3: 'F' })).toBe(1);
    expect(autoScore(item, { r1: 'T', r2: 'F', r3: 'F' })).toBe(0);
  });

  it('short_auto: 정규화 후 허용 정답 일치', () => {
    const item = makeItem({
      id: 'CR901Q04',
      responseFormat: 'short_auto',
      acceptedAnswers: ['서울', '서울특별시'],
      normalize: { ignoreSpace: true, ignoreCase: true },
    });
    expect(autoScore(item, ' 서울 ')).toBe(1);
    expect(autoScore(item, '부산')).toBe(0);
  });

  it('open_human: 자동 채점 없음(undefined)', () => {
    const item = makeItem({ id: 'CR901Q05', responseFormat: 'open_human' });
    expect(autoScore(item, '아무 답')).toBeUndefined();
  });
});

describe('humanCodeToScore', () => {
  it('9=0, 0=0, 1=0.5, 2=1', () => {
    expect(humanCodeToScore(9)).toBe(0);
    expect(humanCodeToScore(0)).toBe(0);
    expect(humanCodeToScore(1)).toBe(0.5);
    expect(humanCodeToScore(2)).toBe(1);
  });
});

describe('responseScore', () => {
  it('미채점 구성형은 undefined', () => {
    const item = makeItem({ id: 'CR901Q06', responseFormat: 'open_human' });
    expect(responseScore(item, resp('CR901Q06', '답'))).toBeUndefined();
  });
  it('채점된 구성형은 코드 기반', () => {
    const item = makeItem({ id: 'CR901Q06', responseFormat: 'open_human' });
    expect(responseScore(item, resp('CR901Q06', '답', { humanCode: 2 }))).toBe(1);
  });
});
