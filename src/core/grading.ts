// 상/중/하 등급 산출 (design §3.3). 전제/한계: IRT 아님 — 보고서 Ⅶ에 고정 명시.

import type { Item, ResponseRecord, Subtest, Grade, Result } from '../types';
import { responseScore } from './scoring';
import { autoRate, classify } from './routing';
import { groupOfProcess, type ProcessGroupCode } from '../data/taxonomy';

export interface ScoredContext {
  subtest: Subtest;
  items: Item[]; // 응시한 문항 전체(경로상)
  responses: ResponseRecord[];
}

/** 득점비율 합/개수. 미채점 구성형은 제외(채점 완료분만). */
function scoredRate(items: Item[], responses: ResponseRecord[]): { sum: number; total: number } {
  const byId = new Map(responses.map((r) => [r.itemId, r]));
  let sum = 0;
  let total = 0;
  for (const it of items) {
    const r = byId.get(it.id);
    if (!r) continue;
    const s = responseScore(it, r);
    if (s == null) continue; // 미채점 구성형
    sum += s;
    total++;
  }
  return { sum, total };
}

/** 응시 문항에 미채점 구성형(open_human, humanCode 없음)이 있으면 true → 잠정 */
export function hasUngradedOpen(items: Item[], responses: ResponseRecord[]): boolean {
  const byId = new Map(responses.map((r) => [r.itemId, r]));
  return items.some((it) => {
    if (it.responseFormat !== 'open_human') return false;
    const r = byId.get(it.id);
    return !r || r.humanCode == null;
  });
}

/** 인지 과정 대분류별 성취(맞힌 수/전체). 득점비율을 반올림해 '맞힌 수'로 집계. */
export function byProcessGroup(
  items: Item[],
  responses: ResponseRecord[],
): Record<ProcessGroupCode, { correct: number; total: number }> {
  const acc: Record<ProcessGroupCode, { correct: number; total: number }> = {
    locate: { correct: 0, total: 0 },
    understand: { correct: 0, total: 0 },
    evaluate_reflect: { correct: 0, total: 0 },
  };
  const byId = new Map(responses.map((r) => [r.itemId, r]));
  for (const it of items) {
    const g = groupOfProcess(it.cognitiveProcess);
    if (!g) continue;
    const r = byId.get(it.id);
    if (!r) continue;
    const s = responseScore(it, r);
    if (s == null) continue;
    acc[g].total++;
    if (s >= 0.5) acc[g].correct++;
  }
  return acc;
}

/**
 * 최종 등급 계산 (design §3.3).
 * - single: classify(rate(all scored), firstCut)
 * - msat3: 최종(stage2) 묶음 수준 + stage2 정답률 기준
 */
export function computeGrade(
  ctx: ScoredContext,
  finalBlock?: 'low' | 'high', // msat3에서 stage2 묶음 수준
): { grade: Grade; firstGrade: Grade; first: { correct: number; total: number; rate: number } } {
  const { subtest, items, responses } = ctx;

  // 1차 판정은 핵심단계 자동 채점 기준
  const coreItems = items.filter((i) => i.stage === 'core');
  const coreRate = autoRate(coreItems.length ? coreItems : items, responses);
  const firstGrade: Grade = coreRate ? classify(coreRate.rate, subtest.routing.firstCut) : 'low';
  const first = coreRate
    ? { correct: coreRate.correct, total: coreRate.total, rate: coreRate.rate }
    : { correct: 0, total: 0, rate: 0 };

  if (subtest.structure === 'single') {
    const { sum, total } = scoredRate(items, responses);
    const rate = total ? sum / total : 0;
    const grade = classify(rate, subtest.routing.firstCut);
    return { grade, firstGrade, first };
  }

  // msat3
  const stage2Items = items.filter((i) => i.stage === 'stage2');
  const { sum, total } = scoredRate(stage2Items, responses);
  const r = total ? sum / total : 0;
  const rule = subtest.gradeRule;
  let grade: Grade;
  if (finalBlock === 'high') {
    grade = r >= rule.highBlockCut ? 'high' : 'mid';
  } else {
    // low 묶음 (또는 미지정)
    grade = r >= rule.lowBlockCut ? 'mid' : 'low';
  }
  return { grade, firstGrade, first };
}

export type { Result };
