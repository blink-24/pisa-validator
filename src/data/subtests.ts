// 소검사 생성·복제·삭제 (Req 2.1, 2.4, 2.5).

import { db, loadBundle } from './db';
import { uid } from '../core/ids';
import { serializeAssets, restoreAssets } from './assets';
import { exportSubtest, downloadJson } from './transfer';
import { getActiveSubtestId, setActiveSubtestId } from './active';
import type { Subtest, Unit, Passage, Item } from '../types';

export function defaultSubtest(input: {
  title: string;
  description: string;
  target: string;
}): Subtest {
  const now = new Date().toISOString();
  return {
    id: uid('st'),
    title: input.title,
    description: input.description,
    target: input.target,
    structure: 'msat3',
    routing: { firstCut: { high: 0.7, mid: 0.4 }, assign: 'deterministic', midGoesTo: 'low' },
    gradeRule: { highBlockCut: 0.5, lowBlockCut: 0.7 },
    gradeDescriptors: {},
    allowWithinUnitNav: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createSubtest(input: {
  title: string;
  description: string;
  target: string;
}): Promise<Subtest> {
  const st = defaultSubtest(input);
  await db.subtests.put(st);
  return st;
}

export async function updateSubtest(st: Subtest): Promise<void> {
  await db.subtests.put({ ...st, updatedAt: new Date().toISOString() });
}

/** 결과(세션)를 제외한 사본 생성 (Req 2.4). */
export async function cloneSubtest(subtestId: string): Promise<string> {
  const bundle = await loadBundle(subtestId);
  if (!bundle) throw new Error('소검사를 찾을 수 없습니다.');

  const newStId = uid('st');
  const unitIdMap = new Map<string, string>();
  const assetIdMap = new Map<string, string>();

  for (const u of bundle.units) unitIdMap.set(u.id, uid('u'));
  const imageIds = bundle.passages.flatMap((p) => p.imageIds ?? []);
  for (const id of new Set(imageIds)) assetIdMap.set(id, uid('img'));

  const now = new Date().toISOString();
  const subtest: Subtest = {
    ...bundle.subtest,
    id: newStId,
    title: `${bundle.subtest.title} (사본)`,
    createdAt: now,
    updatedAt: now,
  };
  const units: Unit[] = bundle.units.map((u) => ({
    ...u,
    id: unitIdMap.get(u.id)!,
    subtestId: newStId,
  }));
  const passages: Passage[] = bundle.passages.map((p) => ({
    ...p,
    unitId: unitIdMap.get(p.unitId) ?? p.unitId,
    imageIds: (p.imageIds ?? []).map((id) => assetIdMap.get(id) ?? id),
  }));
  const items: Item[] = bundle.items.map((it) => ({
    ...it,
    subtestId: newStId,
    unitId: unitIdMap.get(it.unitId) ?? it.unitId,
  }));

  // 이미지 자산 복제 (직렬화는 트랜잭션 밖에서 먼저 수행)
  const serialized = await serializeAssets([...new Set(imageIds)]);

  await db.transaction('rw', db.subtests, db.units, db.passages, db.items, db.assets, async () => {
    await db.subtests.put(subtest);
    await db.units.bulkPut(units);
    await db.passages.bulkPut(passages);
    await db.items.bulkPut(items);
    await restoreAssets(serialized, assetIdMap);
  });
  return newStId;
}

export type DeleteResultChoice = 'delete_all' | 'export_then_delete' | 'cancel';

/**
 * 소검사 삭제 (Req 2.5). 결과가 있으면 choice로 분기.
 * export_then_delete이면 삭제 전에 결과 JSON을 내려받는다.
 */
export async function deleteSubtest(subtestId: string, choice: DeleteResultChoice): Promise<void> {
  if (choice === 'cancel') return;

  const sessions = await db.sessions.where('subtestId').equals(subtestId).toArray();
  if (choice === 'export_then_delete' && sessions.length > 0) {
    const exp = await exportSubtest(subtestId);
    downloadJson(
      { ...exp, sessions },
      `${subtestId}-결과포함-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  const bundle = await loadBundle(subtestId);
  await db.transaction('rw', db.subtests, db.units, db.passages, db.items, db.sessions, async () => {
    if (bundle) {
      const unitIds = bundle.units.map((u) => u.id);
      await db.passages.bulkDelete(bundle.passages.map((p) => p.id));
      await db.units.bulkDelete(unitIds);
      await db.items.where('subtestId').equals(subtestId).delete();
    }
    await db.sessions.where('subtestId').equals(subtestId).delete();
    await db.subtests.delete(subtestId);
  });

  // 활성 소검사였다면 해제
  if ((await getActiveSubtestId()) === subtestId) {
    await setActiveSubtestId(null);
  }
}
