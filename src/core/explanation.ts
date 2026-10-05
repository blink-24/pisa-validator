// 사유 문장 생성 (design §3.4). 템플릿 변수 치환만, 자유 생성 금지 (product steering 5).

import type { Item, ResponseRecord, Subtest, Grade, PathStep } from '../types';
import { byProcessGroup, scoredRate } from './grading';
import { autoRate } from './routing';
import { gradeLabel, processGroupLabel, blockLabel, stageLabel } from '../data/taxonomy';
import type { ProcessGroupCode } from '../data/taxonomy';

export interface ExplanationInput {
  subtest: Subtest;
  items: Item[]; // 응시 문항 전체
  responses: ResponseRecord[];
  grade: Grade;
  firstGrade: Grade;
  provisional: boolean;
  path: PathStep[]; // 세션 경로 기록
}

function pct(n: number): number {
  return Math.round(n * 100);
}

/** 경로 요약: "1단계 상 묶음 → 2단계 상 묶음" */
function summarizePath(path: PathStep[]): string {
  const parts = path
    .filter((p) => p.stage !== 'core')
    .map((p) => `${stageLabel(p.stage)} ${blockLabel(p.block)} 묶음`);
  return parts.join(' → ');
}

/** 보완이 필요한 대분류: 정답률 최저. 동률이면 문항 수가 많은 쪽. 0개 대분류는 제외. */
function weakestGroup(
  groups: Record<ProcessGroupCode, { correct: number; total: number }>,
): ProcessGroupCode | null {
  let best: ProcessGroupCode | null = null;
  let bestRate = Infinity;
  let bestTotal = -1;
  (Object.keys(groups) as ProcessGroupCode[]).forEach((g) => {
    const { correct, total } = groups[g];
    if (total === 0) return;
    const rate = correct / total;
    if (rate < bestRate || (rate === bestRate && total > bestTotal)) {
      best = g;
      bestRate = rate;
      bestTotal = total;
    }
  });
  return best;
}

export function buildExplanation(input: ExplanationInput): string {
  const { subtest, items, responses, grade, firstGrade, provisional, path } = input;
  const lines: string[] = [];

  const prov = provisional ? '(잠정)' : '';
  lines.push(
    `첫 소검사(${subtest.title})에서 '${gradeLabel(grade)}' 등급${prov}을 받았습니다.`,
  );
  lines.push('그 사유는 다음과 같습니다.');

  // ① 핵심단계 1차 판정
  const coreItems = items.filter((i) => i.stage === 'core');
  const coreR = autoRate(coreItems.length ? coreItems : items, responses);
  const hi = pct(subtest.routing.firstCut.high);
  const mid = pct(subtest.routing.firstCut.mid);
  if (coreR) {
    lines.push(
      `① 핵심단계 ${coreR.correct}/${coreR.total}문항(${pct(coreR.rate)}%)을 해결하여 1차로 '${gradeLabel(
        firstGrade,
      )}'(기준: 상 ${hi}% 이상, 중 ${mid}% 이상)으로 판정되었습니다.`,
    );
  }

  // ② 경로 및 최종 묶음
  if (subtest.structure === 'msat3') {
    // 등급 계산(computeGrade)과 같은 집계 함수를 써서 문장과 판정이 어긋나지 않게 한다.
    const stage2Items = items.filter((i) => i.stage === 'stage2');
    const { sum, total } = scoredRate(stage2Items, responses);
    const r2 = total ? sum / total : 0;
    const finalBlock = path.filter((p) => p.stage === 'stage2')[0]?.block;
    const cut = finalBlock === 'high' ? pct(subtest.gradeRule.highBlockCut) : pct(subtest.gradeRule.lowBlockCut);
    lines.push(
      `② 이에 따라 ${summarizePath(path)}으로 응시했고, 최종 묶음에서 ${Math.round(sum)}/${total}문항(${pct(
        r2,
      )}%)을 해결하여 기준(${cut}%)에 따라 '${gradeLabel(grade)}'로 판정되었습니다.`,
    );
  }

  // ③ 인지 과정 대분류별 성취
  const groups = byProcessGroup(items, responses);
  const g3: string[] = [];
  (['locate', 'understand', 'evaluate_reflect'] as ProcessGroupCode[]).forEach((g) => {
    const { correct, total } = groups[g];
    if (total === 0) return; // 0개 대분류는 생략
    g3.push(`${processGroupLabel(g)} ${correct}/${total}`);
  });
  if (g3.length) {
    lines.push(`③ 인지 과정별로는 ${g3.join(', ')}입니다.`);
  }

  // ④ 보완 필요 유형
  const weak = weakestGroup(groups);
  if (weak) {
    lines.push(`④ 정답률이 가장 낮은 '${processGroupLabel(weak)}' 문항 유형의 보완이 필요합니다.`);
  }

  // 등급별 설명문 (있으면)
  const desc = subtest.gradeDescriptors?.[grade];
  if (desc && desc.trim()) {
    lines.push(`[등급 특성] ${desc.trim()}`);
  }

  // 잠정 문구
  if (provisional) {
    lines.push('서술형 문항 채점 후 등급이 확정됩니다.');
  }

  return lines.join('\n');
}
