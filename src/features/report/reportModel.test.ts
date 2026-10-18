import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../../data/db';
import { buildReportModel, itemSituationLabel } from './reportModel';
import { buildReportHtml } from './htmlReport';
import { makeItem, makeSubtest } from '../../core/testFixtures';
import type { Passage, Unit } from '../../types';

function passage(id: string, unitId: string, situation: string): Passage {
  return {
    id,
    unitId,
    title: id,
    bodyHtml: '<p>자작 지문</p>',
    imageIds: [],
    source: { author: '자작' },
    situation,
    textFormat: 'continuous',
    textType: 'exposition',
    organization: 'static',
  };
}

function unit(id: string, unitNo: number, passageIds: string[], scenarioSituation?: string): Unit {
  return {
    id,
    subtestId: 'st1',
    unitNo,
    title: id,
    scenarioIntro: '',
    passageIds,
    ...(scenarioSituation ? { scenarioSituation } : {}),
  };
}

describe('itemSituationLabel (Req 3.8)', () => {
  it('지문이 없으면 -', () => {
    expect(itemSituationLabel([])).toBe('-');
  });
  it('지문 1개면 그 지문의 상황', () => {
    expect(itemSituationLabel([passage('p1', 'u1', 'public')])).toBe('공적');
  });
  it('지문 2개 이상이고 상황이 같으면 그 상황', () => {
    expect(
      itemSituationLabel([passage('p1', 'u1', 'personal'), passage('p2', 'u1', 'personal')]),
    ).toBe('개인적');
  });
  it('지문 2개 이상이고 상황이 다르면 복합', () => {
    expect(
      itemSituationLabel([passage('p1', 'u1', 'personal'), passage('p2', 'u1', 'public')]),
    ).toBe('복합');
  });
});

describe('보고서 Ⅲ 문항 정보표', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.subtests.put(makeSubtest({ structure: 'single' }));
    await db.units.bulkPut([
      unit('u1', 901, ['p1', 'p2'], 'occupational'), // 지문 상황 서로 다름
      unit('u2', 902, ['p3']), // 시나리오 상황 미지정(이전 데이터)
    ]);
    await db.passages.bulkPut([
      passage('p1', 'u1', 'personal'),
      passage('p2', 'u1', 'public'),
      passage('p3', 'u2', 'educational'),
    ]);
    await db.items.bulkPut([
      makeItem({ id: 'CR901Q01', unitId: 'u1', order: 1 }),
      makeItem({ id: 'CR902Q01', unitId: 'u2', order: 1 }),
      makeItem({ id: 'CR901Q02', unitId: 'u1', order: 2 }),
    ]);
  });

  it('시나리오 상황은 단위문항 값, 상황은 지문 상황(다르면 복합)으로 따로 표시한다', async () => {
    const m = await buildReportModel('st1');
    const row = (id: string) => m.itemTable.find((r) => r.id === id)!;
    expect(row('CR901Q01')).toMatchObject({ scenarioSituation: '직업적', situation: '복합' });
    expect(row('CR902Q01')).toMatchObject({ scenarioSituation: '-', situation: '교육적' });
  });

  it('문항 정보표는 단위문항 → 문항 순서로 정렬된다', async () => {
    const m = await buildReportModel('st1');
    expect(m.itemTable.map((r) => r.id)).toEqual(['CR901Q01', 'CR901Q02', 'CR902Q01']);
  });

  it('HTML 보고서에 시나리오 상황 열이 상황 열 앞에 있다', async () => {
    const html = buildReportHtml(await buildReportModel('st1'));
    expect(html).toMatch(/<th>시나리오 상황<\/th><th>상황<\/th>/);
    expect(html).toContain('<td>직업적</td><td>복합</td>');
  });

  it('시나리오 상황이 빠진 단위는 정합성 점검에서 경고한다', async () => {
    const m = await buildReportModel('st1');
    const c = m.conformance.find((r) => r.id === 'scenario_situation');
    expect(c).toMatchObject({ level: 'warn', itemIds: ['CR902Q01'] });
  });
});
