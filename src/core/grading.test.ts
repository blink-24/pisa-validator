import { describe, it, expect } from 'vitest';
import { computeGrade, hasUngradedOpen, byProcessGroup } from './grading';
import { makeItem, makeSubtest, resp } from './testFixtures';

describe('hasUngradedOpen', () => {
  it('미채점 구성형이 있으면 true', () => {
    const items = [makeItem({ id: 'CR901Q01', responseFormat: 'open_human' })];
    expect(hasUngradedOpen(items, [resp('CR901Q01', '답')])).toBe(true);
  });
  it('모두 채점됐으면 false', () => {
    const items = [makeItem({ id: 'CR901Q01', responseFormat: 'open_human' })];
    expect(hasUngradedOpen(items, [resp('CR901Q01', '답', { humanCode: 2 })])).toBe(false);
  });
  it('응답 기록 없이 건너뛴 구성형은 잠정 사유가 아니다 (채점 대기열에 나타나지 않음)', () => {
    const items = [makeItem({ id: 'CR901Q01', responseFormat: 'open_human' })];
    expect(hasUngradedOpen(items, [])).toBe(false);
  });
});

describe('computeGrade — 건너뛴 문항', () => {
  it('건너뛴 문항은 0점으로 분모에 포함된다', () => {
    const subtest = makeSubtest({ structure: 'single' });
    const items = [
      makeItem({ id: 'CR901Q01', answer: 'a' }),
      makeItem({ id: 'CR901Q02', answer: 'a' }),
      makeItem({ id: 'CR901Q03', answer: 'a' }),
    ];
    // 1문항만 맞히고 2문항은 건너뜀 → 1/3 = 33% → 하 (건너뛴 문항을 빼면 100% → 상으로 잘못 판정됨)
    const { grade, first } = computeGrade({ subtest, items, responses: [resp('CR901Q01', 'a')] });
    expect(grade).toBe('low');
    expect(first.total).toBe(3);
  });
});

describe('computeGrade single', () => {
  it('전체 득점비율로 등급', () => {
    const subtest = makeSubtest({ structure: 'single' });
    const items = [
      makeItem({ id: 'CR901Q01', stage: 'core', answer: 'a' }),
      makeItem({ id: 'CR901Q02', stage: 'core', answer: 'a' }),
      makeItem({ id: 'CR901Q03', stage: 'core', answer: 'a' }),
    ];
    const responses = [resp('CR901Q01', 'a'), resp('CR901Q02', 'a'), resp('CR901Q03', 'b')]; // 2/3 ≈ 0.67
    const { grade } = computeGrade({ subtest, items, responses });
    expect(grade).toBe('mid'); // 0.67 >= 0.4, < 0.7
  });
});

describe('computeGrade msat3', () => {
  it('최종 상 묶음 + stage2 정답률 >= highBlockCut 이면 상', () => {
    const subtest = makeSubtest(); // highBlockCut 0.5
    const items = [
      makeItem({ id: 'CR901Q01', stage: 'core', answer: 'a' }),
      makeItem({ id: 'CR902Q01', stage: 'stage2', block: 'high', difficulty: 'high', answer: 'a' }),
      makeItem({ id: 'CR902Q02', stage: 'stage2', block: 'high', difficulty: 'high', answer: 'a' }),
    ];
    const responses = [resp('CR901Q01', 'a'), resp('CR902Q01', 'a'), resp('CR902Q02', 'b')]; // stage2 0.5
    const { grade } = computeGrade({ subtest, items, responses }, 'high');
    expect(grade).toBe('high');
  });

  it('최종 하 묶음 + stage2 정답률 < lowBlockCut 이면 하', () => {
    const subtest = makeSubtest(); // lowBlockCut 0.7
    const items = [
      makeItem({ id: 'CR901Q01', stage: 'core', answer: 'a' }),
      makeItem({ id: 'CR902Q01', stage: 'stage2', block: 'low', difficulty: 'low', answer: 'a' }),
      makeItem({ id: 'CR902Q02', stage: 'stage2', block: 'low', difficulty: 'low', answer: 'a' }),
    ];
    const responses = [resp('CR901Q01', 'b'), resp('CR902Q01', 'a'), resp('CR902Q02', 'b')]; // stage2 0.5 < 0.7
    const { grade } = computeGrade({ subtest, items, responses }, 'low');
    expect(grade).toBe('low');
  });
});

describe('byProcessGroup', () => {
  it('대분류별 집계', () => {
    const items = [
      makeItem({ id: 'CR901Q01', cognitiveProcess: 'scan_locate', answer: 'a' }), // locate
      makeItem({ id: 'CR901Q02', cognitiveProcess: 'literal', answer: 'a' }), // understand
      makeItem({ id: 'CR901Q03', cognitiveProcess: 'reflect_content_form', answer: 'a' }), // evaluate_reflect
    ];
    const responses = [resp('CR901Q01', 'a'), resp('CR901Q02', 'b'), resp('CR901Q03', 'a')];
    const g = byProcessGroup(items, responses);
    expect(g.locate).toEqual({ correct: 1, total: 1 });
    expect(g.understand).toEqual({ correct: 0, total: 1 });
    expect(g.evaluate_reflect).toEqual({ correct: 1, total: 1 });
  });
});
