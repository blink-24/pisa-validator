import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { db, loadBundle } from './db';
import { exportSubtest, importSubtest, validateSubtestExport } from './transfer';
import { cloneSubtest } from './subtests';
import { deletePassage } from './editorRepo';
import { applyPublished, buildPublished, validatePublished } from './published';
import { makeItem, makeSubtest } from '../core/testFixtures';
import { runConformance, hasBlockingError } from '../core/conformance';
import type { Passage } from '../types';

function passage(id: string): Passage {
  return {
    id,
    unitId: 'u1',
    title: id,
    bodyHtml: '',
    imageIds: [],
    source: { author: '자작' },
    situation: 'public',
    textFormat: 'continuous',
    textType: 'exposition',
    organization: 'static',
  };
}

async function seed() {
  await db.subtests.put(makeSubtest({ id: 'st1' }));
  await db.units.put({
    id: 'u1',
    subtestId: 'st1',
    unitNo: 901,
    title: '',
    scenarioIntro: '',
    passageIds: ['p1', 'p2'],
  });
  await db.passages.bulkPut([passage('p1'), passage('p2')]);
  await db.items.bulkPut([
    makeItem({ id: 'CR901Q01', unitId: 'u1', passageIds: ['p2'] }),
    makeItem({ id: 'CR901Q02', unitId: 'u1', order: 2 }),
  ]);
}

/** 같은 소검사 안에서 문항의 다루는 지문이 모두 자기 단위의 지문을 가리키는지 */
async function refsValid(subtestId: string) {
  const b = (await loadBundle(subtestId))!;
  return !hasBlockingError(runConformance({ ...b }).filter((r) => r.id === 'item_passage_ref'));
}

const clearAll = () => Promise.all(db.tables.map((t) => t.clear()));
beforeEach(async () => {
  await clearAll();
  await seed();
});

describe('passageIds 보존 (Req 4.11)', () => {
  it('내보내기 → JSON → 검증 → 다른 기기에서 덮어쓰기 가져오기', async () => {
    const json = JSON.parse(JSON.stringify(await exportSubtest('st1')));
    await clearAll();
    await importSubtest(validateSubtestExport(json), 'overwrite');
    expect((await db.items.get('CR901Q01'))?.passageIds).toEqual(['p2']);
    expect((await db.items.get('CR901Q02'))?.passageIds).toBeUndefined();
  });

  it('배포본: 만들기 → JSON → 검증 → 다른 기기에 반영', async () => {
    const json = JSON.parse(JSON.stringify(await buildPublished(['st1'], null)));
    await clearAll();
    await applyPublished(validatePublished(json));
    expect((await db.items.get('CR901Q01'))?.passageIds).toEqual(['p2']);
  });

  it('같은 기기에 새 사본으로 가져오기: 원본은 그대로, 사본은 자기 지문을 가리킨다', async () => {
    const copyId = await importSubtest(await exportSubtest('st1'), 'new_copy');
    const orig = (await loadBundle('st1'))!;
    const copy = (await loadBundle(copyId))!;
    expect(orig.passages).toHaveLength(2);
    expect(orig.items.map((i) => i.id)).toEqual(['CR901Q01', 'CR901Q02']);
    expect(copy.passages).toHaveLength(2);
    expect(copy.items.map((i) => i.id)).toEqual(['CR902Q01', 'CR902Q02']); // 겹치지 않게 다시 매김
    const copied = copy.items.find((i) => i.id === 'CR902Q01')!;
    expect(copied.passageIds).toEqual([copy.units[0]!.passageIds[1]]);
    expect(await refsValid(copyId)).toBe(true);
  });
});

describe('복제 회귀: 원본의 지문·문항이 사라지지 않는다', () => {
  it('cloneSubtest 후 원본·사본 모두 지문 2개·문항 2개', async () => {
    const copyId = await cloneSubtest('st1');
    for (const id of ['st1', copyId]) {
      const b = (await loadBundle(id))!;
      expect(b.passages).toHaveLength(2);
      expect(b.items).toHaveLength(2);
      expect(await refsValid(id)).toBe(true);
    }
  });
});

describe('지문 삭제', () => {
  it('문항의 다루는 지문에서도 빠지고, 남는 게 없으면 지정이 해제된다', async () => {
    const unit = (await db.units.get('u1'))!;
    await deletePassage(unit, 'p2');
    expect((await db.items.get('CR901Q01'))?.passageIds).toBeUndefined();
    expect(await refsValid('st1')).toBe(true);
  });
});
