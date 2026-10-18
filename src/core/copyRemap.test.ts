import { describe, it, expect } from 'vitest';
import { remapForCopy } from './copyRemap';
import { makeItem } from './testFixtures';
import type { Passage, Unit } from '../types';

const units: Unit[] = [
  {
    id: 'u1',
    subtestId: 'st1',
    unitNo: 901,
    title: '',
    scenarioIntro: '',
    passageIds: ['p1', 'p2'],
  },
];
const passages = (['p1', 'p2'] as const).map((id): Passage => ({
  id,
  unitId: 'u1',
  title: id,
  bodyHtml: '',
  imageIds: [],
  source: {},
  situation: 'public',
  textFormat: 'continuous',
  textType: 'exposition',
  organization: 'static',
}));
const items = [
  makeItem({ id: 'CR901Q01', unitId: 'u1', passageIds: ['p2'] }),
  makeItem({ id: 'CR901Q02', unitId: 'u1', order: 2 }),
];
const src = { units, passages, items };

describe('remapForCopy', () => {
  it('지문은 항상 새 ID — 단위와 문항의 지문 참조도 같은 새 ID로 바뀐다', () => {
    const r = remapForCopy(src, 'st2', { usedItemIds: new Set(), usedUnitNos: [] });
    const [np1, np2] = r.units[0]!.passageIds;
    expect(np1).not.toBe('p1');
    expect(r.passages.map((p) => p.id)).toEqual([np1, np2]);
    expect(r.passages.every((p) => p.unitId === r.units[0]!.id)).toBe(true);
    expect(r.items[0]!.passageIds).toEqual([np2]); // 다루는 지문 유지(Req 4.11)
    expect(r.items[1]!.passageIds).toBeUndefined(); // 미지정은 미지정 그대로
  });

  it('문항 ID가 이 기기에서 안 겹치면 번호를 그대로 둔다(새 기기로 가져오기)', () => {
    const r = remapForCopy(src, 'st2', { usedItemIds: new Set(), usedUnitNos: [] });
    expect(r.renumbered).toBe(false);
    expect(r.items.map((i) => i.id)).toEqual(['CR901Q01', 'CR901Q02']);
    expect(r.units[0]!.unitNo).toBe(901);
  });

  it('겹치면 사본의 단위 번호를 안 쓰는 다음 번호로 다시 매긴다', () => {
    const r = remapForCopy(src, 'st2', {
      usedItemIds: new Set(['CR901Q01', 'CR901Q02']),
      usedUnitNos: [901, 902, 903],
    });
    expect(r.renumbered).toBe(true);
    expect(r.units[0]!.unitNo).toBe(904);
    expect(r.items.map((i) => i.id)).toEqual(['CR904Q01', 'CR904Q02']);
  });
});
