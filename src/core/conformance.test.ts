import { describe, it, expect } from 'vitest';
import { runConformance } from './conformance';
import { makeItem, makeSubtest } from './testFixtures';
import type { Unit } from '../types';

const unit: Unit = {
  id: 'u1',
  subtestId: 'st1',
  unitNo: 901,
  title: '',
  scenarioIntro: '',
  passageIds: ['p1', 'p2'],
};
const check = (items: ReturnType<typeof makeItem>[], id: string) =>
  runConformance({ subtest: makeSubtest(), units: [unit], passages: [], items }).find(
    (r) => r.id === id,
  )!;

describe('정합성: 출처 요구와 다루는 지문 수 (Req 4.11, 경고)', () => {
  it("'단일'인데 2개 이상, '다중'인데 1개면 경고하고 문항 ID를 보인다", () => {
    const r = check(
      [
        makeItem({
          id: 'CR901Q01',
          unitId: 'u1',
          sourceRequirement: 'single',
          passageIds: ['p1', 'p2'],
        }),
        makeItem({
          id: 'CR901Q02',
          unitId: 'u1',
          sourceRequirement: 'multiple',
          passageIds: ['p1'],
        }),
        makeItem({ id: 'CR901Q03', unitId: 'u1', sourceRequirement: 'single', passageIds: ['p2'] }),
        makeItem({ id: 'CR901Q04', unitId: 'u1', sourceRequirement: 'multiple' }), // 미지정=2개
      ],
      'source_passage_count',
    );
    expect(r.level).toBe('warn');
    expect(r.itemIds).toEqual(['CR901Q01', 'CR901Q02']);
  });

  it('맞으면 통과', () => {
    const r = check(
      [makeItem({ id: 'CR901Q01', unitId: 'u1', sourceRequirement: 'single', passageIds: ['p1'] })],
      'source_passage_count',
    );
    expect(r.level).toBe('pass');
  });
});

describe('정합성: 다루는 지문이 소속 단위의 지문인지 (Req 4.11, 오류)', () => {
  it('단위에 없는 지문 ID가 있으면 오류', () => {
    const r = check(
      [makeItem({ id: 'CR901Q01', unitId: 'u1', passageIds: ['p1', 'p_other'] })],
      'item_passage_ref',
    );
    expect(r).toMatchObject({ level: 'error', itemIds: ['CR901Q01'] });
  });
  it('이전 데이터(지정 없음)는 통과', () => {
    expect(check([makeItem({ id: 'CR901Q01', unitId: 'u1' })], 'item_passage_ref').level).toBe(
      'pass',
    );
  });
});
