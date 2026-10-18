import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../../data/db';
import { buildReportModel, itemSituationLabel } from './reportModel';
import { buildReportHtml } from './htmlReport';
import { makeItem, makeSubtest } from '../../core/testFixtures';
import type { Passage, Unit } from '../../types';

function passage(
  id: string,
  unitId: string,
  situation: string,
  textFormat = 'continuous',
  textType = 'exposition',
): Passage {
  return {
    id,
    unitId,
    title: id,
    bodyHtml: '<p>자작 지문</p>',
    imageIds: [],
    source: { author: '자작' },
    situation,
    textFormat,
    textType,
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
      passage('p1', 'u1', 'personal'), // 블로그(개인적·연속·설명)
      passage('p2', 'u1', 'public', 'non_continuous', 'argumentation'), // 기사(공적·비연속·논증)
      passage('p3', 'u2', 'educational'),
    ]);
    await db.items.bulkPut([
      makeItem({ id: 'CR901Q01', unitId: 'u1', order: 1 }), // 이전 데이터: 다루는 지문 미지정
      makeItem({ id: 'CR902Q01', unitId: 'u2', order: 1 }),
      makeItem({ id: 'CR901Q02', unitId: 'u1', order: 2 }),
      makeItem({
        id: 'CR901Q03',
        unitId: 'u1',
        order: 3,
        sourceRequirement: 'single',
        passageIds: ['p2'],
      }),
      makeItem({
        id: 'CR901Q04',
        unitId: 'u1',
        order: 4,
        sourceRequirement: 'multiple',
        passageIds: ['p1', 'p2'],
      }),
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
    expect(m.itemTable.map((r) => r.id)).toEqual([
      'CR901Q01',
      'CR901Q02',
      'CR901Q03',
      'CR901Q04',
      'CR902Q01',
    ]);
  });

  it("단일 출처 문항은 고른 지문 기준('공적'), 다중 출처 문항은 '복합' (Req 4.11)", async () => {
    const m = await buildReportModel('st1');
    const row = (id: string) => m.itemTable.find((r) => r.id === id)!;
    expect(row('CR901Q03')).toMatchObject({
      situation: '공적',
      textFormat: '비연속',
      textType: '논증',
    });
    expect(row('CR901Q04')).toMatchObject({
      situation: '복합',
      textFormat: '복합',
      textType: '복합',
    });
  });

  it('다루는 지문이 없는 이전 데이터는 기존과 같은 결과(단위 지문 전체 기준)', async () => {
    const m = await buildReportModel('st1');
    const row = (id: string) => m.itemTable.find((r) => r.id === id)!;
    expect(row('CR901Q01')).toMatchObject({
      situation: '복합',
      textFormat: '복합',
      textType: '복합',
    });
    expect(row('CR902Q01')).toMatchObject({
      situation: '교육적',
      textFormat: '연속',
      textType: '설명',
    });
  });

  it('Ⅳ 평가틀 특성에도 같은 값을 쓰고, 확장 표기 복합을 쓰면 Ⅲ에 주석을 단다', async () => {
    const m = await buildReportModel('st1');
    const traits = m.itemDetails.find((d) => d.id === 'CR901Q03')!.characteristics;
    expect(traits).toEqual(
      expect.arrayContaining([
        { label: '상황', value: '공적' },
        { label: '텍스트 체재', value: '비연속' },
        { label: '텍스트 유형', value: '논증' },
      ]),
    );
    expect(m.itemTableNotes).toHaveLength(1);
    expect(buildReportHtml(m)).toContain('PISA 원 분류가 아닌 본 도구의 확장 표기');
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
