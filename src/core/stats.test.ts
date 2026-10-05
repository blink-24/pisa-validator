import { describe, it, expect } from 'vitest';
import { computeItemStats } from './stats';
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
