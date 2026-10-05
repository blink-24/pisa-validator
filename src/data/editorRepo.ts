// 편집기용 단위·지문·문항 레코드 CRUD (Task 4).

import { db } from './db';
import { uid, makeItemId } from '../core/ids';
import type { Unit, Passage, Item, Stage, Block } from '../types';

// ---- 단위문항 ----

/** 다음 단위 번호 (901부터, 10단위 증가 아님 — 901,902... 순차). */
export async function nextUnitNo(subtestId: string): Promise<number> {
  const units = await db.units.where('subtestId').equals(subtestId).toArray();
  if (units.length === 0) return 901;
  return Math.max(...units.map((u) => u.unitNo)) + 1;
}

export async function addUnit(subtestId: string): Promise<Unit> {
  const unitNo = await nextUnitNo(subtestId);
  const unit: Unit = {
    id: uid('u'),
    subtestId,
    unitNo,
    title: `단위문항 ${unitNo}`,
    scenarioIntro: '',
    passageIds: [],
  };
  await db.units.put(unit);
  await touchSubtest(subtestId);
  return unit;
}

export async function updateUnit(unit: Unit): Promise<void> {
  await db.units.put(unit);
  await touchSubtest(unit.subtestId);
}

export async function deleteUnit(unit: Unit): Promise<void> {
  await db.transaction('rw', db.units, db.passages, db.items, db.subtests, async () => {
    await db.passages.bulkDelete(unit.passageIds);
    await db.items.where('unitId').equals(unit.id).delete();
    await db.units.delete(unit.id);
  });
  await touchSubtest(unit.subtestId);
}

// ---- 지문 ----

export async function addPassage(unit: Unit): Promise<Passage> {
  const passage: Passage = {
    id: uid('p'),
    unitId: unit.id,
    title: '',
    bodyHtml: '',
    imageIds: [],
    source: {},
    situation: 'educational',
    textFormat: 'continuous',
    textType: 'exposition',
    organization: 'static',
  };
  await db.transaction('rw', db.passages, db.units, async () => {
    await db.passages.put(passage);
    await db.units.put({ ...unit, passageIds: [...unit.passageIds, passage.id] });
  });
  await touchSubtest(unit.subtestId);
  return passage;
}

export async function updatePassage(passage: Passage, subtestId: string): Promise<void> {
  await db.passages.put(passage);
  await touchSubtest(subtestId);
}

export async function deletePassage(unit: Unit, passageId: string): Promise<void> {
  await db.transaction('rw', db.passages, db.units, async () => {
    await db.passages.delete(passageId);
    await db.units.put({ ...unit, passageIds: unit.passageIds.filter((id) => id !== passageId) });
  });
  await touchSubtest(unit.subtestId);
}

// ---- 문항 ----

/** 단위 내 다음 문항 번호 (1부터). */
async function nextItemNo(unitId: string): Promise<number> {
  const items = await db.items.where('unitId').equals(unitId).toArray();
  const nums = items
    .map((i) => Number(i.id.slice(-2)))
    .filter((n) => Number.isFinite(n));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

export async function addItem(
  subtestId: string,
  unit: Unit,
  stage: Stage = 'core',
  block: Block = 'none',
): Promise<Item> {
  const itemNo = await nextItemNo(unit.id);
  const unitItems = await db.items.where('unitId').equals(unit.id).toArray();
  const order = unitItems.length;
  const item: Item = {
    id: makeItemId(unit.unitNo, itemNo),
    subtestId,
    unitId: unit.id,
    order,
    stage,
    block: stage === 'core' ? 'none' : block,
    stem: '',
    cognitiveProcess: 'literal',
    responseFormat: 'simple_mc',
    sourceRequirement: 'single',
    difficulty: 'mid',
    choices: [
      { id: uid('c'), text: '' },
      { id: uid('c'), text: '' },
    ],
    answer: '',
    tags: [],
  };
  await db.items.put(item);
  await touchSubtest(subtestId);
  return item;
}

export async function updateItem(item: Item): Promise<void> {
  await db.items.put(item);
  await touchSubtest(item.subtestId);
}

export async function deleteItem(item: Item): Promise<void> {
  await db.items.delete(item.id);
  await touchSubtest(item.subtestId);
}

/** 문항 ID 중복 검사 (자기 자신 제외). */
export async function itemIdExists(id: string, exceptId?: string): Promise<boolean> {
  const found = await db.items.get(id);
  return found != null && found.id !== exceptId;
}

/**
 * 단위 내 문항 순서를 재배치하고 order를 다시 매긴다 (Req 4.6).
 * orderedIds: 새 순서의 item id 배열.
 */
export async function reorderItems(_unitId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.items, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]!;
      const it = await db.items.get(id);
      if (it) await db.items.put({ ...it, order: i });
    }
  });
}

async function touchSubtest(subtestId: string): Promise<void> {
  const st = await db.subtests.get(subtestId);
  if (st) await db.subtests.put({ ...st, updatedAt: new Date().toISOString() });
}
