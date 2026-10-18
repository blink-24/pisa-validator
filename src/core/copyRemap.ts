// 소검사 사본(복제·'새 사본으로 가져오기')의 ID 재배정. 순수 함수.
//
// 지문·문항은 DB 전체에서 ID가 고유한 키다. 예전에는 사본이 원본과 같은 지문·문항 ID로 저장되어
// 원본의 지문·문항을 덮어써 원본에서 사라지게 했다. 사본은 반드시 새 ID를 받아야 한다.
// - 단위·지문: 내부 ID라 항상 새로 만든다. 단위의 passageIds와 문항의 passageIds(Req 4.11)도 함께 바꾼다.
// - 문항 ID(CR{단위}Q{번호}): 화면에 보이는 ID다. 이미 쓰이는 ID와 겹치지 않으면 그대로 두고,
//   하나라도 겹치면 사본의 단위 번호를 이 기기에서 쓰지 않는 다음 번호로 다시 매긴다(예: 901→906).

import { uid, makeItemId, parseItemId } from './ids';
import type { Item, Passage, Unit } from '../types';

export interface CopyContext {
  /** 이 기기 DB에 이미 있는 문항 ID */
  usedItemIds: Set<string>;
  /** 이 기기 DB에 이미 있는 단위 번호 */
  usedUnitNos: number[];
  /** 이미지 자산 ID 재배정표 (없으면 그대로) */
  assetIdMap?: Map<string, string>;
}

export interface CopyResult {
  units: Unit[];
  passages: Passage[];
  items: Item[];
  /** 문항 ID를 다시 매겼는지 (안내 문구용) */
  renumbered: boolean;
}

export function remapForCopy(
  src: { units: Unit[]; passages: Passage[]; items: Item[] },
  newSubtestId: string,
  ctx: CopyContext,
): CopyResult {
  const unitIdMap = new Map(src.units.map((u) => [u.id, uid('u')]));
  const passageIdMap = new Map(src.passages.map((p) => [p.id, uid('p')]));
  const mapPassage = (id: string) => passageIdMap.get(id) ?? id;

  const renumbered = src.items.some((it) => ctx.usedItemIds.has(it.id));
  const unitNoMap = new Map<string, number>();
  if (renumbered) {
    let next = Math.max(900, ...ctx.usedUnitNos, ...src.units.map((u) => u.unitNo)) + 1;
    for (const u of [...src.units].sort((a, b) => a.unitNo - b.unitNo)) unitNoMap.set(u.id, next++);
  }

  const units: Unit[] = src.units.map((u) => ({
    ...u,
    id: unitIdMap.get(u.id)!,
    subtestId: newSubtestId,
    unitNo: unitNoMap.get(u.id) ?? u.unitNo,
    passageIds: u.passageIds.map(mapPassage),
  }));

  const passages: Passage[] = src.passages.map((p) => ({
    ...p,
    id: passageIdMap.get(p.id)!,
    unitId: unitIdMap.get(p.unitId) ?? p.unitId,
    imageIds: (p.imageIds ?? []).map((id) => ctx.assetIdMap?.get(id) ?? id),
  }));

  const taken = new Set(ctx.usedItemIds);
  const items: Item[] = src.items.map((it) => {
    let id = it.id;
    const unitNo = unitNoMap.get(it.unitId);
    if (unitNo != null) {
      let itemNo = parseItemId(it.id)?.itemNo ?? it.order;
      id = makeItemId(unitNo, itemNo);
      while (taken.has(id)) id = makeItemId(unitNo, ++itemNo);
    }
    taken.add(id);
    return {
      ...it,
      id,
      subtestId: newSubtestId,
      unitId: unitIdMap.get(it.unitId) ?? it.unitId,
      ...(it.passageIds ? { passageIds: it.passageIds.map(mapPassage) } : {}),
    };
  });

  return { units, passages, items, renumbered };
}
