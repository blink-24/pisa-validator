import { describe, it, expect } from 'vitest';
import { combinedLabel, itemPassageIds, strayPassageIds } from './itemPassages';
import { makeItem } from './testFixtures';
import type { Unit } from '../types';

const unit: Unit = {
  id: 'u1',
  subtestId: 'st1',
  unitNo: 901,
  title: '',
  scenarioIntro: '',
  passageIds: ['p1', 'p2', 'p3'],
};

describe('itemPassageIds (Req 4.11)', () => {
  it('지정이 없으면(이전 데이터) 단위 지문 전체', () => {
    expect(itemPassageIds(makeItem({ id: 'X' }), unit)).toEqual(['p1', 'p2', 'p3']);
    expect(itemPassageIds(makeItem({ id: 'X', passageIds: [] }), unit)).toEqual(['p1', 'p2', 'p3']);
  });
  it('지정하면 그 지문만, 단위의 지문 순서대로', () => {
    expect(itemPassageIds(makeItem({ id: 'X', passageIds: ['p3', 'p1'] }), unit)).toEqual([
      'p1',
      'p3',
    ]);
  });
  it('단위에 없는 ID는 계산에서 빠지고 strayPassageIds로 드러난다', () => {
    const item = makeItem({ id: 'X', passageIds: ['p2', 'p9'] });
    expect(itemPassageIds(item, unit)).toEqual(['p2']);
    expect(strayPassageIds(item, unit)).toEqual(['p9']);
  });
});

describe('combinedLabel', () => {
  const label = (c: string) => c.toUpperCase();
  it('없음 → -, 같음 → 그 값, 다름 → 복합 표기', () => {
    expect(combinedLabel([], label, '복합')).toBe('-');
    expect(combinedLabel(['a', 'a'], label, '복합')).toBe('A');
    expect(combinedLabel(['a', 'b'], label, '복합')).toBe('복합');
  });
});
