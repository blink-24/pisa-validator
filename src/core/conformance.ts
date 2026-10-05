// 평가틀 정합성 점검 (design §3.5, Req 7.1). 순수 함수.

import type { Item, Unit, Passage, Subtest } from '../types';
import { groupOfProcess } from '../data/taxonomy';

export type ConformanceLevel = 'pass' | 'warn' | 'error';

export interface ConformanceResult {
  id: string;
  label: string;
  level: ConformanceLevel;
  itemIds: string[];
  basis: string; // 근거 문서 쪽수 (고정 문자열)
}

export interface ConformanceInput {
  subtest: Subtest;
  units: Unit[];
  passages: Passage[];
  items: Item[];
}

const BASIS_FRAMEWORK = 'RRE 2019-11 pp.39-43';
const BASIS_TABLE = 'RRE 2019-11 pp.45-51 <표 Ⅲ-2>';
const BASIS_MSAT = 'RRE 2019-11 pp.31-33 (PISA 2018 MSAT)';
const BASIS_CODING = 'OECD PISA 2018 Coding Guide / RRE 2019-11';

function hasAllRequired(it: Item): boolean {
  return Boolean(it.cognitiveProcess && it.responseFormat && it.sourceRequirement && it.difficulty);
}

/** 묶음 수준에 맞는 난도가 하나라도 있는지. 상 묶음에 '하' 문항만 있으면 경고. */
function blockDifficultyMismatch(items: Item[]): string[] {
  const bad: string[] = [];
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    if (it.block === 'none') continue;
    const key = `${it.stage}:${it.block}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  }
  for (const [key, group] of groups) {
    const [, block] = key.split(':');
    if (block === 'high') {
      // 상 묶음인데 '상/중' 난도가 하나도 없으면(모두 '하') 경고
      const anyHighMid = group.some((i) => i.difficulty === 'high' || i.difficulty === 'mid');
      if (!anyHighMid) bad.push(...group.map((i) => i.id));
    } else if (block === 'low') {
      const anyLowMid = group.some((i) => i.difficulty === 'low' || i.difficulty === 'mid');
      if (!anyLowMid) bad.push(...group.map((i) => i.id));
    }
  }
  return bad;
}

/** 연결 규칙의 모든 경로(단계×묶음)에 문항이 있는지 확인. 비어있는 경로의 라벨 반환. */
function missingRoutePaths(subtest: Subtest, items: Item[]): string[] {
  const need: Array<{ stage: Item['stage']; block: Item['block'] }> = [{ stage: 'core', block: 'none' }];
  if (subtest.structure === 'msat3') {
    need.push(
      { stage: 'stage1', block: 'low' },
      { stage: 'stage1', block: 'high' },
      { stage: 'stage2', block: 'low' },
      { stage: 'stage2', block: 'high' },
    );
  }
  const present = new Set(items.map((i) => `${i.stage}:${i.block}`));
  const missing: string[] = [];
  for (const n of need) {
    if (!present.has(`${n.stage}:${n.block}`)) missing.push(`${n.stage}:${n.block}`);
  }
  return missing;
}

export function runConformance(input: ConformanceInput): ConformanceResult[] {
  const { subtest, units, passages, items } = input;
  const results: ConformanceResult[] = [];

  // 1) 모든 문항의 4개 필수 속성 입력 (오류)
  const missingAttr = items.filter((i) => !hasAllRequired(i)).map((i) => i.id);
  results.push({
    id: 'required_attrs',
    label: '모든 문항의 4개 필수 속성 입력',
    level: missingAttr.length ? 'error' : 'pass',
    itemIds: missingAttr,
    basis: BASIS_TABLE,
  });

  // 2) 인지 과정 3개 대분류가 소검사 전체에 모두 포함 (경고)
  const groupsPresent = new Set(
    items.map((i) => groupOfProcess(i.cognitiveProcess)).filter(Boolean) as string[],
  );
  const allGroups = ['locate', 'understand', 'evaluate_reflect'];
  const groupsOk = allGroups.every((g) => groupsPresent.has(g));
  results.push({
    id: 'process_coverage',
    label: '인지 과정 3개 대분류 모두 포함',
    level: items.length === 0 ? 'warn' : groupsOk ? 'pass' : 'warn',
    itemIds: [],
    basis: BASIS_FRAMEWORK,
  });

  // 3) 응답 형식이 2종 이상 혼합 (경고)
  const formats = new Set(items.map((i) => i.responseFormat));
  results.push({
    id: 'format_mix',
    label: '응답 형식 2종 이상 혼합',
    level: formats.size >= 2 ? 'pass' : 'warn',
    itemIds: [],
    basis: BASIS_TABLE,
  });

  // 4) 단위문항당 문항 수 3~5개 (경고)
  const unitBad: string[] = [];
  for (const u of units) {
    const n = items.filter((i) => i.unitId === u.id).length;
    if (n < 3 || n > 5) {
      unitBad.push(...items.filter((i) => i.unitId === u.id).map((i) => i.id));
    }
  }
  results.push({
    id: 'items_per_unit',
    label: '단위문항당 문항 수 3~5개',
    level: units.length === 0 ? 'warn' : unitBad.length ? 'warn' : 'pass',
    itemIds: unitBad,
    basis: BASIS_FRAMEWORK,
  });

  // 5) 구성형 문항의 채점 기준 존재 (오류)
  const codingBad = items
    .filter((i) => i.responseFormat === 'open_human')
    .filter((i) => {
      const codes = i.coding ?? [];
      return !codes.some((c) => c.code === 1 || c.code === 2);
    })
    .map((i) => i.id);
  results.push({
    id: 'coding_exists',
    label: '구성형 문항의 채점 기준(Code 1 또는 2) 존재',
    level: codingBad.length ? 'error' : 'pass',
    itemIds: codingBad,
    basis: BASIS_CODING,
  });

  // 6) 지문 출처 정보 기재 (경고)
  const passagesNoSource = passages.filter((p) => {
    const s = p.source ?? {};
    return !(s.author || s.work || s.publisher || s.year || s.pages);
  });
  results.push({
    id: 'passage_source',
    label: '지문 출처 정보 기재',
    level: passagesNoSource.length ? 'warn' : 'pass',
    itemIds: [],
    basis: BASIS_FRAMEWORK,
  });

  // 7) 연결 규칙의 모든 경로에 문항 존재 (오류)
  const missingPaths = missingRoutePaths(subtest, items);
  results.push({
    id: 'route_coverage',
    label: '연결 규칙의 모든 경로에 문항 존재',
    level: missingPaths.length ? 'error' : 'pass',
    itemIds: [],
    basis: BASIS_MSAT,
  });

  // 8) 각 묶음의 설계 난도와 묶음 수준 일치 (경고)
  const mismatch = blockDifficultyMismatch(items);
  results.push({
    id: 'block_difficulty',
    label: "묶음 수준과 문항 난도 일치(상 묶음에 '하' 문항만 있지 않음)",
    level: mismatch.length ? 'warn' : 'pass',
    itemIds: mismatch,
    basis: BASIS_MSAT,
  });

  // 9) 출처 요구 '다중' 문항이 지문 1개인 단위에 있음 (오류)
  const multiBad: string[] = [];
  for (const it of items) {
    if (it.sourceRequirement !== 'multiple') continue;
    const unit = units.find((u) => u.id === it.unitId);
    if (unit && unit.passageIds.length < 2) multiBad.push(it.id);
  }
  results.push({
    id: 'multi_source',
    label: "출처 요구 '다중' 문항이 지문 1개 단위에 있음",
    level: multiBad.length ? 'error' : 'pass',
    itemIds: multiBad,
    basis: BASIS_FRAMEWORK,
  });

  return results;
}

/** 오류가 하나라도 있으면 true → 활성화 차단 (Req 7.3) */
export function hasBlockingError(results: ConformanceResult[]): boolean {
  return results.some((r) => r.level === 'error');
}
