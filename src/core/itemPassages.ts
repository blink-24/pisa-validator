// 문항이 다루는 지문 (Req 4.11). 순수 함수. 보고서·정합성 점검이 같은 규칙을 쓰도록 한곳에 둔다.

import type { Item, Passage, Unit } from '../types';

/** 문항에 '다루는 지문'이 따로 지정됐는지 (없거나 빈 배열이면 미지정 = 단위 지문 전체) */
export function hasExplicitPassages(item: Item): boolean {
  return (item.passageIds?.length ?? 0) > 0;
}

/**
 * 문항이 다루는 지문 ID. 지정값이 있으면 그중 단위에 실제로 있는 것만 단위의 지문 순서대로,
 * 없으면 단위문항의 지문 전체. (단위에 없는 ID는 정합성 점검이 오류로 따로 알린다.)
 */
export function itemPassageIds(item: Item, unit: Unit | undefined): string[] {
  if (!unit) return [];
  if (!hasExplicitPassages(item)) return [...unit.passageIds];
  const chosen = new Set(item.passageIds);
  return unit.passageIds.filter((id) => chosen.has(id));
}

/** itemPassageIds를 지문 레코드로 */
export function itemPassages(item: Item, unit: Unit | undefined, passages: Passage[]): Passage[] {
  const byId = new Map(passages.map((p) => [p.id, p]));
  return itemPassageIds(item, unit)
    .map((id) => byId.get(id))
    .filter((p): p is Passage => !!p);
}

/** 단위에 없는 지문 ID (오류 대상) */
export function strayPassageIds(item: Item, unit: Unit | undefined): string[] {
  if (!hasExplicitPassages(item)) return [];
  const inUnit = new Set(unit?.passageIds ?? []);
  return (item.passageIds ?? []).filter((id) => !inUnit.has(id));
}

/**
 * 여러 지문의 속성값을 하나로 요약: 지문 없음 → '-', 모두 같음 → 그 값의 표시명, 서로 다름 → mixedLabel.
 */
export function combinedLabel(
  codes: string[],
  labelOf: (code: string) => string,
  mixedLabel: string,
): string {
  if (codes.length === 0) return '-';
  if (new Set(codes).size > 1) return mixedLabel;
  return labelOf(codes[0]!);
}
