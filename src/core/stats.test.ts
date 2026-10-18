import { describe, it, expect } from 'vitest';
import { choiceRates, computeItemStats, pathDistribution, tagComparison } from './stats';
import { makeItem, makeSession, resp } from './testFixtures';

// 교정된 문항-총점 상관(design §3.6, Req 13.3).
// 모든 문항은 simple_mc 기본 (정답 'a'): resp(id,'a')=1점, resp(id,'b')=0점.
describe('computeItemStats discrimination (교정된 문항-총점 상관)', () => {
  const A = makeItem({ id: 'CR901Q01' });
  const B = makeItem({ id: 'CR901Q02' });
  const C = makeItem({ id: 'CR901Q03' });

  // S1: A=1 B=1 C=1 / S2: A=1 B=0 C=0 / S3: A=0 B=1 C=1
  const S1 = makeSession({ id: 's1', responses: [resp('CR901Q01', 'a'), resp('CR901Q02', 'a'), resp('CR901Q03', 'a')] });
  const S2 = makeSession({ id: 's2', responses: [resp('CR901Q01', 'a'), resp('CR901Q02', 'b'), resp('CR901Q03', 'b')] });
  const S3 = makeSession({ id: 's3', responses: [resp('CR901Q01', 'b'), resp('CR901Q02', 'a'), resp('CR901Q03', 'a')] });

  it('(a) 교정 상관을 계산한다 (문항 자신 점수를 제외한 나머지 총점 기준)', () => {
    const stats = computeItemStats([A, B, C], [S1, S2, S3]);
    const a = stats.find((s) => s.itemId === 'CR901Q01')!;
    // x=[1,1,0], 나머지 총점 y=[(3-1)/2, (1-1)/2, (2-0)/2]=[1,0,1] → Pearson = -0.5
    // (옛 버그: 문항 포함 전체 득점비율 [1, 1/3, 2/3] → 상관 ≈ 0)
    expect(a.discrimination).toBeCloseTo(-0.5, 10);
  });

  it('(b) 응시자가 3명 미만이면 null', () => {
    const stats = computeItemStats([A, B, C], [S1, S2]);
    const a = stats.find((s) => s.itemId === 'CR901Q01')!;
    expect(a.discrimination).toBeNull();
  });

  it('(c) 채점 응답이 하나뿐인 세션은 변별도 입력에서 제외된다', () => {
    // S4는 문항 A만 응답 → restCount=0 이므로 변별도 쌍에서 제외.
    const S4 = makeSession({ id: 's4', responses: [resp('CR901Q01', 'a')] });
    const stats = computeItemStats([A, B, C], [S1, S2, S3, S4]);
    const a = stats.find((s) => s.itemId === 'CR901Q01')!;
    // 변별도는 S4를 제외하므로 여전히 -0.5.
    expect(a.discrimination).toBeCloseTo(-0.5, 10);
    // 하지만 S4도 응시자이므로 n/p 집계에는 포함된다 (변별도 표본 크기와 n은 다를 수 있음).
    expect(a.n).toBe(4);
  });

  it('(d) p와 n은 변별도 변경의 영향을 받지 않는다', () => {
    const stats = computeItemStats([A, B, C], [S1, S2, S3]);
    const a = stats.find((s) => s.itemId === 'CR901Q01')!;
    expect(a.n).toBe(3);
    // A 정답: S1,S2 / 오답: S3 → p = 2/3
    expect(a.p).toBeCloseTo(2 / 3, 10);
  });
});

describe('tagComparison (Req 13.6)', () => {
  // A·C: 'scenario' 태그, 3명 응답(A p=2/3, C p=1). B: 같은 태그지만 아무도 보지 않음(n=0)
  const A = makeItem({ id: 'CR901Q01', tags: ['scenario'] });
  const B = makeItem({ id: 'CR901Q02', tags: ['scenario', 'literary'] });
  const C = makeItem({ id: 'CR901Q03', tags: ['scenario'] });
  const sessions = [
    makeSession({ id: 's1', responses: [resp('CR901Q01', 'a'), resp('CR901Q03', 'a')] }),
    makeSession({ id: 's2', responses: [resp('CR901Q01', 'a'), resp('CR901Q03', 'a')] }),
    makeSession({ id: 's3', responses: [resp('CR901Q01', 'b'), resp('CR901Q03', 'a')] }),
  ];

  it('n=0 문항이 섞여도 평균 p는 응답 있는 문항만으로 계산한다 (회귀)', () => {
    const items = [A, B, C];
    const tags = tagComparison(items, computeItemStats(items, sessions));
    // 옛 버그: (2/3 + 0 + 1) / 3 ≈ 0.556, 문항 수 3
    expect(tags.scenario!.avgP).toBeCloseTo((2 / 3 + 1) / 2, 10);
    expect(tags.scenario).toMatchObject({ count: 2, total: 3 });
  });

  it('응답 있는 문항이 하나도 없는 태그는 평균을 비운다(0%가 아님)', () => {
    const items = [A, B, C];
    expect(tagComparison(items, computeItemStats(items, sessions)).literary).toEqual({
      count: 0,
      total: 1,
      avgP: null,
      avgDisc: null,
    });
  });
});

describe('choiceRates (Req 13.3)', () => {
  it('선지 ID 대신 ①②③ 번호와 정답(★) 여부, 고르지 않은 선지는 0%, 삭제된 선지는 ?', () => {
    const item = makeItem({
      id: 'CR901Q01',
      choices: [
        { id: 'c_x1', text: '가' },
        { id: 'c_x2', text: '나' },
        { id: 'c_x3', text: '다' },
      ],
      answer: 'c_x2',
    });
    expect(choiceRates(item, { c_x1: 1, c_x2: 2, c_gone: 1 })).toEqual([
      { label: '①', isAnswer: false, count: 1, rate: 0.25 },
      { label: '②', isAnswer: true, count: 2, rate: 0.5 },
      { label: '③', isAnswer: false, count: 0, rate: 0 },
      { label: '?', isAnswer: false, count: 1, rate: 0.25 },
    ]);
  });
});

describe('pathDistribution (Req 13.5)', () => {
  const result = (grade: 'high' | 'mid' | 'low', provisional: boolean) => ({
    grade,
    provisional,
    firstJudgement: { grade, correct: 0, total: 0, rate: 0 },
    byProcessGroup: {
      locate: { correct: 0, total: 0 },
      understand: { correct: 0, total: 0 },
      evaluate_reflect: { correct: 0, total: 0 },
    },
    explanation: '',
  });
  it("잠정 등급은 'high(잠정)'처럼 확정 등급과 따로 센다", () => {
    const path = [{ stage: 'stage1', block: 'high', reason: '' }];
    const d = pathDistribution([
      makeSession({ id: 's1', path, result: result('high', false) }),
      makeSession({ id: 's2', path, result: result('high', true) }),
      makeSession({ id: 's3', path, result: result('high', false) }),
    ]);
    expect(d['stage1:high']).toEqual({ count: 3, grades: { high: 2, 'high(잠정)': 1 } });
  });
});
